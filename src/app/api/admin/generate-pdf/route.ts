export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import { supabaseServer } from "@/lib/supabase/server";
import { cleanRut, isValidRut } from "@/lib/rut";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import path from "path";
import { readFile } from "fs/promises";

/**
 * POST /api/admin/generate-pdf (formato tipo ACHS, LOGO EMPRESA principal)
 * Body: { code, passcode, force? }
 *
 * Branding (prioridad):
 * 1) companies.logo_path (bucket company-logos) => logo principal (arriba-izquierda, grande)
 * 2) public/brand/lz-capacita-qr.png => fallback (logo app)
 * 3) public/registro-logo.png => fallback alternativo
 *
 * Seguridad:
 * - Si viene Bearer token y user es owner_id => OK sin passcode
 * - Si no, valida passcode con sessions.admin_passcode (RUT)
 *
 * Idempotencia:
 * - Si ya hay pdf_path y force=false, devuelve signed_url sin re-generar.
 */

const BodySchema = z.object({
  code: z.string().min(3),
  passcode: z.string().min(0).optional().default(""),
  force: z.boolean().optional().default(false),
});

function getBearer(req: Request) {
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

async function getAuthedUserId(req: Request): Promise<string | null> {
  const token = getBearer(req);
  if (!token) return null;

  const sb = sbAuthed(token);
  const { data, error } = await sb.auth.getUser();
  if (error || !data?.user?.id) return null;
  return data.user.id;
}

async function downloadBucketBytes(bucket: string, pathInBucket: string) {
  const sb = supabaseServer();
  const { data, error } = await sb.storage.from(bucket).download(pathInBucket);
  if (error || !data) throw new Error(error?.message || `No se pudo descargar archivo (${bucket})`);
  const ab = await data.arrayBuffer();
  return Buffer.from(ab);
}

function normalizeCompany(session: any) {
  const c = session?.companies;
  return Array.isArray(c) ? c[0] : c;
}

function safeStr(v: any) {
  const s = typeof v === "string" ? v : v == null ? "" : String(v);
  return s.trim();
}

function fmtCL(iso?: any) {
  try {
    if (!iso) return "-";
    return new Date(iso).toLocaleString("es-CL");
  } catch {
    return "-";
  }
}

function wrapText(text: string, font: any, size: number, maxWidth: number, maxLines = 2) {
  const words = String(text ?? "").split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";

  for (const w of words) {
    const candidate = line ? `${line} ${w}` : w;
    const width = font.widthOfTextAtSize(candidate, size);
    if (width <= maxWidth) line = candidate;
    else {
      if (line) lines.push(line);
      line = w;
      if (lines.length >= maxLines - 1) break;
    }
  }
  if (line && lines.length < maxLines) lines.push(line);

  let last = lines[lines.length - 1] || "";
  while (font.widthOfTextAtSize(last, size) > maxWidth && last.length > 2) {
    last = last.slice(0, -2) + "…";
    lines[lines.length - 1] = last;
  }

  return lines.length ? lines : ["-"];
}

function scaleToFit(w: number, h: number, maxW: number, maxH: number) {
  const s = Math.min(maxW / w, maxH / h);
  return { w: w * s, h: h * s };
}

export async function POST(req: NextRequest) {
  try {
    const parsed = BodySchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });

    const code = parsed.data.code.toUpperCase().trim();
    const passcodeRaw = (parsed.data.passcode || "").trim();
    const force = !!parsed.data.force;

    const sb = supabaseServer();

    const { data: session, error: sErr } = await sb
      .from("sessions")
      .select(
        "id, owner_id, code, topic, location, session_date, trainer_name, status, closed_at, trainer_signature_path, admin_passcode, pdf_path, pdf_generated_at, companies(name, legal_name, rut, address, logo_path)"
      )
      .eq("code", code)
      .single();

    if (sErr || !session) return NextResponse.json({ error: "Charla no existe" }, { status: 404 });

    if ((session as any).status !== "closed") {
      return NextResponse.json({ error: "Primero debes cerrar la charla con firma del relator." }, { status: 409 });
    }

    // Seguridad (owner shortcut)
    const authedUserId = await getAuthedUserId(req);
    const isOwner = !!authedUserId && authedUserId === (session as any).owner_id;

    if (!isOwner) {
      const provided = cleanRut(passcodeRaw);
      const expected = (session as any).admin_passcode ? cleanRut(String((session as any).admin_passcode)) : null;

      if (expected) {
        if (!isValidRut(provided)) return NextResponse.json({ error: "RUT/passcode inválido" }, { status: 400 });
        if (provided !== expected) return NextResponse.json({ error: "RUT/passcode incorrecto" }, { status: 401 });
      } else {
        if (!process.env.ADMIN_PASSCODE || passcodeRaw !== process.env.ADMIN_PASSCODE) {
          return NextResponse.json({ error: "Passcode incorrecto (configura sessions.admin_passcode)" }, { status: 401 });
        }
      }
    }

    // Idempotencia
    const existingPdfPath = (session as any).pdf_path ? String((session as any).pdf_path) : null;
    if (existingPdfPath && !force) {
      const { data: signed, error: signErr } = await sb.storage.from("assets").createSignedUrl(existingPdfPath, 60 * 60);
      if (signErr || !signed) return NextResponse.json({ error: signErr?.message || "No se pudo firmar URL" }, { status: 500 });
      return NextResponse.json({ ok: true, pdf_path: existingPdfPath, signed_url: signed.signedUrl, reused: true });
    }

    const company = normalizeCompany(session);

    const empresa = safeStr(company?.name) || "-";
    const razonSocial = safeStr(company?.legal_name) || empresa;
    const rutEmpresa = safeStr(company?.rut) || "-";
    const direccion = safeStr(company?.address) || "-";

    const tema = safeStr((session as any).topic) || "-";
    const lugar = safeStr((session as any).location) || "-";
    const relator = safeStr((session as any).trainer_name) || "-";
    const fechaCharla = fmtCL((session as any).session_date);
    const fechaCierre = fmtCL((session as any).closed_at);

    const { data: attendees, error: aErr } = await sb
      .from("attendees")
      .select("full_name, rut, role, created_at, signature_path")
      .eq("session_id", (session as any).id)
      .order("created_at", { ascending: true });

    if (aErr) return NextResponse.json({ error: aErr.message }, { status: 500 });

    const attendeeCount = Array.isArray(attendees) ? attendees.length : 0;

    // PDF setup
    const pdfDoc = await PDFDocument.create();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    // A4 portrait
    const pageW = 595.28;
    const pageH = 841.89;
    const margin = 28;
    const contentW = pageW - margin * 2;

    // App logo fallback (PNG)
    let appLogo: any = null;
    try {
      const p1 = path.join(process.cwd(), "public", "brand", "lz-capacita-qr.png");
      appLogo = await pdfDoc.embedPng(await readFile(p1));
    } catch {
      try {
        const p2 = path.join(process.cwd(), "public", "registro-logo.png");
        appLogo = await pdfDoc.embedPng(await readFile(p2));
      } catch {}
    }

    // Company logo from bucket company-logos (if any)
    let companyLogo: any = null;
    const logoPathRaw = company?.logo_path ?? null;
    if (logoPathRaw) {
      try {
        const logoPath = String(logoPathRaw).replace(/^company-logos\//, "");
        const bytes = await downloadBucketBytes("company-logos", logoPath);
        try {
          companyLogo = await pdfDoc.embedPng(bytes);
        } catch {
          companyLogo = await pdfDoc.embedJpg(bytes);
        }
      } catch {
        companyLogo = null;
      }
    }

    const primaryLogo = companyLogo ?? appLogo;

    const addPage = () => pdfDoc.addPage([pageW, pageH]);
    let page = addPage();

    // Drawing helpers (yTop coordinates)
    function rect(x: number, yTop: number, w: number, h: number, opts?: { fillGray?: boolean; border?: number }) {
      page.drawRectangle({
        x,
        y: yTop - h,
        width: w,
        height: h,
        color: opts?.fillGray ? rgb(0.92, 0.92, 0.92) : undefined,
        borderColor: rgb(0, 0, 0),
        borderWidth: opts?.border ?? 1,
      });
    }

    function text(t: string, x: number, yTop: number, size = 10, bold = false) {
      page.drawText(String(t ?? ""), {
        x,
        y: yTop - size,
        size,
        font: bold ? fontBold : font,
        color: rgb(0, 0, 0),
      });
    }

    function textCenter(t: string, yTop: number, size = 14, bold = true) {
      const s = String(t ?? "");
      const w = (bold ? fontBold : font).widthOfTextAtSize(s, size);
      const x = (pageW - w) / 2;
      text(s, x, yTop, size, bold);
    }

    function drawLabelValuePair(x: number, yTop: number, totalW: number, h: number, label: string, value: string) {
      const labelW = 120;
      const valueW = Math.max(40, totalW - labelW);

      rect(x, yTop, labelW, h, { fillGray: true, border: 1 });
      rect(x + labelW, yTop, valueW, h, { border: 1 });

      text(label, x + 6, yTop - 7, 9, true);

      const pad = 6;
      const maxW = valueW - pad * 2;
      const lines = wrapText(value || "-", font, 9.5, maxW, 2);
      let yy = yTop - 7;
      for (const line of lines) {
        text(line, x + labelW + pad, yy, 9.5, false);
        yy -= 11;
      }
    }

    function draw4ColRow(yTop: number, h: number, l1: string, v1: string, l2: string, v2: string) {
      const half = contentW / 2;
      drawLabelValuePair(margin, yTop, half, h, l1, v1);
      drawLabelValuePair(margin + half, yTop, half, h, l2, v2);
    }

    // ===== LAYOUT START =====
    let cursorY = pageH - margin;

    // Logo principal grande arriba izquierda
    const logoMax = 92;
    if (primaryLogo) {
      const s = scaleToFit(primaryLogo.width, primaryLogo.height, logoMax, logoMax);
      page.drawImage(primaryLogo, { x: margin, y: cursorY - s.h, width: s.w, height: s.h });
    } else {
      text("LZ Capacita QR", margin, cursorY - 12, 14, true);
    }

    // Title centered
    textCenter("REGISTRO DE ASISTENCIA", cursorY - 24, 16, true);
    textCenter("Capacitación / Charla", cursorY - 42, 10, false);
    textCenter(`Código: ${code}`, cursorY - 56, 10, false);

    cursorY -= 98;

    // Datos (cuadrado)
    const rowH = 26;
    rect(margin, cursorY, contentW, rowH * 4, { border: 1 });

    draw4ColRow(cursorY, rowH, "Razón Social:", razonSocial, "Dirección:", direccion);
    draw4ColRow(cursorY - rowH, rowH, "RUT Empresa:", rutEmpresa, "Lugar:", lugar);
    draw4ColRow(cursorY - rowH * 2, rowH, "Temática:", tema, "Fecha Charla:", fechaCharla);
    draw4ColRow(cursorY - rowH * 3, rowH, "Relator:", relator, "Cierre:", fechaCierre);

    cursorY -= rowH * 4;

    // Contenidos (bloque)
    const contH = 130;
    const labelW = 120;

    rect(margin, cursorY, labelW, contH, { fillGray: true, border: 1 });
    rect(margin + labelW, cursorY, contentW - labelW, contH, { border: 1 });
    text("Contenidos Charla:", margin + 6, cursorY - 12, 9, true);

    const contLines = [
      `• Tema: ${tema}`,
      `• Fecha charla: ${fechaCharla}`,
      `• Asistentes: ${attendeeCount}`,
      "",
      "Observaciones: ________________________________",
      "_______________________________________________",
    ];

    let contY = cursorY - 14;
    const contX = margin + labelW + 8;
    for (const line of contLines) {
      text(line || " ", contX, contY, 9.5, false);
      contY -= 14;
    }

    cursorY -= contH;

    // Firma relator
    const sigH = 70;
    rect(margin, cursorY, labelW, sigH, { fillGray: true, border: 1 });
    rect(margin + labelW, cursorY, contentW - labelW, sigH, { border: 1 });
    text("Firma Relator:", margin + 6, cursorY - 12, 9, true);

    if ((session as any).trainer_signature_path) {
      try {
        const imgBytes = await downloadBucketBytes("assets", String((session as any).trainer_signature_path));
        const sigImg = await pdfDoc.embedPng(imgBytes);
        const s = scaleToFit(sigImg.width, sigImg.height, contentW - labelW - 16, sigH - 16);
        page.drawImage(sigImg, {
          x: margin + labelW + 8 + (contentW - labelW - 16 - s.w) / 2,
          y: cursorY - sigH + 8 + (sigH - 16 - s.h) / 2,
          width: s.w,
          height: s.h,
        });
      } catch {
        // ignore
      }
    }

    cursorY -= sigH + 14;

    // Tabla participantes
    text("Listado de participantes", margin, cursorY, 11, true);
    cursorY -= 14;

    const col = {
      rut: 90,
      name: 170,
      role: 110,
      company: 120,
      sig: contentW - (90 + 170 + 110 + 120),
    };

    function drawParticipantsHeader(yTop: number) {
      const h = 22;

      rect(margin, yTop, col.rut, h, { fillGray: true, border: 1 });
      rect(margin + col.rut, yTop, col.name, h, { fillGray: true, border: 1 });
      rect(margin + col.rut + col.name, yTop, col.role, h, { fillGray: true, border: 1 });
      rect(margin + col.rut + col.name + col.role, yTop, col.company, h, { fillGray: true, border: 1 });
      rect(margin + col.rut + col.name + col.role + col.company, yTop, col.sig, h, { fillGray: true, border: 1 });

      text("Rut", margin + 6, yTop - 7, 9.5, true);
      text("Nombre", margin + col.rut + 6, yTop - 7, 9.5, true);
      text("Cargo", margin + col.rut + col.name + 6, yTop - 7, 9.5, true);
      text("Empresa", margin + col.rut + col.name + col.role + 6, yTop - 7, 9.5, true);
      text("Firma", margin + col.rut + col.name + col.role + col.company + 6, yTop - 7, 9.5, true);

      return h;
    }

    function startNewParticipantsPage() {
      page = addPage();
      cursorY = pageH - margin;

      // Header mini: logo (empresa o app)
      const miniMax = 54;
      if (primaryLogo) {
        const s = scaleToFit(primaryLogo.width, primaryLogo.height, miniMax, miniMax);
        page.drawImage(primaryLogo, { x: margin, y: cursorY - s.h, width: s.w, height: s.h });
      }
      text(`Código: ${code} — ${tema}`, margin + 140, cursorY - 16, 10, true);

      cursorY -= 64;
      const hh = drawParticipantsHeader(cursorY);
      cursorY -= hh;
    }

    const firstHeaderH = drawParticipantsHeader(cursorY);
    cursorY -= firstHeaderH;

    const rowH2 = 36;
    const pad = 6;

    for (let i = 0; i < (attendees?.length ?? 0); i++) {
      const a: any = (attendees as any[])[i];

      if (cursorY - rowH2 < margin + 22) startNewParticipantsPage();

      rect(margin, cursorY, contentW, rowH2, { border: 1 });

      const x1 = margin + col.rut;
      const x2 = x1 + col.name;
      const x3 = x2 + col.role;
      const x4 = x3 + col.company;

      page.drawLine({ start: { x: x1, y: cursorY - rowH2 }, end: { x: x1, y: cursorY }, thickness: 1, color: rgb(0, 0, 0) });
      page.drawLine({ start: { x: x2, y: cursorY - rowH2 }, end: { x: x2, y: cursorY }, thickness: 1, color: rgb(0, 0, 0) });
      page.drawLine({ start: { x: x3, y: cursorY - rowH2 }, end: { x: x3, y: cursorY }, thickness: 1, color: rgb(0, 0, 0) });
      page.drawLine({ start: { x: x4, y: cursorY - rowH2 }, end: { x: x4, y: cursorY }, thickness: 1, color: rgb(0, 0, 0) });

      const rut = safeStr(a.rut) || "-";
      const name = safeStr(a.full_name) || "-";
      const roleTxt = safeStr(a.role) || "Persona trabajadora";

      text(rut, margin + pad, cursorY - 10, 9.5, false);

      const nameLines = wrapText(name, font, 9.5, col.name - pad * 2, 2);
      let ny = cursorY - 10;
      for (const ln of nameLines) {
        text(ln, margin + col.rut + pad, ny, 9.5, false);
        ny -= 12;
      }

      const roleLines = wrapText(roleTxt, font, 9.5, col.role - pad * 2, 2);
      let ry = cursorY - 10;
      for (const ln of roleLines) {
        text(ln, margin + col.rut + col.name + pad, ry, 9.5, false);
        ry -= 12;
      }

      const compLines = wrapText(empresa, font, 9.5, col.company - pad * 2, 2);
      let cy = cursorY - 10;
      for (const ln of compLines) {
        text(ln, margin + col.rut + col.name + col.role + pad, cy, 9.5, false);
        cy -= 12;
      }

      const sigX = margin + col.rut + col.name + col.role + col.company + 6;
      const sigY = cursorY - rowH2 + 6;
      const sigW = col.sig - 12;
      const sigH2 = rowH2 - 12;

      if (a.signature_path) {
        try {
          const imgBytes = await downloadBucketBytes("assets", String(a.signature_path));
          const png = await pdfDoc.embedPng(imgBytes);
          const s = scaleToFit(png.width, png.height, sigW, sigH2);
          page.drawImage(png, {
            x: sigX + (sigW - s.w) / 2,
            y: sigY + (sigH2 - s.h) / 2,
            width: s.w,
            height: s.h,
          });
        } catch {
          // ignore
        }
      }

      cursorY -= rowH2;
    }

    if (cursorY - 16 > margin) {
      text(`Generado por LZ Capacita QR · ${fmtCL(new Date().toISOString())}`, margin, cursorY - 6, 8.5, false);
    }

    const pdfBytes = await pdfDoc.save();
    const pdfPath = `reports/${code}/registro-${Date.now()}.pdf`;

    const up = await sb.storage.from("assets").upload(pdfPath, Buffer.from(pdfBytes), {
      contentType: "application/pdf",
      upsert: false,
    });

    if (up.error) return NextResponse.json({ error: up.error.message }, { status: 500 });

    const nowIso = new Date().toISOString();
    const { error: updErr } = await sb
      .from("sessions")
      .update({ pdf_path: pdfPath, pdf_generated_at: nowIso })
      .eq("id", (session as any).id);

    const { data: signed, error: signErr } = await sb.storage.from("assets").createSignedUrl(pdfPath, 60 * 60);
    if (signErr || !signed) return NextResponse.json({ error: signErr?.message || "No se pudo firmar URL" }, { status: 500 });

    if (updErr) {
      return NextResponse.json({
        ok: true,
        pdf_path: pdfPath,
        signed_url: signed.signedUrl,
        warning: "PDF OK, pero no pude guardar pdf_path/pdf_generated_at en sessions (revisa columnas/RLS).",
        error: updErr.message,
      });
    }

    return NextResponse.json({ ok: true, pdf_path: pdfPath, signed_url: signed.signedUrl });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ error: e?.message || "Error interno" }, { status: 500 });
  }
}
