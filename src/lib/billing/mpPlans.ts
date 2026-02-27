import type { PlanTier } from "@/lib/planTier";

export type PublicTier = Exclude<PlanTier, "diamante">;

// ✅ Define estos envs en Vercel / .env.local
// MP_ACCESS_TOKEN=APP_USR-...
// MP_PREAPPROVAL_PLAN_ID_BRONCE=...
// MP_PREAPPROVAL_PLAN_ID_PLATA=...
// MP_PREAPPROVAL_PLAN_ID_ORO=...

export function planIdForTier(tier: PublicTier) {
  if (tier === "oro") return (process.env.MP_PREAPPROVAL_PLAN_ID_ORO || "").trim();
  if (tier === "plata") return (process.env.MP_PREAPPROVAL_PLAN_ID_PLATA || "").trim();
  return (process.env.MP_PREAPPROVAL_PLAN_ID_BRONCE || "").trim();
}

export function tierFromPlanId(planId: string): PublicTier | null {
  const p = (planId || "").trim();
  if (!p) return null;

  const br = (process.env.MP_PREAPPROVAL_PLAN_ID_BRONCE || "").trim();
  const pl = (process.env.MP_PREAPPROVAL_PLAN_ID_PLATA || "").trim();
  const or = (process.env.MP_PREAPPROVAL_PLAN_ID_ORO || "").trim();

  if (or && p === or) return "oro";
  if (pl && p === pl) return "plata";
  if (br && p === br) return "bronce";

  return null;
}
