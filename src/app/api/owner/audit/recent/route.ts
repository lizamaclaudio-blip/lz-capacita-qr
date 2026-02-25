import { NextRequest, NextResponse } from "next/server";
import { requireOwner } from "@/lib/supabase/owner";
import { checkRateLimit, logOwnerAction } from "@/lib/owner/audit";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await requireOwner(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const rl = await checkRateLimit(auth.sbAdmin, {
    owner_user_id: auth.user.id,
    action: "audit_recent",
    windowSeconds: 60,
    max: 30,
  });
  if (!rl.ok) return NextResponse.json({ error: rl.error }, { status: 429 });

  try {
    const { data, error } = await auth.sbAdmin
      .from("owner_audit_logs")
      .select("id, created_at, action, target_email, target_user_id, status, request_ip")
      .eq("owner_user_id", auth.user.id)
      .order("created_at", { ascending: false })
      .limit(30);

    if (error) throw new Error(error.message);

    await logOwnerAction(auth.sbAdmin, {
      owner_user_id: auth.user.id,
      owner_email: auth.ownerEmail,
      action: "audit_recent",
      request_ip: auth.ip,
      request_ua: auth.ua,
      status: 200,
    });

    return NextResponse.json({ ok: true, logs: data ?? [] });
  } catch (e: any) {
    await logOwnerAction(auth.sbAdmin, {
      owner_user_id: auth.user.id,
      owner_email: auth.ownerEmail,
      action: "audit_recent",
      request_ip: auth.ip,
      request_ua: auth.ua,
      status: 500,
      result: { error: e?.message || "error" },
    });
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}