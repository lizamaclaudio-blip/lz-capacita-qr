"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/browser";

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setMsg(null);
    setLoading(true);

    const { data, error } = await supabaseBrowser.auth.signUp({
      email: email.trim(),
      password,
    });

    setLoading(false);

    if (error) {
      setErr(error.message);
      return;
    }

    // Si en Supabase está desactivado "Confirm email", quedas logueado al tiro:
    if (data.session) {
      router.replace("/app");
      return;
    }

    // Si confirmación está activada, no habrá session:
    setMsg("Cuenta creada. Revisa tu correo para confirmar el acceso.");
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl border bg-white/10 p-6 backdrop-blur">
        <h1 className="text-2xl font-bold">Crear cuenta</h1>

        {err && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {err}
          </div>
        )}
        {msg && (
          <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
            {msg}
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
            placeholder="Contraseña (mínimo 6)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type="password"
            autoComplete="new-password"
            required
          />

          <button
            disabled={loading}
            className="w-full rounded-lg bg-emerald-500 py-2 font-semibold text-white disabled:opacity-60"
          >
            {loading ? "Creando..." : "Crear cuenta"}
          </button>
        </form>

        <div className="mt-4 text-sm">
          ¿Ya tienes cuenta?{" "}
          <a className="underline" href="/login">
            Volver al login
          </a>
        </div>
      </div>
    </div>
  );
}