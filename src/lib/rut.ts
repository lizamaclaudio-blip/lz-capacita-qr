export function cleanRut(rut: string) {
  return rut.replace(/\./g, "").replace(/-/g, "").trim().toUpperCase();
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