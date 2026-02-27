export type PlanTier = "bronce" | "plata" | "oro" | "diamante";

export function normalizePlanTier(input: unknown): PlanTier {
  const v = String(input || "").trim().toLowerCase();

  // acepta español e inglés por si lo guardas distinto
  if (v === "diamante" || v === "diamond") return "diamante";
  if (v === "oro" || v === "gold") return "oro";
  if (v === "plata" || v === "silver") return "plata";
  if (v === "bronce" || v === "bronze") return "bronce";

  return "bronce";
}

export function planLabel(tier: PlanTier, isOwner: boolean) {
  if (isOwner) return "Diamante (Owner)";
  if (tier === "oro") return "Oro";
  if (tier === "plata") return "Plata";
  return "Bronce";
}