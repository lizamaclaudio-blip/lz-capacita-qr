export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseServer } from "@/lib/supabase/server";
import { cleanRut, isValidRut } from "@/lib/rut";

/**
 * GET /api/admin/attendees?code=ABC123&passcode=12345678K
 *
 * Seguridad:
 * - Si viene Bearer token y el usuario es dueño (sessions.owner_id) => OK sin passcode.
 * - Si no viene token => valida passcode (sessions.admin_passcode), fallback opcional ADMIN_PASSCODE.
 */

function getBearer(req: Request) {
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

async function getAuthedUserId(req: Request): Promise<string | null> {
  const token = getBearer(req);
  if (!token) return null;

  const sb = sbAuthed(token);
  const { data, error } = await sb.auth.getUser();
  if (error || !data?.user?.id) return null;
  return data.user.id;
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const code = (url.searchParams.get("code") || "").toUpperCase().trim();
    const passcodeRaw = (url.searchParams.get("passcode") || "").trim();

    if (!code) return NextResponse.json({ error: "Falta code" }, { status: 400 });

    const sb = supabaseServer();

    const { data: session, error: sErr } = await sb
      .from("sessions")
      .select("id, owner_id, code, admin_passcode")
      .eq("code", code)
      .single();

    if (sErr || !session) return NextResponse.json({ error: "Charla no existe" }, { status: 404 });

    // Owner shortcut (optional)
    const authedUserId = await getAuthedUserId(req);
    const isOwner = !!authedUserId && authedUserId === (session as any).owner_id;

    if (!isOwner) {
      // Passcode required
      const expected = (session as any).admin_passcode ? cleanRut(String((session as any).admin_passcode)) : null;
      const provided = cleanRut(passcodeRaw);

      if (expected) {
        if (!passcodeRaw) return NextResponse.json({ error: "Falta passcode (RUT relator)" }, { status: 401 });
        if (!isValidRut(provided)) return NextResponse.json({ error: "RUT/passcode inválido" }, { status: 400 });
        if (provided !== expected) return NextResponse.json({ error: "RUT/passcode incorrecto" }, { status: 401 });
      } else {
        if (!process.env.ADMIN_PASSCODE || passcodeRaw !== process.env.ADMIN_PASSCODE) {
          return NextResponse.json({ error: "Passcode incorrecto (configura sessions.admin_passcode)" }, { status: 401 });
        }
      }
    }

    const { data: attendees, error: aErr } = await sb
      .from("attendees")
      .select("full_name, rut, role, created_at")
      .eq("session_id", (session as any).id)
      .order("created_at", { ascending: true });

    if (aErr) return NextResponse.json({ error: aErr.message }, { status: 500 });

    return NextResponse.json({ ok: true, attendees: attendees ?? [] });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}
