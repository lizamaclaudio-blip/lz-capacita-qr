export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

async function fetchSession(sb: any, code: string, full: boolean) {
  const selectFull =
    "id, code, topic, location, session_date, trainer_name, status, closed_at, companies(id,name,legal_name,rut,address,logo_path,company_type,parent_company_id)";
  const selectLite =
    "id, code, topic, location, session_date, trainer_name, status, closed_at, companies(id,name,address)";

  return sb
    .from("sessions")
    .select(full ? selectFull : selectLite)
    .ilike("code", code) // ✅ case-insensitive exact match
    .single();
}

export async function GET(req: NextRequest) {
  try {
    const code = (req.nextUrl.searchParams.get("code") || "").trim().toUpperCase();
    if (!code) return NextResponse.json({ error: "Missing code" }, { status: 400 });

    const sb = supabaseServer();

    // 1) Intento completo (incluye logo_path + legal_name + rut + company_type)
    let { data: session, error } = await fetchSession(sb, code, true);

    // 2) Si falla por columnas faltantes, reintento “lite”
    if (error && /Could not find the '.*' column/i.test(error.message)) {
      const retry = await fetchSession(sb, code, false);
      session = retry.data as any;
      error = retry.error as any;
    }

    if (error || !session) return NextResponse.json({ error: "Charla no existe" }, { status: 404 });

    const company = Array.isArray((session as any).companies)
      ? (session as any).companies[0]
      : (session as any).companies;

    return NextResponse.json({
      session: {
        id: session.id,
        code: session.code,
        topic: session.topic,
        location: session.location,
        session_date: session.session_date,
        trainer_name: session.trainer_name,
        status: session.status,
        closed_at: session.closed_at,
        company: company ?? null,
      },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}