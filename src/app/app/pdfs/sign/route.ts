import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const PDF_BUCKET = "assets"; // <-- si tu bucket es otro, cámbialo aquí
const EXPIRES_SECONDS = 60 * 60; // 1 hora

export async function POST(req: Request) {
  try {
    if (!SUPABASE_URL || !SUPABASE_ANON) {
      return NextResponse.json({ error: "Supabase env vars missing" }, { status: 500 });
    }

    const auth = req.headers.get("authorization") || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;

    if (!token) {
      return NextResponse.json({ error: "Missing bearer token" }, { status: 401 });
    }

    const body = await req.json().catch(() => null);
    const pdf_path = typeof body?.pdf_path === "string" ? body.pdf_path.trim() : "";

    if (!pdf_path) {
      return NextResponse.json({ error: "pdf_path is required" }, { status: 400 });
    }

    // Evitar que pasen URLs completas por accidente
    if (pdf_path.startsWith("http://") || pdf_path.startsWith("https://")) {
      return NextResponse.json({ error: "pdf_path must be a storage path, not a full URL" }, { status: 400 });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON, {
      global: {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    });

    const { data, error } = await supabase.storage.from(PDF_BUCKET).createSignedUrl(pdf_path, EXPIRES_SECONDS);

    if (error || !data?.signedUrl) {
      return NextResponse.json({ error: error?.message || "Failed to sign URL" }, { status: 400 });
    }

    return NextResponse.json({ ok: true, signed_url: data.signedUrl });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Unexpected error" }, { status: 500 });
  }
}