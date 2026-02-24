import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { cleanRut, isValidRut } from "@/lib/rut";

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

function missingColumnHint(msg: string) {
  const m = msg.match(/Could not find the '([^']+)' column/i);
  const col = m?.[1];
  if (!col) return null;

  const base =
    "⚠️ Tu tabla `companies` no tiene la columna requerida para esta versión.\n" +
    "Ejecuta esta migración en Supabase (SQL Editor):\n\n" +
    "alter table public.companies\n" +
    "  add column if not exists legal_name text,\n" +
    "  add column if not exists company_type text default 'hq',\n" +
    "  add column if not exists parent_company_id uuid null references public.companies(id);\n";

  return { col, message: `${base}\nColumna faltante: ${col}` };
}

async function assertParentBelongsToUser(supabase: any, ownerId: string, parentId: string, selfId: string) {
  if (parentId === selfId) {
    return { ok: false as const, error: "Una empresa no puede ser su propia casa matriz." };
  }

  const { data, error } = await supabase
    .from("companies")
    .select("id, owner_id, company_type")
    .eq("id", parentId)
    .eq("owner_id", ownerId)
    .maybeSingle();

  if (error) return { ok: false as const, error: error.message };
  if (!data) return { ok: false as const, error: "Casa matriz no encontrada o no pertenece a tu usuario." };

  if (data.company_type && data.company_type === "branch") {
    return { ok: false as const, error: "La casa matriz seleccionada no puede ser una sucursal." };
  }

  return { ok: true as const };
}

export async function GET(req: NextRequest, ctx: { params: { companyId: string } }) {
  try {
    const auth = await requireUser(req);
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const companyId = ctx.params.companyId;

    const { data, error } = await auth.supabase
      .from("companies")
      .select("*")
      .eq("id", companyId)
      .eq("owner_id", auth.user.id)
      .maybeSingle();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    if (!data) return NextResponse.json({ error: "Empresa no encontrada" }, { status: 404 });

    return NextResponse.json({ company: data });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, ctx: { params: { companyId: string } }) {
  try {
    const auth = await requireUser(req);
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const companyId = ctx.params.companyId;
    const body = await req.json().catch(() => ({}));

    // ✅ Requeridos (tu modal envía todo, así que lo validamos fuerte)
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const legal_name = typeof body.legal_name === "string" ? body.legal_name.trim() : "";
    const address = typeof body.address === "string" ? body.address.trim() : "";
    const rutRaw = typeof body.rut === "string" ? body.rut.trim() : "";

    if (!name) return NextResponse.json({ error: "Nombre comercial es obligatorio" }, { status: 400 });
    if (!legal_name) return NextResponse.json({ error: "Razón social es obligatoria" }, { status: 400 });
    if (!address) return NextResponse.json({ error: "Dirección empresa es obligatoria" }, { status: 400 });

    const rut = cleanRut(rutRaw);
    if (!rut) return NextResponse.json({ error: "RUT empresa es obligatorio" }, { status: 400 });
    if (!isValidRut(rut))
      return NextResponse.json({ error: "RUT empresa inválido (dígito verificador incorrecto)" }, { status: 400 });

    // ✅ Tipo empresa (hq / branch)
    const company_type = body.company_type === "branch" ? "branch" : "hq";
    const parent_company_id =
      company_type === "branch" && typeof body.parent_company_id === "string" && body.parent_company_id.trim()
        ? body.parent_company_id.trim()
        : null;

    if (company_type === "branch" && !parent_company_id) {
      return NextResponse.json({ error: "Sucursal requiere seleccionar la casa matriz" }, { status: 400 });
    }

    if (company_type === "branch" && parent_company_id) {
      const okParent = await assertParentBelongsToUser(auth.supabase, auth.user.id, parent_company_id, companyId);
      if (!okParent.ok) return NextResponse.json({ error: okParent.error }, { status: 400 });
    }

    // ✅ Contacto (opcional)
    const contact_name =
      typeof body.contact_name === "string" && body.contact_name.trim() ? body.contact_name.trim() : null;

    const contact_rut_raw =
      typeof body.contact_rut === "string" && body.contact_rut.trim() ? body.contact_rut.trim() : null;

    const contact_rut = contact_rut_raw ? cleanRut(contact_rut_raw) : null;
    if (contact_rut && !isValidRut(contact_rut)) {
      return NextResponse.json({ error: "RUT contacto inválido" }, { status: 400 });
    }

    const contact_email =
      typeof body.contact_email === "string" && body.contact_email.trim() ? body.contact_email.trim() : null;

    const contact_phone =
      typeof body.contact_phone === "string" && body.contact_phone.trim() ? body.contact_phone.trim() : null;

    // ✅ Logo (opcional)
    const logo_path =
      typeof body.logo_path === "string" && body.logo_path.trim()
        ? body.logo_path.replace(/^company-logos\//, "")
        : undefined; // undefined => no lo toca

    const payload: any = {
      name,
      legal_name,
      rut,
      address,

      company_type,
      parent_company_id,

      contact_name,
      contact_rut,
      contact_email,
      contact_phone,
    };

    if (typeof logo_path === "string") payload.logo_path = logo_path;

    const { data, error } = await auth.supabase
      .from("companies")
      .update(payload)
      .eq("id", companyId)
      .eq("owner_id", auth.user.id)
      .select("*")
      .maybeSingle();

    if (error) {
      const hint = missingColumnHint(error.message);
      if (hint) return NextResponse.json({ error: hint.message }, { status: 400 });
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    if (!data) return NextResponse.json({ error: "Empresa no encontrada" }, { status: 404 });

    return NextResponse.json({ company: data });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, ctx: { params: { companyId: string } }) {
  try {
    const auth = await requireUser(req);
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const companyId = ctx.params.companyId;

    const { error } = await auth.supabase
      .from("companies")
      .delete()
      .eq("id", companyId)
      .eq("owner_id", auth.user.id);

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}