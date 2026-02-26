import { NextRequest, NextResponse } from "next/server";
import { requireOwner, removeInBatches } from "@/lib/supabase/owner";
import { logOwnerAction } from "@/lib/owner/audit";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const auth = await requireOwner(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const body = await req.json().catch(() => ({}));
  const user_id = String(body?.user_id || "").trim();
  if (!user_id) return NextResponse.json({ error: "user_id is required" }, { status: 400 });

  try {
    // 1) Collect
    const { data: companies, error: cErr } = await auth.sbAdmin
      .from("companies")
      .select("id, logo_path")
      .eq("owner_id", user_id);
    if (cErr) return NextResponse.json({ error: cErr.message }, { status: 400 });

    const companyIds = (companies || []).map((c: any) => c.id).filter(Boolean);
    const logoPaths = (companies || []).map((c: any) => c.logo_path).filter(Boolean);

    const { data: sessions, error: sErr } = await auth.sbAdmin
      .from("sessions")
      .select("id, pdf_path, trainer_signature_path")
      .eq("owner_id", user_id);
    if (sErr) return NextResponse.json({ error: sErr.message }, { status: 400 });

    const sessionIds = (sessions || []).map((s: any) => s.id).filter(Boolean);
    const pdfPaths = (sessions || []).map((s: any) => s.pdf_path).filter(Boolean);
    const trainerSigPaths = (sessions || []).map((s: any) => s.trainer_signature_path).filter(Boolean);

    let attendeeSigPaths: string[] = [];
    let attendeesCount = 0;

    if (sessionIds.length) {
      const { data: attendees, error: aErr } = await auth.sbAdmin
        .from("attendees")
        .select("id, signature_path")
        .in("session_id", sessionIds);
      if (aErr) return NextResponse.json({ error: aErr.message }, { status: 400 });
      attendeesCount = (attendees || []).length;
      attendeeSigPaths = (attendees || []).map((a: any) => a.signature_path).filter(Boolean);
    }

    const summary = {
      companies: companyIds.length,
      sessions: sessionIds.length,
      attendees: attendeesCount,
      storage: {
        company_logos: logoPaths.length,
        pdfs: pdfPaths.length,
        trainer_signatures: trainerSigPaths.length,
        signatures: attendeeSigPaths.length,
      },
    };

    // 2) Storage best-effort
    await removeInBatches(auth.sbAdmin, "company-logos", logoPaths);
    await removeInBatches(auth.sbAdmin, "assets", [...pdfPaths, ...trainerSigPaths, ...attendeeSigPaths]);

    // 3) DB (FK order)
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
        action: "force_delete_user",
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
      action: "force_delete_user",
      target_user_id: user_id,
      request_ip: auth.ip,
      request_ua: auth.ua,
      status: 200,
      result: summary,
    });

    return NextResponse.json({ ok: true, summary });
  } catch (e: any) {
    await logOwnerAction(auth.sbAdmin, {
      owner_user_id: auth.user.id,
      owner_email: auth.ownerEmail,
      action: "force_delete_user",
      target_user_id: user_id,
      request_ip: auth.ip,
      request_ua: auth.ua,
      status: 500,
      result: { error: e?.message || "error" },
    });
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}
