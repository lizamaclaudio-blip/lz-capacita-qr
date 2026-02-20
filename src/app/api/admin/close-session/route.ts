export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { z } from "zod";
import { nanoid } from "nanoid";
import { supabaseServer } from "@/lib/supabase/server";

const BodySchema = z.object({
  passcode: z.string(),
  code: z.string().min(3),
  trainer_signature_data_url: z.string().min(20),
});

export async function POST(req: Request) {
  const json = await req.json().catch(() => null);
  const parsed = BodySchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });

  if (parsed.data.passcode !== process.env.ADMIN_PASSCODE) {
    return NextResponse.json({ error: "Passcode incorrecto" }, { status: 401 });
  }

  const code = parsed.data.code.toUpperCase().trim();
  const sb = supabaseServer();

  const { data: session, error: sErr } = await sb
    .from("sessions")
    .select("id, status")
    .eq("code", code)
    .single();

  if (sErr || !session) return NextResponse.json({ error: "Charla no existe" }, { status: 404 });
  if (session.status !== "open") return NextResponse.json({ error: "Ya está cerrada" }, { status: 409 });

  const parts = parsed.data.trainer_signature_data_url.split(",");
  if (parts.length < 2) return NextResponse.json({ error: "Firma inválida" }, { status: 400 });

  const buffer = Buffer.from(parts[1]!, "base64");
  const filePath = `trainer-signatures/${code}/${Date.now()}-${nanoid(6)}.png`;

  const up = await sb.storage.from("assets").upload(filePath, buffer, {
    contentType: "image/png",
    upsert: false,
  });

  if (up.error) return NextResponse.json({ error: up.error.message }, { status: 500 });

  const { error: uErr } = await sb
    .from("sessions")
    .update({
      status: "closed",
      closed_at: new Date().toISOString(),
      trainer_signature_path: filePath,
    })
    .eq("id", session.id);

  if (uErr) return NextResponse.json({ error: uErr.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}