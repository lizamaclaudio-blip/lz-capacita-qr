"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { cleanRut, isValidRut, formatRutChile, normalizeRutInput } from "@/lib/rut";
import styles from "./page.module.css";

function isEmail(v: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
}

function SignupSkeleton() {
  return (
    <main className={styles.shell}>
      <div className={styles.card}>
        <div className={styles.title}>Cargando…</div>
        <div className={styles.sub}>Preparando registro</div>
      </div>
    </main>
  );
}

function SignupInner() {
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
      const rClean = cleanRut(rut);

      const { error } = await supabaseBrowser.auth.signUp({
        email: em,
        password: pw1,
        options: {
          data: {
            first_name: firstName.trim(),
            last_name: lastName.trim(),
            full_name: `${firstName.trim()} ${lastName.trim()}`.trim(),
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

      setOk("✅ Cuenta creada. Revisa tu correo si se requiere confirmación.");
      router.replace("/app");
    } catch (e: any) {
      setErr(e?.message || "No se pudo crear la cuenta");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <SignupSkeleton />;

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
              <h1 className={styles.h1}>Registro</h1>
              <p className={styles.p}>Crea tu cuenta para administrar empresas, charlas y PDFs.</p>
            </div>
          </div>

          {err ? <div className={styles.errBox}>{err}</div> : null}
          {ok ? <div className={styles.okBox}>{ok}</div> : null}

          <form className={styles.form} onSubmit={submit}>
            <div className={styles.field}>
              <label className={styles.label}>Email</label>
              <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>

            <div className={styles.grid2}>
              <div className={styles.field}>
                <label className={styles.label}>Contraseña</label>
                <input className="input" type="password" value={pw1} onChange={(e) => setPw1(e.target.value)} required />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Confirmar contraseña</label>
                <input className="input" type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} required />
              </div>
            </div>

            <div className={styles.grid2}>
              <div className={styles.field}>
                <label className={styles.label}>Nombres</label>
                <input className="input" value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Apellidos</label>
                <input className="input" value={lastName} onChange={(e) => setLastName(e.target.value)} required />
              </div>
            </div>

            <div className={styles.grid2}>
              <div className={styles.field}>
                <label className={styles.label}>RUT</label>
                <input
                  className="input"
                  value={rut}
                  onChange={(e) => setRut(normalizeRutInput(e.target.value))}
                  onBlur={() => setRut(formatRutChile(cleanRut(rut)))}
                  placeholder="12345678-9"
                  required
                />
                {rutLooksComplete ? (
                  <div className={rutOk ? styles.hintOk : styles.hintBad}>
                    {rutOk ? "RUT válido" : "RUT inválido"}
                  </div>
                ) : null}
              </div>

              <div className={styles.field}>
                <label className={styles.label}>Teléfono</label>
                <input className="input" value={phone} onChange={(e) => setPhone(e.target.value)} />
              </div>
            </div>

            <div className={styles.field}>
              <label className={styles.label}>Dirección</label>
              <input className="input" value={address} onChange={(e) => setAddress(e.target.value)} />
            </div>

            <div className={styles.grid3}>
              <div className={styles.field}>
                <label className={styles.label}>Región</label>
                <input className="input" value={region} onChange={(e) => setRegion(e.target.value)} />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Comuna</label>
                <input className="input" value={comuna} onChange={(e) => setComuna(e.target.value)} />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Ciudad</label>
                <input className="input" value={city} onChange={(e) => setCity(e.target.value)} />
              </div>
            </div>

            <div className={styles.actions}>
              <button className="btn btnPrimary" type="submit" disabled={submitting}>
                {submitting ? "Creando…" : "Crear cuenta"}
              </button>
              <Link className="btn btnGhost" href="/login">
                Volver a login
              </Link>
            </div>
          </form>
        </section>
      </div>
    </main>
  );
}

export default function SignupPage() {
  // ✅ FIX Next 16: useSearchParams debe estar dentro de Suspense en una page
  return (
    <Suspense fallback={<SignupSkeleton />}>
      <SignupInner />
    </Suspense>
  );
}