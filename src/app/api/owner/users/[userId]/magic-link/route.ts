import { NextRequest, NextResponse } from "next/server";
import { requireOwner } from "@/lib/supabase/owner";

export const dynamic = "force-dynamic";

/**
 * POST /api/owner/users/[userId]/magic-link
 * Body (optional): { redirect_to?: string } // default: `${SITE}/app`
 */
export async function POST(req: NextRequest, ctx: any) {
  const params = (await ctx?.params) ?? ctx?.params ?? {};
  const auth = await requireOwner(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { userId } = await params;
  const user_id = String(userId || "").trim();
  if (!user_id) return NextResponse.json({ error: "userId is required" }, { status: 400 });

  const body = await req.json().catch(() => ({}));
  const redirect_to = String(body?.redirect_to || `${auth.baseUrl}/app`).trim();

  // resolve email by user id
  let email: string | null = null;

  if (typeof (auth.sbAdmin.auth.admin as any).getUserById === "function") {
    const res = await (auth.sbAdmin.auth.admin as any).getUserById(user_id);
    email = res?.data?.user?.email ?? null;
  } else {
    const { data: list } = await auth.sbAdmin.auth.admin.listUsers({ page: 1, perPage: 200 });
    const u = (list?.users || []).find((x: any) => x.id === user_id);
    email = u?.email ?? null;
  }

  if (!email) return NextResponse.json({ error: "User not found (email missing)" }, { status: 404 });

  const { data, error } = await auth.sbAdmin.auth.admin.generateLink({
    type: "magiclink",
    email,
    options: { redirectTo: redirect_to },
  } as any);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({
    ok: true,
    email,
    redirect_to,
    action_link: (data as any)?.properties?.action_link ?? null,
  });
}
