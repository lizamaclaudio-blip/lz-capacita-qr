export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { mpCancelPreapproval } from "@/lib/mercadopago";

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

    const supabase = sbAuthed(token);
    const { data, error } = await supabase.auth.getUser();
    if (error || !data?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const user = data.user;
    const md: any = user.user_metadata || {};
    const preapprovalId = String(md.mp_preapproval_id || "").trim();
    if (!preapprovalId) {
      return NextResponse.json({ error: "No hay suscripción Mercado Pago asociada a tu cuenta." }, { status: 400 });
    }

    const updated = await mpCancelPreapproval(preapprovalId);

    await supabase.auth.updateUser({
      data: {
        ...md,
        plan_tier: "bronce",
        subscription_status: updated.status || "canceled",
        subscription_current_period_end: null,
      },
    });

    return NextResponse.json({ ok: true, status: updated.status || "canceled" });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}
