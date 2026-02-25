import { NextRequest, NextResponse } from "next/server";
import { requireOwner } from "@/lib/supabase/owner";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const auth = await requireOwner(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const body = await req.json().catch(() => ({}));
  const email = String(body?.email || "").trim().toLowerCase();
  if (!email) return NextResponse.json({ error: "email is required" }, { status: 400 });

  // Magic link para entrar como ese usuario
  const { data, error } = await auth.sbAdmin.auth.admin.generateLink({
    type: "magiclink",
    email,
    options: { redirectTo: `${auth.baseUrl}/app` },
  } as any);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  // data.properties.action_link trae el link
  return NextResponse.json({
    ok: true,
    action_link: (data as any)?.properties?.action_link ?? null,
  });
}