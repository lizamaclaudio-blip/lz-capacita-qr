export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

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

  const email = data.user.email.toLowerCase();
  if (!owners.has(email)) return { ok: false as const, status: 403, error: "Not owner" };

  return { ok: true as const, email };
}

export async function GET(req: NextRequest) {
  try {
    const auth = await requireOwner(req);
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const sb = supabaseAdmin();

    // USERS (Auth)
    const { data: usersData, error: uErr } = await sb.auth.admin.listUsers({ page: 1, perPage: 500 });
    if (uErr) return NextResponse.json({ error: uErr.message }, { status: 500 });

    const users = (usersData?.users ?? []).map((u: any) => ({
      id: u.id,
      email: u.email ?? null,
      created_at: u.created_at ?? null,
      last_sign_in_at: u.last_sign_in_at ?? null,
      banned_until: u.banned_until ?? null,
      user_metadata: u.user_metadata ?? {},
      app_metadata: u.app_metadata ?? {},
    }));

    const userEmailById: Record<string, string> = {};
    for (const u of users) if (u.id && u.email) userEmailById[u.id] = u.email;

    // COMPANIES
    const { data: companiesRaw, error: cErr } = await sb
      .from("companies")
      .select("id,name,rut,address,owner_id,created_at")
      .order("created_at", { ascending: false })
      .limit(5000);

    if (cErr) return NextResponse.json({ error: cErr.message }, { status: 500 });

    const companies = (companiesRaw ?? []).map((c: any) => ({
      ...c,
      owner_email: c.owner_id ? (userEmailById[c.owner_id] ?? null) : null,
    }));

    // SESSIONS
    const { data: sessionsRaw, error: sErr } = await sb
      .from("sessions")
      .select(
        "id,code,topic,location,session_date,trainer_name,status,closed_at,created_at,owner_id,company_id,pdf_path,pdf_generated_at,companies(name)"
      )
      .order("created_at", { ascending: false })
      .limit(8000);

    if (sErr) return NextResponse.json({ error: sErr.message }, { status: 500 });

    const sessions = (sessionsRaw ?? []).map((s: any) => ({
      ...s,
      companies: Array.isArray(s.companies) ? s.companies[0] : s.companies,
      owner_email: s.owner_id ? (userEmailById[s.owner_id] ?? null) : null,
    }));

    // PDFs list
    const pdfs = sessions
      .filter((s: any) => !!s.pdf_path)
      .map((s: any) => ({
        session_id: s.id,
        code: s.code,
        topic: s.topic,
        owner_id: s.owner_id,
        owner_email: s.owner_email,
        company_name: s.companies?.name ?? null,
        pdf_path: s.pdf_path,
        pdf_generated_at: s.pdf_generated_at ?? null,
      }));

    // Attendees counts (simple, ok para soporte)
    const sessionIds = sessions.map((s: any) => s.id).filter(Boolean);
    const attendeeCounts: Record<string, number> = {};
    if (sessionIds.length) {
      // OJO: esto puede crecer, pero para soporte suele ser OK.
      const { data: atts, error: aErr } = await sb
        .from("attendees")
        .select("session_id")
        .in("session_id", sessionIds.slice(0, 2000));

      if (!aErr) {
        for (const r of atts ?? []) {
          const sid = (r as any).session_id;
          if (!sid) continue;
          attendeeCounts[sid] = (attendeeCounts[sid] ?? 0) + 1;
        }
      }
    }

    const sessionsWithCounts = sessions.map((s: any) => ({
      ...s,
      attendees_count: attendeeCounts[s.id] ?? 0,
    }));

    // Stats per user
    const companiesCountByUser: Record<string, number> = {};
    for (const c of companies) {
      const uid = (c as any).owner_id;
      if (!uid) continue;
      companiesCountByUser[uid] = (companiesCountByUser[uid] ?? 0) + 1;
    }

    const sessionsCountByUser: Record<string, number> = {};
    const pdfCountByUser: Record<string, number> = {};
    for (const s of sessions) {
      const uid = (s as any).owner_id;
      if (!uid) continue;
      sessionsCountByUser[uid] = (sessionsCountByUser[uid] ?? 0) + 1;
      if ((s as any).pdf_path) pdfCountByUser[uid] = (pdfCountByUser[uid] ?? 0) + 1;
    }

    const usersWithStats = users.map((u: any) => ({
      ...u,
      companies_count: companiesCountByUser[u.id] ?? 0,
      sessions_count: sessionsCountByUser[u.id] ?? 0,
      pdfs_count: pdfCountByUser[u.id] ?? 0,
    }));

    return NextResponse.json({
      ok: true,
      owner_email: auth.email,
      stats: {
        users: users.length,
        companies: companies.length,
        sessions: sessions.length,
        pdfs: pdfs.length,
      },
      users: usersWithStats,
      companies,
      sessions: sessionsWithCounts,
      pdfs,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}