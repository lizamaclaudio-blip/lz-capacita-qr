import { NextRequest, NextResponse } from "next/server";
import { requireOwner, removeInBatches } from "@/lib/supabase/owner";
import { logOwnerAction } from "@/lib/owner/audit";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const auth = await requireOwner(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const body = await req.json().catch(() => ({}));
  const company_id = String(body?.company_id || "").trim();

  if (!company_id) return NextResponse.json({ error: "company_id is required" }, { status: 400 });

  try {
    const { data: company, error: cErr } = await auth.sbAdmin
      .from("companies")
      .select("id, owner_id, name, rut, logo_path")
      .eq("id", company_id)
      .maybeSingle();

    if (cErr) return NextResponse.json({ error: cErr.message }, { status: 400 });
    if (!company) return NextResponse.json({ error: "Company not found" }, { status: 404 });

    const { data: sessions, error: sErr } = await auth.sbAdmin
      .from("sessions")
      .select("id, pdf_path, trainer_signature_path")
      .eq("company_id", company_id);

    if (sErr) return NextResponse.json({ error: sErr.message }, { status: 400 });

    const sessionIds = (sessions ?? []).map((s: any) => s.id).filter(Boolean);

    let sigPaths: string[] = [];
    if (sessionIds.length) {
      const { data: atts, error: aErr } = await auth.sbAdmin
        .from("attendees")
        .select("session_id, signature_path")
        .in("session_id", sessionIds);

      if (aErr) return NextResponse.json({ error: aErr.message }, { status: 400 });

      sigPaths = (atts ?? []).map((a: any) => a.signature_path).filter(Boolean);
    }

    const pdfPaths = (sessions ?? []).map((s: any) => s.pdf_path).filter(Boolean);
    const trainerSig = (sessions ?? []).map((s: any) => s.trainer_signature_path).filter(Boolean);

    // Storage best-effort
    if (company.logo_path) {
      await removeInBatches(auth.sbAdmin, "company-logos", [String(company.logo_path)]);
    }
    await removeInBatches(auth.sbAdmin, "assets", [...pdfPaths, ...trainerSig, ...sigPaths].map(String));

    // DB in FK order
    if (sessionIds.length) {
      const { error: delA } = await auth.sbAdmin.from("attendees").delete().in("session_id", sessionIds);
      if (delA) return NextResponse.json({ error: delA.message }, { status: 400 });

      const { error: delS } = await auth.sbAdmin.from("sessions").delete().in("id", sessionIds);
      if (delS) return NextResponse.json({ error: delS.message }, { status: 400 });
    }

    const { error: delC } = await auth.sbAdmin.from("companies").delete().eq("id", company_id);
    if (delC) return NextResponse.json({ error: delC.message }, { status: 400 });

    const summary = {
      company_id,
      company_name: company.name,
      rut: company.rut,
      sessions: sessionIds.length,
      attendees_signatures: sigPaths.length,
      storage_company_logos_deleted: company.logo_path ? 1 : 0,
      storage_assets_deleted: pdfPaths.length + trainerSig.length + sigPaths.length,
    };

    await logOwnerAction(auth.sbAdmin, {
      owner_user_id: auth.user.id,
      owner_email: auth.ownerEmail,
      action: "force_delete_company",
      request_ip: auth.ip,
      request_ua: auth.ua,
      status: 200,
      payload: { company_id },
      result: summary,
    });

    return NextResponse.json({ ok: true, summary });
  } catch (e: any) {
    await logOwnerAction(auth.sbAdmin, {
      owner_user_id: auth.user.id,
      owner_email: auth.ownerEmail,
      action: "force_delete_company",
      request_ip: auth.ip,
      request_ua: auth.ua,
      status: 500,
      payload: { company_id },
      result: { error: e?.message || "error" },
    });

    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}
