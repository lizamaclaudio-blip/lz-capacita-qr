export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { nanoid } from "nanoid";
import { createClient } from "@supabase/supabase-js";
import { supabaseServer } from "@/lib/supabase/server";

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
  if (uerr || !u?.user) return { ok: false as const, status: 401, error: "Unauthorized" };

  return { ok: true as const, user: u.user };
}

const BodySchema = z.object({
  data_url: z.string().min(50),
  filename: z.string().min(1).max(200).optional(),
});

function extFromDataUrl(dataUrl: string) {
  // PDF-lib embebe PNG/JPG (WEBP no).
  const m = dataUrl.match(/^data:(image\/(png|jpeg|jpg));base64,/i);
  if (!m) return null;
  const mime = m[1].toLowerCase();
  const ext = mime.includes("png") ? "png" : "jpg";
  return { mime, ext };
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireUser(req);
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const json = await req.json().catch(() => null);
    const parsed = BodySchema.safeParse(json);
    if (!parsed.success) return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });

    const dataUrl = parsed.data.data_url;
    const info = extFromDataUrl(dataUrl);
    if (!info) {
      return NextResponse.json({ error: "Formato inválido. Solo PNG/JPG" }, { status: 400 });
    }

    const parts = dataUrl.split(",");
    if (parts.length < 2) return NextResponse.json({ error: "Data URL inválido" }, { status: 400 });

    const b64 = parts[1] || "";
    if (b64.length > 3_200_000) {
      return NextResponse.json({ error: "Logo demasiado pesado (máx 2MB)." }, { status: 413 });
    }

    const buffer = Buffer.from(b64, "base64");
    const sb = supabaseServer();

    const filePath = `logos/${auth.user.id}/${Date.now()}-${nanoid(8)}.${info.ext}`;

    const up = await sb.storage.from("company-logos").upload(filePath, buffer, {
      contentType: info.mime,
      upsert: true,
    });

    if (up.error) return NextResponse.json({ error: up.error.message }, { status: 500 });

    return NextResponse.json({ logo_path: filePath });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}