export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";

// Mercado Pago no tiene un "Customer Portal" equivalente a Stripe.
// Dejamos este endpoint por compatibilidad y devolvemos una guía.

export async function POST(req: NextRequest) {
  try {
    return NextResponse.json({
      ok: true,
      message:
        "Mercado Pago no ofrece un portal de suscripción como Stripe. Para administrar tu suscripción, ingresa a tu cuenta de Mercado Pago y revisa tus pagos recurrentes. También puedes cancelar desde LZ Capacita QR si el comercio lo permite.",
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}
