export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { z } from "zod";
import { nanoid } from "nanoid";
import { supabaseServer } from "@/lib/supabase/server";

const BodySchema = z.object({
  passcode: z.string(),
  company_name: z.string().min(2),
  company_address: z.string().optional().default(""),
  topic: z.string().min(2),
  location: z.string().optional().default(""),
  trainer_name: z.string().min(2),
  trainer_email: z.string().optional().default(""),
});

export async function POST(req: Request) {
  const json = await req.json().catch(() => null);
  const parsed = BodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }

  if (parsed.data.passcode !== process.env.ADMIN_PASSCODE) {
    return NextResponse.json({ error: "Passcode incorrecto" }, { status: 401 });
  }

  const sb = supabaseServer();

  // 1) crear empresa
  const { data: company, error: cErr } = await sb
    .from("companies")
    .insert({
      name: parsed.data.company_name,
      address: parsed.data.company_address,
    })
    .select("*")
    .single();

  if (cErr) return NextResponse.json({ error: cErr.message }, { status: 500 });

  // 2) crear charla
  const code = nanoid(6).toUpperCase();

  const { data: session, error: sErr } = await sb
    .from("sessions")
    .insert({
      company_id: company.id,
      code,
      topic: parsed.data.topic,
      location: parsed.data.location,
      trainer_name: parsed.data.trainer_name,
      trainer_email: parsed.data.trainer_email,
      status: "open",
    })
    .select("*")
    .single();

  if (sErr) return NextResponse.json({ error: sErr.message }, { status: 500 });

  return NextResponse.json({
    code: session.code,
    public_url: `${process.env.APP_URL}/c/${session.code}`,
    admin_url: `${process.env.APP_URL}/admin/s/${session.code}`,
  });
}