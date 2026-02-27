import Stripe from "stripe";

export function stripeServer() {
  const key = (process.env.STRIPE_SECRET_KEY || "").trim();
  if (!key) throw new Error("Missing STRIPE_SECRET_KEY");

  return new Stripe(key, {
    // Mantén apiVersion por defecto del SDK instalado.
    // Si quieres fijarla, define STRIPE_API_VERSION en env y pásala aquí.
    apiVersion: (process.env.STRIPE_API_VERSION as any) || undefined,
    typescript: true,
  });
}
