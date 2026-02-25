import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { cleanRut, isValidRut } from "@/lib/rut";

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
 * GET /api/app/companies/[companyId]/workers/[rut]/history
 * Historial del trabajador (asistencias + sesión) dentro de la empresa.
 */
export async function GET(req: NextRequest, ctx: any) {
  const params = (await ctx?.params) ?? ctx?.params ?? {};
  const companyId = String(params.companyId || "").trim();
  const rutParam = String(params.rut || "").trim();

  const token = getBearerToken(req);
  if (!token) return bad("Missing bearer token", 401);

  if (!companyId || !isUuid(companyId)) return bad("companyId inválido", 400);

  const rutClean = cleanRut(rutParam);
  if (!rutClean || !isValidRut(rutClean)) return bad("RUT inválido", 400);

  const supabase = sbAuthed(token);
  const { data: u, error: uErr } = await supabase.auth.getUser();
  if (uErr || !u?.user) return bad("Unauthorized", 401);

  const { data: company, error: cErr } = await supabase
    .from("companies")
    .select("id, name")
    .eq("id", companyId)
    .eq("owner_id", u.user.id)
    .maybeSingle();

  if (cErr) return bad(cErr.message, 400);
  if (!company) return bad("Company not found", 404);

  const { data: sessions, error: sErr } = await supabase
    .from("sessions")
    .select("id, code, topic, location, session_date, trainer_name, status, closed_at, created_at, pdf_path, pdf_generated_at")
    .eq("company_id", companyId)
    .eq("owner_id", u.user.id);

  if (sErr) return bad(sErr.message, 400);

  const sessionIds = (sessions ?? []).map((s: any) => s.id).filter(Boolean);
  if (!sessionIds.length) return NextResponse.json({ ok: true, company, worker: { rut: rutClean }, history: [] });

  const { data: atts, error: aErr } = await supabase
    .from("attendees")
    .select("created_at, rut, full_name, role, signature_path, session_id")
    .in("session_id", sessionIds)
    .eq("rut", rutClean)
    .order("created_at", { ascending: false });

  if (aErr) return bad(aErr.message, 400);

  const sessionMap = new Map<string, any>();
  for (const s of sessions ?? []) sessionMap.set((s as any).id, s);

  const history = (atts ?? [])
    .map((a: any) => ({
      created_at: a.created_at,
      rut: a.rut,
      full_name: a.full_name ?? null,
      role: a.role ?? null,
      signature_path: a.signature_path ?? null,
      session: sessionMap.get(a.session_id) ?? null,
    }))
    .filter((x: any) => !!x.session);

  return NextResponse.json({ ok: true, company, worker: { rut: rutClean }, history });
}
