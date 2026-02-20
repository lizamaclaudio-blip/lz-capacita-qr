"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/browser";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setLoading(true);

    const { error } = await supabaseBrowser.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    setLoading(false);

    if (error) {
      setErr(error.message);
      return;
    }

    router.replace("/app");
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl border bg-white/10 p-6 backdrop-blur">
        <h1 className="text-2xl font-bold">Iniciar sesión</h1>

        {err && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {err}
          </div>
        )}

        <form onSubmit={onSubmit} className="mt-5 space-y-3">
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
          />

          <button
            disabled={loading}
            className="w-full rounded-lg bg-emerald-500 py-2 font-semibold text-white disabled:opacity-60"
          >
            {loading ? "Entrando..." : "Entrar"}
          </button>
        </form>

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