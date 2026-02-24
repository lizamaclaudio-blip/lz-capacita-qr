import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { randomUUID } from "crypto";
import { supabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const BodySchema = z.object({
  data_url: z.string().min(50),
});

function getToken(req: NextRequest) {
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

async function requireUser(req: NextRequest) {
  const token = getToken(req);
  if (!token) return { ok: false as const, status: 401, error: "Missing bearer token" };

  const supabase = sbAuthed(token);
  const { data: u, error: uerr } = await supabase.auth.getUser();

  if (uerr || !u?.user) {
    return { ok: false as const, status: 401, error: "Unauthorized" };
  }

  return { ok: true as const, user: u.user };
}

function parseDataUrl(dataUrl: string) {
  // Aceptamos solo PNG y JPG/JPEG (PDF-lib no maneja WEBP fácilmente)
  const m = dataUrl.match(/^data:(image\/png|image\/jpeg|image\/jpg);base64,(.+)$/i);
  if (!m) return null;

  const mime = m[1].toLowerCase();
  const b64 = m[2] || "";
  const ext = mime.includes("png") ? "png" : "jpg";

  return { mime, b64, ext };
}

export async function POST(req: NextRequest) {
  try {
    const parsed = BodySchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });

    const auth = await requireUser(req);
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const info = parseDataUrl(parsed.data.data_url);
    if (!info) {
      return NextResponse.json({ error: "Formato inválido. Solo PNG/JPG" }, { status: 400 });
    }

    // Límite tamaño (2MB aprox, base64 es más grande, por eso validamos buffer)
    const buffer = Buffer.from(info.b64, "base64");
    if (buffer.byteLength > 2_000_000) {
      return NextResponse.json({ error: "Logo demasiado pesado (máx 2MB)" }, { status: 413 });
    }

    // Subimos con server client (usa service role si está disponible en server.ts)
    const sb = supabaseServer();

    const filePath = `logos/${auth.user.id}/${Date.now()}-${randomUUID()}.${info.ext}`;

    const { error: upErr } = await sb.storage.from("company-logos").upload(filePath, buffer, {
      contentType: info.mime,
      upsert: true,
    });

    if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });

    // Devolvemos path relativo al bucket (sin "company-logos/")
    return NextResponse.json({ ok: true, logo_path: filePath });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}