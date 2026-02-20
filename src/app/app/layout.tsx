"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/browser";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [email, setEmail] = useState<string | null>(null);

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

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center opacity-70">
        Cargando panel…
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/app" className="font-bold">
            LZ Capacita QR · Panel
          </Link>

          <div className="flex items-center gap-3 text-sm">
            {email && <span className="text-gray-600">{email}</span>}
            <button onClick={logout} className="px-3 py-2 rounded border">
              Salir
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">{children}</main>
    </div>
  );
}
