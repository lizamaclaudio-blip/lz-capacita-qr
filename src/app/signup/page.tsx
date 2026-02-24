"use client";

import Link from "next/link";
import { Suspense, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { cleanRut, isValidRut, formatRutChile, normalizeRutInput } from "@/lib/rut";

function safeNext(next: string | null) {
  if (!next) return null;
  if (next.startsWith("/") && !next.startsWith("//")) return next;
  return null;
}

function SignupInner() {
  const router = useRouter();
  const sp = useSearchParams();

  const next = safeNext(sp.get("next"));

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [rut, setRut] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [region, setRegion] = useState("");
  const [comuna, setComuna] = useState("");
  const [city, setCity] = useState("");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [showPass, setShowPass] = useState(false);

  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const fullName = useMemo(() => {
    const f = firstName.trim();
    const l = lastName.trim();
    return `${f} ${l}`.trim();
  }, [firstName, lastName]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setMsg(null);

    const f = firstName.trim();
    const l = lastName.trim();
    if (!f) return setErr("Ingresa tus nombres.");
    if (!l) return setErr("Ingresa tus apellidos.");

    const rutRaw = rut.trim();
    const rutClean = cleanRut(rutRaw);
    if (!rutRaw) return setErr("Ingresa tu RUT.");
    if (!isValidRut(rutClean)) return setErr("RUT inválido (dígito verificador incorrecto).");

    const addr = address.trim();
    if (!addr) return setErr("Ingresa tu dirección.");

    const ph = phone.trim();
    if (!ph) return setErr("Ingresa tu teléfono.");
    if (ph.replace(/\D/g, "").length < 8) return setErr("Teléfono inválido (muy corto).");

    const reg = region.trim();
    const com = comuna.trim();
    const ciu = city.trim();
    if (!reg) return setErr("Ingresa tu región.");
    if (!com) return setErr("Ingresa tu comuna.");
    if (!ciu) return setErr("Ingresa tu ciudad.");

    const mail = email.trim();
    if (!mail) return setErr("Ingresa tu correo.");

    if (!password || password.length < 6) return setErr("La contraseña debe tener al menos 6 caracteres.");
    if (password !== password2) return setErr("Las contraseñas no coinciden.");

    setLoading(true);

    try {
      const { data, error } = await supabaseBrowser.auth.signUp({
        email: mail,
        password,
        options: {
          data: {
            full_name: fullName,

            first_name: f,
            last_name: l,
            rut: rutClean, // guardamos limpio
            address: addr,
            phone: ph,
            region: reg,
            comuna: com,
            city: ciu,
          },
        },
      });

      setLoading(false);

      if (error) {
        setErr(error.message);
        return;
      }

      if (data.session) {
        router.replace(next || "/app");
        return;
      }

      setMsg("Cuenta creada ✅ Revisa tu correo para confirmar el acceso.");
    } catch (e: any) {
      setLoading(false);
      setErr(e?.message || "Error inesperado al crear la cuenta.");
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-lg glass card">
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-2xl overflow-hidden border border-white/30 bg-white/60 flex items-center justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/lz-capacita-qr.png" alt="LZ Capacita QR" className="h-full w-full object-contain p-1" />
          </div>

          <div className="min-w-0">
            <div className="text-lg font-black leading-tight">Crear cuenta</div>
            <div className="text-xs font-extrabold opacity-70">
              Tus empresas y charlas quedan separadas por usuario.
            </div>
          </div>
        </div>

        {err && (
          <div className="mt-4 rounded-xl border border-red-200/70 bg-red-50/70 p-3 text-sm text-red-700">
            {err}
          </div>
        )}
        {msg && (
          <div className="mt-4 rounded-xl border border-emerald-200/70 bg-emerald-50/70 p-3 text-sm text-emerald-800">
            {msg}
          </div>
        )}

        <form onSubmit={onSubmit} className="mt-5 space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="text-xs font-extrabold opacity-70">Nombres</label>
              <input className="input mt-1" value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
            </div>
            <div>
              <label className="text-xs font-extrabold opacity-70">Apellidos</label>
              <input className="input mt-1" value={lastName} onChange={(e) => setLastName(e.target.value)} required />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="text-xs font-extrabold opacity-70">RUT</label>
              <input
                className="input mt-1"
                placeholder="12345678-5"
                value={rut}
                onChange={(e) => setRut(normalizeRutInput(e.target.value))}
                onBlur={() => setRut(formatRutChile(rut))}
                required
              />
              <div className="mt-1 text-[11px] font-extrabold opacity-60">
                Formato Chile: número-guion-dígito verificador.
              </div>
            </div>

            <div>
              <label className="text-xs font-extrabold opacity-70">Teléfono</label>
              <input
                className="input mt-1"
                placeholder="+56 9 1234 5678"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                inputMode="tel"
                required
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-extrabold opacity-70">Dirección</label>
            <input className="input mt-1" value={address} onChange={(e) => setAddress(e.target.value)} required />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <label className="text-xs font-extrabold opacity-70">Región</label>
              <input className="input mt-1" value={region} onChange={(e) => setRegion(e.target.value)} required />
            </div>
            <div>
              <label className="text-xs font-extrabold opacity-70">Comuna</label>
              <input className="input mt-1" value={comuna} onChange={(e) => setComuna(e.target.value)} required />
            </div>
            <div>
              <label className="text-xs font-extrabold opacity-70">Ciudad</label>
              <input className="input mt-1" value={city} onChange={(e) => setCity(e.target.value)} required />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
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
              <input
                className="input mt-1"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type={showPass ? "text" : "password"}
                autoComplete="new-password"
                required
              />
            </div>

            <div>
              <label className="text-xs font-extrabold opacity-70">Repite contraseña</label>
              <input
                className="input mt-1"
                value={password2}
                onChange={(e) => setPassword2(e.target.value)}
                type={showPass ? "text" : "password"}
                autoComplete="new-password"
                required
              />
            </div>
          </div>

          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              className="btn"
              style={{
                padding: "10px 12px",
                border: "1px solid rgba(15,23,42,.12)",
                background: "rgba(255,255,255,.65)",
              }}
              onClick={() => setShowPass((v) => !v)}
            >
              {showPass ? "🙈 Ocultar" : "👁️ Mostrar"}
            </button>

            <button type="submit" disabled={loading} className="btn btnCta flex-1 disabled:opacity-60">
              {loading ? "Creando..." : "Crear cuenta"}
            </button>
          </div>
        </form>

        <div className="mt-4 text-sm">
          ¿Ya tienes cuenta?{" "}
          <Link className="font-extrabold underline" href="/login">
            Volver al login
          </Link>
        </div>

        <div className="mt-6 text-center text-xs opacity-60 font-extrabold">
          LZ Capacita QR © 2026
        </div>
      </div>
    </div>
  );
}

export default function SignupPage() {
  return (
    <Suspense fallback={<div style={{ padding: 20, opacity: 0.7 }}>Cargando…</div>}>
      <SignupInner />
    </Suspense>
  );
}