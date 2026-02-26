export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { z } from "zod";
import { nanoid } from "nanoid";
import { createClient } from "@supabase/supabase-js";
import { supabaseServer } from "@/lib/supabase/server";
import { cleanRut, isValidRut } from "@/lib/rut";

/**
 * POST /api/admin/close-session
 * Body: { code, passcode, trainer_signature_data_url }
 *
 * Seguridad:
 * - Si viene Bearer token y el usuario es dueño (sessions.owner_id) => OK sin passcode.
 * - Si no viene token => valida passcode (sessions.admin_passcode), fallback opcional ADMIN_PASSCODE.
 */

const BodySchema = z.object({
  code: z.string().min(3),
  passcode: z.string().min(0).optional().default(""),
  trainer_signature_data_url: z.string().min(20),
});

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

function parseDataUrlPng(dataUrl: string) {
  const parts = String(dataUrl || "").split(",");
  if (parts.length < 2) return null;

  const head = parts[0] || "";
  if (!head.includes("image/png")) return null;

  const b64 = parts[1] || "";
  if (!b64) return null;

  return Buffer.from(b64, "base64");
}

export async function POST(req: Request) {
  try {
    const parsed = BodySchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });

    const code = parsed.data.code.toUpperCase().trim();
    const passcodeRaw = (parsed.data.passcode || "").trim();
    const signatureDataUrl = parsed.data.trainer_signature_data_url;

    const sb = supabaseServer();

    const { data: session, error: sErr } = await sb
      .from("sessions")
      .select("id, owner_id, code, status, closed_at, admin_passcode")
      .eq("code", code)
      .single();

    if (sErr || !session) return NextResponse.json({ error: "Charla no existe" }, { status: 404 });

    // If already closed, return 409 (client shows it).
    const st = String((session as any).status ?? "").toLowerCase();
    if (st && st !== "open") return NextResponse.json({ error: "Ya está cerrada" }, { status: 409 });

    // Owner shortcut (optional)
    const authedUserId = await getAuthedUserId(req);
    const isOwner = !!authedUserId && authedUserId === (session as any).owner_id;

    if (!isOwner) {
      // Passcode required
      const expected = (session as any).admin_passcode ? cleanRut(String((session as any).admin_passcode)) : null;
      const provided = cleanRut(passcodeRaw);

      // If session has admin_passcode, we validate as RUT
      if (expected) {
        if (!isValidRut(provided)) {
          return NextResponse.json({ error: "RUT/passcode inválido" }, { status: 400 });
        }
        if (provided !== expected) return NextResponse.json({ error: "RUT/passcode incorrecto" }, { status: 401 });
      } else {
        // Fallback optional while migrating old sessions
        if (!process.env.ADMIN_PASSCODE || passcodeRaw !== process.env.ADMIN_PASSCODE) {
          return NextResponse.json({ error: "Passcode incorrecto (configura sessions.admin_passcode)" }, { status: 401 });
        }
      }
    }

    const buffer = parseDataUrlPng(signatureDataUrl);
    if (!buffer) return NextResponse.json({ error: "Firma inválida (se requiere PNG)" }, { status: 400 });

    const trainerSigPath = `trainer-signatures/${code}/${Date.now()}-${nanoid(6)}.png`;

    const upSig = await sb.storage.from("assets").upload(trainerSigPath, buffer, {
      contentType: "image/png",
      upsert: false,
    });

    if (upSig.error) return NextResponse.json({ error: upSig.error.message }, { status: 500 });

    const nowIso = new Date().toISOString();
    const { error: closeErr } = await sb
      .from("sessions")
      .update({
        status: "closed",
        closed_at: nowIso,
        trainer_signature_path: trainerSigPath,
      })
      .eq("id", (session as any).id);

    if (closeErr) return NextResponse.json({ error: closeErr.message }, { status: 500 });

    return NextResponse.json({ ok: true, closed_at: nowIso, trainer_signature_path: trainerSigPath });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}
