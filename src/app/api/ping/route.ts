import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

export const runtime = "nodejs";


export async function GET() {
    const sb = supabaseServer();

    // Prueba simple: leer tablas
    const { data, error } = await sb.from("companies").select("id").limit(1);

    if (error) {
        return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, sample: data });
}