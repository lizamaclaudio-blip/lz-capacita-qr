import { NextRequest, NextResponse } from "next/server";
import { requireOwner } from "@/lib/supabase/owner";

export const dynamic = "force-dynamic";

/**
 * POST /api/owner/user/unban
 * Body: { user_id: string }
 */
export async function POST(req: NextRequest) {
  const auth = await requireOwner(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const body = await req.json().catch(() => ({}));
  const user_id = String(body?.user_id || "").trim();
  if (!user_id) return NextResponse.json({ error: "user_id is required" }, { status: 400 });

  // Try ban_duration none (SDK)
  let { data, error } = await auth.sbAdmin.auth.admin.updateUserById(user_id, {
    ban_duration: "none",
  } as any);

  // Fallback: banned_until null
  if (error) {
    const res2 = await auth.sbAdmin.auth.admin.updateUserById(user_id, { banned_until: null } as any);
    data = res2.data;
    error = res2.error;
  }

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, user: data?.user ?? null });
}
