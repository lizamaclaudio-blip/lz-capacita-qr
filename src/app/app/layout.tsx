"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/app/Sidebar";
import Topbar from "@/components/app/Topbar";
import { supabaseBrowser } from "@/lib/supabase/browser";
import styles from "./layout.module.css";

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

      // nombre para el saludo: usa metadata si existe, si no usa parte del email
      const metaName =
        (session.user as any)?.user_metadata?.full_name ||
        (session.user as any)?.user_metadata?.name ||
        null;

      setGreetingName(metaName ? String(metaName) : null);

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
      <div className={styles.loading}>
        Cargando panel…
      </div>
    );
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
          {children}
        </main>
      </div>
    </div>
  );
}