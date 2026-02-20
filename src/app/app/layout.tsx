"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import styles from "./layout.module.css";
import Sidebar from "@/components/app/Sidebar";
import Topbar from "@/components/app/Topbar";
import { supabaseBrowser } from "@/lib/supabase/browser";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  const [checking, setChecking] = useState(true);
  const [email, setEmail] = useState<string | null>(null);

  const title = useMemo(() => {
    if (pathname === "/app" || pathname === "/app/dashboard") return "Dashboard";
    if (pathname.startsWith("/app/profile")) return "Mi perfil";
    if (pathname.startsWith("/app/companies/new")) return "Crear empresa";
    if (pathname.startsWith("/app/companies")) return "Mis empresas";
    if (pathname.startsWith("/app/sessions")) return "Mis charlas";
    if (pathname.startsWith("/app/pdfs")) return "Mis PDF";
    return "Panel";
  }, [pathname]);

  useEffect(() => {
    let alive = true;

    async function boot() {
      const { data } = await supabaseBrowser.auth.getSession();
      const session = data.session;

      if (!alive) return;

      if (!session) {
        router.replace("/login?e=" + encodeURIComponent("Sesión expirada. Vuelve a ingresar."));
        return;
      }

      setEmail(session.user?.email ?? null);
      setChecking(false);
    }

    boot();

    const { data: sub } = supabaseBrowser.auth.onAuthStateChange((_event, session) => {
      if (!alive) return;

      if (!session) {
        router.replace("/login?e=" + encodeURIComponent("Sesión expirada. Vuelve a ingresar."));
        return;
      }

      setEmail(session.user?.email ?? null);
    });

    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, [router]);

  async function logout() {
    await supabaseBrowser.auth.signOut();
    router.replace("/login");
  }

  if (checking) {
    return <div className={styles.center}>Cargando panel…</div>;
  }

  return (
    <div className={styles.shell}>
      <Sidebar />

      <div className={styles.main}>
        {/* ✅ Topbar único (se termina el duplicado) */}
        <Topbar title={title} email={email} onLogout={logout} />

        <div className={styles.content}>{children}</div>
      </div>
    </div>
  );
}