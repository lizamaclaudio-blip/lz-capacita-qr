export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { mpGetPreapproval, type MpPreapproval } from "@/lib/mercadopago";
import { tierFromPlanId } from "@/lib/billing/mpPlans";

async function updateUserMetadata(userId: string, patch: Record<string, any>) {
  const sb = supabaseAdmin();
  const { data } = await sb.auth.admin.getUserById(userId);
  const prev = (data?.user?.user_metadata || {}) as Record<string, any>;
  const next = { ...prev, ...patch };
  await sb.auth.admin.updateUserById(userId, { user_metadata: next });
}

function safeJsonParse(text: string) {
  try {
    return text ? JSON.parse(text) : null;
  } catch {
    return null;
  }
}

// Validación opcional de firma (si Mercado Pago envía x-signature/x-request-id)
// Manifest: id:{id};request-id:{x-request-id};ts:{ts};  (HMAC SHA256 con tu MP_WEBHOOK_SECRET)
function verifyMpSignature(req: NextRequest, resourceId: string): boolean {
  const secret = (process.env.MP_WEBHOOK_SECRET || "").trim();
  if (!secret) return true; // si no está configurado, no bloqueamos

  const xSig = req.headers.get("x-signature") || "";
  const xReqId = req.headers.get("x-request-id") || "";
  if (!xSig || !xReqId || !resourceId) return true;

  const parts = xSig.split(",").map((p) => p.trim());
  let ts = "";
  let v1 = "";
  for (const part of parts) {
    const [k, v] = part.split("=").map((s) => s.trim());
    if (k === "ts") ts = v;
    if (k === "v1") v1 = v;
  }
  if (!ts || !v1) return true;

  const manifest = `id:${resourceId};request-id:${xReqId};ts:${ts};`;
  const hash = crypto.createHmac("sha256", secret).update(manifest).digest("hex");
  return hash === v1;
}

function pickPreapprovalId(req: NextRequest, body: any): string | null {
  // Webhooks suelen venir como type + data.id
  const q = req.nextUrl.searchParams;
  const qId = q.get("data.id") || q.get("id") || q.get("preapproval_id");
  if (qId) return qId;

  // IPN: topic + id
  const topic = q.get("topic") || q.get("type");
  if (topic && q.get("id")) return q.get("id");

  // JSON bodies
  const dataId = body?.data?.id || body?.data_id || body?.id;
  if (typeof dataId === "string" && dataId.trim()) return dataId.trim();
  if (typeof dataId === "number") return String(dataId);

  return null;
}

function periodEndFromPreapproval(p: MpPreapproval): string | null {
  // next_payment_date suele venir como ISO
  if (p.next_payment_date) return String(p.next_payment_date);
  return null;
}

export async function POST(req: NextRequest) {
  try {
    const raw = await req.text();
    const body = safeJsonParse(raw);

    const preapprovalId = pickPreapprovalId(req, body);
    if (!preapprovalId) {
      return NextResponse.json({ ok: true, ignored: true });
    }

    if (!verifyMpSignature(req, preapprovalId)) {
      return NextResponse.json({ error: "Invalid Mercado Pago signature" }, { status: 401 });
    }

    const preapproval = await mpGetPreapproval(preapprovalId);

    const userId = String(preapproval.external_reference || "").trim();
    if (!userId) {
      // Sin external_reference no podemos asociar; respondemos ok para no reintentar infinito.
      return NextResponse.json({ ok: true, missing_user: true });
    }

    const tier =
      tierFromPlanId(String(preapproval.preapproval_plan_id || "")) ||
      (String((preapproval as any)?.metadata?.plan_tier || "").trim() as any) ||
      null;

    const status = String(preapproval.status || "").trim() || "unknown";
    const currentPeriodEnd = periodEndFromPreapproval(preapproval);

    const isCanceled = status === "canceled" || status === "cancelled";

    await updateUserMetadata(userId, {
      subscription_provider: "mercadopago",
      plan_tier: isCanceled ? "bronce" : tier || "bronce",
      subscription_status: status,
      subscription_current_period_end: currentPeriodEnd,
      mp_preapproval_id: preapprovalId,
      mp_preapproval_plan_id: preapproval.preapproval_plan_id || null,
      mp_payer_email: preapproval.payer_email || null,
    });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}
