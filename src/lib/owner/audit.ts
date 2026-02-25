export async function logOwnerAction(sbAdmin: any, row: {
  owner_user_id: string;
  owner_email: string;
  action: string;

  target_user_id?: string | null;
  target_email?: string | null;

  request_ip?: string | null;
  request_ua?: string | null;

  status?: number | null;
  payload?: any;
  result?: any;
}) {
  try {
    await sbAdmin.from("owner_audit_logs").insert({
      owner_user_id: row.owner_user_id,
      owner_email: row.owner_email,
      action: row.action,
      target_user_id: row.target_user_id ?? null,
      target_email: row.target_email ?? null,
      request_ip: row.request_ip ?? null,
      request_ua: row.request_ua ?? null,
      status: row.status ?? null,
      payload: row.payload ?? null,
      result: row.result ?? null,
    });
  } catch (e) {
    // best effort: no rompemos el flujo por logging
    // eslint-disable-next-line no-console
    console.warn("[owner_audit_logs] insert failed");
  }
}

export async function checkRateLimit(sbAdmin: any, opts: {
  owner_user_id: string;
  action: string;
  windowSeconds: number;
  max: number;
}) {
  const since = new Date(Date.now() - opts.windowSeconds * 1000).toISOString();

  const { count, error } = await sbAdmin
    .from("owner_audit_logs")
    .select("id", { count: "exact", head: true })
    .eq("owner_user_id", opts.owner_user_id)
    .eq("action", opts.action)
    .gte("created_at", since);

  if (error) return { ok: true as const }; // si falla rate limit, no bloqueamos

  if ((count || 0) >= opts.max) {
    return { ok: false as const, error: "Rate limit exceeded" };
  }

  return { ok: true as const };
}