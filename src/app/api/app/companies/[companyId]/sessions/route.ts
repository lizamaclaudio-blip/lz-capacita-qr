import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import crypto from "node:crypto";

export const runtime = "nodejs";
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

function getCompanyId(ctx: any): string | null {
  const companyId = ctx?.params?.companyId;
  if (!companyId || typeof companyId !== "string") return null;
  return companyId;
}

async function requireUser(req: NextRequest) {
  const token = getToken(req);
  if (!token) return { ok: false as const, status: 401, error: "Missing bearer token" };

  const supabase = sbAuthed(token);
  const { data: u, error: uerr } = await supabase.auth.getUser(token);

  if (uerr || !u?.user) return { ok: false as const, status: 401, error: "Unauthorized" };

  return { ok: true as const, token, supabase, user: u.user };
}

async function generateUniqueCode(supabase: ReturnType<typeof sbAuthed>) {
  // 6 chars base32-ish
  for (let i = 0; i < 8; i++) {
    const raw = crypto.randomBytes(4).toString("hex").toUpperCase(); // 8 hex
    const code = raw.slice(0, 6);

    const { data, error } = await supabase
      .from("sessions")
      .select("id")
      .eq("code", code)
      .maybeSingle();

    if (error) continue;
    if (!data) return code;
  }
  // fallback
  return crypto.randomBytes(6).toString("hex").toUpperCase().slice(0, 6);
}

export async function GET(req: NextRequest, ctx?: any) {
  try {
    const companyId = getCompanyId(ctx);
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
    const companyId = getCompanyId(ctx);
    if (!companyId) return NextResponse.json({ error: "Missing companyId" }, { status: 400 });

    const auth = await requireUser(req);
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const body = await req.json().catch(() => ({}));

    const topic = typeof body.topic === "string" ? body.topic.trim() : "";
    const trainer_name = typeof body.trainer_name === "string" ? body.trainer_name.trim() : "";
    const location = typeof body.location === "string" && body.location.trim() ? body.location.trim() : null;
    const session_date = typeof body.session_date === "string" && body.session_date ? body.session_date : null;

    if (!topic) return NextResponse.json({ error: "topic es obligatorio" }, { status: 400 });
    if (!trainer_name) return NextResponse.json({ error: "trainer_name es obligatorio" }, { status: 400 });

    const code = await generateUniqueCode(auth.supabase);

    const insertRow: any = {
      company_id: companyId,
      code,
      topic,
      location,
      trainer_name,
      session_date,
      status: "open",
    };

    const { data, error } = await auth.supabase
      .from("sessions")
      .insert(insertRow)
      .select("*")
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    return NextResponse.json({ session: data });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}