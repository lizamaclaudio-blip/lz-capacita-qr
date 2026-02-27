import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { cleanRut, isValidRut } from "@/lib/rut";
import { guardCheckinCapacity } from "@/lib/planGuard";
import { normalizePlanTier } from "@/lib/planTier";

export const dynamic = "force-dynamic";

function bad(msg: string, status = 400) {
  return NextResponse.json({ error: msg }, { status });
}

function parseDataUrlPng(dataUrl: string) {
  const m = String(dataUrl || "").match(/^data:image\/(png);base64,(.+)$/i);
  if (!m) return null;
  const b64 = m[2] || "";
  if (!b64 || b64.length < 50) return null; // evita "vacío"
  const buf = Buffer.from(b64, "base64");
  if (!buf || buf.length < 200) return null;
  return buf;
}

export async function POST(req: NextRequest) {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const service = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    if (!url || !service) return bad("Missing env vars", 500);

    const body = await req.json().catch(() => null);
    if (!body) return bad("Invalid JSON body", 400);

    const code = String(body.code || "").trim().toUpperCase();
    const full_name = String(body.full_name || body.name || "").trim();
    const role = String(body.role || body.cargo || "").trim();
    const rutInput = String(body.rut || "").trim();
    const signature = String(body.signature || body.signature_data_url || "").trim();

    if (!code) return bad("code is required", 400);
    if (!full_name) return bad("full_name is required", 400);
    if (!rutInput) return bad("rut is required", 400);
    if (!role) return bad("role is required", 400);
    if (!signature) return bad("signature is required", 400);

    const rut = cleanRut(rutInput);
    if (!isValidRut(rut)) return bad("RUT inválido (DV incorrecto)", 400);

    const sb = createClient(url, service, { auth: { persistSession: false } });

    const { data: session, error: sErr } = await sb
      .from("sessions")
      .select("id, code, status, closed_at, company_id, owner_id")
      .eq("code", code)
      .maybeSingle();

    if (sErr) return bad(sErr.message, 400);
    if (!session) return bad("Session not found", 404);

    const isClosed = (session.status || "").toLowerCase() === "closed" || !!session.closed_at;
    if (isClosed) return bad("Session is closed", 409);

    // ✅ Plan gate: máximo asistentes por charla
    try {
      const ownerId = (session as any).owner_id as string | undefined;
      if (ownerId) {
        const { data: u } = await sb.auth.admin.getUserById(ownerId);
        const md: any = u?.user?.user_metadata || {};
        const email = String(u?.user?.email || "").toLowerCase();
        // Owner emails => diamante
        const ownerEmails = (process.env.NEXT_PUBLIC_OWNER_EMAILS || "")
          .split(",")
          .map((s) => s.trim().toLowerCase())
          .filter(Boolean);
        const isOwner = ownerEmails.length ? ownerEmails.includes(email) : email === "lizamaclaudio@gmail.com";
        const tier = isOwner ? "diamante" : normalizePlanTier(md.plan_tier || md.plan || md.tier);

        const cap = await guardCheckinCapacity(sb, session.id, tier);
        if (!cap.ok) return bad(cap.error, cap.status);
      }
    } catch {
      // si falla el gate, no bloqueamos el check-in (fail-open)
    }

    // Prevent duplicates by session_id + rut
    const { data: existing, error: eErr } = await sb
      .from("attendees")
      .select("id")
      .eq("session_id", session.id)
      .eq("rut", rut)
      .maybeSingle();

    if (eErr) return bad(eErr.message, 400);
    if (existing?.id) return bad("Already checked in", 409);

    const png = parseDataUrlPng(signature);
    if (!png) return bad("Firma inválida o vacía (PNG base64)", 400);

    const stamp = Date.now();
    const rand = Math.random().toString(16).slice(2);
    const path = `signatures/${session.id}/${rut}-${stamp}-${rand}.png`;

    const { error: upErr } = await sb.storage.from("assets").upload(path, png, {
      contentType: "image/png",
      upsert: false,
    });

    if (upErr) return bad(upErr.message, 400);

    const { data: attendee, error: insErr } = await sb
      .from("attendees")
      .insert({
        session_id: session.id,
        rut,
        full_name,
        role,
        signature_path: path,
      })
      .select("id, created_at, rut, full_name, role, signature_path")
      .maybeSingle();

    if (insErr) return bad(insErr.message, 400);

    return NextResponse.json({
      ok: true,
      attendee,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}
