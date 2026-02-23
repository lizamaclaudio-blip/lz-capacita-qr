export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase/admin";

const BodySchema = z.object({
  action: z.enum(["ban", "unban"]),
});

function getBearer(req: NextRequest) {
  const auth = req.headers.get("authorization") || "";
  const m = auth.match(/^Bearer\s+(.+)$/i);
  return m?.[1] || null;
}

function ownerSet() {
  return new Set(
    (process.env.OWNER_EMAILS || "")
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean)
  );
}

async function requireOwner(req: NextRequest) {
  const token = getBearer(req);
  if (!token) return { ok: false as const, status: 401, error: "Missing bearer token" };

  const sb = supabaseAdmin();
  const { data, error } = await sb.auth.getUser(token);
  if (error || !data?.user?.email) return { ok: false as const, status: 401, error: "Unauthorized" };

  const owners = ownerSet();
  if (owners.size === 0) return { ok: false as const, status: 500, error: "Missing OWNER_EMAILS" };
  if (!owners.has(data.user.email.toLowerCase())) return { ok: false as const, status: 403, error: "Not owner" };

  return { ok: true as const };
}

export async function POST(req: NextRequest, ctx: { params: { userId: string } }) {
  try {
    const auth = await requireOwner(req);
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const userId = ctx.params.userId;
    if (!userId) return NextResponse.json({ error: "Missing userId" }, { status: 400 });

    const body = await req.json().catch(() => ({}));
    const parsed = BodySchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });

    const sb = supabaseAdmin();
    const ban_duration = parsed.data.action === "ban" ? "876000h" : "none";

    const { data, error } = await sb.auth.admin.updateUserById(userId, { ban_duration });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({
      ok: true,
      action: parsed.data.action,
      user: data?.user ?? null,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}