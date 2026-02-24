export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { supabaseServer } from "@/lib/supabase/server";
import { cleanRut, isValidRut } from "@/lib/rut";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import path from "path";
import { readFile } from "fs/promises";

/** Body */
const BodySchema = z.object({
  code: z.string().min(3),
  passcode: z.string().min(3), // RUT del relator (clave)
});

/** Storage download (bucket flexible) */
async function downloadBucketBytes(bucket: string, pathInBucket: string) {
  const sb = supabaseServer();
  const { data, error } = await sb.storage.from(bucket).download(pathInBucket);
  if (error || !data) throw new Error(error?.message || `No se pudo descargar archivo (${bucket})`);
  const ab = await data.arrayBuffer();
  return Buffer.from(ab);
}

function clampText(text: string, max: number) {
  const t = String(text ?? "");
  return t.length > max ? t.slice(0, max - 1) + "…" : t;
}

function normalizeRutPretty(rut: any) {
  return String(rut ?? "")
    .replace(/[^0-9kK]/g, "")
    .toUpperCase();
}

function formatRutPretty(rut: any) {
  const clean = normalizeRutPretty(rut);
  if (!clean) return "-";
  if (clean.length === 1) return clean;

  const dv = clean.slice(-1);
  const num = clean.slice(0, -1).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${num}-${dv}`;
}

function formatDateParts(d: any) {
  try {
    if (!d) return { date: "-", time: "-" };
    const dt = new Date(d);

    const date = dt.toLocaleDateString("es-CL", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });

    const time = dt.toLocaleTimeString("es-CL", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });

    return { date, time };
  } catch {
    return { date: "-", time: "-" };
  }
}

function formatDateFull(d: any) {
  try {
    if (!d) return "-";
    return new Date(d).toLocaleString("es-CL");
  } catch {
    return "-";
  }
}

function wrapLines(text: string, font: any, size: number, maxWidth: number) {
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
    }
  }
  if (line) lines.push(line);
  return lines.length ? lines : ["-"];
}

function fitWithEllipsis(str: string, font: any, size: number, maxWidth: number) {
  let s = str;
  const ell = "…";
  while (s.length > 0 && font.widthOfTextAtSize(s + ell, size) > maxWidth) {
    s = s.slice(0, -1);
  }
  return s.length ? s + ell : ell;
}

function scaleToFit(w: number, h: number, maxW: number, maxH: number) {
  const s = Math.min(maxW / w, maxH / h);
  return { w: w * s, h: h * s };
}

export async function POST(req: NextRequest) {
  try {
    const json = await req.json().catch(() => null);
    const parsed = BodySchema.safeParse(json);
    if (!parsed.success) return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });

    const code = parsed.data.code.toUpperCase().trim();
    const passcodeRaw = parsed.data.passcode.trim();

    const sb = supabaseServer();

    // 1) Traer sesión + empresa + admin_passcode + logo_path
    const { data: session, error: sErr } = await sb
      .from("sessions")
      .select(
        "id, code, topic, location, session_date, trainer_name, status, closed_at, trainer_signature_path, admin_passcode, pdf_path, pdf_generated_at, companies(name, legal_name, rut, address, logo_path)"
      )
      .eq("code", code)
      .single();

    if (sErr || !session) return NextResponse.json({ error: "Charla no existe" }, { status: 404 });

    // 2) Validar passcode (RUT del relator) vs admin_passcode
    const provided = cleanRut(passcodeRaw);
    if (!isValidRut(provided)) {
      return NextResponse.json({ error: "RUT/passcode inválido" }, { status: 400 });
    }

    const expected = (session as any).admin_passcode ? cleanRut(String((session as any).admin_passcode)) : null;

    if (expected) {
      if (provided !== expected) {
        return NextResponse.json({ error: "RUT/passcode incorrecto" }, { status: 401 });
      }
    } else {
      // Fallback opcional mientras migras (si quieres puedes eliminar esto)
      if (!process.env.ADMIN_PASSCODE || passcodeRaw !== process.env.ADMIN_PASSCODE) {
        return NextResponse.json(
          { error: "Passcode incorrecto (configura sessions.admin_passcode)" },
          { status: 401 }
        );
      }
    }

    // 3) Debe estar cerrada
    if ((session as any).status !== "closed") {
      return NextResponse.json(
        { error: "Primero debes cerrar la charla con firma del relator." },
        { status: 409 }
      );
    }

    const company = Array.isArray((session as any).companies)
      ? (session as any).companies[0]
      : (session as any).companies;

    const empresa = company?.name ?? "";
    const razonSocial = company?.legal_name ?? "";
    const rutEmpresa = company?.rut ?? "";
    const direccion = company?.address ?? "-";
    const logoPathRaw = company?.logo_path ?? null;

    const tema = (session as any).topic ?? "";
    const lugar = (session as any).location ?? "-";

    const fechaCharla = formatDateFull((session as any).session_date);
    const fechaCierre = formatDateFull((session as any).closed_at);

    // 4) Asistentes
    const { data: attendees, error: aErr } = await sb
      .from("attendees")
      .select("full_name, rut, role, created_at, signature_path")
      .eq("session_id", (session as any).id)
      .order("created_at", { ascending: true });

    if (aErr) return NextResponse.json({ error: aErr.message }, { status: 500 });

    // 5) PDF
    const pdfDoc = await PDFDocument.create();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    const pageW = 595.28; // A4
    const pageH = 841.89;
    const margin = 36;
    const contentW = pageW - margin * 2;

    // Logo LZ (brand)
    let brandLogo: any = null;
    try {
      const logoPathNew = path.join(process.cwd(), "public", "brand", "lz-capacita-qr.png");
      const bytes = await readFile(logoPathNew);
      brandLogo = await pdfDoc.embedPng(bytes);
    } catch {
      try {
        const logoPathOld = path.join(process.cwd(), "public", "registro-logo.png");
        const bytes = await readFile(logoPathOld);
        brandLogo = await pdfDoc.embedPng(bytes);
      } catch {}
    }

    // Logo empresa (desde bucket company-logos)
    let companyLogo: any = null;
    if (logoPathRaw) {
      try {
        const logoPath = String(logoPathRaw).replace(/^company-logos\//, "");
        const bytes = await downloadBucketBytes("company-logos", logoPath);
        // intentar png, si no, jpg
        try {
          companyLogo = await pdfDoc.embedPng(bytes);
        } catch {
          companyLogo = await pdfDoc.embedJpg(bytes);
        }
      } catch {
        companyLogo = null;
      }
    }

    const addPage = () => pdfDoc.addPage([pageW, pageH]);

    let page = addPage();
    let y = pageH - margin;

    const drawLine = (x1: number, y1: number, x2: number, y2: number, w = 1) => {
      page.drawLine({
        start: { x: x1, y: y1 },
        end: { x: x2, y: y2 },
        thickness: w,
        color: rgb(0, 0, 0),
      });
    };

    const drawBox = (x: number, yBottom: number, w: number, h: number, lineW = 1) => {
      page.drawRectangle({
        x,
        y: yBottom,
        width: w,
        height: h,
        borderColor: rgb(0, 0, 0),
        borderWidth: lineW,
      });
    };

    // HEADER
    const headerH = 110;
    const headerBottom = y - headerH;
    drawBox(margin, headerBottom, contentW, headerH, 1);

    // Draw brand logo left
    let brandW = 0;
    if (brandLogo) {
      const maxH = 52;
      const maxW = 170;
      const s = scaleToFit(brandLogo.width, brandLogo.height, maxW, maxH);
      brandW = s.w;

      page.drawImage(brandLogo, {
        x: margin + 12,
        y: headerBottom + headerH - s.h - 14,
        width: s.w,
        height: s.h,
      });
    }

    // Draw company logo right
    let compW = 0;
    if (companyLogo) {
      const maxH = 52;
      const maxW = 170;
      const s = scaleToFit(companyLogo.width, companyLogo.height, maxW, maxH);
      compW = s.w;

      page.drawImage(companyLogo, {
        x: margin + contentW - 12 - s.w,
        y: headerBottom + headerH - s.h - 14,
        width: s.w,
        height: s.h,
      });
    }

    const leftX = margin + 12;
    const rightX = margin + contentW * 0.62;

    // Title line (between logos)
    y = headerBottom + headerH - 22;
    const title = "REGISTRO DE ASISTENCIA – CHARLA";
    const titleX = leftX + (brandW ? brandW + 14 : 0);
    const titleMaxW =
      margin + contentW - 12 - (compW ? compW + 14 : 0) - titleX;
    const titleText =
      titleMaxW > 60 && fontBold.widthOfTextAtSize(title, 14) > titleMaxW
        ? fitWithEllipsis(title, fontBold, 14, titleMaxW)
        : title;

    page.drawText(titleText, {
      x: titleX,
      y,
      size: 14,
      font: fontBold,
      color: rgb(0, 0, 0),
    });

    // Info lines
    y -= 18;
    page.drawText(`Empresa: ${clampText(empresa, 45)}`, { x: leftX, y, size: 10, font: fontBold });
    page.drawText(`Código: ${(session as any).code}`, { x: rightX, y, size: 10, font: fontBold });

    y -= 13;
    page.drawText(`Razón social: ${clampText(razonSocial || "-", 55)}`, { x: leftX, y, size: 9, font });
    page.drawText(`Fecha charla: ${fechaCharla}`, { x: rightX, y, size: 9, font });

    y -= 13;
    page.drawText(`RUT empresa: ${formatRutPretty(rutEmpresa)}`, { x: leftX, y, size: 9, font });
    page.drawText(`Cerrada: ${fechaCierre}`, { x: rightX, y, size: 9, font });

    y -= 13;
    page.drawText(`Dirección: ${clampText(direccion, 55)}`, { x: leftX, y, size: 9, font });
    page.drawText(`Relator: ${(session as any).trainer_name ?? ""}`, { x: rightX, y, size: 9, font });

    y -= 13;
    page.drawText(`Tema: ${clampText(tema, 55)}`, { x: leftX, y, size: 9, font: fontBold });
    page.drawText(`Lugar: ${clampText(lugar, 45)}`, { x: rightX, y, size: 9, font });

    y = headerBottom - 18;

    // TABLA
    const col = {
      n: 20,
      nombre: 165,
      rut: 80,
      cargo: 85,
      hora: 70,
      firma: contentW - (20 + 165 + 80 + 85 + 70),
    };

    const x0 = margin;
    const xN = x0;
    const xNombre = xN + col.n;
    const xRut = xNombre + col.nombre;
    const xCargo = xRut + col.rut;
    const xHora = xCargo + col.cargo;
    const xFirma = xHora + col.hora;

    const headerRowH = 22;
    const rowH = 52;

    const drawTableHeader = () => {
      page.drawRectangle({
        x: x0,
        y: y - headerRowH,
        width: contentW,
        height: headerRowH,
        color: rgb(0.95, 0.95, 0.95),
        borderColor: rgb(0, 0, 0),
        borderWidth: 1,
      });

      const yy = y - 15;
      page.drawText("N°", { x: xN + 6, y: yy, size: 10, font: fontBold });
      page.drawText("Nombre", { x: xNombre + 6, y: yy, size: 10, font: fontBold });
      page.drawText("RUT", { x: xRut + 6, y: yy, size: 10, font: fontBold });
      page.drawText("Cargo", { x: xCargo + 6, y: yy, size: 10, font: fontBold });
      page.drawText("Hora", { x: xHora + 6, y: yy, size: 10, font: fontBold });
      page.drawText("Firma", { x: xFirma + 6, y: yy, size: 10, font: fontBold });

      drawLine(xNombre, y, xNombre, y - headerRowH);
      drawLine(xRut, y, xRut, y - headerRowH);
      drawLine(xCargo, y, xCargo, y - headerRowH);
      drawLine(xHora, y, xHora, y - headerRowH);
      drawLine(xFirma, y, xFirma, y - headerRowH);

      y -= headerRowH;
    };

    const ensureSpace = (need: number) => {
      if (y - need < margin + 160) {
        page = addPage();
        y = pageH - margin;

        page.drawText(`Registro de asistencia – ${empresa}`, {
          x: margin,
          y,
          size: 10,
          font: fontBold,
        });
        y -= 16;

        drawTableHeader();
      }
    };

    drawTableHeader();

    for (let i = 0; i < (attendees?.length ?? 0); i++) {
      ensureSpace(rowH);

      const a: any = attendees![i];

      drawBox(x0, y - rowH, contentW, rowH, 1);

      drawLine(xNombre, y, xNombre, y - rowH);
      drawLine(xRut, y, xRut, y - rowH);
      drawLine(xCargo, y, xCargo, y - rowH);
      drawLine(xHora, y, xHora, y - rowH);
      drawLine(xFirma, y, xFirma, y - rowH);

      page.drawText(String(i + 1), { x: xN + 6, y: y - 16, size: 9, font });

      page.drawText(clampText(a.full_name ?? "", 30), {
        x: xNombre + 6,
        y: y - 16,
        size: 9,
        font,
      });

      page.drawText(formatRutPretty(a.rut), { x: xRut + 6, y: y - 16, size: 9, font });

      const cargoX = xCargo + 6;
      const cargoW = col.cargo - 12;
      const cargoSize = 8;
      const cargoLineH = 12;

      let cargoLines = wrapLines(a.role ?? "-", font, cargoSize, cargoW);
      if (cargoLines.length > 2) {
        cargoLines = cargoLines.slice(0, 2);
        cargoLines[1] = fitWithEllipsis(cargoLines[1], font, cargoSize, cargoW);
      }

      page.drawText(cargoLines[0], { x: cargoX, y: y - 16, size: cargoSize, font });
      if (cargoLines[1]) {
        page.drawText(cargoLines[1], { x: cargoX, y: y - 16 - cargoLineH, size: cargoSize, font });
      }

      const { date, time } = formatDateParts(a.created_at);
      page.drawText(clampText(date, 14), { x: xHora + 6, y: y - 16, size: 8, font });
      page.drawText(clampText(time, 10), { x: xHora + 6, y: y - 32, size: 8, font });

      const sigAreaX = xFirma + 6;
      const sigAreaW = col.firma - 12;
      const sigAreaH = rowH - 18;
      const sigAreaY = y - rowH + 9;

      try {
        if (!a.signature_path) throw new Error("no signature");
        const imgBytes = await downloadBucketBytes("assets", a.signature_path);
        const png = await pdfDoc.embedPng(imgBytes);

        const scale = Math.min(sigAreaW / png.width, sigAreaH / png.height);
        const w = png.width * scale;
        const h = png.height * scale;

        page.drawImage(png, {
          x: sigAreaX + (sigAreaW - w) / 2,
          y: sigAreaY + (sigAreaH - h) / 2,
          width: w,
          height: h,
        });
      } catch {
        page.drawText("Sin firma", { x: sigAreaX + 8, y: sigAreaY + sigAreaH / 2 - 4, size: 8, font });
      }

      y -= rowH;
    }

    // FIRMA RELATOR
    ensureSpace(150);

    page.drawText("Firma relator:", { x: margin, y: y - 14, size: 11, font: fontBold });
    y -= 22;

    const relBoxW = 300;
    const relBoxH = 90;
    const relBoxX = margin;
    const relBoxY = y - relBoxH;

    drawBox(relBoxX, relBoxY, relBoxW, relBoxH, 1);

    if ((session as any).trainer_signature_path) {
      try {
        const imgBytes = await downloadBucketBytes("assets", (session as any).trainer_signature_path);
        const png = await pdfDoc.embedPng(imgBytes);

        const scale = Math.min(relBoxW / png.width, relBoxH / png.height);
        const w = png.width * scale;
        const h = png.height * scale;

        page.drawImage(png, {
          x: relBoxX + (relBoxW - w) / 2,
          y: relBoxY + (relBoxH - h) / 2,
          width: w,
          height: h,
        });
      } catch {
        page.drawText("Sin firma relator", { x: relBoxX + 10, y: relBoxY + 10, size: 10, font });
      }
    }

    y = relBoxY - 18;
    page.drawText(`Relator: ${(session as any).trainer_name ?? ""}`, { x: margin, y, size: 10, font });

    // Upload PDF + signed url + update sessions
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
    if (signErr || !signed) {
      return NextResponse.json({ error: signErr?.message || "No se pudo firmar URL" }, { status: 500 });
    }

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