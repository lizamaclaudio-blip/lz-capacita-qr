import crypto from "crypto";

export function sha256(input: string) {
  return crypto.createHash("sha256").update(input).digest("hex");
}

export function randomCode6() {
  const n = crypto.randomInt(0, 1_000_000);
  return String(n).padStart(6, "0");
}

export function nowPlusMinutes(mins: number) {
  const d = new Date();
  d.setMinutes(d.getMinutes() + mins);
  return d;
}

export async function sendEmailResend(opts: {
  to: string;
  subject: string;
  html: string;
}) {
  const key = process.env.RESEND_API_KEY?.trim();
  const from = process.env.OWNER_FROM_EMAIL?.trim();
  if (!key || !from) return { ok: false as const, error: "Resend not configured" };

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
    }),
  });

  if (!res.ok) {
    const t = await res.text().catch(() => "");
    return { ok: false as const, error: t || `Resend HTTP ${res.status}` };
  }

  return { ok: true as const };
}