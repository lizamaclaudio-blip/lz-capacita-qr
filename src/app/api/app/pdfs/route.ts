export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseServer } from "@/lib/supabase/server";

/**
 * GET /api/app/pdfs
 * - Requiere Bearer token
 * - Devuelve PDFs (sessions con pdf_path) del owner_id = user.id
 * - Incluye signed_url (1 hora) para abrir/copiar desde dashboard
 */

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

export async function GET(req: NextRequest) {
  try {
    const auth = await requireUser(req);
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    // Service role (server) => firmamos URLs aunque el bucket sea privado.
    const sb = supabaseServer();

    const { data, error } = await sb
      .from("sessions")
      .select(
        "id, owner_id, company_id, code, topic, session_date, trainer_name, pdf_path, pdf_generated_at, companies(name,address,logo_path)"
      )
      .eq("owner_id", auth.user.id)
      .not("pdf_path", "is", null)
      .order("pdf_generated_at", { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    const rows = (data ?? []).map((r: any) => ({
      ...r,
      companies: Array.isArray(r.companies) ? r.companies[0] : r.companies,
    }));

    // Signed URLs (1 hora)
    const ttl = 60 * 60;

    const pdfs = await Promise.all(
      rows.map(async (r: any) => {
        const p = r.pdf_path ? String(r.pdf_path) : null;
        if (!p) return { ...r, signed_url: null };

        const { data: signed, error: sErr } = await sb.storage.from("assets").createSignedUrl(p, ttl);
        if (sErr || !signed) return { ...r, signed_url: null };

        return { ...r, signed_url: signed.signedUrl };
      })
    );

    return NextResponse.json({ pdfs });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}
