import { NextRequest, NextResponse } from "next/server";
import { requireOwner } from "@/lib/supabase/owner";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const auth = await requireOwner(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const body = await req.json().catch(() => ({}));
  const user_id = String(body?.user_id || "").trim();
  const password = String(body?.password || "");

  if (!user_id) return NextResponse.json({ error: "user_id is required" }, { status: 400 });
  if (!password || password.length < 6) return NextResponse.json({ error: "password must be >= 6 chars" }, { status: 400 });

  const { data, error } = await auth.sbAdmin.auth.admin.updateUserById(user_id, { password });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ ok: true, user: data?.user ?? null });
}