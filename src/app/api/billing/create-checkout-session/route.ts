export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import { mpCreatePreapproval } from "@/lib/mercadopago";
import { planIdForTier, type PublicTier } from "@/lib/billing/mpPlans";

const BodySchema = z.object({
  tier: z.enum(["bronce", "plata", "oro"]),
  success_url: z.string().optional(),
  cancel_url: z.string().optional(),
});

function getToken(req: NextRequest) {
  const auth = req.headers.get("authorization") || "";
  const m = auth.match(/^Bearer\s+(.+)$/i);
  return m?.[1] || null;
}

function sbAuthed(token: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(url, anon, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false },
  });
}

export async function POST(req: NextRequest) {
  try {
    const token = getToken(req);
    if (!token) return NextResponse.json({ error: "Missing bearer token" }, { status: 401 });

    const parsed = BodySchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });

    const supabase = sbAuthed(token);
    const { data, error } = await supabase.auth.getUser();
    if (error || !data?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const user = data.user;
    const tier = parsed.data.tier as PublicTier;
    const planId = planIdForTier(tier);
    if (!planId) {
      return NextResponse.json(
        { error: `Falta configurar MP_PREAPPROVAL_PLAN_ID para plan ${tier}` },
        { status: 500 }
      );
    }

    const appUrl = (process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || "").trim() || req.nextUrl.origin;
    const successUrl = parsed.data.success_url || `${appUrl}/app/billing?status=success`;
    const cancelUrl = parsed.data.cancel_url || `${appUrl}/app/billing?status=cancel`;

    if (!user.email) {
      return NextResponse.json(
        { error: "Tu cuenta no tiene email. Agrega un email en tu perfil para suscribirte." },
        { status: 400 }
      );
    }

    const webhookUrl = `${appUrl}/api/billing/webhook?source_news=webhooks`;

    const preapproval = await mpCreatePreapproval({
      preapproval_plan_id: planId,
      payer_email: user.email,
      reason: `LZ Capacita QR - Plan ${tier.toUpperCase()}`,
      external_reference: user.id,
      back_url: successUrl,
      notification_url: webhookUrl,
      status: "pending",
    });

    const url = preapproval.init_point || preapproval.sandbox_init_point;
    if (!url) {
      return NextResponse.json(
        { error: "Mercado Pago no devolvió URL de suscripción (init_point)." },
        { status: 500 }
      );
    }

    // Guardamos en metadata (self-update) para poder cancelar/mostrar estado
    const md: any = user.user_metadata || {};
    await supabase.auth.updateUser({
      data: {
        ...md,
        subscription_provider: "mercadopago",
        mp_preapproval_id: preapproval.id || md.mp_preapproval_id || null,
        mp_preapproval_plan_id: planId,
        pending_plan_tier: tier,
      },
    });

    return NextResponse.json({ url, id: preapproval.id });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}
