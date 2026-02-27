import type { PlanTier } from "@/lib/planTier";

/**
 * Límites por plan.
 *
 * - Usa -1 para "ilimitado".
 * - Estos límites se usan para:
 *   - gate de creación de empresas
 *   - gate de creación de charlas por mes
 *   - gate de máximo asistentes por charla
 */

export type PlanLimits = {
  maxCompanies: number;
  maxSessionsPerMonth: number;
  maxPdfsPerMonth: number;
  maxAttendeesPerSession: number;
};

export const UNLIMITED = -1;

export function isUnlimited(n: number) {
  return n === UNLIMITED || n === Infinity;
}

/**
 * 🥉🥈🥇 Ajusta estos números cuando quieras.
 *
 * Los precios los defines en Mercado Pago (planes).
 * Estos límites son los que tu app hace cumplir.
 */
export const PLAN_LIMITS: Record<PlanTier, PlanLimits> = {
  bronce: {
    maxCompanies: 1,
    maxSessionsPerMonth: 8,
    maxPdfsPerMonth: 8,
    maxAttendeesPerSession: 30,
  },
  plata: {
    maxCompanies: 3,
    maxSessionsPerMonth: 25,
    maxPdfsPerMonth: 25,
    maxAttendeesPerSession: 80,
  },
  oro: {
    maxCompanies: 10,
    maxSessionsPerMonth: 100,
    maxPdfsPerMonth: 100,
    maxAttendeesPerSession: 250,
  },
  // Solo para Owner (no se vende)
  diamante: {
    maxCompanies: UNLIMITED,
    maxSessionsPerMonth: UNLIMITED,
    maxPdfsPerMonth: UNLIMITED,
    maxAttendeesPerSession: UNLIMITED,
  },
};
