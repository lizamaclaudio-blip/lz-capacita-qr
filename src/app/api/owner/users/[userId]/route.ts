import { NextRequest, NextResponse } from "next/server";
import { requireOwner } from "@/lib/supabase/owner";

export const dynamic = "force-dynamic";

/**
 * GET /api/owner/users/[userId]
 * Devuelve: user + companies + sessions (+ counts)
 *
 * Nota Next 16: ctx.params puede venir como Promise, por eso usamos ctx:any y await.
 */
export async function GET(req: NextRequest, ctx: any) {
  try {
    const params = (await ctx?.params) ?? ctx?.params ?? {};
    const { userId } = await params;

    const user_id = String(userId || "").trim();
    if (!user_id) return NextResponse.json({ error: "userId is required" }, { status: 400 });

    const auth = await requireOwner(req);
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    // 1) User info (Admin)
    const { data: uData, error: uErr } = await auth.sbAdmin.auth.admin.getUserById(user_id);
    if (uErr) return NextResponse.json({ error: uErr.message }, { status: 400 });

    const user = uData?.user ?? null;

    // 2) Companies by owner_id
    const { data: companies, error: cErr } = await auth.sbAdmin
      .from("companies")
      .select("id, owner_id, name, legal_name, rut, address, logo_path, created_at")
      .eq("owner_id", user_id)
      .order("created_at", { ascending: false });

    if (cErr) return NextResponse.json({ error: cErr.message }, { status: 400 });

    // 3) Sessions by owner_id
    const { data: sessions, error: sErr } = await auth.sbAdmin
      .from("sessions")
      .select(
        "id, owner_id, company_id, code, topic, location, session_date, trainer_name, status, closed_at, created_at, pdf_path, pdf_generated_at"
      )
      .eq("owner_id", user_id)
      .order("created_at", { ascending: false });

    if (sErr) return NextResponse.json({ error: sErr.message }, { status: 400 });

    // 4) Attendees counts (optional but useful)
    const list = sessions ?? [];
    const ids = list.map((s: any) => s.id).filter(Boolean);

    const counts: Record<string, number> = {};
    if (ids.length) {
      const { data: atts, error: aErr } = await auth.sbAdmin
        .from("attendees")
        .select("session_id")
        .in("session_id", ids);

      if (aErr) return NextResponse.json({ error: aErr.message }, { status: 400 });

      for (const row of atts ?? []) {
        const sid = (row as any).session_id;
        if (!sid) continue;
        counts[sid] = (counts[sid] ?? 0) + 1;
      }
    }

    const sessions_out = (sessions ?? []).map((s: any) => ({
      ...s,
      attendees_count: counts[s.id] ?? 0,
    }));

    return NextResponse.json({
      ok: true,
      user,
      companies: companies ?? [],
      sessions: sessions_out,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}