import { createClient } from "@supabase/supabase-js";
import type { NextRequest } from "next/server";

function getBaseUrl(req: NextRequest) {
  const env = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (env) return env.replace(/\/$/, "");

  const proto = req.headers.get("x-forwarded-proto") || "http";
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || "localhost:3000";
  return `${proto}://${host}`.replace(/\/$/, "");
}

function parseOwnerEmails() {
  const raw = (process.env.OWNER_EMAILS || "lizamaclaudio@gmail.com")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return new Set(raw);
}

function getBearer(req: NextRequest) {
  const auth = req.headers.get("authorization") || "";
  const m = auth.match(/^Bearer\s+(.+)$/i);
  return m?.[1] || null;
}

function getIp(req: NextRequest) {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip")?.trim() ||
    null
  );
}

export async function requireOwner(req: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  if (!url || !anon || !service) {
    return {
      ok: false as const,
      status: 500,
      error: "Missing Supabase env vars (URL/ANON/SERVICE_ROLE).",
    };
  }

  const token = getBearer(req);
  if (!token) return { ok: false as const, status: 401, error: "Missing bearer token" };

  const sbUser = createClient(url, anon, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false },
  });

  const { data, error } = await sbUser.auth.getUser();
  if (error || !data?.user) return { ok: false as const, status: 401, error: "Unauthorized" };

  const ownerEmails = parseOwnerEmails();
  const email = (data.user.email || "").toLowerCase();
  if (!ownerEmails.has(email)) {
    return { ok: false as const, status: 403, error: "Forbidden (not owner)" };
  }

  const sbAdmin = createClient(url, service, { auth: { persistSession: false } });

  return {
    ok: true as const,
    sbAdmin,
    sbUser,
    user: data.user,
    baseUrl: getBaseUrl(req),
    ownerEmail: email,
    ip: getIp(req),
    ua: req.headers.get("user-agent") || null,
  };
}

export function cleanStoragePath(path: string) {
  return path.replace(/^\/+/, "").replace(/^(company-logos|assets)\//, "");
}

export async function removeInBatches(sbAdmin: any, bucket: string, paths: string[], batchSize = 100) {
  const clean = paths.map((p) => cleanStoragePath(String(p || ""))).filter(Boolean);

  for (let i = 0; i < clean.length; i += batchSize) {
    const chunk = clean.slice(i, i + batchSize);
    const { error } = await sbAdmin.storage.from(bucket).remove(chunk);
    if (error) console.warn(`[storage.remove] bucket=${bucket}`, error.message);
  }
}