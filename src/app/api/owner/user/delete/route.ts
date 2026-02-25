import { NextRequest, NextResponse } from "next/server";
import { requireOwner, removeInBatches } from "@/lib/supabase/owner";
import { checkRateLimit, logOwnerAction } from "@/lib/owner/audit";
import { sha256 } from "@/lib/owner/security";

export const dynamic = "force-dynamic";

type DeleteMode = "dry_run" | "delete";

export async function POST(req: NextRequest) {
  const auth = await requireOwner(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const body = await req.json().catch(() => ({}));
  const user_id = String(body?.user_id || "").trim();
  const mode = (String(body?.mode || "dry_run") as DeleteMode) || "dry_run";
  const confirmation_code = String(body?.confirmation_code || "").trim();

  if (!user_id) return NextResponse.json({ error: "user_id is required" }, { status: 400 });

  const actionName = mode === "delete" ? "delete_execute" : "delete_dry_run";

  const rl = await checkRateLimit(auth.sbAdmin, {
    owner_user_id: auth.user.id,
    action: actionName,
    windowSeconds: 60 * 60,
    max: mode === "delete" ? 3 : 10,
  });
  if (!rl.ok) return NextResponse.json({ error: rl.error }, { status: 429 });

  try {
    // Si es DELETE real, exige confirmación
    if (mode === "delete") {
      if (!confirmation_code) {
        return NextResponse.json({ error: "confirmation_code is required" }, { status: 400 });
      }

      const hash = sha256(confirmation_code);

      const { data: tokenRow, error: tErr } = await auth.sbAdmin
        .from("owner_danger_tokens")
        .select("id, expires_at, used_at, token_hash")
        .eq("owner_user_id", auth.user.id)
        .eq("action", "delete_user")
        .eq("target_user_id", user_id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (tErr || !tokenRow) return NextResponse.json({ error: "No active confirmation token. Request a new code." }, { status: 400 });

      const exp = new Date(tokenRow.expires_at).getTime();
      if (Date.now() > exp) return NextResponse.json({ error: "Confirmation code expired. Request a new code." }, { status: 400 });
      if (tokenRow.used_at) return NextResponse.json({ error: "Confirmation token already used. Request a new code." }, { status: 400 });
      if (tokenRow.token_hash !== hash) return NextResponse.json({ error: "Invalid confirmation code" }, { status: 400 });

      // marcar usado
      await auth.sbAdmin.from("owner_danger_tokens").update({ used_at: new Date().toISOString() }).eq("id", tokenRow.id);
    }

    // 1) Recolectar
    const { data: companies } = await auth.sbAdmin
      .from("companies")
      .select("id, logo_path")
      .eq("owner_id", user_id);

    const companyIds = (companies || []).map((c: any) => c.id).filter(Boolean);
    const logoPaths = (companies || []).map((c: any) => c.logo_path).filter(Boolean);

    const { data: sessions } = await auth.sbAdmin
      .from("sessions")
      .select("id, pdf_path")
      .eq("owner_id", user_id);

    const sessionIds = (sessions || []).map((s: any) => s.id).filter(Boolean);
    const pdfPaths = (sessions || []).map((s: any) => s.pdf_path).filter(Boolean);

    let sigPaths: string[] = [];
    let attendeesCount = 0;

    if (sessionIds.length) {
      const { data: attendees } = await auth.sbAdmin
        .from("attendees")
        .select("id, signature_path")
        .in("session_id", sessionIds);

      attendeesCount = (attendees || []).length;
      sigPaths = (attendees || []).map((a: any) => a.signature_path).filter(Boolean);
    }

    const summary = {
      companies: companyIds.length,
      sessions: sessionIds.length,
      attendees: attendeesCount,
      storage: {
        company_logos: logoPaths.length,
        pdfs: pdfPaths.length,
        signatures: sigPaths.length,
      },
    };

    if (mode === "dry_run") {
      await logOwnerAction(auth.sbAdmin, {
        owner_user_id: auth.user.id,
        owner_email: auth.ownerEmail,
        action: "delete_dry_run",
        target_user_id: user_id,
        request_ip: auth.ip,
        request_ua: auth.ua,
        status: 200,
        payload: { user_id },
        result: summary,
      });
      return NextResponse.json({ ok: true, mode, summary });
    }

    // 2) Storage best-effort
    await removeInBatches(auth.sbAdmin, "company-logos", logoPaths);
    await removeInBatches(auth.sbAdmin, "assets", [...pdfPaths, ...sigPaths]);

    // 3) DB en orden FK
    if (sessionIds.length) {
      await auth.sbAdmin.from("attendees").delete().in("session_id", sessionIds);
      await auth.sbAdmin.from("sessions").delete().in("id", sessionIds);
    }

    if (companyIds.length) {
      await auth.sbAdmin.from("companies").delete().in("id", companyIds);
    }

    // 4) Auth user
    const { error: delErr } = await auth.sbAdmin.auth.admin.deleteUser(user_id);
    if (delErr) {
      await logOwnerAction(auth.sbAdmin, {
        owner_user_id: auth.user.id,
        owner_email: auth.ownerEmail,
        action: "delete_execute",
        target_user_id: user_id,
        request_ip: auth.ip,
        request_ua: auth.ua,
        status: 400,
        result: { summary, error: delErr.message },
      });
      return NextResponse.json(
        { ok: false, error: `Data deleted, but failed deleting auth user: ${delErr.message}`, summary },
        { status: 400 }
      );
    }

    await logOwnerAction(auth.sbAdmin, {
      owner_user_id: auth.user.id,
      owner_email: auth.ownerEmail,
      action: "delete_execute",
      target_user_id: user_id,
      request_ip: auth.ip,
      request_ua: auth.ua,
      status: 200,
      result: summary,
    });

    return NextResponse.json({ ok: true, mode, summary });
  } catch (e: any) {
    await logOwnerAction(auth.sbAdmin, {
      owner_user_id: auth.user.id,
      owner_email: auth.ownerEmail,
      action: actionName,
      target_user_id: user_id,
      request_ip: auth.ip,
      request_ua: auth.ua,
      status: 500,
      result: { error: e?.message || "error" },
    });

    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}