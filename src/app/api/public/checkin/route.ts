export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { z } from "zod";
import { nanoid } from "nanoid";
import { supabaseServer } from "@/lib/supabase/server";

const BodySchema = z.object({
  code: z.string().min(3),
  full_name: z.string().min(3),
  rut: z.string().min(3),
  role: z.string().optional().nullable(),
  signature_data_url: z.string().min(50),
});

function normalizeRut(rut: string) {
  return String(rut ?? "").replace(/[^0-9kK]/g, "").toUpperCase();
}

export async function POST(req: Request) {
  try {
    const json = await req.json().catch(() => null);
    const parsed = BodySchema.safeParse(json);
    if (!parsed.success) return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });

    const code = parsed.data.code.trim().toUpperCase();
    const full_name = parsed.data.full_name.trim();
    const rut = normalizeRut(parsed.data.rut);
    const role = parsed.data.role ? String(parsed.data.role).trim() : null;

    const sb = supabaseServer();

    // 1) Buscar sesión por code (case-insensitive)
    const { data: session, error: sErr } = await sb
      .from("sessions")
      .select("id,status,code")
      .ilike("code", code)
      .single();

    if (sErr || !session) return NextResponse.json({ error: "Charla no existe" }, { status: 404 });
    if (session.status !== "open") {
      return NextResponse.json(
        { error: "Esta charla está cerrada. No se puede registrar asistencia." },
        { status: 409 }
      );
    }

    // 2) Evitar duplicado por RUT
    const { data: existing } = await sb
      .from("attendees")
      .select("id")
      .eq("session_id", session.id)
      .eq("rut", rut)
      .maybeSingle();

    if (existing?.id) {
      return NextResponse.json({ error: "Este RUT ya fue registrado en esta charla." }, { status: 409 });
    }

    // 3) Base64 → PNG
    const parts = parsed.data.signature_data_url.split(",");
    if (parts.length < 2) return NextResponse.json({ error: "Firma inválida" }, { status: 400 });

    const b64 = parts[1]!;
    if (b64.length > 3_000_000) {
      return NextResponse.json({ error: "Firma demasiado pesada. Firma más pequeño." }, { status: 413 });
    }

    const buffer = Buffer.from(b64, "base64");
    const filePath = `attendee-signatures/${session.code}/${Date.now()}-${nanoid(6)}.png`;

    const up = await sb.storage.from("assets").upload(filePath, buffer, {
      contentType: "image/png",
      upsert: false,
    });
    if (up.error) return NextResponse.json({ error: up.error.message }, { status: 500 });

    // 4) Insert
    const { data: ins, error: iErr } = await sb
      .from("attendees")
      .insert({
        session_id: session.id,
        full_name,
        rut,
        role,
        signature_path: filePath,
      })
      .select("id,created_at")
      .single();

    if (iErr) return NextResponse.json({ error: iErr.message }, { status: 500 });

    return NextResponse.json({ ok: true, attendee: ins });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}