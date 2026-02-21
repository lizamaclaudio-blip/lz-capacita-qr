export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { nanoid } from "nanoid";
import { supabaseServer } from "@/lib/supabase/server";

const BodySchema = z.object({
  code: z.string().min(3),
  trainer_signature_data_url: z.string().min(20),
});

function getBearer(req: NextRequest) {
  const auth = req.headers.get("authorization") || "";
  const m = auth.match(/^Bearer\s+(.+)$/i);
  return m?.[1] || null;
}

function adminSet(): Set<string> {
  return new Set(
    (process.env.ADMIN_EMAILS || "")
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean)
  );
}

async function requireAdmin(req: NextRequest) {
  const token = getBearer(req);
  if (!token) return { ok: false as const, status: 401, error: "Debes iniciar sesión." };

  const admins = adminSet();
  if (admins.size === 0) return { ok: false as const, status: 500, error: "Falta ADMIN_EMAILS en env." };

  const sb = supabaseServer();
  const { data, error } = await sb.auth.getUser(token);
  if (error || !data?.user?.email) return { ok: false as const, status: 401, error: "Sesión inválida." };

  const email = data.user.email.toLowerCase();
  if (!admins.has(email)) return { ok: false as const, status: 403, error: "No autorizado (email no permitido)." };

  return { ok: true as const, email };
}

export async function POST(req: NextRequest) {
  try {
    const json = await req.json().catch(() => null);
    const parsed = BodySchema.safeParse(json);
    if (!parsed.success) return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });

    const auth = await requireAdmin(req);
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const code = parsed.data.code.toUpperCase().trim();
    const sb = supabaseServer();

    const { data: session, error: sErr } = await sb
      .from("sessions")
      .select("id, status, code")
      .eq("code", code)
      .maybeSingle();

    if (sErr) return NextResponse.json({ error: sErr.message }, { status: 500 });
    if (!session) return NextResponse.json({ error: "Charla no existe" }, { status: 404 });

    const st = String(session.status ?? "").toLowerCase();
    if (st && st !== "open") return NextResponse.json({ error: "Ya está cerrada" }, { status: 409 });

    const parts = parsed.data.trainer_signature_data_url.split(",");
    if (parts.length < 2) return NextResponse.json({ error: "Firma inválida" }, { status: 400 });

    const b64 = parts[1]!;
    const buffer = Buffer.from(b64, "base64");
    const trainerSigPath = `trainer-signatures/${code}/${Date.now()}-${nanoid(6)}.png`;

    const up = await sb.storage.from("assets").upload(trainerSigPath, buffer, {
      contentType: "image/png",
      upsert: false,
    });

    if (up.error) return NextResponse.json({ error: up.error.message }, { status: 500 });

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