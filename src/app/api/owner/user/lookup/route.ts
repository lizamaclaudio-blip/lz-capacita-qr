import { NextRequest, NextResponse } from "next/server";
import { requireOwner } from "@/lib/supabase/owner";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const auth = await requireOwner(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const body = await req.json().catch(() => ({}));
  const email = String(body?.email || "").trim().toLowerCase();
  if (!email) return NextResponse.json({ error: "email is required" }, { status: 400 });

  // buscar user por email
  const { data: list, error: lErr } = await auth.sbAdmin.auth.admin.listUsers({ page: 1, perPage: 200 });
  if (lErr) return NextResponse.json({ error: lErr.message }, { status: 400 });

  const target = (list?.users || []).find((u: any) => (u.email || "").toLowerCase() === email);
  if (!target) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const userId = target.id;

  // Conteos base (asumiendo owner_id)
  const [{ count: companies }, { count: sessions }] = await Promise.all([
    auth.sbAdmin.from("companies").select("id", { count: "exact", head: true }).eq("owner_id", userId),
    auth.sbAdmin.from("sessions").select("id", { count: "exact", head: true }).eq("owner_id", userId),
  ]);

  // asistentes: por sesiones del usuario
  const { data: sessIds } = await auth.sbAdmin.from("sessions").select("id").eq("owner_id", userId);
  const ids = (sessIds || []).map((x: any) => x.id).filter(Boolean);

  let attendeesCount = 0;
  if (ids.length) {
    const { count } = await auth.sbAdmin.from("attendees").select("id", { count: "exact", head: true }).in("session_id", ids);
    attendeesCount = count || 0;
  }

  return NextResponse.json({
    user: {
      id: target.id,
      email: target.email,
      created_at: target.created_at,
      last_sign_in_at: target.last_sign_in_at,
      banned_until: target.banned_until ?? null,
      user_metadata: target.user_metadata ?? {},
    },
    stats: {
      companies: companies || 0,
      sessions: sessions || 0,
      attendees: attendeesCount,
    },
  });
}