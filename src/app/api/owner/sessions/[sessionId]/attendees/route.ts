export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

function getBearer(req: NextRequest) {
  const auth = req.headers.get("authorization") || "";
  const m = auth.match(/^Bearer\s+(.+)$/i);
  return m?.[1] || null;
}

function ownerSet() {
  return new Set(
    (process.env.OWNER_EMAILS || "")
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean)
  );
}

async function requireOwner(req: NextRequest) {
  const token = getBearer(req);
  if (!token) return { ok: false as const, status: 401, error: "Missing bearer token" };

  const sb = supabaseAdmin();
  const { data, error } = await sb.auth.getUser(token);
  if (error || !data?.user?.email) return { ok: false as const, status: 401, error: "Unauthorized" };

  const owners = ownerSet();
  if (owners.size === 0) return { ok: false as const, status: 500, error: "Missing OWNER_EMAILS" };
  if (!owners.has(data.user.email.toLowerCase())) return { ok: false as const, status: 403, error: "Not owner" };

  return { ok: true as const };
}

export async function GET(req: NextRequest, ctx: { params: { sessionId: string } }) {
  try {
    const auth = await requireOwner(req);
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const sessionId = ctx.params.sessionId;
    if (!sessionId) return NextResponse.json({ error: "Missing sessionId" }, { status: 400 });

    const sb = supabaseAdmin();

    const { data: session, error: sErr } = await sb
      .from("sessions")
      .select("id,code,topic,trainer_name,status,created_at,companies(name)")
      .eq("id", sessionId)
      .single();

    if (sErr || !session) return NextResponse.json({ error: sErr?.message || "Session not found" }, { status: 404 });

    const { data: attendees, error: aErr } = await sb
      .from("attendees")
      .select("full_name,rut,role,created_at,signature_path")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: true });

    if (aErr) return NextResponse.json({ error: aErr.message }, { status: 500 });

    return NextResponse.json({
      ok: true,
      session: {
        ...session,
        companies: Array.isArray((session as any).companies) ? (session as any).companies[0] : (session as any).companies,
      },
      attendees: attendees ?? [],
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}