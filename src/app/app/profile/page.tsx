"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { cleanRut, isValidRut } from "@/lib/rut";

type Meta = {
  full_name?: string;
  first_name?: string;
  last_name?: string;
  rut?: string;
  address?: string;
  phone?: string;
  region?: string;
  comuna?: string;
  city?: string;
};

export default function ProfilePage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);

  const [email, setEmail] = useState("");
  const [userId, setUserId] = useState("");

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [rut, setRut] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [region, setRegion] = useState("");
  const [comuna, setComuna] = useState("");
  const [city, setCity] = useState("");

  const [saving, setSaving] = useState(false);

  const [newPassword, setNewPassword] = useState("");
  const [savingPass, setSavingPass] = useState(false);
  const [showPass, setShowPass] = useState(false);

  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const fullName = useMemo(() => {
    const f = firstName.trim();
    const l = lastName.trim();
    return `${f} ${l}`.trim();
  }, [firstName, lastName]);

  useEffect(() => {
    let alive = true;

    (async () => {
      setLoading(true);
      setErr(null);
      setMsg(null);

      const { data, error } = await supabaseBrowser.auth.getUser();
      if (!alive) return;

      if (error) {
        setErr(error.message);
        setLoading(false);
        return;
      }

      const u = data.user;
      if (!u) {
        router.replace("/login");
        return;
      }

      setUserId(u.id);
      setEmail(u.email ?? "");

      const md = (u.user_metadata ?? {}) as Meta;

      setFirstName((md.first_name ?? "").toString());
      setLastName((md.last_name ?? "").toString());
      setRut((md.rut ?? "").toString());
      setAddress((md.address ?? "").toString());
      setPhone((md.phone ?? "").toString());
      setRegion((md.region ?? "").toString());
      setComuna((md.comuna ?? "").toString());
      setCity((md.city ?? "").toString());

      // Si venías con full_name antiguo pero no first/last, hacemos fallback inteligente
      const fallbackFull = (md.full_name ?? "").toString().trim();
      if ((!md.first_name || !md.last_name) && fallbackFull && (!md.first_name && !md.last_name)) {
        const parts = fallbackFull.split(" ").filter(Boolean);
        if (parts.length >= 2) {
          setFirstName(parts.slice(0, -1).join(" "));
          setLastName(parts.slice(-1).join(" "));
        } else if (parts.length === 1) {
          setFirstName(parts[0] || "");
        }
      }

      setLoading(false);
    })();

    return () => {
      alive = false;
    };
  }, [router]);

  function validate() {
    const f = firstName.trim();
    const l = lastName.trim();
    if (!f) return "Ingresa tus nombres.";
    if (!l) return "Ingresa tus apellidos.";

    const rutRaw = rut.trim();
    const rutClean = cleanRut(rutRaw);
    if (!rutRaw) return "Ingresa tu RUT.";
    if (!isValidRut(rutClean)) return "RUT inválido (dígito verificador incorrecto).";

    const addr = address.trim();
    if (!addr) return "Ingresa tu dirección.";

    const ph = phone.trim();
    if (!ph) return "Ingresa tu teléfono.";
    if (ph.replace(/\D/g, "").length < 8) return "Teléfono inválido (muy corto).";

    const reg = region.trim();
    const com = comuna.trim();
    const ciu = city.trim();
    if (!reg) return "Ingresa tu región.";
    if (!com) return "Ingresa tu comuna.";
    if (!ciu) return "Ingresa tu ciudad.";

    return null;
  }

  async function saveProfile() {
    setErr(null);
    setMsg(null);

    const v = validate();
    if (v) {
      setErr(v);
      return;
    }

    const rutClean = cleanRut(rut.trim());

    setSaving(true);

    const { error } = await supabaseBrowser.auth.updateUser({
      data: {
        // compat y saludo
        full_name: fullName,

        first_name: firstName.trim(),
        last_name: lastName.trim(),
        rut: rutClean,
        address: address.trim(),
        phone: phone.trim(),
        region: region.trim(),
        comuna: comuna.trim(),
        city: city.trim(),
      },
    });

    setSaving(false);

    if (error) {
      setErr(error.message);
      return;
    }

    setMsg("✅ Perfil actualizado.");
  }

  async function changePassword() {
    setErr(null);
    setMsg(null);

    if (!newPassword || newPassword.length < 6) {
      setErr("La contraseña debe tener al menos 6 caracteres.");
      return;
    }

    setSavingPass(true);

    const { error } = await supabaseBrowser.auth.updateUser({
      password: newPassword,
    });

    setSavingPass(false);

    if (error) {
      setErr(error.message);
      return;
    }

    setNewPassword("");
    setMsg("✅ Contraseña actualizada.");
  }

  return (
    <div className="max-w-5xl mx-auto space-y-4">
      {/* Header */}
      <div className="glass card flex items-start justify-between gap-4">
        <div>
          <div className="text-2xl font-black">Mi perfil</div>
          <div className="text-sm opacity-70 font-extrabold">
            Edita tus datos. El email es solo lectura.
          </div>
        </div>

        <button type="button" className="btn" onClick={() => router.push("/app")}>
          ← Volver
        </button>
      </div>

      {(err || msg) && (
        <div
          className={`glass card ${
            err ? "border border-red-200/70 bg-red-50/60" : "border border-emerald-200/70 bg-emerald-50/60"
          }`}
        >
          <div className={`text-sm font-extrabold ${err ? "text-red-700" : "text-emerald-800"}`}>
            {err ? err : msg}
          </div>
        </div>
      )}

      {loading ? (
        <div className="glass card">
          <div className="opacity-70 font-extrabold">Cargando…</div>
        </div>
      ) : (
        <>
          {/* Datos cuenta */}
          <div className="glass card">
            <div className="text-lg font-black">Datos de cuenta</div>
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="text-xs font-extrabold opacity-70">Email</label>
                <input className="input mt-1 opacity-80" value={email} disabled />
              </div>
              <div>
                <label className="text-xs font-extrabold opacity-70">ID usuario</label>
                <input className="input mt-1 opacity-80" value={userId} disabled />
              </div>
            </div>
          </div>

          {/* Datos personales */}
          <div className="glass card">
            <div className="text-lg font-black">Datos personales</div>
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="text-xs font-extrabold opacity-70">Nombres</label>
                <input className="input mt-1" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
              </div>
              <div>
                <label className="text-xs font-extrabold opacity-70">Apellidos</label>
                <input className="input mt-1" value={lastName} onChange={(e) => setLastName(e.target.value)} />
              </div>

              <div>
                <label className="text-xs font-extrabold opacity-70">RUT</label>
                <input
                  className="input mt-1"
                  placeholder="12.345.678-5"
                  value={rut}
                  onChange={(e) => setRut(e.target.value)}
                />
                <div className="mt-1 text-[11px] font-extrabold opacity-60">
                  Se valida el dígito verificador.
                </div>
              </div>

              <div>
                <label className="text-xs font-extrabold opacity-70">Teléfono</label>
                <input
                  className="input mt-1"
                  placeholder="+56 9 1234 5678"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>

              <div className="sm:col-span-2">
                <label className="text-xs font-extrabold opacity-70">Dirección</label>
                <input className="input mt-1" value={address} onChange={(e) => setAddress(e.target.value)} />
              </div>

              <div>
                <label className="text-xs font-extrabold opacity-70">Región</label>
                <input className="input mt-1" value={region} onChange={(e) => setRegion(e.target.value)} />
              </div>
              <div>
                <label className="text-xs font-extrabold opacity-70">Comuna</label>
                <input className="input mt-1" value={comuna} onChange={(e) => setComuna(e.target.value)} />
              </div>
              <div>
                <label className="text-xs font-extrabold opacity-70">Ciudad</label>
                <input className="input mt-1" value={city} onChange={(e) => setCity(e.target.value)} />
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button type="button" className="btn btnPrimary" onClick={saveProfile} disabled={saving}>
                {saving ? "Guardando…" : "Guardar perfil"}
              </button>

              <div className="text-xs font-extrabold opacity-60">
                Se guarda en <span className="font-black">user_metadata</span>.
              </div>
            </div>
          </div>

          {/* Seguridad */}
          <div className="glass card">
            <div className="text-lg font-black">Seguridad</div>

            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="text-xs font-extrabold opacity-70">Nueva contraseña</label>
                <div className="mt-1 flex gap-2">
                  <input
                    className="input"
                    type={showPass ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Mínimo 6 caracteres"
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
                  >
                    {showPass ? "🙈" : "👁️"}
                  </button>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <button type="button" className="btn btnCta" onClick={changePassword} disabled={savingPass}>
                    {savingPass ? "Actualizando…" : "Actualizar contraseña"}
                  </button>

                  <div className="text-xs font-extrabold opacity-60">
                    Esto actualiza tu contraseña en Supabase Auth.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}