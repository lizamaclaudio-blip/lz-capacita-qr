import { NextRequest, NextResponse } from "next/server";
import { requireOwner } from "@/lib/supabase/owner";

export const dynamic = "force-dynamic";

/**
 * POST /api/owner/users/[userId]/set-password
 * Body: { password: string }
 */
export async function POST(req: NextRequest, ctx: any) {
  const params = (await ctx?.params) ?? ctx?.params ?? {};
  const auth = await requireOwner(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { userId } = await params;
  const user_id = String(userId || "").trim();
  if (!user_id) return NextResponse.json({ error: "userId is required" }, { status: 400 });

  const body = await req.json().catch(() => ({}));
  const password = String(body?.password || "");

  if (!password || password.length < 6) {
    return NextResponse.json({ error: "password must be >= 6 chars" }, { status: 400 });
  }

  const { data, error } = await auth.sbAdmin.auth.admin.updateUserById(user_id, { password });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ ok: true, user: data?.user ?? null });
}
