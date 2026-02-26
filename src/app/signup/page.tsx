"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { cleanRut, isValidRut, formatRutChile, normalizeRutInput } from "@/lib/rut";
import styles from "./page.module.css";

function isEmail(v: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
}

export default function SignupPage() {
  const router = useRouter();
  const sp = useSearchParams();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  // Account
  const [email, setEmail] = useState("");
  const [pw1, setPw1] = useState("");
  const [pw2, setPw2] = useState("");

  // Metadata
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [rut, setRut] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [region, setRegion] = useState("");
  const [comuna, setComuna] = useState("");
  const [city, setCity] = useState("");

  const rutClean = useMemo(() => cleanRut(rut), [rut]);
  const rutLooksComplete = useMemo(() => rutClean.length >= 8, [rutClean]);
  const rutOk = useMemo(() => (rutClean ? isValidRut(rutClean) : false), [rutClean]);

  useEffect(() => {
    // If already signed in, go to app
    (async () => {
      const { data } = await supabaseBrowser.auth.getSession();
      if (data.session) {
        router.replace("/app");
        return;
      }
      setLoading(false);
    })();
  }, [router]);

  useEffect(() => {
    const e = sp.get("e");
    if (e) setErr(e);
    const m = sp.get("m");
    if (m) setOk(m);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function validate() {
    const em = email.trim().toLowerCase();
    if (!em) return "Ingresa tu email.";
    if (!isEmail(em)) return "Email inválido.";

    if (!pw1 || pw1.length < 6) return "La contraseña debe tener al menos 6 caracteres.";
    if (pw1 !== pw2) return "Las contraseñas no coinciden.";

    const f = firstName.trim();
    const l = lastName.trim();
    if (!f) return "Ingresa tus nombres.";
    if (!l) return "Ingresa tus apellidos.";

    const rInput = rut.trim();
    const rClean = cleanRut(rInput);
    if (!rInput) return "Ingresa tu RUT.";
    if (!isValidRut(rClean)) return "RUT inválido (dígito verificador incorrecto).";

    if (!address.trim()) return "Ingresa tu dirección.";
    const ph = phone.trim();
    if (!ph) return "Ingresa tu teléfono.";
    if (ph.replace(/\D/g, "").length < 8) return "Teléfono inválido (muy corto).";

    if (!region.trim()) return "Ingresa tu región.";
    if (!comuna.trim()) return "Ingresa tu comuna.";
    if (!city.trim()) return "Ingresa tu ciudad.";

    return null;
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setOk(null);

    const v = validate();
    if (v) {
      setErr(v);
      return;
    }

    setSubmitting(true);
    try {
      const em = email.trim().toLowerCase();
      const rClean = cleanRut(rut.trim());
      const f = firstName.trim();
      const l = lastName.trim();
      const full_name = `${f} ${l}`.trim();

      const { data, error } = await supabaseBrowser.auth.signUp({
        email: em,
        password: pw1,
        options: {
          data: {
            full_name,
            first_name: f,
            last_name: l,
            rut: rClean,
            address: address.trim(),
            phone: phone.trim(),
            region: region.trim(),
            comuna: comuna.trim(),
            city: city.trim(),
          },
        },
      });

      if (error) throw new Error(error.message);

      // If email confirmation is enabled, user may not have session yet.
      if (!data.session) {
        setOk("✅ Cuenta creada. Revisa tu correo para confirmar el acceso.");
        return;
      }

      router.replace("/app");
    } catch (e: any) {
      setErr(e?.message || "No se pudo crear la cuenta");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <main className={styles.shell}>
        <div className={styles.card}>
          <div className={styles.title}>Cargando…</div>
          <div className={styles.sub}>Preparando registro</div>
        </div>
      </main>
    );
  }

  return (
    <main className={styles.shell}>
      <div className={styles.wrap}>
        <header className={styles.brandRow}>
          <div className={styles.brandTitle}>LZ Capacita QR</div>
          <div className={styles.brandSub}>Registro ejecutivo · trazabilidad · evidencia</div>
        </header>

        <section className={styles.card}>
          <div className={styles.head}>
            <div>
              <div className={styles.kicker}>Crear cuenta</div>
              <h1 className={styles.h1}>Tu panel en 1 minuto</h1>
              <p className={styles.p}>
                Datos reales para trazabilidad (RUT + DV). Luego podrás crear empresas, charlas y PDFs.
              </p>
            </div>

            <div className={styles.sidePills}>
              <span className={`${styles.pill} ${rutClean && rutLooksComplete ? (rutOk ? styles.pillOk : styles.pillWarn) : styles.pillMuted}`}>
                {rutClean && rutLooksComplete ? (rutOk ? "DV OK" : "Revisar DV") : "RUT"}
              </span>
              <span className={`${styles.pill} ${styles.pillMuted}`}>Onboarding</span>
            </div>
          </div>

          {err ? <div className={styles.errBox}>{err}</div> : null}
          {ok ? <div className={styles.okBox}>{ok}</div> : null}

          <form className={styles.form} onSubmit={submit}>
            <div className={styles.sectionTitle}>Acceso</div>

            <div className={styles.row2}>
              <div className={styles.field}>
                <label className={styles.label}>Email</label>
                <input
                  className="input"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="tu@email.com"
                  required
                />
              </div>

              <div className={styles.field}>
                <label className={styles.label}>Contraseña</label>
                <input
                  className="input"
                  type="password"
                  value={pw1}
                  onChange={(e) => setPw1(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                  autoComplete="new-password"
                  required
                />
              </div>
            </div>

            <div className={styles.row2}>
              <div className={styles.field}>
                <label className={styles.label}>Repite contraseña</label>
                <input
                  className="input"
                  type="password"
                  value={pw2}
                  onChange={(e) => setPw2(e.target.value)}
                  autoComplete="new-password"
                  required
                />
              </div>

              <div className={styles.field}>
                <label className={styles.label}>Teléfono</label>
                <input
                  className="input"
                  inputMode="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+56 9 1234 5678"
                  required
                />
              </div>
            </div>

            <div className={styles.sep} />

            <div className={styles.sectionTitle}>Identidad</div>

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

            <div className={styles.field}>
              <div className={styles.labelRow}>
                <label className={styles.label}>RUT</label>
                <span
                  className={`${styles.rutPill} ${rutClean && rutLooksComplete ? (rutOk ? styles.rutOk : styles.rutBad) : styles.rutIdle}`}
                  title="Validación por DV"
                >
                  {rutClean && rutLooksComplete ? (rutOk ? "DV OK" : "DV inválido") : "Chile"}
                </span>
              </div>
              <input
                className="input"
                value={rut}
                onChange={(e) => setRut(normalizeRutInput(e.target.value))}
                onBlur={() => setRut(formatRutChile(rut))}
                placeholder="12345678-5"
                required
              />
              <div className={styles.hint}>Formato Chile: XXXXXXXX-X (sin puntos). Validamos DV.</div>
            </div>

            <div className={styles.sep} />

            <div className={styles.sectionTitle}>Dirección</div>

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

            <div className={styles.actions}>
              <div className={styles.legal}>
                Al crear cuenta, aceptas un uso orientado a trazabilidad y respaldo de capacitaciones.
              </div>

              <button className="btn btnPrimary" type="submit" disabled={submitting}>
                {submitting ? "Creando…" : "Crear cuenta"}
              </button>
            </div>
          </form>

          <div className={styles.bottom}>
            <div className={styles.bottomText}>
              ¿Ya tienes cuenta?{" "}
              <Link className={styles.link} href="/login">
                Inicia sesión
              </Link>
            </div>

            <div className={styles.bottomMini}>
              Si tu proyecto tiene confirmación por correo activada, primero deberás confirmar tu email.
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
