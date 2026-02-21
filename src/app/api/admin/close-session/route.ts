export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { z } from "zod";
import { nanoid } from "nanoid";
import { createClient } from "@supabase/supabase-js";
import { supabaseServer } from "@/lib/supabase/server";

const BodySchema = z.object({
  // passcode ahora es opcional (si viene bearer, no se necesita)
  passcode: z.string().optional(),
  code: z.string().min(3),
  trainer_signature_data_url: z.string().min(20),
});

function getBearer(req: Request) {
  const auth = req.headers.get("authorization") || "";
  const m = auth.match(/^Bearer\s+(.+)$/i);
  return m?.[1] || null;
}

function parseAdminEmails(): Set<string> {
  const raw = process.env.ADMIN_EMAILS || "";
  return new Set(
    raw
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean)
  );
}

function sbAuthed(token: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(url, anon, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false },
  });
}

/**
 * Autorización:
 * - Si passcode correcto -> ok (service role)
 * - Si bearer token -> ok si:
 *     - email es admin (ADMIN_EMAILS), o
 *     - el usuario tiene acceso por RLS a la sesión (select por token)
 */
async function authorize(req: Request, code: string) {
  const passcode = (await req.clone().json().catch(() => null))?.passcode as string | undefined;

  // 1) passcode
  if (passcode && passcode === process.env.ADMIN_PASSCODE) {
    return { ok: true as const, mode: "passcode" as const, token: null as string | null };
  }

  // 2) bearer
  const token = getBearer(req);
  if (!token) {
    return { ok: false as const, status: 401, error: "Necesitas sesión (login) o passcode" };
  }

  const sb = sbAuthed(token);
  const { data: u, error: uerr } = await sb.auth.getUser();
  if (uerr || !u?.user) {
    return { ok: false as const, status: 401, error: "Sesión inválida" };
  }

  const isAdmin = parseAdminEmails().has((u.user.email || "").toLowerCase());
  if (isAdmin) {
    return { ok: true as const, mode: "bearer_admin" as const, token };
  }

  // No admin: validamos acceso vía RLS (si no puede ver la sesión, no puede cerrarla)
  const { data: s, error: sErr } = await sb
    .from("sessions")
    .select("id")
    .eq("code", code)
    .single();

  if (sErr || !s) {
    return { ok: false as const, status: 403, error: "No tienes acceso a esta charla" };
  }

  return { ok: true as const, mode: "bearer" as const, token };
}

export async function POST(req: Request) {
  const json = await req.json().catch(() => null);
  const parsed = BodySchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });

  const code = parsed.data.code.toUpperCase().trim();

  // ✅ Autorizar (passcode o bearer)
  const auth = await authorize(req, code);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  // Usamos service-role para subir/actualizar (pero ya autorizamos arriba)
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