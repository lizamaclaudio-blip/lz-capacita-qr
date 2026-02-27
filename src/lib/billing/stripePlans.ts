import type { PlanTier } from "@/lib/planTier";

export type PublicTier = Exclude<PlanTier, "diamante">;

// ✅ Define estos envs en Vercel / .env.local
// STRIPE_PRICE_ID_BRONCE=price_...
// STRIPE_PRICE_ID_PLATA=price_...
// STRIPE_PRICE_ID_ORO=price_...

export function priceIdForTier(tier: PublicTier) {
  if (tier === "oro") return (process.env.STRIPE_PRICE_ID_ORO || "").trim();
  if (tier === "plata") return (process.env.STRIPE_PRICE_ID_PLATA || "").trim();
  return (process.env.STRIPE_PRICE_ID_BRONCE || "").trim();
}

export function tierFromPriceId(priceId: string): PublicTier | null {
  const p = (priceId || "").trim();
  if (!p) return null;

  const br = (process.env.STRIPE_PRICE_ID_BRONCE || "").trim();
  const pl = (process.env.STRIPE_PRICE_ID_PLATA || "").trim();
  const or = (process.env.STRIPE_PRICE_ID_ORO || "").trim();

  if (or && p === or) return "oro";
  if (pl && p === pl) return "plata";
  if (br && p === br) return "bronce";

  return null;
}
