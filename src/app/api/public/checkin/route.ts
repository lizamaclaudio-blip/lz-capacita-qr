export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { z } from "zod";
import { nanoid } from "nanoid";
import { createClient } from "@supabase/supabase-js";

const BodySchema = z.object({
  code: z.string().min(3),
  full_name: z.string().min(3),
  rut: z.string().min(3),
  role: z.string().nullable().optional(),
  signature_data_url: z.string().min(20),
});

function sbAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, service, { auth: { persistSession: false } });
}

export async function POST(req: Request) {
  const json = await req.json().catch(() => null);
  const parsed = BodySchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });

  const sb = sbAdmin();
  const code = parsed.data.code.toUpperCase().trim();

  // 1) Buscar sesión
  const { data: session, error: sErr } = await sb
    .from("sessions")
    .select("id, status, closed_at")
    .eq("code", code)
    .maybeSingle();

  if (sErr) return NextResponse.json({ error: sErr.message }, { status: 500 });
  if (!session) return NextResponse.json({ error: "Charla no existe" }, { status: 404 });

  const st = (session.status ?? "").toString().toLowerCase();
  const isClosed = st === "closed" || !!session.closed_at;
  if (isClosed) return NextResponse.json({ error: "Esta charla está cerrada" }, { status: 409 });

  // 2) Subir firma a Storage
  const parts = parsed.data.signature_data_url.split(",");
  if (parts.length < 2) return NextResponse.json({ error: "Firma inválida" }, { status: 400 });

  const buffer = Buffer.from(parts[1]!, "base64");
  const sigPath = `attendee-signatures/${code}/${Date.now()}-${nanoid(6)}.png`;

  const up = await sb.storage.from("assets").upload(sigPath, buffer, {
    contentType: "image/png",
    upsert: false,
  });

  if (up.error) return NextResponse.json({ error: up.error.message }, { status: 500 });

  // 3) Insertar asistente
  const ins = await sb.from("attendees").insert({
    session_id: session.id,
    full_name: parsed.data.full_name.trim(),
    rut: parsed.data.rut.trim(),
    role: parsed.data.role?.trim() || null,
    signature_path: sigPath,
  });

  if (ins.error) return NextResponse.json({ error: ins.error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}