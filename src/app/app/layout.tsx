"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/app/Sidebar";
import Topbar from "@/components/app/Topbar";
import RouteTransition from "@/components/app/RouteTransition";
import { supabaseBrowser } from "@/lib/supabase/browser";
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

      const em = session.user?.email ?? null;
      setEmail(em);
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
    return <div className={styles.loading}>Cargando panel…</div>;
  }

  return (
    <div className={styles.shell}>
      <Sidebar />

      <div className={styles.content}>
        <Topbar
          greetingName={greetingName}
          email={email}
          subtitle={subtitle}
          onLogout={logout}
        />

        <main className={styles.main}>
          <RouteTransition>{children}</RouteTransition>
        </main>
      </div>
    </div>
  );
}