"use client";

import Link from "next/link";
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
  const [showPass, setShowPass] = useState(false);
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
    <div className="min-h-screen flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md glass card">
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-2xl overflow-hidden border border-white/30 bg-white/60 flex items-center justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/lz-capacita-qr.png" alt="LZ Capacita QR" className="h-full w-full object-contain p-1" />
          </div>

          <div className="min-w-0">
            <div className="text-lg font-black leading-tight">LZ Capacita QR</div>
            <div className="text-xs font-extrabold opacity-70">Acceso al panel</div>
          </div>
        </div>

        <h1 className="mt-5 text-2xl font-black">Iniciar sesión</h1>
        <p className="mt-1 text-sm opacity-70">
          Entra para gestionar empresas, charlas y asistentes.
        </p>

        {err && (
          <div className="mt-4 rounded-xl border border-red-200/70 bg-red-50/70 p-3 text-sm text-red-700">
            {err}
          </div>
        )}

        <div className="mt-5 space-y-3">
          <div>
            <label className="text-xs font-extrabold opacity-70">Correo</label>
            <input
              className="input mt-1"
              placeholder="correo@ejemplo.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              inputMode="email"
              required
            />
          </div>

          <div>
            <label className="text-xs font-extrabold opacity-70">Contraseña</label>
            <div className="mt-1 flex gap-2">
              <input
                className="input"
                placeholder="Contraseña"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type={showPass ? "text" : "password"}
                autoComplete="current-password"
                required
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleLogin();
                }}
              />
              <button
                type="button"
                className="btn"
                style={{
                  padding: "10px 12px",
                  border: "1px solid rgba(15,23,42,.12)",
                  background: "rgba(255,255,255,.65)",
                }}
                onClick={() => setShowPass((v) => !v)}
                title={showPass ? "Ocultar contraseña" : "Mostrar contraseña"}
              >
                {showPass ? "🙈" : "👁️"}
              </button>
            </div>
          </div>

          <button
            type="button"
            onClick={handleLogin}
            disabled={loading}
            className="btn btnPrimary w-full disabled:opacity-60"
          >
            {loading ? "Entrando..." : "Entrar"}
          </button>
        </div>

        <div className="mt-4 text-sm">
          ¿No tienes cuenta?{" "}
          <Link className="font-extrabold underline" href="/signup">
            Crear cuenta
          </Link>
        </div>

        <div className="mt-6 text-center text-xs opacity-60 font-extrabold">
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