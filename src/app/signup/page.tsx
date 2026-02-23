"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { cleanRut, isValidRut } from "@/lib/rut";

export default function SignupPage() {
  const router = useRouter();

  const [fullName, setFullName] = useState("");
  const [rut, setRut] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");

  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setMsg(null);

    const name = fullName.trim();
    if (!name) return setErr("Ingresa tu nombre.");

    const mail = email.trim();
    if (!mail) return setErr("Ingresa tu correo.");

    if (!password || password.length < 6) return setErr("La contraseña debe tener al menos 6 caracteres.");
    if (password !== password2) return setErr("Las contraseñas no coinciden.");

    const rutRaw = rut.trim();
    let rutClean: string | null = null;
    if (rutRaw) {
      rutClean = cleanRut(rutRaw);
      if (!isValidRut(rutClean)) return setErr("RUT inválido.");
    }

    setLoading(true);

    const { data, error } = await supabaseBrowser.auth.signUp({
      email: mail,
      password,
      options: {
        data: {
          full_name: name,
          rut: rutClean,
        },
      },
    });

    setLoading(false);

    if (error) {
      setErr(error.message);
      return;
    }

    if (data.session) {
      router.replace("/app");
      return;
    }

    setMsg("Cuenta creada. Revisa tu correo para confirmar el acceso.");
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl border border-black/10 bg-white/70 p-6 shadow-[0_18px_60px_rgba(0,0,0,0.12)] backdrop-blur">
        <h1 className="text-2xl font-bold">Crear cuenta</h1>

        <p className="mt-2 text-sm opacity-70">
          Cada cuenta tiene sus <b>empresas</b> y <b>charlas</b> independientes.
        </p>

        {err && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {err}
          </div>
        )}
        {msg && (
          <div className="mt-4 rounded-lg border border-teal-200 bg-teal-50 p-3 text-sm text-teal-900">
            {msg}
          </div>
        )}

        <form onSubmit={onSubmit} className="mt-5 space-y-3">
          <input
            className="w-full rounded-lg border px-3 py-2"
            placeholder="Nombre completo"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            autoComplete="name"
            required
          />

          <input
            className="w-full rounded-lg border px-3 py-2"
            placeholder="RUT (opcional)"
            value={rut}
            onChange={(e) => setRut(e.target.value)}
          />

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

          <input
            className="w-full rounded-lg border px-3 py-2"
            placeholder="Repite la contraseña"
            value={password2}
            onChange={(e) => setPassword2(e.target.value)}
            type="password"
            autoComplete="new-password"
            required
          />

          <button
            disabled={loading}
            className="w-full rounded-lg bg-amber-500 py-2 font-semibold text-slate-900 hover:bg-amber-400 disabled:opacity-60"
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