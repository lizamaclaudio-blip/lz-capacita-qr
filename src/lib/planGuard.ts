import type { User } from "@supabase/supabase-js";
import { normalizePlanTier, type PlanTier } from "@/lib/planTier";
import { PLAN_LIMITS, isUnlimited } from "@/lib/plans";

const OWNER_EMAILS_DEFAULT = ["lizamaclaudio@gmail.com"]; // fallback

function getOwnerEmails(): string[] {
  const env = (process.env.NEXT_PUBLIC_OWNER_EMAILS || "").trim();
  if (env) return env.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
  return OWNER_EMAILS_DEFAULT;
}

export function resolveTierFromUser(user: User): { tier: PlanTier; isOwner: boolean } {
  const email = String(user.email || "").toLowerCase();
  const isOwner = !!email && getOwnerEmails().includes(email);
  if (isOwner) return { tier: "diamante", isOwner: true };

  const md: any = user.user_metadata || {};
  const tier = normalizePlanTier(md.plan_tier || md.plan || md.tier);
  return { tier, isOwner: false };
}

export type GateOk = {
  ok: true;
};

export type GateFail = {
  ok: false;
  status: number;
  error: string;
  tier: PlanTier;
  used: number;
  limit: number;
};

export type GateResult = GateOk | GateFail;

function fail(tier: PlanTier, used: number, limit: number, error: string): GateFail {
  return { ok: false, status: 402, error, tier, used, limit };
}

function monthRangeISO(d = new Date()) {
  const start = new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
  const end = new Date(d.getFullYear(), d.getMonth() + 1, 1, 0, 0, 0, 0);
  return { start: start.toISOString(), end: end.toISOString() };
}

export async function guardCreateCompany(sb: any, ownerId: string, tier: PlanTier): Promise<GateResult> {
  const limit = PLAN_LIMITS[tier]?.maxCompanies ?? 0;
  if (isUnlimited(limit)) return { ok: true };

  const { count, error } = await sb
    .from("companies")
    .select("id", { count: "exact", head: true })
    .eq("owner_id", ownerId);

  if (error) return fail(tier, 0, limit, `No se pudo validar el plan (companies): ${error.message}`);

  const used = count ?? 0;
  if (used >= limit) {
    return fail(
      tier,
      used,
      limit,
      `Tu plan (${tier}) alcanzó el máximo de empresas (${limit}). Sube de plan para crear más.`
    );
  }

  return { ok: true };
}

export async function guardCreateSession(sb: any, ownerId: string, tier: PlanTier): Promise<GateResult> {
  const limit = PLAN_LIMITS[tier]?.maxSessionsPerMonth ?? 0;
  if (isUnlimited(limit)) return { ok: true };

  const { start, end } = monthRangeISO();

  const { count, error } = await sb
    .from("sessions")
    .select("id", { count: "exact", head: true })
    .eq("owner_id", ownerId)
    .gte("created_at", start)
    .lt("created_at", end);

  if (error) return fail(tier, 0, limit, `No se pudo validar el plan (sessions): ${error.message}`);

  const used = count ?? 0;
  if (used >= limit) {
    return fail(
      tier,
      used,
      limit,
      `Tu plan (${tier}) alcanzó el máximo de charlas este mes (${limit}). Sube de plan para crear más.`
    );
  }

  return { ok: true };
}

export async function guardCheckinCapacity(sb: any, sessionId: string, tier: PlanTier): Promise<GateResult> {
  const limit = PLAN_LIMITS[tier]?.maxAttendeesPerSession ?? 0;
  if (isUnlimited(limit)) return { ok: true };

  const { count, error } = await sb
    .from("attendees")
    .select("id", { count: "exact", head: true })
    .eq("session_id", sessionId);

  if (error) return fail(tier, 0, limit, `No se pudo validar el plan (attendees): ${error.message}`);

  const used = count ?? 0;
  if (used >= limit) {
    return fail(tier, used, limit, `Esta charla alcanzó el máximo de asistentes de tu plan (${limit}).`);
  }

  return { ok: true };
}
