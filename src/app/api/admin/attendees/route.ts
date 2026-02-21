export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

function getBearer(req: NextRequest) {
  const auth = req.headers.get("authorization") || "";
  const m = auth.match(/^Bearer\s+(.+)$/i);
  return m?.[1] || null;
}

function adminSet(): Set<string> {
  return new Set(
    (process.env.ADMIN_EMAILS || "")
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean)
  );
}

async function requireAdmin(req: NextRequest) {
  const token = getBearer(req);
  if (!token) return { ok: false as const, status: 401, error: "Debes iniciar sesión." };

  const admins = adminSet();
  if (admins.size === 0) return { ok: false as const, status: 500, error: "Falta ADMIN_EMAILS en env." };

  const sb = supabaseServer();
  const { data, error } = await sb.auth.getUser(token);
  if (error || !data?.user?.email) return { ok: false as const, status: 401, error: "Sesión inválida." };

  const email = data.user.email.toLowerCase();
  if (!admins.has(email)) return { ok: false as const, status: 403, error: "No autorizado (email no permitido)." };

  return { ok: true as const, email };
}

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const code = (url.searchParams.get("code") || "").toUpperCase().trim();
    if (!code) return NextResponse.json({ error: "Falta code" }, { status: 400 });

    const auth = await requireAdmin(req);
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const sb = supabaseServer();

    const { data: session, error: sErr } = await sb
      .from("sessions")
      .select("id, code, topic, location, trainer_name, status, closed_at, trainer_signature_path, companies(name, address)")
      .eq("code", code)
      .single();

    if (sErr || !session) return NextResponse.json({ error: "Charla no existe" }, { status: 404 });

    const { data: attendees, error: aErr } = await sb
      .from("attendees")
      .select("full_name, rut, role, created_at")
      .eq("session_id", session.id)
      .order("created_at", { ascending: true });

    if (aErr) return NextResponse.json({ error: aErr.message }, { status: 500 });

    return NextResponse.json({ session, attendees });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}