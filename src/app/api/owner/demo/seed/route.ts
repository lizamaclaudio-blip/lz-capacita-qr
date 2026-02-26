export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { requireOwner, removeInBatches } from "@/lib/supabase/owner";
import { logOwnerAction } from "@/lib/owner/audit";

const DEMO_EMAIL = "demo@lzcapacitqr.cl";
const DEMO_PASSWORD = "123456";

function randInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randChoice<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function makeCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 6; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return out;
}

// RUT Chile (DV) — genera string tipo 76190355-1
function dvRut(n: number) {
  let s = 1;
  let m = 0;
  while (n > 0) {
    s = (s + (n % 10) * (9 - (m++ % 6))) % 11;
    n = Math.floor(n / 10);
  }
  return s ? String(s - 1) : "K";
}

function genRut() {
  const base = randInt(7000000, 25999999);
  return `${base}-${dvRut(base)}`;
}

const TINY_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/58BAgAI/AL+Oe6Q7wAAAABJRU5ErkJggg==";

async function uploadPng(sbAdmin: any, path: string) {
  const buf = Buffer.from(TINY_PNG_BASE64, "base64");
  const up = await sbAdmin.storage.from("assets").upload(path, buf, {
    contentType: "image/png",
    upsert: true,
  });
  if (up.error) throw new Error(up.error.message);
  return path;
}

async function uploadDemoPdf(sbAdmin: any, path: string, title: string, companyName: string, code: string) {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595.28, 841.89]); // A4
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);

  page.drawText("LZ Capacita QR — DEMO", { x: 48, y: 780, size: 18, font: fontBold, color: rgb(0.08, 0.1, 0.12) });
  page.drawText(`Empresa: ${companyName}`, { x: 48, y: 740, size: 12, font });
  page.drawText(`Charla: ${title}`, { x: 48, y: 720, size: 12, font });
  page.drawText(`Código: ${code}`, { x: 48, y: 700, size: 12, font });
  page.drawText("Este PDF es ficticio para pruebas de interfaz.", { x: 48, y: 660, size: 11, font, color: rgb(0.3, 0.35, 0.45) });

  const bytes = await doc.save();
  const up = await sbAdmin.storage.from("assets").upload(path, Buffer.from(bytes), {
    contentType: "application/pdf",
    upsert: true,
  });
  if (up.error) throw new Error(up.error.message);
  return path;
}

async function findUserByEmail(sbAdmin: any, email: string) {
  const perPage = 200;
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await sbAdmin.auth.admin.listUsers({ page, perPage });
    if (error) throw new Error(error.message);
    const users = (data?.users ?? []) as any[];
    const hit = users.find((u) => String(u.email || "").toLowerCase() === email.toLowerCase());
    if (hit) return hit;
    if (users.length < perPage) break;
  }
  return null;
}

async function purgeUserData(sbAdmin: any, userId: string) {
  const { data: companies } = await sbAdmin.from("companies").select("id, logo_path").eq("owner_id", userId);
  const companyIds = (companies || []).map((c: any) => c.id).filter(Boolean);
  const logoPaths = (companies || []).map((c: any) => c.logo_path).filter(Boolean);

  const { data: sessions } = await sbAdmin
    .from("sessions")
    .select("id, pdf_path, trainer_signature_path")
    .eq("owner_id", userId);

  const sessionIds = (sessions || []).map((s: any) => s.id).filter(Boolean);
  const pdfPaths = (sessions || []).map((s: any) => s.pdf_path).filter(Boolean);
  const trainerSigPaths = (sessions || []).map((s: any) => s.trainer_signature_path).filter(Boolean);

  let attendeeSigPaths: string[] = [];
  if (sessionIds.length) {
    const { data: attendees } = await sbAdmin.from("attendees").select("signature_path").in("session_id", sessionIds);
    attendeeSigPaths = (attendees || []).map((a: any) => a.signature_path).filter(Boolean);
  }

  await removeInBatches(sbAdmin, "company-logos", logoPaths);
  await removeInBatches(sbAdmin, "assets", [...pdfPaths, ...trainerSigPaths, ...attendeeSigPaths]);

  if (sessionIds.length) {
    await sbAdmin.from("attendees").delete().in("session_id", sessionIds);
    await sbAdmin.from("sessions").delete().in("id", sessionIds);
  }
  if (companyIds.length) {
    await sbAdmin.from("companies").delete().in("id", companyIds);
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireOwner(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const body = await req.json().catch(() => ({}));
  const reset = !!body?.reset;

  try {
    // 1) Ensure demo user
    const existing = await findUserByEmail(auth.sbAdmin, DEMO_EMAIL);

    if (existing && reset) {
      await purgeUserData(auth.sbAdmin, existing.id);
      await auth.sbAdmin.auth.admin.deleteUser(existing.id);
    }

    const demoUser = existing && !reset ? existing : null;
    const user =
      demoUser ||
      (
        await (async () => {
          const { data, error } = await auth.sbAdmin.auth.admin.createUser({
            email: DEMO_EMAIL,
            password: DEMO_PASSWORD,
            email_confirm: true,
            user_metadata: {
              first_name: "Demo",
              last_name: "Usuario",
              full_name: "Demo Usuario",
              rut: "11111111-1",
              phone: "+56 9 1234 5678",
              region: "Los Lagos",
              comuna: "Puerto Montt",
              ciudad: "Puerto Montt",
              direccion: "Av. Demo 123",
            },
          });
          if (error || !data?.user) throw new Error(error?.message || "No se pudo crear demo");
          return data.user;
        })()
      );

    // 2) Seed data only if user is new or reset
    if (!demoUser || reset) {
      // Companies
      const sectors = ["SPA", "LTDA", "EIRL", "S.A."];
      const names = [
        "Prevenidos",
        "Austral",
        "Patagonia",
        "Andes",
        "Llanquihue",
        "Río Sur",
        "Norte Claro",
        "Bosque",
        "Mar Azul",
        "Volcán",
      ];

      const streets = ["Av. Costanera", "Ruta 5 Sur", "Av. Ejército", "Los Alerces", "Camino a Chinquihue", "Av. Salvador Allende"];
      const cities = ["Puerto Montt", "Osorno", "Castro", "Ancud", "Calbuco", "Frutillar"];

      const companiesPayload: any[] = [];
      for (let i = 0; i < 50; i++) {
        const base = `${randChoice(names)} ${randChoice(["Servicios", "Industrial", "Logística", "Alimentos", "Salmones", "Constructora"])}`;
        const suffix = randChoice(sectors);
        const name = `${base} ${suffix}`.trim();
        const rut = genRut();
        const address = `${randChoice(streets)} ${randInt(10, 999)}, ${randChoice(cities)}`;
        companiesPayload.push({
          owner_id: user.id,
          name,
          legal_name: name,
          rut,
          address,
          company_type: "hq",
          parent_company_id: null,
          contact_name: "Contacto Demo",
          contact_rut: genRut(),
          contact_email: "contacto@demo.cl",
          contact_phone: "+56 9 5555 5555",
          logo_path: null,
        });
      }

      const { data: insertedCompanies, error: insCErr } = await auth.sbAdmin
        .from("companies")
        .insert(companiesPayload)
        .select("id, name, rut");
      if (insCErr) throw new Error(insCErr.message);

      const companies = (insertedCompanies ?? []) as any[];

      // Sessions
      const topics = [
        "Uso de extintores",
        "Trabajo en altura",
        "Manipulación manual de cargas",
        "Orden y aseo",
        "Bloqueo y etiquetado (LOTO)",
        "Prevención de caídas",
        "Ergonomía en oficina",
        "Conducción defensiva",
        "Riesgos eléctricos",
        "Manejo de sustancias peligrosas",
      ];

      const locations = ["Sala de reuniones", "Bodega", "Planta", "Terreno", "Casino", "Patio"]; 

      const sessionsPayload: any[] = [];
      const attendeePayload: any[] = [];

      const closedCount = 18;
      const totalSessions = 30;

      const now = new Date();

      for (let i = 0; i < totalSessions; i++) {
        const company = randChoice(companies);
        const code = makeCode();
        const topic = randChoice(topics);

        const sessionDate = new Date(now);
        sessionDate.setDate(now.getDate() - randInt(0, 45));

        const closed = i < closedCount;
        const closedAt = closed ? new Date(sessionDate.getTime() + 1000 * 60 * 60).toISOString() : null;

        // signature + pdf for closed sessions
        const trainerSigPath = closed ? `demo/trainer-signatures/${code}.png` : null;
        const pdfPath = closed ? `demo/pdfs/${code}.pdf` : null;
        const pdfAt = closed ? new Date(sessionDate.getTime() + 1000 * 60 * 90).toISOString() : null;

        sessionsPayload.push({
          owner_id: user.id,
          company_id: company.id,
          code,
          topic,
          location: randChoice(locations),
          session_date: sessionDate.toISOString(),
          trainer_name: "Relator Demo",
          trainer_email: "relator@demo.cl",
          status: closed ? "closed" : "open",
          closed_at: closedAt,
          admin_passcode: company.rut,
          trainer_signature_path: trainerSigPath,
          pdf_path: pdfPath,
          pdf_generated_at: pdfAt,
        });
      }

      const { data: insertedSessions, error: insSErr } = await auth.sbAdmin
        .from("sessions")
        .insert(sessionsPayload)
        .select("id, code, topic, company_id, status");
      if (insSErr) throw new Error(insSErr.message);

      const inserted = (insertedSessions ?? []) as any[];
      const companyById = new Map(companies.map((c) => [c.id, c]));

      for (const s of inserted) {
        const closed = String(s.status || "").toLowerCase() === "closed";
        if (!closed) continue;

        const company = companyById.get(s.company_id);
        const code = String(s.code);
        const topic = String(s.topic || "Charla");

        // Upload one shared signature per closed session
        const sigPath = await uploadPng(auth.sbAdmin, `demo/signatures/${code}.png`);
        await uploadPng(auth.sbAdmin, `demo/trainer-signatures/${code}.png`);
        await uploadDemoPdf(auth.sbAdmin, `demo/pdfs/${code}.pdf`, topic, company?.name || "Empresa", code);

        const attendeesN = randInt(6, 18);
        for (let i = 0; i < attendeesN; i++) {
          attendeePayload.push({
            session_id: s.id,
            full_name: `Trabajador Demo ${i + 1}`,
            rut: genRut(),
            role: randChoice(["Operario", "Supervisor", "Administrativo", "Mantención", "Chofer"]),
            signature_path: sigPath,
          });
        }
      }

      if (attendeePayload.length) {
        const { error: insAErr } = await auth.sbAdmin.from("attendees").insert(attendeePayload);
        if (insAErr) throw new Error(insAErr.message);
      }
    }

    await logOwnerAction(auth.sbAdmin, {
      owner_user_id: auth.user.id,
      owner_email: auth.ownerEmail,
      action: "demo_seed",
      request_ip: auth.ip,
      request_ua: auth.ua,
      status: 200,
      result: { demo_email: DEMO_EMAIL, reset },
    });

    return NextResponse.json({ ok: true, demo_email: DEMO_EMAIL });
  } catch (e: any) {
    await logOwnerAction(auth.sbAdmin, {
      owner_user_id: auth.user.id,
      owner_email: auth.ownerEmail,
      action: "demo_seed",
      request_ip: auth.ip,
      request_ua: auth.ua,
      status: 500,
      result: { error: e?.message || "error" },
    });
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}
