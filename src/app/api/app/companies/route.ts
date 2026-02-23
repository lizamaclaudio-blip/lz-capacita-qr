import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

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
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) return { ok: false as const, status: 401, error: "Unauthorized" };

  return { ok: true as const, token, supabase, user: data.user };
}

export async function GET(req: NextRequest) {
  try {
    const auth = await requireUser(req);
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    // ✅ RLS ya filtra, pero igual dejamos explícito
    const { data, error } = await auth.supabase
      .from("companies")
      .select("*")
      .eq("user_id", auth.user.id)
      .order("created_at", { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    return NextResponse.json({ companies: data ?? [] });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireUser(req);
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const body = await req.json().catch(() => ({}));

    const payload = {
      user_id: auth.user.id, // ✅ dueño
      name: String(body?.name ?? "").trim(),
      address: body?.address ? String(body.address).trim() : null,
      rut: body?.rut ? String(body.rut).trim() : null,
      contact_name: body?.contact_name ? String(body.contact_name).trim() : null,
      contact_rut: body?.contact_rut ? String(body.contact_rut).trim() : null,
      contact_email: body?.contact_email ? String(body.contact_email).trim() : null,
      contact_phone: body?.contact_phone ? String(body.contact_phone).trim() : null,
      logo_path: body?.logo_path ? String(body.logo_path).trim() : null,
    };

    if (!payload.name) {
      return NextResponse.json({ error: "Nombre empresa es obligatorio" }, { status: 400 });
    }

    const { data, error } = await auth.supabase
      .from("companies")
      .insert(payload)
      .select("*")
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    return NextResponse.json({ company: data });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}