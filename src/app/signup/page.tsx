"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { cleanRut, isValidRut } from "@/lib/rut";

export default function SignupPage() {
  const router = useRouter();

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

  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setMsg(null);

    const fn = firstName.trim();
    const ln = lastName.trim();
    if (!fn) return setErr("Ingresa tus nombres.");
    if (!ln) return setErr("Ingresa tus apellidos.");

    const fullName = `${fn} ${ln}`.trim();

    const mail = email.trim();
    if (!mail) return setErr("Ingresa tu correo.");

    if (!password || password.length < 6) return setErr("La contraseña debe tener al menos 6 caracteres.");
    if (password !== password2) return setErr("Las contraseñas no coinciden.");

    const rutRaw = rut.trim();
    if (!rutRaw) return setErr("RUT es obligatorio.");
    const rutClean = cleanRut(rutRaw);
    if (!isValidRut(rutClean)) return setErr("RUT inválido.");

    setLoading(true);

    const { data, error } = await supabaseBrowser.auth.signUp({
      email: mail,
      password,
      options: {
        data: {
          full_name: fullName,
          first_name: fn,
          last_name: ln,
          rut: rutClean,
          address: address.trim() || null,
          phone: phone.trim() || null,
          region: region.trim() || null,
          comuna: comuna.trim() || null,
          city: city.trim() || null,
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
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <input
              className="w-full rounded-lg border px-3 py-2"
              placeholder="Nombres"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              autoComplete="given-name"
              required
            />

            <input
              className="w-full rounded-lg border px-3 py-2"
              placeholder="Apellidos"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              autoComplete="family-name"
              required
            />
          </div>

          <input
            className="w-full rounded-lg border px-3 py-2"
            placeholder="RUT (ej: 12.345.678-9)"
            value={rut}
            onChange={(e) => setRut(e.target.value)}
            required
          />

          <input
            className="w-full rounded-lg border px-3 py-2"
            placeholder="Dirección"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            autoComplete="street-address"
          />

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <input
              className="w-full rounded-lg border px-3 py-2"
              placeholder="Teléfono"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              autoComplete="tel"
            />

            <input
              className="w-full rounded-lg border px-3 py-2"
              placeholder="Ciudad"
              value={city}
              onChange={(e) => setCity(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <input
              className="w-full rounded-lg border px-3 py-2"
              placeholder="Región"
              value={region}
              onChange={(e) => setRegion(e.target.value)}
            />

            <input
              className="w-full rounded-lg border px-3 py-2"
              placeholder="Comuna"
              value={comuna}
              onChange={(e) => setComuna(e.target.value)}
            />
          </div>

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