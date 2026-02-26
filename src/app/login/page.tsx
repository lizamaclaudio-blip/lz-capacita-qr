"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/browser";
import styles from "./page.module.css";

function isEmail(v: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
}

function normalizeLoginEmail(raw: string) {
  const v = raw.trim().toLowerCase();
  // Permitir login escribiendo solo "demo"
  if (v === "demo") return "demo@lzcapacitqr.cl";
  return v;
}

function LoginSkeleton() {
  return (
    <main className={styles.shell}>
      <div className={styles.card}>
        <div className={styles.title}>Cargando…</div>
        <div className={styles.sub}>Preparando acceso</div>
      </div>
    </main>
  );
}

function LoginInner() {
  const router = useRouter();
  const sp = useSearchParams();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const redirectTo = sp.get("redirect") || "/app";

  useEffect(() => {
    (async () => {
      const { data } = await supabaseBrowser.auth.getSession();
      if (data.session) {
        router.replace(redirectTo);
        return;
      }
      setLoading(false);
    })();
  }, [router, redirectTo]);

  useEffect(() => {
    const e = sp.get("e");
    if (e) setErr(e);
    const m = sp.get("m");
    if (m) setOk(m);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setOk(null);

    const em = normalizeLoginEmail(email);
    if (!em) {
      setErr("Ingresa tu email.");
      return;
    }
    if (!isEmail(em)) {
      setErr("Email inválido.");
      return;
    }
    if (!password) {
      setErr("Ingresa tu contraseña.");
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabaseBrowser.auth.signInWithPassword({
        email: em,
        password,
      });
      if (error) throw new Error(error.message);

      router.replace(redirectTo);
    } catch (e: any) {
      setErr(e?.message || "No se pudo iniciar sesión");
    } finally {
      setSubmitting(false);
    }
  }

  async function resetPassword() {
    setErr(null);
    setOk(null);

    const em = normalizeLoginEmail(email);
    if (!em) {
      setErr("Ingresa tu email para enviar el enlace de recuperación.");
      return;
    }
    if (!isEmail(em)) {
      setErr("Email inválido.");
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabaseBrowser.auth.resetPasswordForEmail(em, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw new Error(error.message);

      setOk("✅ Te enviamos un correo para recuperar tu contraseña.");
    } catch (e: any) {
      setErr(e?.message || "No se pudo enviar el correo de recuperación");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <LoginSkeleton />;

  return (
    <main className={styles.shell}>
      <div className={styles.wrap}>
        <header className={styles.brandRow}>
          <div className={styles.brandTitle}>LZ Capacita QR</div>
          <div className={styles.brandSub}>Acceso ejecutivo · trazabilidad · evidencia</div>
        </header>

        <section className={styles.card}>
          <div className={styles.head}>
            <div>
              <div className={styles.kicker}>Iniciar sesión</div>
              <h1 className={styles.h1}>Bienvenido</h1>
              <p className={styles.p}>
                Ingresa a tu panel para crear empresas, gestionar charlas y generar PDFs.
              </p>
            </div>

            <div className={styles.sidePills}>
              <span className={`${styles.pill} ${styles.pillMuted}`}>Secure</span>
              <span className={`${styles.pill} ${styles.pillMuted}`}>Panel</span>
            </div>
          </div>

          {err ? <div className={styles.errBox}>{err}</div> : null}
          {ok ? <div className={styles.okBox}>{ok}</div> : null}

          <form className={styles.form} onSubmit={submit}>
            <div className={styles.field}>
              <label className={styles.label}>Email</label>
              <input
                className="input"
                type="text"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tu@email.com o demo"
                required
              />
            </div>

            <div className={styles.field}>
              <label className={styles.label}>Contraseña</label>
              <input
                className="input"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
            </div>

            <div className={styles.actions}>
              <button className="btn btnPrimary" type="submit" disabled={submitting}>
                {submitting ? "Ingresando…" : "Ingresar"}
              </button>

              <button className="btn btnGhost" type="button" disabled={submitting} onClick={resetPassword}>
                Recuperar contraseña
              </button>
            </div>
          </form>

          <div className={styles.bottom}>
            <div className={styles.bottomText}>
              ¿No tienes cuenta?{" "}
              <Link className={styles.link} href="/signup">
                Crear cuenta
              </Link>
            </div>

            <div className={styles.bottomMini}>
              Si estás con problemas de acceso, usa “Recuperar contraseña” (te enviará un link por correo).
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

export default function LoginPage() {
  // ✅ FIX Next 16: useSearchParams debe estar dentro de Suspense en una page
  return (
    <Suspense fallback={<LoginSkeleton />}>
      <LoginInner />
    </Suspense>
  );
}