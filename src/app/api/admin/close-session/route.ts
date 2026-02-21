export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { z } from "zod";
import { nanoid } from "nanoid";
import { createClient } from "@supabase/supabase-js";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { supabaseServer } from "@/lib/supabase/server";

const BodySchema = z.object({
  passcode: z.string().optional(),
  code: z.string().min(3),
  trainer_signature_data_url: z.string().min(20),
});

function getBearer(req: Request) {
  const auth = req.headers.get("authorization") || "";
  const m = auth.match(/^Bearer\s+(.+)$/i);
  return m?.[1] || null;
}

function parseAdminEmails(): Set<string> {
  const raw = process.env.ADMIN_EMAILS || "";
  return new Set(raw.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean));
}

// Cliente para validar usuario con bearer (anon)
function sbAuthed(token: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(url, anon, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false },
  });
}

// ✅ Cliente admin (service role) para cerrar, leer asistentes, subir PDF
function sbAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, service, { auth: { persistSession: false } });
}

function dataUrlToBytes(dataUrl: string) {
  const base64 = dataUrl.split(",")[1] ?? "";
  return Uint8Array.from(Buffer.from(base64, "base64"));
}

/**
 * Autorización:
 * 1) passcode (opcional)
 * 2) login por cookies (Supabase session normal)
 * 3) bearer token (fallback)
 */
async function authorize(req: Request, code: string, passcode?: string) {
  // 1) passcode
  if (passcode && passcode === process.env.ADMIN_PASSCODE) {
    return { ok: true as const, mode: "passcode" as const };
  }

  // 2) cookies (login normal)
  const sbCookie = supabaseServer();
  const { data: uCookie, error: uCookieErr } = await sbCookie.auth.getUser();

  if (!uCookieErr && uCookie?.user) {
    const email = (uCookie.user.email || "").toLowerCase();
    const isAdmin = parseAdminEmails().has(email);

    if (isAdmin) return { ok: true as const, mode: "cookie_admin" as const };

    // No admin: validar acceso por RLS (si el usuario puede ver la sesión, puede cerrarla)
    const { data: s, error: sErr } = await sbCookie
      .from("sessions")
      .select("id")
      .eq("code", code)
      .maybeSingle();

    if (sErr || !s) {
      return { ok: false as const, status: 403, error: "No tienes acceso a esta charla" };
    }

    return { ok: true as const, mode: "cookie" as const };
  }

  // 3) bearer fallback
  const token = getBearer(req);
  if (!token) {
    return { ok: false as const, status: 401, error: "Necesitas iniciar sesión (login) o passcode" };
  }

  const sb = sbAuthed(token);
  const { data: u, error: uerr } = await sb.auth.getUser();
  if (uerr || !u?.user) {
    return { ok: false as const, status: 401, error: "Sesión inválida" };
  }

  const isAdmin = parseAdminEmails().has((u.user.email || "").toLowerCase());
  if (isAdmin) return { ok: true as const, mode: "bearer_admin" as const };

  const { data: s, error: sErr } = await sb.from("sessions").select("id").eq("code", code).maybeSingle();
  if (sErr || !s) {
    return { ok: false as const, status: 403, error: "No tienes acceso a esta charla" };
  }

  return { ok: true as const, mode: "bearer" as const };
}

export async function POST(req: Request) {
  const json = await req.json().catch(() => null);
  const parsed = BodySchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });

  const code = parsed.data.code.toUpperCase().trim();
  const passcode = parsed.data.passcode;

  const auth = await authorize(req, code, passcode);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const sb = sbAdmin();

  // 1) buscar sesión
  const { data: session, error: sErr } = await sb
    .from("sessions")
    .select("id, status, topic, location, session_date, trainer_name, company:companies(name,address)")
    .eq("code", code)
    .maybeSingle();

  if (sErr) return NextResponse.json({ error: sErr.message }, { status: 500 });
  if (!session) return NextResponse.json({ error: "Charla no existe" }, { status: 404 });

  const st = (session.status ?? "").toString().toLowerCase();
  if (st && st !== "open") return NextResponse.json({ error: "Ya está cerrada" }, { status: 409 });

  // ✅ normalizar company (puede venir como array)
  const companyObj =
    Array.isArray((session as any).company) ? (session as any).company[0] : (session as any).company;

  // 2) subir firma relator
  const trainerParts = parsed.data.trainer_signature_data_url.split(",");
  if (trainerParts.length < 2) return NextResponse.json({ error: "Firma inválida" }, { status: 400 });

  const trainerBuffer = Buffer.from(trainerParts[1]!, "base64");
  const trainerSigPath = `trainer-signatures/${code}/${Date.now()}-${nanoid(6)}.png`;

  const upSig = await sb.storage.from("assets").upload(trainerSigPath, trainerBuffer, {
    contentType: "image/png",
    upsert: false,
  });
  if (upSig.error) return NextResponse.json({ error: upSig.error.message }, { status: 500 });

  // 3) cerrar primero
  const { error: closeErr } = await sb
    .from("sessions")
    .update({
      status: "closed",
      closed_at: new Date().toISOString(),
      trainer_signature_path: trainerSigPath,
    })
    .eq("id", session.id);

  if (closeErr) return NextResponse.json({ error: closeErr.message }, { status: 500 });

  // 4) traer asistentes
  const { data: attendees, error: aErr } = await sb
    .from("attendees")
    .select("full_name, rut, role, signature_data_url, signature_path, created_at")
    .eq("session_id", session.id)
    .order("created_at", { ascending: true });

  if (aErr) return NextResponse.json({ error: aErr.message }, { status: 500 });

  // 5) generar PDF
  try {
    const pdfDoc = await PDFDocument.create();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

    const page = pdfDoc.addPage([595.28, 841.89]); // A4
    let y = 800;

    page.drawText(`Charla: ${session.topic ?? "—"}`, { x: 40, y, size: 14, font });
    y -= 18;
    page.drawText(`Código: ${code}`, { x: 40, y, size: 12, font });
    y -= 18;
    page.drawText(`Empresa: ${companyObj?.name ?? "—"}`, { x: 40, y, size: 12, font });
    y -= 18;
    page.drawText(`Fecha: ${session.session_date ?? "—"}`, { x: 40, y, size: 12, font });
    y -= 26;

    page.drawText(`Firma Relator:`, { x: 40, y, size: 12, font });

    const trainerImg = await pdfDoc.embedPng(new Uint8Array(trainerBuffer));
    page.drawImage(trainerImg, { x: 140, y: y - 40, width: 220, height: 65 });
    y -= 90;

    page.drawText(`Asistentes (${attendees?.length ?? 0}):`, { x: 40, y, size: 12, font });
    y -= 18;

    for (const at of attendees ?? []) {
      if (y < 140) {
        y = 800;
        pdfDoc.addPage([595.28, 841.89]);
      }
      const p = pdfDoc.getPages()[pdfDoc.getPageCount() - 1];

      p.drawText(`${at.full_name} · ${at.rut}${at.role ? " · " + at.role : ""}`, {
        x: 40,
        y,
        size: 10,
        font,
      });

      let sigBytes: Uint8Array | null = null;

      if ((at as any).signature_data_url) {
        sigBytes = dataUrlToBytes((at as any).signature_data_url);
      } else if ((at as any).signature_path) {
        const dl = await sb.storage.from("assets").download((at as any).signature_path);
        if (!dl.error && dl.data) {
          const ab = await dl.data.arrayBuffer();
          sigBytes = new Uint8Array(ab);
        }
      }

      if (sigBytes) {
        const img = await pdfDoc.embedPng(sigBytes);
        p.drawImage(img, { x: 380, y: y - 20, width: 160, height: 45 });
      }

      y -= 60;
    }

    const pdfBytes = await pdfDoc.save();

    // 6) subir PDF
    const pdfPath = `pdfs/${code}/acta-${Date.now()}-${nanoid(6)}.pdf`;
    const upPdf = await sb.storage.from("assets").upload(pdfPath, Buffer.from(pdfBytes), {
      contentType: "application/pdf",
      upsert: true,
    });

    if (upPdf.error) {
      return NextResponse.json({
        ok: true,
        warning: "Sesión cerrada, pero falló subida PDF",
        error: upPdf.error.message,
      });
    }

    const { data: pub } = sb.storage.from("assets").getPublicUrl(pdfPath);

    // 7) guardar link (si tienes columnas)
    const upd = await sb.from("sessions").update({ pdf_path: pdfPath, pdf_url: pub.publicUrl }).eq("id", session.id);

    if (upd.error) {
      return NextResponse.json({
        ok: true,
        pdf_url: pub.publicUrl,
        warning: "PDF OK, pero no pude guardar pdf_url en sessions (revisa columnas)",
        error: upd.error.message,
      });
    }

    return NextResponse.json({ ok: true, pdf_url: pub.publicUrl });
  } catch (e: any) {
    return NextResponse.json({
      ok: true,
      warning: "Sesión cerrada, pero falló generación PDF",
      error: e?.message || "PDF error",
    });
  }
}