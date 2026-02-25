import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

function getBearerToken(req: NextRequest) {
  const auth = req.headers.get("authorization") || "";
  const m = auth.match(/^Bearer\s+(.+)$/i);
  return m?.[1] ?? null;
}

function sbAuthed(token: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(url, anon, {
    auth: { persistSession: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
}

function bad(msg: string, status = 400) {
  return NextResponse.json({ error: msg }, { status });
}

export async function GET(req: NextRequest, ctx: any) {
  const companyId = String((await ctx?.params)?.companyId ?? ctx?.params?.companyId ?? "").trim();

  const token = getBearerToken(req);
  if (!token) return bad("Missing bearer token", 401);

  const supabase = sbAuthed(token);
  const { data: u, error: uErr } = await supabase.auth.getUser();
  if (uErr || !u?.user) return bad("Unauthorized", 401);

  // Ensure company belongs to owner
  const { data: company, error: cErr } = await supabase
    .from("companies")
    .select("id")
    .eq("id", companyId)
    .eq("owner_id", u.user.id)
    .maybeSingle();

  if (cErr) return bad(cErr.message, 400);
  if (!company) return bad("Company not found", 404);

  const { count: sessionsTotal, error: sErr } = await supabase
    .from("sessions")
    .select("id", { count: "exact", head: true })
    .eq("company_id", companyId)
    .eq("owner_id", u.user.id);

  if (sErr) return bad(sErr.message, 400);

  const { data: sessIds, error: idsErr } = await supabase
    .from("sessions")
    .select("id")
    .eq("company_id", companyId)
    .eq("owner_id", u.user.id);

  if (idsErr) return bad(idsErr.message, 400);

  const ids = (sessIds ?? []).map((x: any) => x.id).filter(Boolean);

  let attendancesTotal = 0;
  let workersUnique = 0;

  if (ids.length) {
    const { count: aCount, error: aErr } = await supabase
      .from("attendees")
      .select("id", { count: "exact", head: true })
      .in("session_id", ids);

    if (aErr) return bad(aErr.message, 400);
    attendancesTotal = aCount || 0;

    const { data: ruts, error: rErr } = await supabase
      .from("attendees")
      .select("rut")
      .in("session_id", ids);

    if (rErr) return bad(rErr.message, 400);

    const set = new Set<string>();
    for (const row of ruts ?? []) {
      const rut = (row as any)?.rut;
      if (rut) set.add(String(rut));
    }
    workersUnique = set.size;
  }

  return NextResponse.json({
    kpis: {
      sessions_total: sessionsTotal || 0,
      workers_unique: workersUnique,
      attendances_total: attendancesTotal,
    },
  });
}
