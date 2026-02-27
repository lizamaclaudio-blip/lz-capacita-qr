export type MpEnv = {
  accessToken: string;
};

export function mpEnv(): MpEnv {
  const accessToken = (process.env.MP_ACCESS_TOKEN || "").trim();
  if (!accessToken) throw new Error("Missing MP_ACCESS_TOKEN");
  return { accessToken };
}

export async function mpFetch<T = any>(
  path: string,
  init: RequestInit & { json?: any } = {}
): Promise<T> {
  const { accessToken } = mpEnv();
  const url = path.startsWith("http") ? path : `https://api.mercadopago.com${path}`;

  const headers = new Headers(init.headers || undefined);
  headers.set("Authorization", `Bearer ${accessToken}`);
  if (!headers.has("Content-Type")) headers.set("Content-Type", "application/json");

  const body =
    init.json !== undefined ? JSON.stringify(init.json) : (init.body as any) ?? undefined;

  const res = await fetch(url, {
    ...init,
    headers,
    body,
  });

  const text = await res.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (!res.ok) {
    const msg =
      (data && (data.message || data.error || data.status_message)) ||
      `Mercado Pago API error (${res.status})`;
    const err: any = new Error(msg);
    err.status = res.status;
    err.data = data;
    throw err;
  }

  return data as T;
}

export type MpPreapproval = {
  id?: string;
  status?: string;
  payer_email?: string;
  preapproval_plan_id?: string;
  external_reference?: string;
  init_point?: string;
  sandbox_init_point?: string;
  next_payment_date?: string;
  date_created?: string;
  last_modified?: string;
};

export async function mpGetPreapproval(id: string) {
  return mpFetch<MpPreapproval>(`/preapproval/${encodeURIComponent(id)}`, { method: "GET" });
}

export async function mpCreatePreapproval(payload: Record<string, any>) {
  return mpFetch<MpPreapproval>("/preapproval", { method: "POST", json: payload });
}

export async function mpCancelPreapproval(id: string) {
  // Docs refer to status = "canceled" to cancel a subscription.
  // We'll use that exact value.
  return mpFetch<MpPreapproval>(`/preapproval/${encodeURIComponent(id)}`, {
    method: "PUT",
    json: { status: "canceled" },
  });
}
