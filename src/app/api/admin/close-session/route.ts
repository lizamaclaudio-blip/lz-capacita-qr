export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { z } from "zod";
import { nanoid } from "nanoid";
import { supabaseServer } from "@/lib/supabase/server";
import { cleanRut } from "@/lib/rut";

const BodySchema = z.object({
  passcode: z.string().min(3),
  code: z.string().min(3),
  trainer_signature_data_url: z.string().min(20),
});

export async function POST(req: Request) {
  try {
    const json = await req.json().catch(() => null);
    const parsed = BodySchema.safeParse(json);
    if (!parsed.success) return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });

    const code = parsed.data.code.toUpperCase().trim();
    const passcodeRaw = parsed.data.passcode.trim();

    const sb = supabaseServer();

    const { data: session, error: sErr } = await sb
      .from("sessions")
      .select("*")
      .eq("code", code)
      .single();

    if (sErr || !session) return NextResponse.json({ error: "Charla no existe" }, { status: 404 });

    const expected = session.admin_passcode ? cleanRut(String(session.admin_passcode)) : null;
    const provided = cleanRut(passcodeRaw);

    if (expected) {
      if (provided !== expected) return NextResponse.json({ error: "RUT/passcode incorrecto" }, { status: 401 });
    } else {
      if (!process.env.ADMIN_PASSCODE || passcodeRaw !== process.env.ADMIN_PASSCODE) {
        return NextResponse.json({ error: "Passcode incorrecto (configura sessions.admin_passcode)" }, { status: 401 });
      }
    }

    const st = String(session.status ?? "").toLowerCase();
    if (st && st !== "open") return NextResponse.json({ error: "Ya está cerrada" }, { status: 409 });

    const parts = parsed.data.trainer_signature_data_url.split(",");
    if (parts.length < 2) return NextResponse.json({ error: "Firma inválida" }, { status: 400 });

    const b64 = parts[1]!;
    const buffer = Buffer.from(b64, "base64");
    const trainerSigPath = `trainer-signatures/${code}/${Date.now()}-${nanoid(6)}.png`;

    const upSig = await sb.storage.from("assets").upload(trainerSigPath, buffer, {
      contentType: "image/png",
      upsert: false,
    });

    if (upSig.error) return NextResponse.json({ error: upSig.error.message }, { status: 500 });

    const { error: closeErr } = await sb
      .from("sessions")
      .update({
        status: "closed",
        closed_at: new Date().toISOString(),
        trainer_signature_path: trainerSigPath,
      })
      .eq("id", session.id);

    if (closeErr) return NextResponse.json({ error: closeErr.message }, { status: 500 });

    return NextResponse.json({ ok: true, trainer_signature_path: trainerSigPath });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}