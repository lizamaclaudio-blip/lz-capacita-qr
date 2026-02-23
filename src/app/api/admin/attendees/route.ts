export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { cleanRut } from "@/lib/rut";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const code = (url.searchParams.get("code") || "").toUpperCase().trim();
    const passcodeRaw = (url.searchParams.get("passcode") || "").trim();

    if (!code) return NextResponse.json({ error: "Falta code" }, { status: 400 });
    if (!passcodeRaw) return NextResponse.json({ error: "Falta passcode (RUT relator)" }, { status: 401 });

    const sb = supabaseServer();

    // ✅ Traemos todo para no romper si la columna aún no existe
    const { data: session, error: sErr } = await sb
      .from("sessions")
      .select("*, companies(name, address)")
      .eq("code", code)
      .single();

    if (sErr || !session) return NextResponse.json({ error: "Charla no existe" }, { status: 404 });

    const expected = session.admin_passcode ? cleanRut(String(session.admin_passcode)) : null;
    const provided = cleanRut(passcodeRaw);

    // ✅ Si no hay admin_passcode aún, fallback a ADMIN_PASSCODE global (opcional)
    if (expected) {
      if (provided !== expected) return NextResponse.json({ error: "RUT/passcode incorrecto" }, { status: 401 });
    } else {
      if (!process.env.ADMIN_PASSCODE || passcodeRaw !== process.env.ADMIN_PASSCODE) {
        return NextResponse.json({ error: "Passcode incorrecto (configura sessions.admin_passcode)" }, { status: 401 });
      }
    }

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