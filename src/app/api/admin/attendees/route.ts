export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = (url.searchParams.get("code") || "").toUpperCase().trim();
  const passcode = (url.searchParams.get("passcode") || "").trim();

  if (!code) return NextResponse.json({ error: "Falta code" }, { status: 400 });

  if (passcode !== process.env.ADMIN_PASSCODE) {
    return NextResponse.json({ error: "Passcode incorrecto" }, { status: 401 });
  }

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
}