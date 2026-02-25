import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

function bad(msg: string, status = 400) {
  return NextResponse.json({ error: msg }, { status });
}

export async function GET(req: NextRequest) {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const service = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    if (!url || !service) return bad("Missing env vars", 500);

    const code = new URL(req.url).searchParams.get("code")?.trim().toUpperCase() || "";
    if (!code) return bad("code is required", 400);

    const sb = createClient(url, service, { auth: { persistSession: false } });

    const { data: session, error } = await sb
      .from("sessions")
      .select("id, code, topic, location, session_date, trainer_name, status, closed_at, company_id")
      .eq("code", code)
      .maybeSingle();

    if (error) return bad(error.message, 400);
    if (!session) return bad("Session not found", 404);

    // company minimal info
    let company: any = null;
    if (session.company_id) {
      const { data: c } = await sb
        .from("companies")
        .select("id, name, logo_path")
        .eq("id", session.company_id)
        .maybeSingle();
      company = c ?? null;
    }

    return NextResponse.json({
      ok: true,
      session: {
        id: session.id,
        code: session.code,
        topic: session.topic ?? null,
        location: session.location ?? null,
        session_date: session.session_date ?? null,
        trainer_name: session.trainer_name ?? null,
        status: session.status ?? null,
        closed_at: session.closed_at ?? null,
      },
      company,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}
