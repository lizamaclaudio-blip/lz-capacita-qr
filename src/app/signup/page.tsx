"use client";

import Link from "next/link";
import { Suspense, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { cleanRut, isValidRut, formatRutChile, normalizeRutInput } from "@/lib/rut";
import styles from "./page.module.css";

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
            rut: rutClean,
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
    <div className={styles.page}>
      <div className={styles.grid}>
        {/* LEFT */}
        <aside className={styles.left}>
          <div className={styles.brandRow}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className={styles.logo} src="/brand/lz-capacita-qr.png" alt="LZ Capacita QR" />
            <div className={styles.brandText}>
              <div className={styles.brandTitle}>Crear cuenta</div>
              <div className={styles.brandSub}>Tus empresas y charlas quedan separadas por usuario</div>
            </div>
          </div>

          <h1 className={styles.h1}>
            Empieza con trazabilidad real
            <br />
            <span className={styles.h1Strong}>en minutos.</span>
          </h1>

          <p className={styles.p}>
            Crea tu cuenta y administra tus empresas, charlas y PDF finales desde un panel simple y ordenado.
          </p>

          <div className={styles.bullets}>
            <div className={styles.bullet}>✅ 1 cuenta = 1 panel propio</div>
            <div className={styles.bullet}>✅ RUT validado + firma</div>
            <div className={styles.bullet}>✅ PDF final con logo</div>
            <div className={styles.bullet}>✅ Ideal para auditorías</div>
          </div>

          <div className={styles.miniCta}>
            <Link href="/login" className="btn btnGhost">
              Ya tengo cuenta
            </Link>
            <a className="btn btnGhost" href="/">
              Ver landing
            </a>
          </div>

          <div className={styles.foot}>LZ Capacita QR © 2026</div>
        </aside>

        {/* RIGHT */}
        <section className={styles.right}>
          <div className={styles.card}>
            <div className={styles.cardHead}>
              <div className={styles.cardTitle}>Datos de registro</div>
              <div className={styles.cardSub}>Completa tu información para crear tu cuenta</div>
            </div>

            {err && <div className={styles.errBox}>{err}</div>}
            {msg && <div className={styles.okBox}>{msg}</div>}

            <form onSubmit={onSubmit} className={styles.form}>
              <div className={styles.row2}>
                <div className={styles.field}>
                  <label className={styles.label}>Nombres</label>
                  <input className="input" value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>Apellidos</label>
                  <input className="input" value={lastName} onChange={(e) => setLastName(e.target.value)} required />
                </div>
              </div>

              <div className={styles.row2}>
                <div className={styles.field}>
                  <label className={styles.label}>RUT</label>
                  <input
                    className="input"
                    placeholder="12345678-5"
                    value={rut}
                    onChange={(e) => setRut(normalizeRutInput(e.target.value))}
                    onBlur={() => setRut(formatRutChile(rut))}
                    required
                  />
                  <div className={styles.hint}>Formato Chile: número-guion-dígito verificador.</div>
                </div>

                <div className={styles.field}>
                  <label className={styles.label}>Teléfono</label>
                  <input
                    className="input"
                    placeholder="+56 9 1234 5678"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    inputMode="tel"
                    required
                  />
                </div>
              </div>

              <div className={styles.field}>
                <label className={styles.label}>Dirección</label>
                <input className="input" value={address} onChange={(e) => setAddress(e.target.value)} required />
              </div>

              <div className={styles.row3}>
                <div className={styles.field}>
                  <label className={styles.label}>Región</label>
                  <input className="input" value={region} onChange={(e) => setRegion(e.target.value)} required />
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>Comuna</label>
                  <input className="input" value={comuna} onChange={(e) => setComuna(e.target.value)} required />
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>Ciudad</label>
                  <input className="input" value={city} onChange={(e) => setCity(e.target.value)} required />
                </div>
              </div>

              <div className={styles.field}>
                <label className={styles.label}>Correo</label>
                <input
                  className="input"
                  placeholder="correo@ejemplo.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  inputMode="email"
                  required
                />
              </div>

              <div className={styles.row2}>
                <div className={styles.field}>
                  <label className={styles.label}>Contraseña</label>
                  <input
                    className="input"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    type={showPass ? "text" : "password"}
                    autoComplete="new-password"
                    required
                  />
                </div>

                <div className={styles.field}>
                  <label className={styles.label}>Repite contraseña</label>
                  <input
                    className="input"
                    value={password2}
                    onChange={(e) => setPassword2(e.target.value)}
                    type={showPass ? "text" : "password"}
                    autoComplete="new-password"
                    required
                  />
                </div>
              </div>

              <div className={styles.actionsRow}>
                <button
                  type="button"
                  className="btn btnGhost"
                  onClick={() => setShowPass((v) => !v)}
                  style={{ padding: "11px 12px" }}
                >
                  {showPass ? "🙈 Ocultar" : "👁️ Mostrar"}
                </button>

                <button type="submit" disabled={loading} className="btn btnCta" style={{ flex: 1 }}>
                  {loading ? "Creando..." : "Crear cuenta"}
                </button>
              </div>

              <div className={styles.alt}>
                ¿Ya tienes cuenta?{" "}
                <Link className={styles.link} href="/login">
                  Volver al login
                </Link>
              </div>
            </form>
          </div>

          <div className={styles.mobileFoot}>LZ Capacita QR © 2026</div>
        </section>
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