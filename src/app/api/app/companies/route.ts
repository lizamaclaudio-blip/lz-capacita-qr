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
  if (!token) {
    return { ok: false as const, status: 401, error: "Missing bearer token" };
  }

  const supabase = sbAuthed(token);
  const { data: u, error: uerr } = await supabase.auth.getUser(token);

  if (uerr || !u?.user) {
    return { ok: false as const, status: 401, error: "Unauthorized" };
  }

  return { ok: true as const, token, supabase, user: u.user };
}

export async function GET(req: NextRequest) {
  try {
    const auth = await requireUser(req);
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const { data, error } = await auth.supabase
      .from("companies")
      .select("*")
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

    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name) {
      return NextResponse.json({ error: "Nombre empresa es obligatorio" }, { status: 400 });
    }

    const payload: any = {
      name,
      address: typeof body.address === "string" && body.address.trim() ? body.address.trim() : null,
      rut: typeof body.rut === "string" && body.rut.trim() ? body.rut.trim() : null,

      contact_name:
        typeof body.contact_name === "string" && body.contact_name.trim()
          ? body.contact_name.trim()
          : null,
      contact_rut:
        typeof body.contact_rut === "string" && body.contact_rut.trim()
          ? body.contact_rut.trim()
          : null,
      contact_email:
        typeof body.contact_email === "string" && body.contact_email.trim()
          ? body.contact_email.trim()
          : null,
      contact_phone:
        typeof body.contact_phone === "string" && body.contact_phone.trim()
          ? body.contact_phone.trim()
          : null,

      // guarda solo el path dentro del bucket, ejemplo: "companies/<id>/logo.png"
      logo_path:
        typeof body.logo_path === "string" && body.logo_path.trim()
          ? body.logo_path.replace(/^company-logos\//, "")
          : null,
    };

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