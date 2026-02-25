import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const service = process.env.SUPABASE_SERVICE_ROLE_KEY!;

    if (!url || !service) {
      return NextResponse.json({ error: "Missing env vars" }, { status: 500 });
    }

    const sb = createClient(url, service, { auth: { persistSession: false } });

    const [{ count: companies }, { count: sessions }, { count: attendees }, { count: pdfs }] =
      await Promise.all([
        sb.from("companies").select("id", { count: "exact", head: true }),
        sb.from("sessions").select("id", { count: "exact", head: true }),
        sb.from("attendees").select("id", { count: "exact", head: true }),
        sb.from("sessions").select("id", { count: "exact", head: true }).not("pdf_path", "is", null),
      ]);

    return NextResponse.json({
      ok: true,
      stats: {
        companies: companies || 0,
        sessions: sessions || 0,
        attendees: attendees || 0,
        pdfs: pdfs || 0,
      },
      updated_at: new Date().toISOString(),
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}
