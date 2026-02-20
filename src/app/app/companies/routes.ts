export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import { supabaseServer } from "@/lib/supabase/server";

function getToken(req: Request) {
  const h = req.headers.get("authorization") || "";
  if (!h.toLowerCase().startsWith("bearer ")) return null;
  return h.slice(7).trim();
}

async function requireUser(req: Request) {
  const token = getToken(req);
  if (!token) return null;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anon =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_KEY;

  if (!url || !anon) return null;

  const sbAuth = createClient(url, anon, { auth: { persistSession: false } });
  const { data, error } = await sbAuth.auth.getUser(token);
  if (error || !data?.user) return null;
  return data.user;
}

const CreateCompanySchema = z.object({
  name: z.string().min(2),
  address: z.string().optional().nullable(),
});

export async function GET(req: Request) {
  const user = await requireUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sb = supabaseServer();
  const { data, error } = await sb
    .from("companies")
    .select("id, name, address, created_at")
    .eq("owner_id", user.id)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, companies: data ?? [] });
}

export async function POST(req: Request) {
  const user = await requireUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = CreateCompanySchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });

  const sb = supabaseServer();
  const { data, error } = await sb
    .from("companies")
    .insert({
      owner_id: user.id,
      name: parsed.data.name,
      address: parsed.data.address ?? null,
    })
    .select("id, name, address, created_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, company: data });
}