import { NextRequest, NextResponse } from "next/server";
import { requireOwner, removeInBatches } from "@/lib/supabase/owner";
import { logOwnerAction } from "@/lib/owner/audit";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const auth = await requireOwner(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const body = await req.json().catch(() => ({}));
  const session_id = String(body?.session_id || "").trim();

  if (!session_id) return NextResponse.json({ error: "session_id is required" }, { status: 400 });

  try {
    const { data: session, error: sErr } = await auth.sbAdmin
      .from("sessions")
      .select("id, owner_id, company_id, code, pdf_path, trainer_signature_path")
      .eq("id", session_id)
      .maybeSingle();

    if (sErr) return NextResponse.json({ error: sErr.message }, { status: 400 });
    if (!session) return NextResponse.json({ error: "Session not found" }, { status: 404 });

    const { data: attendees, error: aErr } = await auth.sbAdmin
      .from("attendees")
      .select("id, signature_path")
      .eq("session_id", session_id);

    if (aErr) return NextResponse.json({ error: aErr.message }, { status: 400 });

    const sigPaths = (attendees ?? []).map((a: any) => a.signature_path).filter(Boolean);
    const assetPaths = [session.pdf_path, session.trainer_signature_path, ...sigPaths].filter(Boolean).map(String);

    // Storage best-effort
    await removeInBatches(auth.sbAdmin, "assets", assetPaths);

    // DB
    const { error: delA } = await auth.sbAdmin.from("attendees").delete().eq("session_id", session_id);
    if (delA) return NextResponse.json({ error: delA.message }, { status: 400 });

    const { error: delS } = await auth.sbAdmin.from("sessions").delete().eq("id", session_id);
    if (delS) return NextResponse.json({ error: delS.message }, { status: 400 });

    const summary = {
      session_id,
      code: session.code,
      attendees: (attendees ?? []).length,
      storage_assets_deleted: assetPaths.length,
    };

    await logOwnerAction(auth.sbAdmin, {
      owner_user_id: auth.user.id,
      owner_email: auth.ownerEmail,
      action: "force_delete_session",
      request_ip: auth.ip,
      request_ua: auth.ua,
      status: 200,
      payload: { session_id },
      result: summary,
    });

    return NextResponse.json({ ok: true, summary });
  } catch (e: any) {
    await logOwnerAction(auth.sbAdmin, {
      owner_user_id: auth.user.id,
      owner_email: auth.ownerEmail,
      action: "force_delete_session",
      request_ip: auth.ip,
      request_ua: auth.ua,
      status: 500,
      payload: { session_id },
      result: { error: e?.message || "error" },
    });

    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}
