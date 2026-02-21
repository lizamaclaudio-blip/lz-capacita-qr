import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

function getToken(req: NextRequest) {
  const auth = req.headers.get("authorization") || "";
  const m = auth.match(/^Bearer\s+(.+)$/i);
  return m?.[1] || null;
}

function sbAuthed(token: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(url, anon, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false },
  });
}

async function requireUser(req: NextRequest) {
  const token = getToken(req);
  if (!token) return { ok: false as const, status: 401, error: "Missing bearer token" };

  const supabase = sbAuthed(token);
  const { data: u, error: uerr } = await supabase.auth.getUser();

  if (uerr || !u?.user) return { ok: false as const, status: 401, error: "Unauthorized" };

  return { ok: true as const, token, supabase, user: u.user };
}

// ✅ Fallback universal: /api/app/companies/<id>/sessions
function companyIdFromReq(req: NextRequest) {
  const parts = req.nextUrl.pathname.split("/").filter(Boolean);
  const idx = parts.indexOf("companies");
  const id = idx >= 0 ? parts[idx + 1] : null;
  return id && id !== "companies" ? id : null;
}

function resolveCompanyId(req: NextRequest, ctx?: any) {
  const fromParams = ctx?.params?.companyId;
  if (typeof fromParams === "string" && fromParams) return fromParams;
  return companyIdFromReq(req);
}

function genCode(len = 6) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < len; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return out;
}

export async function GET(req: NextRequest, ctx?: any) {
  try {
    const companyId = resolveCompanyId(req, ctx);
    if (!companyId) return NextResponse.json({ error: "Missing companyId" }, { status: 400 });

    const auth = await requireUser(req);
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const { data, error } = await auth.supabase
      .from("sessions")
      .select("*")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ sessions: data ?? [] });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest, ctx?: any) {
  try {
    const companyId = resolveCompanyId(req, ctx);
    if (!companyId) return NextResponse.json({ error: "Missing companyId" }, { status: 400 });

    const auth = await requireUser(req);
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const body = await req.json().catch(() => ({}));

    const topic = typeof body.topic === "string" ? body.topic.trim() : "";
    const trainer_name = typeof body.trainer_name === "string" ? body.trainer_name.trim() : "";

    if (!topic || !trainer_name) {
      return NextResponse.json({ error: "topic y trainer_name son obligatorios" }, { status: 400 });
    }

    const location = typeof body.location === "string" ? body.location.trim() : null;
    const session_date = typeof body.session_date === "string" ? body.session_date : null;

    // code único (simple)
    let code = genCode(6);
    for (let i = 0; i < 3; i++) {
      const { count } = await auth.supabase
        .from("sessions")
        .select("id", { count: "exact", head: true })
        .eq("code", code);
      if ((count ?? 0) === 0) break;
      code = genCode(6);
    }

    const { data, error } = await auth.supabase
      .from("sessions")
      .insert({
        company_id: companyId,
        code,
        topic,
        location,
        session_date,
        trainer_name,
        status: "open",
      })
      .select("*")
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    return NextResponse.json({ session: data, code: data.code });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}