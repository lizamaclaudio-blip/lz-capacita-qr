export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  try {
    const code = (req.nextUrl.searchParams.get("code") || "").trim().toUpperCase();
    if (!code) return NextResponse.json({ error: "Missing code" }, { status: 400 });

    const sb = supabaseServer();

    const { data: session, error } = await sb
      .from("sessions")
      .select(
        "id, code, topic, location, session_date, trainer_name, status, closed_at, companies(name,address)"
      )
      .eq("code", code)
      .single();

    if (error || !session) return NextResponse.json({ error: "Charla no existe" }, { status: 404 });

    // No exponemos nada sensible, solo info para mostrar el header
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
        company: Array.isArray((session as any).companies)
          ? (session as any).companies[0]
          : (session as any).companies,
      },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}