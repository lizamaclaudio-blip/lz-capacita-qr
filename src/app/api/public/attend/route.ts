export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { z } from "zod";
import { nanoid } from "nanoid";
import { supabaseServer } from "@/lib/supabase/server";
import { cleanRut, isValidRut } from "@/lib/rut";

const BodySchema = z.object({
  code: z.string().min(3),
  full_name: z.string().min(3),
  rut: z.string().min(6),
  role: z.string().optional().default(""),
  signature_data_url: z.string().min(20),
});

export async function POST(req: Request) {
  const json = await req.json().catch(() => null);
  const parsed = BodySchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });

  const code = parsed.data.code.toUpperCase().trim();
  const rutClean = cleanRut(parsed.data.rut);

  if (!isValidRut(rutClean)) return NextResponse.json({ error: "RUT inválido" }, { status: 400 });

  const sb = supabaseServer();

  const { data: session, error: sErr } = await sb
    .from("sessions")
    .select("id, status")
    .eq("code", code)
    .single();

  if (sErr || !session) return NextResponse.json({ error: "Charla no existe" }, { status: 404 });
  if (session.status !== "open") return NextResponse.json({ error: "Charla cerrada" }, { status: 403 });

  const parts = parsed.data.signature_data_url.split(",");
  if (parts.length < 2) return NextResponse.json({ error: "Firma inválida" }, { status: 400 });

  const buffer = Buffer.from(parts[1]!, "base64");
  const filePath = `signatures/${code}/${rutClean}-${Date.now()}-${nanoid(6)}.png`;

  const up = await sb.storage.from("assets").upload(filePath, buffer, {
    contentType: "image/png",
    upsert: false,
  });

  if (up.error) return NextResponse.json({ error: up.error.message }, { status: 500 });

  const { error: aErr } = await sb.from("attendees").insert({
    session_id: session.id,
    full_name: parsed.data.full_name,
    rut: rutClean,
    role: parsed.data.role,
    signature_path: filePath,
  });

  if (aErr) {
    if ((aErr as any).code === "23505") {
      return NextResponse.json({ error: "Este RUT ya firmó en esta charla" }, { status: 409 });
    }
    return NextResponse.json({ error: aErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}