export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { z } from "zod";
import { nanoid } from "nanoid";
import { supabaseServer } from "@/lib/supabase/server";
import { cleanRut, isValidRut } from "@/lib/rut";

const BodySchema = z.object({
  code: z.string().min(3),
  full_name: z.string().min(3),
  rut: z.string().min(6),
  role: z.string().optional().nullable(),
  signature_data_url: z.string().min(50),
});

function isPngHeader(buf: Buffer) {
  if (buf.length < 8) return false;
  const pngHeader = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  return buf.subarray(0, 8).equals(pngHeader);
}

export async function POST(req: Request) {
  try {
    const json = await req.json().catch(() => null);
    const parsed = BodySchema.safeParse(json);
    if (!parsed.success) return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });

    const code = parsed.data.code.trim().toUpperCase();
    const full_name = parsed.data.full_name.trim();
    const rutClean = cleanRut(parsed.data.rut);
    const role = parsed.data.role ? String(parsed.data.role).trim() : null;

    if (!code) return NextResponse.json({ error: "Código inválido" }, { status: 400 });
    if (!full_name || full_name.length < 3) {
      return NextResponse.json({ error: "Nombre inválido" }, { status: 400 });
    }

    if (!rutClean || !isValidRut(rutClean)) {
      return NextResponse.json({ error: "RUT inválido (dígito verificador incorrecto)" }, { status: 400 });
    }

    // Firma: debe ser PNG dataURL
    const sig = parsed.data.signature_data_url;
    const m = sig.match(/^data:image\/png;base64,(.+)$/i);
    if (!m) {
      return NextResponse.json({ error: "Firma inválida (formato). Firma debe ser PNG." }, { status: 400 });
    }

    const b64 = m[1] || "";
    if (!b64 || b64.length < 50) {
      return NextResponse.json({ error: "Firma inválida (vacía)." }, { status: 400 });
    }

    // base64 puede ser grande; validamos buffer final
    const buffer = Buffer.from(b64, "base64");
    if (buffer.byteLength > 2_000_000) {
      return NextResponse.json({ error: "Firma demasiado pesada (máx 2MB). Firma más pequeño." }, { status: 413 });
    }

    // Evitar firmas "vacías": png muy chico o header inválido
    if (buffer.byteLength < 300) {
      return NextResponse.json({ error: "Firma demasiado pequeña. Firma nuevamente." }, { status: 400 });
    }
    if (!isPngHeader(buffer)) {
      return NextResponse.json({ error: "Firma inválida (archivo PNG corrupto)." }, { status: 400 });
    }

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
      .eq("rut", rutClean)
      .maybeSingle();

    if (existing?.id) {
      return NextResponse.json({ error: "Este RUT ya fue registrado en esta charla." }, { status: 409 });
    }

    // 3) Upload firma
    const filePath = `attendee-signatures/${session.code}/${rutClean}-${Date.now()}-${nanoid(6)}.png`;

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
        rut: rutClean,
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