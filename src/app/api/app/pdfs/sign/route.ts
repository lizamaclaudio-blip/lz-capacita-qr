import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { supabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const BodySchema = z.object({
  pdf_path: z.string().min(5),
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
  if (uerr || !u?.user) return { ok: false as const, status: 401, error: "Unauthorized" };

  return { ok: true as const, user: u.user, supabase };
}

export async function POST(req: NextRequest) {
  try {
    const parsed = BodySchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });

    const auth = await requireUser(req);
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const pdf_path = String(parsed.data.pdf_path).replace(/^assets\//, "").trim();

    // Validar que exista en sessions (evita firmar paths random)
    const { data: row, error: rErr } = await auth.supabase
      .from("sessions")
      .select("id,pdf_path")
      .eq("pdf_path", pdf_path)
      .single();

    if (rErr || !row) return NextResponse.json({ error: "PDF no asociado a una charla" }, { status: 404 });

    // Firmar con server client (más estable para storage privado)
    const sb = supabaseServer();
    const { data: signed, error: signErr } = await sb.storage.from("assets").createSignedUrl(pdf_path, 60 * 60);

    if (signErr || !signed) return NextResponse.json({ error: signErr?.message || "No se pudo firmar URL" }, { status: 500 });

    return NextResponse.json({ ok: true, signed_url: signed.signedUrl });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}