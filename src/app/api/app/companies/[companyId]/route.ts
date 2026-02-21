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
  if (!token) return { ok: false as const, status: 401, error: "Missing bearer token" };

  const supabase = sbAuthed(token);
  const { data: u, error: uerr } = await supabase.auth.getUser();

  if (uerr || !u?.user) return { ok: false as const, status: 401, error: "Unauthorized" };

  return { ok: true as const, token, supabase, user: u.user };
}

// ✅ Fallback universal: extrae companyId desde la URL
function companyIdFromReq(req: NextRequest) {
  // Ej: /api/app/companies/<companyId>
  const parts = req.nextUrl.pathname.split("/").filter(Boolean);
  const idx = parts.indexOf("companies");
  const id = idx >= 0 ? parts[idx + 1] : null;
  return id && id !== "companies" ? id : null;
}

function resolveCompanyId(req: NextRequest, ctx?: any) {
  const fromParams = ctx?.params?.companyId;
  if (typeof fromParams === "string" && fromParams) return fromParams;
  return companyIdFromReq(req);
}

export async function GET(req: NextRequest, ctx?: any) {
  try {
    const companyId = resolveCompanyId(req, ctx);
    if (!companyId) return NextResponse.json({ error: "Missing companyId" }, { status: 400 });

    const auth = await requireUser(req);
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const { data, error } = await auth.supabase
      .from("companies")
      .select("*")
      .eq("id", companyId)
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ company: data });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, ctx?: any) {
  try {
    const companyId = resolveCompanyId(req, ctx);
    if (!companyId) return NextResponse.json({ error: "Missing companyId" }, { status: 400 });

    const auth = await requireUser(req);
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const body = await req.json().catch(() => ({}));
    const patch: any = {};

    if (typeof body.name === "string") patch.name = body.name.trim();
    if (typeof body.address === "string" || body.address === null) {
      patch.address = body.address ? String(body.address).trim() : null;
    }
    if (typeof body.rut === "string" || body.rut === null) {
      patch.rut = body.rut ? String(body.rut).trim() : null;
    }
    if (typeof body.contact_name === "string" || body.contact_name === null) {
      patch.contact_name = body.contact_name ? String(body.contact_name).trim() : null;
    }
    if (typeof body.contact_rut === "string" || body.contact_rut === null) {
      patch.contact_rut = body.contact_rut ? String(body.contact_rut).trim() : null;
    }
    if (typeof body.contact_email === "string" || body.contact_email === null) {
      patch.contact_email = body.contact_email ? String(body.contact_email).trim() : null;
    }
    if (typeof body.contact_phone === "string" || body.contact_phone === null) {
      patch.contact_phone = body.contact_phone ? String(body.contact_phone).trim() : null;
    }
    if (typeof body.logo_path === "string" || body.logo_path === null) {
      patch.logo_path = body.logo_path ? String(body.logo_path).replace(/^company-logos\//, "") : null;
    }

    const { data, error } = await auth.supabase
      .from("companies")
      .update(patch)
      .eq("id", companyId)
      .select("*")
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ company: data });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, ctx?: any) {
  try {
    const companyId = resolveCompanyId(req, ctx);
    if (!companyId) return NextResponse.json({ error: "Missing companyId" }, { status: 400 });

    const auth = await requireUser(req);
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    // 1) Traer empresa para logo_path
    const { data: company, error: cErr } = await auth.supabase
      .from("companies")
      .select("id,logo_path")
      .eq("id", companyId)
      .single();

    if (cErr || !company) {
      return NextResponse.json({ error: cErr?.message || "Empresa no encontrada" }, { status: 404 });
    }

    // 2) Bloquear si tiene sesiones asociadas
    const { count, error: cntErr } = await auth.supabase
      .from("sessions")
      .select("id", { count: "exact", head: true })
      .eq("company_id", companyId);

    if (cntErr) return NextResponse.json({ error: cntErr.message }, { status: 400 });
    if ((count ?? 0) > 0) {
      return NextResponse.json(
        { error: "No puedes eliminar esta empresa porque tiene charlas/sesiones asociadas." },
        { status: 409 }
      );
    }

    // 3) Borrar logo
    if (company.logo_path) {
      await auth.supabase.storage.from("company-logos").remove([String(company.logo_path)]);
    }

    // 4) Borrar empresa
    const { error: delErr } = await auth.supabase.from("companies").delete().eq("id", companyId);
    if (delErr) return NextResponse.json({ error: delErr.message }, { status: 400 });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}