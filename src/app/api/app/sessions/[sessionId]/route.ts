import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

function getToken(req: NextRequest) {
  const auth = req.headers.get("authorization") || "";
  const m = auth.match(/^Bearer\s+(.+)$/i);
  return m?.[1] || null;
}

function sbAuthed(token: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(url, anon, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false },
  });
}

async function requireUser(req: NextRequest) {
  const token = getToken(req);
  if (!token) {
    return { ok: false as const, status: 401, error: "Missing bearer token" };
  }

  const supabase = sbAuthed(token);
  const { data: u, error: uerr } = await supabase.auth.getUser();

  if (uerr || !u?.user) {
    return { ok: false as const, status: 401, error: "Unauthorized" };
  }

  return { ok: true as const, supabase, user: u.user };
}

/**
 * ✅ A prueba de balas:
 * 1) intenta params.sessionId
 * 2) fallback: lee el último segmento de req.nextUrl.pathname
 */
function getSessionId(req: NextRequest, params?: any): string | null {
  const fromParams = params?.sessionId;
  if (typeof fromParams === "string" && fromParams.trim()) return fromParams.trim();

  const path = req.nextUrl.pathname; // /api/app/sessions/<id>
  const parts = path.split("/").filter(Boolean);
  const last = parts[parts.length - 1];

  // si quedó en /api/app/sessions (sin id), last sería "sessions"
  if (!last || last === "sessions") return null;

  return last;
}

export async function GET(req: NextRequest, context: any) {
  try {
    const sessionId = getSessionId(req, context?.params);
    if (!sessionId) return NextResponse.json({ error: "Missing sessionId" }, { status: 400 });

    const auth = await requireUser(req);
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const { data, error } = await auth.supabase
      .from("sessions")
      .select("*")
      .eq("id", sessionId)
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ session: data });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, context: any) {
  try {
    const sessionId = getSessionId(req, context?.params);
    if (!sessionId) return NextResponse.json({ error: "Missing sessionId" }, { status: 400 });

    const auth = await requireUser(req);
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const body = await req.json().catch(() => ({}));
    const patch: any = {};

    if (typeof body.topic === "string") patch.topic = body.topic.trim();
    if (typeof body.trainer_name === "string") patch.trainer_name = body.trainer_name.trim();

    if (typeof body.location === "string" || body.location === null) {
      patch.location = body.location ? String(body.location).trim() : null;
    }

    if (typeof body.session_date === "string" || body.session_date === null) {
      patch.session_date = body.session_date ? String(body.session_date) : null;
    }

    const { data, error } = await auth.supabase
      .from("sessions")
      .update(patch)
      .eq("id", sessionId)
      .select("*")
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ session: data });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, context: any) {
  try {
    const sessionId = getSessionId(req, context?.params);
    if (!sessionId) return NextResponse.json({ error: "Missing sessionId" }, { status: 400 });

    const auth = await requireUser(req);
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    // 1) Traer sesión para limpiar firma del relator si existe
    const { data: session, error: sErr } = await auth.supabase
      .from("sessions")
      .select("id, code, trainer_signature_path")
      .eq("id", sessionId)
      .single();

    if (sErr || !session) {
      return NextResponse.json({ error: sErr?.message || "Charla no encontrada" }, { status: 404 });
    }

    // 2) Bloquear si tiene asistentes
    const { count, error: cntErr } = await auth.supabase
      .from("attendees")
      .select("id", { count: "exact", head: true })
      .eq("session_id", sessionId);

    if (cntErr) return NextResponse.json({ error: cntErr.message }, { status: 400 });
    if ((count ?? 0) > 0) {
      return NextResponse.json(
        { error: "No puedes eliminar esta charla porque ya tiene asistentes registrados." },
        { status: 409 }
      );
    }

    // 3) Borrar firma relator si existe
    if (session.trainer_signature_path) {
      await auth.supabase.storage.from("assets").remove([String(session.trainer_signature_path)]);
    }

    // 4) Borrar sesión
    const { error: delErr } = await auth.supabase.from("sessions").delete().eq("id", sessionId);
    if (delErr) return NextResponse.json({ error: delErr.message }, { status: 400 });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}