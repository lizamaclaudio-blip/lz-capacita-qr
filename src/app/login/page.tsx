"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/browser";

function safeNext(next: string | null) {
  if (!next) return null;
  // solo rutas internas
  if (next.startsWith("/") && !next.startsWith("//")) return next;
  return null;
}

function LoginInner() {
  const router = useRouter();
  const sp = useSearchParams();

  const next = safeNext(sp.get("next"));
  const eParam = sp.get("e");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(eParam ? decodeURIComponent(eParam) : null);

  async function handleLogin() {
    if (loading) return;

    setErr(null);
    setLoading(true);

    try {
      const { error } = await supabaseBrowser.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        setErr(error.message);
        setLoading(false);
        return;
      }

      setLoading(false);
      router.replace(next || "/app");
    } catch (e: any) {
      setLoading(false);
      setErr(e?.message || "Error inesperado al iniciar sesión");
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl border border-black/10 bg-white/70 p-6 shadow-[0_18px_60px_rgba(0,0,0,0.12)] backdrop-blur">
        <h1 className="text-2xl font-bold">Iniciar sesión</h1>

        {err && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {err}
          </div>
        )}

        <div className="mt-5 space-y-3">
          <input
            className="w-full rounded-lg border px-3 py-2"
            placeholder="correo@ejemplo.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
          />
          <input
            className="w-full rounded-lg border px-3 py-2"
            placeholder="Contraseña"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type="password"
            autoComplete="current-password"
            required
            onKeyDown={(e) => {
              if (e.key === "Enter") handleLogin();
            }}
          />

          <button
            type="button"
            onClick={handleLogin}
            disabled={loading}
            className="w-full rounded-lg bg-indigo-600 py-2 font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
          >
            {loading ? "Entrando..." : "Entrar"}
          </button>
        </div>

        <div className="mt-4 text-sm">
          ¿No tienes cuenta?{" "}
          <a className="underline" href="/signup">
            Crear cuenta
          </a>
        </div>

        <div className="mt-6 text-center text-xs opacity-60">
          Creado por Claudio Lizama © 2026
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div style={{ padding: 20, opacity: 0.7 }}>Cargando…</div>}>
      <LoginInner />
    </Suspense>
  );
}