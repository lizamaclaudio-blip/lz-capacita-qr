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
  const { data: u, error: uerr } = await supabase.auth.getUser();
  if (uerr || !u?.user) return { ok: false as const, status: 401, error: "Unauthorized" };

  return { ok: true as const, token, supabase, user: u.user };
}

// GET /api/app/admin/attendees?code=ABC123
export async function GET(req: NextRequest) {
  try {
    const code = (req.nextUrl.searchParams.get("code") || "").toUpperCase().trim();
    if (!code) return NextResponse.json({ error: "Missing code" }, { status: 400 });

    const auth = await requireUser(req);
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    // session + company (RLS decide si el usuario puede verla)
    const { data: session, error: sErr } = await auth.supabase
      .from("sessions")
      .select(
        `
        *,
        companies:companies (
          id,
          name,
          address,
          logo_path
        )
      `
      )
      .eq("code", code)
      .single();

    if (sErr || !session) {
      return NextResponse.json(
        { error: sErr?.message || "Sesión no encontrada o sin acceso" },
        { status: 404 }
      );
    }

    // attendees
    const { data: attendees, error: aErr } = await auth.supabase
      .from("attendees")
      .select("*")
      .eq("session_id", session.id)
      .order("created_at", { ascending: true });

    if (aErr) return NextResponse.json({ error: aErr.message }, { status: 400 });

    return NextResponse.json({ session, attendees: attendees ?? [] });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}