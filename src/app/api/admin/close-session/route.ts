export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { nanoid } from "nanoid";
import { supabaseServer } from "@/lib/supabase/server";

const BodySchema = z.object({
  passcode: z.string().optional().nullable(),
  code: z.string().min(3),
  trainer_signature_data_url: z.string().min(20),
});

function getBearer(req: NextRequest) {
  const auth = req.headers.get("authorization") || "";
  const m = auth.match(/^Bearer\s+(.+)$/i);
  return m?.[1] || null;
}

function adminEmails() {
  return (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

async function isAdminByBearer(req: NextRequest) {
  const token = getBearer(req);
  if (!token) return false;

  const sb = supabaseServer();
  const { data, error } = await sb.auth.getUser(token);
  if (error || !data?.user?.email) return false;

  return adminEmails().includes(data.user.email.toLowerCase());
}

async function requireAdmin(req: NextRequest, passcode?: string | null) {
  // 1) Passcode
  const pc = String(passcode || "");
  if (process.env.ADMIN_PASSCODE && pc && pc === process.env.ADMIN_PASSCODE) {
    return { ok: true as const, mode: "passcode" as const };
  }

  // 2) Bearer admin
  if (await isAdminByBearer(req)) {
    return { ok: true as const, mode: "bearer_admin" as const };
  }

  return { ok: false as const, status: 401, error: "No autorizado (passcode o admin bearer)" };
}

export async function POST(req: NextRequest) {
  try {
    const json = await req.json().catch(() => null);
    const parsed = BodySchema.safeParse(json);
    if (!parsed.success) return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });

    const code = parsed.data.code.toUpperCase().trim();

    const auth = await requireAdmin(req, parsed.data.passcode);
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const sb = supabaseServer();

    // 1) buscar sesión
    const { data: session, error: sErr } = await sb
      .from("sessions")
      .select("id, status, code")
      .eq("code", code)
      .maybeSingle();

    if (sErr) return NextResponse.json({ error: sErr.message }, { status: 500 });
    if (!session) return NextResponse.json({ error: "Charla no existe" }, { status: 404 });

    const st = String(session.status ?? "").toLowerCase();
    if (st && st !== "open") return NextResponse.json({ error: "Ya está cerrada" }, { status: 409 });

    // 2) subir firma relator
    const parts = parsed.data.trainer_signature_data_url.split(",");
    if (parts.length < 2) return NextResponse.json({ error: "Firma inválida" }, { status: 400 });

    const b64 = parts[1]!;
    if (b64.length > 3_000_000) {
      return NextResponse.json({ error: "Firma demasiado pesada" }, { status: 413 });
    }

    const buffer = Buffer.from(b64, "base64");
    const trainerSigPath = `trainer-signatures/${code}/${Date.now()}-${nanoid(6)}.png`;

    const upSig = await sb.storage.from("assets").upload(trainerSigPath, buffer, {
      contentType: "image/png",
      upsert: false,
    });

    if (upSig.error) return NextResponse.json({ error: upSig.error.message }, { status: 500 });

    // 3) cerrar sesión
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