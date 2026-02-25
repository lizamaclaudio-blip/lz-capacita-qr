import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { cleanRut, isValidRut } from "@/lib/rut";

export const dynamic = "force-dynamic";

function getBearerToken(req: NextRequest) {
  const auth = req.headers.get("authorization") || "";
  const m = auth.match(/^Bearer\s+(.+)$/i);
  return m?.[1] ?? null;
}

function sbAuthed(token: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(url, anon, {
    auth: { persistSession: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
}

function bad(msg: string, status = 400) {
  return NextResponse.json({ error: msg }, { status });
}

type CompanyUpdateBody = {
  name?: string | null;
  rut?: string | null;
  legal_name?: string | null;
  address?: string | null;
  phone?: string | null;
  region?: string | null;
  comuna?: string | null;
  city?: string | null;
  company_type?: "hq" | "branch" | string | null;
  parent_company_id?: string | null;
  logo_path?: string | null;
};

export async function GET(req: NextRequest, ctx: any) {
  const companyId = String((await ctx?.params)?.companyId ?? ctx?.params?.companyId ?? "").trim();

  const token = getBearerToken(req);
  if (!token) return bad("Missing bearer token", 401);

  const supabase = sbAuthed(token);
  const { data: u, error: uErr } = await supabase.auth.getUser();
  if (uErr || !u?.user) return bad("Unauthorized", 401);

  const { data, error } = await supabase
    .from("companies")
    .select("*")
    .eq("id", companyId)
    .eq("owner_id", u.user.id)
    .maybeSingle();

  if (error) return bad(error.message, 400);
  if (!data) return bad("Company not found", 404);

  return NextResponse.json({ company: data });
}

export async function PUT(req: NextRequest, ctx: any) {
  const companyId = String((await ctx?.params)?.companyId ?? ctx?.params?.companyId ?? "").trim();

  const token = getBearerToken(req);
  if (!token) return bad("Missing bearer token", 401);

  const supabase = sbAuthed(token);
  const { data: u, error: uErr } = await supabase.auth.getUser();
  if (uErr || !u?.user) return bad("Unauthorized", 401);

  const body = (await req.json().catch(() => null)) as CompanyUpdateBody | null;
  if (!body) return bad("Invalid JSON body");

  const patch: Record<string, any> = {};

  if ("name" in body) {
    const name = (body.name ?? "").toString().trim();
    if (!name) return bad("name is required");
    patch.name = name;
  }

  if ("rut" in body) {
    const raw = (body.rut ?? "").toString().trim();
    if (!raw) {
      patch.rut = null;
    } else {
      const r = cleanRut(raw);
      if (!isValidRut(r)) return bad("RUT inválido");
      patch.rut = r;
    }
  }

  if ("legal_name" in body) patch.legal_name = (body.legal_name ?? "").toString().trim() || null;
  if ("address" in body) patch.address = (body.address ?? "").toString().trim() || null;
  if ("phone" in body) patch.phone = (body.phone ?? "").toString().trim() || null;
  if ("region" in body) patch.region = (body.region ?? "").toString().trim() || null;
  if ("comuna" in body) patch.comuna = (body.comuna ?? "").toString().trim() || null;
  if ("city" in body) patch.city = (body.city ?? "").toString().trim() || null;

  if ("company_type" in body) {
    const ct = (body.company_type ?? "").toString().trim();
    if (!ct) patch.company_type = null;
    else if (ct !== "hq" && ct !== "branch") return bad("company_type inválido (use 'hq' o 'branch')");
    else patch.company_type = ct;
  }

  if ("parent_company_id" in body) patch.parent_company_id = (body.parent_company_id ?? "").toString().trim() || null;
  if ("logo_path" in body) patch.logo_path = (body.logo_path ?? "").toString().trim() || null;

  if (!Object.keys(patch).length) return bad("Nothing to update");

  const { data, error } = await supabase
    .from("companies")
    .update(patch)
    .eq("id", companyId)
    .eq("owner_id", u.user.id)
    .select("*")
    .maybeSingle();

  if (error) return bad(error.message, 400);
  if (!data) return bad("Company not found", 404);

  return NextResponse.json({ company: data });
}

export async function DELETE(req: NextRequest, ctx: any) {
  const companyId = String((await ctx?.params)?.companyId ?? ctx?.params?.companyId ?? "").trim();

  const token = getBearerToken(req);
  if (!token) return bad("Missing bearer token", 401);

  const supabase = sbAuthed(token);
  const { data: u, error: uErr } = await supabase.auth.getUser();
  if (uErr || !u?.user) return bad("Unauthorized", 401);

  const { error } = await supabase
    .from("companies")
    .delete()
    .eq("id", companyId)
    .eq("owner_id", u.user.id);

  if (error) return bad(error.message, 400);
  return NextResponse.json({ ok: true });
}
