export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseServer } from "@/lib/supabase/server";
import { cleanRut } from "@/lib/rut";

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

function normalizeCompany(session: any) {
  const c = session?.companies;
  return Array.isArray(c) ? c[0] : c;
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const code = (url.searchParams.get("code") || "").toUpperCase().trim();
    const passcodeRaw = (url.searchParams.get("passcode") || "").trim();

    if (!code) return NextResponse.json({ error: "Falta code" }, { status: 400 });

    const sb = supabaseServer();

    // Traemos sesión + empresa (incluye owner_id para validar si está logueado)
    const { data: session, error: sErr } = await sb
      .from("sessions")
      .select("*, companies(owner_id, name, address, legal_name, rut, logo_path)")
      .eq("code", code)
      .single();

    if (sErr || !session) return NextResponse.json({ error: "Charla no existe" }, { status: 404 });

    // ✅ 1) Si viene Bearer token y el usuario es dueño de la empresa => NO pide passcode
    const authedUserId = await getAuthedUserId(req);
    const company = normalizeCompany(session);
    const ownerId = company?.owner_id ?? null;

    const isOwner = !!authedUserId && !!ownerId && authedUserId === ownerId;

    if (!isOwner) {
      // ✅ 2) Si NO es owner (o no está logueado), mantiene la seguridad por passcode
      if (!passcodeRaw) {
        return NextResponse.json({ error: "Falta passcode (RUT relator)" }, { status: 401 });
      }

      const expected = session.admin_passcode ? cleanRut(String(session.admin_passcode)) : null;
      const provided = cleanRut(passcodeRaw);

      // Si no hay admin_passcode aún, fallback a ADMIN_PASSCODE global (opcional)
      if (expected) {
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
      .eq("session_id", session.id)
      .order("created_at", { ascending: true });

    if (aErr) return NextResponse.json({ error: aErr.message }, { status: 500 });

    return NextResponse.json({ session, attendees });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}