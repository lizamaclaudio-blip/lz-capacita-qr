export function cleanRut(rut: string) {
  return String(rut ?? "")
    .replace(/\./g, "")
    .replace(/-/g, "")
    .replace(/\s+/g, "")
    .trim()
    .toUpperCase();
}

export function isValidRut(rut: string) {
  const r = cleanRut(rut);
  if (!/^\d+[0-9K]$/.test(r)) return false;

  const body = r.slice(0, -1);
  const dv = r.slice(-1);

  let sum = 0;
  let mul = 2;
  for (let i = body.length - 1; i >= 0; i--) {
    sum += parseInt(body[i]!, 10) * mul;
    mul = mul === 7 ? 2 : mul + 1;
  }
  const mod = 11 - (sum % 11);
  const expected = mod === 11 ? "0" : mod === 10 ? "K" : String(mod);
  return expected === dv;
}

/**
 * Formatea a RUT Chile: XXXXXXXX-X (sin puntos).
 * - Si viene incompleto, devuelve lo que pueda sin romper el input.
 */
export function formatRutChile(rut: string) {
  const r = cleanRut(rut);
  if (!r) return "";
  if (r.length === 1) return r;

  const dv = r.slice(-1);
  const body = r.slice(0, -1);

  return `${body}-${dv}`;
}

/** Útil para inputs: deja solo dígitos y K/k + . y - (para que el usuario escriba cómodo). */
export function normalizeRutInput(value: string) {
  return String(value ?? "").replace(/[^0-9kK\.\-]/g, "");
}