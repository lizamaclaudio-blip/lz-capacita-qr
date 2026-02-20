"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/browser";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [ok, setOk] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabaseBrowser.auth.getSession();
      const token = data.session?.access_token;

      if (!token) {
        router.replace("/login");
        return;
      }

      const res = await fetch("/api/app/me", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();

      if (!res.ok || !json?.is_admin) {
        router.replace("/app?e=" + encodeURIComponent("No tienes permisos de admin."));
        return;
      }

      setOk(true);
    })();
  }, [router]);

  if (!ok) {
    return (
      <div className="min-h-screen flex items-center justify-center opacity-70">
        Verificando permisos…
      </div>
    );
  }

  return <>{children}</>;
}