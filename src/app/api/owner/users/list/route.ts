import { NextRequest, NextResponse } from "next/server";
import { requireOwner } from "@/lib/supabase/owner";
import { logOwnerAction } from "@/lib/owner/audit";

export const dynamic = "force-dynamic";

function pickName(meta: Record<string, any>) {
  const first =
    (typeof meta?.first_name === "string" && meta.first_name.trim()) ||
    (typeof meta?.nombres === "string" && meta.nombres.trim()) ||
    "";

  const last =
    (typeof meta?.last_name === "string" && meta.last_name.trim()) ||
    (typeof meta?.apellidos === "string" && meta.apellidos.trim()) ||
    "";

  const full =
    (typeof meta?.full_name === "string" && meta.full_name.trim()) ||
    `${first} ${last}`.trim();

  return {
    first_name: first || null,
    last_name: last || null,
    full_name: full || null,
  };
}

export async function GET(req: NextRequest) {
  const auth = await requireOwner(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  try {
    // List users (paginated)
    const perPage = 200;
    let page = 1;
    const out: any[] = [];

    while (page <= 20) {
      const { data, error } = await auth.sbAdmin.auth.admin.listUsers({ page, perPage });
      if (error) throw new Error(error.message);

      const users = (data?.users ?? []) as any[];
      for (const u of users) {
        const meta = (u.user_metadata ?? {}) as Record<string, any>;
        const nm = pickName(meta);
        out.push({
          id: u.id,
          email: u.email ?? null,
          created_at: u.created_at,
          last_sign_in_at: u.last_sign_in_at ?? null,
          banned_until: u.banned_until ?? null,
          user_metadata: meta,
          ...nm,
        });
      }

      if (users.length < perPage) break;
      page += 1;
    }

    // Sort by last name, then first, then email
    out.sort((a, b) => {
      const la = (a.last_name || "").toLowerCase();
      const lb = (b.last_name || "").toLowerCase();
      if (la !== lb) return la.localeCompare(lb, "es");

      const fa = (a.first_name || "").toLowerCase();
      const fb = (b.first_name || "").toLowerCase();
      if (fa !== fb) return fa.localeCompare(fb, "es");

      return (a.email || "").toLowerCase().localeCompare((b.email || "").toLowerCase(), "es");
    });

    await logOwnerAction(auth.sbAdmin, {
      owner_user_id: auth.user.id,
      owner_email: auth.ownerEmail,
      action: "users_list",
      request_ip: auth.ip,
      request_ua: auth.ua,
      status: 200,
      result: { count: out.length },
    });

    return NextResponse.json({ users: out });
  } catch (e: any) {
    await logOwnerAction(auth.sbAdmin, {
      owner_user_id: auth.user.id,
      owner_email: auth.ownerEmail,
      action: "users_list",
      request_ip: auth.ip,
      request_ua: auth.ua,
      status: 500,
      result: { error: e?.message || "error" },
    });

    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}
