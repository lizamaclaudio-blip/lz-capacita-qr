"use client";

import AppShell from "@/components/AppShell";
import Link from "next/link";
import { useState } from "react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    alert(`Demo login: ${email}`);
  }

  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <div className="text-sm text-white/70">Acceso</div>
          <h1 className="text-2xl font-bold">Iniciar sesión</h1>
        </div>

        <form onSubmit={onSubmit} className="space-y-3">
          <input
            className="w-full rounded-xl border border-white/15 bg-white/10 px-4 py-3 outline-none"
            placeholder="Correo"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <input
            className="w-full rounded-xl border border-white/15 bg-white/10 px-4 py-3 outline-none"
            placeholder="Clave"
            type="password"
            value={pass}
            onChange={(e) => setPass(e.target.value)}
          />

          <button className="w-full rounded-xl bg-emerald-400 text-slate-950 font-semibold py-3">
            Entrar
          </button>
        </form>

        <div className="text-sm text-white/70">
          ¿No tienes cuenta?{" "}
          <Link className="text-emerald-200 underline" href="/register">
            Crear cuenta
          </Link>
        </div>

        <Link className="text-xs text-white/60 underline" href="/">
          ← Volver
        </Link>
      </div>
    </AppShell>
  );
}