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

  return { ok: true as const, supabase, user: u.user };
}

export async function GET(req: NextRequest) {
  try {
    const auth = await requireUser(req);
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const { data: sessions, error: sErr } = await auth.supabase
      .from("sessions")
      .select(
        "id, owner_id, company_id, code, topic, location, session_date, trainer_name, status, closed_at, created_at, pdf_path, pdf_generated_at, companies(id,name,address,logo_path,rut)"
      )
      .eq("owner_id", auth.user.id)
      .order("created_at", { ascending: false });

    if (sErr) return NextResponse.json({ error: sErr.message }, { status: 400 });

    const list = sessions ?? [];
    const ids = list.map((s: any) => s.id).filter(Boolean);

    const counts: Record<string, number> = {};
    if (ids.length) {
      const { data: atts, error: aErr } = await auth.supabase
        .from("attendees")
        .select("session_id")
        .in("session_id", ids);

      if (aErr) return NextResponse.json({ error: aErr.message }, { status: 400 });

      for (const row of atts ?? []) {
        const sid = (row as any).session_id;
        if (!sid) continue;
        counts[sid] = (counts[sid] ?? 0) + 1;
      }
    }

    const out = list.map((s: any) => ({
      ...s,
      attendees_count: counts[s.id] ?? 0,
      companies: Array.isArray(s.companies) ? s.companies[0] : s.companies,
    }));

    return NextResponse.json({ sessions: out });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}