"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/browser";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let alive = true;

    (async () => {
      const { data } = await supabaseBrowser.auth.getSession();
      const session = data.session;

      if (!alive) return;

      if (!session?.access_token) {
        router.replace(`/login?next=${encodeURIComponent(pathname)}`);
        return;
      }

      const meRes = await fetch("/api/app/me", {
        headers: { Authorization: `Bearer ${session.access_token}` },
        cache: "no-store",
      });

      const meJson = await meRes.json().catch(() => null);

      if (!meRes.ok || !meJson?.is_admin) {
        router.replace("/app?e=" + encodeURIComponent("No tienes permisos de admin."));
        return;
      }

      setChecking(false);
    })();

    return () => {
      alive = false;
    };
  }, [pathname, router]);

  if (checking) return <div style={{ padding: 20, opacity: 0.7 }}>Cargando…</div>;

  return <>{children}</>;
}