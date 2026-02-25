import { NextRequest, NextResponse } from "next/server";
import { requireOwner } from "@/lib/supabase/owner";
import { checkRateLimit, logOwnerAction } from "@/lib/owner/audit";
import { nowPlusMinutes, randomCode6, sha256, sendEmailResend } from "@/lib/owner/security";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const auth = await requireOwner(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const rl = await checkRateLimit(auth.sbAdmin, {
    owner_user_id: auth.user.id,
    action: "delete_request",
    windowSeconds: 60 * 60,
    max: 5,
  });
  if (!rl.ok) return NextResponse.json({ error: rl.error }, { status: 429 });

  const body = await req.json().catch(() => ({}));
  const user_id = String(body?.user_id || "").trim();
  const target_email = String(body?.target_email || "").trim().toLowerCase();

  if (!user_id) return NextResponse.json({ error: "user_id is required" }, { status: 400 });

  const code = randomCode6();
  const tokenHash = sha256(code);
  const expires = nowPlusMinutes(10);

  try {
    // Guardar token
    const { error } = await auth.sbAdmin.from("owner_danger_tokens").insert({
      owner_user_id: auth.user.id,
      owner_email: auth.ownerEmail,
      action: "delete_user",
      target_user_id: user_id,
      target_email: target_email || null,
      token_hash: tokenHash,
      expires_at: expires.toISOString(),
    });

    if (error) throw new Error(error.message);

    // Intentar enviar email (opcional)
    const to = auth.ownerEmail;
    const emailRes = await sendEmailResend({
      to,
      subject: "Confirmación: borrar usuario y datos (LZ Owner)",
      html: `
        <div style="font-family:Arial,sans-serif">
          <h2>Confirmación requerida</h2>
          <p>Estás intentando borrar un usuario y todos sus datos.</p>
          <p><b>Código:</b> <span style="font-size:18px;letter-spacing:2px">${code}</span></p>
          <p>Expira: ${expires.toLocaleString("es-CL")}</p>
        </div>
      `,
    });

    await logOwnerAction(auth.sbAdmin, {
      owner_user_id: auth.user.id,
      owner_email: auth.ownerEmail,
      action: "delete_request",
      target_user_id: user_id,
      target_email: target_email || null,
      request_ip: auth.ip,
      request_ua: auth.ua,
      status: 200,
      payload: { user_id, target_email },
      result: { emailed: emailRes.ok },
    });

    // Si no hay email, devolvemos el código como fallback
    return NextResponse.json({
      ok: true,
      expires_at: expires.toISOString(),
      emailed: emailRes.ok,
      code: emailRes.ok ? null : code,
    });
  } catch (e: any) {
    await logOwnerAction(auth.sbAdmin, {
      owner_user_id: auth.user.id,
      owner_email: auth.ownerEmail,
      action: "delete_request",
      target_user_id: user_id,
      target_email: target_email || null,
      request_ip: auth.ip,
      request_ua: auth.ua,
      status: 500,
      result: { error: e?.message || "error" },
    });

    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}