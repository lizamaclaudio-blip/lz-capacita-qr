import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isUuid(v: unknown) {
  return typeof v === "string" && UUID_RE.test(v.trim());
}

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

/**
 * GET /api/app/companies/[companyId]/workers
 * Lista "workers" derivados desde attendees de las sesiones de la empresa.
 * Query opcional:
 *  - q: filtro por rut o nombre (contains)
 *  - limit: default 200
 */
export async function GET(req: NextRequest, ctx: any) {
  const params = (await ctx?.params) ?? ctx?.params ?? {};
  const companyId = String(params.companyId || "").trim();

  const token = getBearerToken(req);
  if (!token) return bad("Missing bearer token", 401);

  if (!companyId || !isUuid(companyId)) return bad("companyId inválido", 400);

  const supabase = sbAuthed(token);

  const { data: u, error: uErr } = await supabase.auth.getUser();
  if (uErr || !u?.user) return bad("Unauthorized", 401);

  // Asegurar propiedad (RLS + owner_id)
  const { data: company, error: cErr } = await supabase
    .from("companies")
    .select("id, name")
    .eq("id", companyId)
    .eq("owner_id", u.user.id)
    .maybeSingle();

  if (cErr) return bad(cErr.message, 400);
  if (!company) return bad("Company not found", 404);

  const url = new URL(req.url);
  const q = (url.searchParams.get("q") || "").trim().toLowerCase();
  const limit = Math.min(Number(url.searchParams.get("limit") || 200) || 200, 500);

  // Obtener IDs de sesiones de la empresa
  const { data: sessIds, error: sErr } = await supabase
    .from("sessions")
    .select("id")
    .eq("company_id", companyId)
    .eq("owner_id", u.user.id);

  if (sErr) return bad(sErr.message, 400);

  const ids = (sessIds ?? []).map((x: any) => x.id).filter(Boolean);
  if (!ids.length) return NextResponse.json({ ok: true, company, workers: [] });

  // Traer attendees mínimos para agrupar por rut
  const { data: rows, error: aErr } = await supabase
    .from("attendees")
    .select("rut, full_name, role, created_at, session_id")
    .in("session_id", ids)
    .order("created_at", { ascending: false })
    .limit(5000); // límite razonable para dashboard; si crece, hacemos RPC

  if (aErr) return bad(aErr.message, 400);

  type Row = { rut: string; full_name: string | null; role: string | null; created_at: string; session_id: string };
  const list = (rows ?? []) as Row[];

  const map = new Map<string, {
    rut: string;
    full_name: string | null;
    role: string | null;
    last_seen_at: string | null;
    first_seen_at: string | null;
    attendances_total: number;
    sessions_unique: Set<string>;
  }>();

  for (const r of list) {
    const rut = String(r.rut || "").trim();
    if (!rut) continue;

    const key = rut;
    const cur = map.get(key) || {
      rut,
      full_name: r.full_name ?? null,
      role: r.role ?? null,
      last_seen_at: r.created_at ?? null,
      first_seen_at: r.created_at ?? null,
      attendances_total: 0,
      sessions_unique: new Set<string>(),
    };

    cur.attendances_total += 1;
    cur.sessions_unique.add(String(r.session_id || ""));

    // mantener last_seen (como viene ordenado desc, el primero es el más nuevo)
    if (!cur.last_seen_at) cur.last_seen_at = r.created_at ?? null;
    // actualizar first_seen si aparece más antiguo
    if (cur.first_seen_at && r.created_at && new Date(r.created_at) < new Date(cur.first_seen_at)) {
      cur.first_seen_at = r.created_at;
    }

    // refrescar nombre/rol si están vacíos
    if (!cur.full_name && r.full_name) cur.full_name = r.full_name;
    if (!cur.role && r.role) cur.role = r.role;

    map.set(key, cur);
  }

  let workers = Array.from(map.values()).map((w) => ({
    rut: w.rut,
    full_name: w.full_name,
    role: w.role,
    last_seen_at: w.last_seen_at,
    first_seen_at: w.first_seen_at,
    attendances_total: w.attendances_total,
    sessions_unique: w.sessions_unique.size,
  }));

  if (q) {
    workers = workers.filter((w) => {
      const a = (w.rut || "").toLowerCase();
      const b = (w.full_name || "").toLowerCase();
      return a.includes(q) || b.includes(q);
    });
  }

  workers = workers.slice(0, limit);

  return NextResponse.json({ ok: true, company, workers });
}
