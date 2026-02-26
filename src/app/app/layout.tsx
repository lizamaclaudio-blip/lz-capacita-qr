"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import RouteTransition from "@/components/app/RouteTransition";
import { supabaseBrowser } from "@/lib/supabase/browser";
import AppTopNav from "@/components/app/AppTopNav";
import MobileNavDrawer from "@/components/app/MobileNavDrawer";
import WorkspaceSidebar from "@/components/app/WorkspaceSidebar";
import DailyTipBanner from "@/components/app/DailyTipBanner";
import styles from "./layout.module.css";

function buildGreetingName(user: any) {
  const md = (user?.user_metadata ?? {}) as Record<string, any>;
  const first = typeof md.first_name === "string" ? md.first_name.trim() : "";
  const last = typeof md.last_name === "string" ? md.last_name.trim() : "";
  const full =
    (typeof md.full_name === "string" && md.full_name.trim()) ||
    (first || last ? `${first} ${last}`.trim() : "");
  return full || null;
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  const [checking, setChecking] = useState(true);
  const [email, setEmail] = useState<string | null>(null);
  const [greetingName, setGreetingName] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    let alive = true;

    (async () => {
      const { data } = await supabaseBrowser.auth.getSession();
      const session = data.session;

      if (!alive) return;

      if (!session) {
        router.replace("/login");
        return;
      }

      setEmail(session.user?.email ?? null);
      setGreetingName(buildGreetingName(session.user));
      setChecking(false);
    })();

    return () => {
      alive = false;
    };
  }, [router]);

  async function logout() {
    await supabaseBrowser.auth.signOut();
    router.replace("/login");
  }

  const subtitle = useMemo(() => "Panel LZ Capacita QR", []);

  if (checking) {
    return (
      <div className={styles.loadingShell}>
        <div className={styles.loadingCard}>
          <div className={styles.loadingTitle}>Cargando panel…</div>
          <div className={styles.loadingSub}>Verificando sesión</div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.shell}>
      {/* Desktop sidebar (siempre render, CSS decide) */}
      <div className={styles.desktopSide}>
        <WorkspaceSidebar greetingName={greetingName} email={email} onLogout={logout} />
      </div>

      <div className={styles.right}>
        {/* Mobile topbar (siempre render, CSS decide) */}
        <div className={styles.mobileTop}>
          <AppTopNav
            greetingName={greetingName}
            email={email}
            subtitle={subtitle}
            onLogout={logout}
            onOpenMobile={() => setMobileOpen(true)}
          />
        </div>

        <MobileNavDrawer
          open={mobileOpen}
          onClose={() => setMobileOpen(false)}
          email={email}
          greetingName={greetingName}
          onLogout={logout}
        />

        <main className={styles.main}>
          <div className={styles.mainInner}>
            <DailyTipBanner />
          </div>

          <div className={styles.scroller} data-app-scroll>
            <div className={styles.mainInner}>
              <RouteTransition>{children}</RouteTransition>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
