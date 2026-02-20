export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseServer } from "@/lib/supabase/server";

function getToken(req: Request) {
  const h = req.headers.get("authorization") || "";
  if (!h.toLowerCase().startsWith("bearer ")) return null;
  return h.slice(7).trim();
}

async function requireUser(req: Request) {
  const token = getToken(req);
  if (!token) return null;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anon =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_KEY;

  if (!url || !anon) return null;

  const sbAuth = createClient(url, anon, { auth: { persistSession: false } });
  const { data, error } = await sbAuth.auth.getUser(token);
  if (error || !data?.user) return null;
  return data.user;
}

export async function GET(req: Request) {
  const user = await requireUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sb = supabaseServer();

  // 1) buscar empresas del usuario
  const { data: comps, error: cErr } = await sb
    .from("companies")
    .select("id")
    .eq("owner_id", user.id);

  if (cErr) return NextResponse.json({ error: cErr.message }, { status: 500 });

  const ids = (comps ?? []).map((x) => x.id);
  if (!ids.length) return NextResponse.json({ ok: true, sessions: [] });

  // 2) buscar sesiones de esas empresas
  const { data, error } = await sb
    .from("sessions")
    .select("id, code, topic, location, session_date, trainer_name, status, closed_at, company_id")
    .in("company_id", ids)
    .order("session_date", { ascending: false })
    .limit(100);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, sessions: data ?? [] });
}