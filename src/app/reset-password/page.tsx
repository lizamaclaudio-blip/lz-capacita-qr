"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/browser";
import styles from "./page.module.css";

export default function ResetPasswordPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const [pw1, setPw1] = useState("");
  const [pw2, setPw2] = useState("");

  useEffect(() => {
    // This page is meant to be opened from the reset email link
    // Supabase sets a temporary session on redirect.
    (async () => {
      const { data } = await supabaseBrowser.auth.getSession();
      if (!data.session) {
        setErr("Este enlace no tiene sesión activa. Vuelve a solicitar recuperación desde Login.");
        setLoading(false);
        return;
      }
      setLoading(false);
    })();
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setOk(null);

    const a = pw1.trim();
    const b = pw2.trim();

    if (!a || a.length < 6) {
      setErr("La nueva contraseña debe tener al menos 6 caracteres.");
      return;
    }
    if (a !== b) {
      setErr("Las contraseñas no coinciden.");
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabaseBrowser.auth.updateUser({ password: a });
      if (error) throw new Error(error.message);

      setOk("✅ Contraseña actualizada. Ahora puedes iniciar sesión.");
      setPw1("");
      setPw2("");

      window.setTimeout(() => {
        router.replace("/login?m=" + encodeURIComponent("Contraseña actualizada. Inicia sesión."));
      }, 900);
    } catch (e: any) {
      setErr(e?.message || "No se pudo actualizar la contraseña");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <main className={styles.shell}>
        <div className={styles.card}>
          <div className={styles.title}>Cargando…</div>
          <div className={styles.sub}>Verificando enlace</div>
        </div>
      </main>
    );
  }

  return (
    <main className={styles.shell}>
      <div className={styles.wrap}>
        <header className={styles.brandRow}>
          <div className={styles.brandTitle}>LZ Capacita QR</div>
          <div className={styles.brandSub}>Recuperación · seguridad · acceso</div>
        </header>

        <section className={styles.card}>
          <div className={styles.head}>
            <div>
              <div className={styles.kicker}>Reset</div>
              <h1 className={styles.h1}>Nueva contraseña</h1>
              <p className={styles.p}>
                Define una nueva contraseña para tu cuenta. Luego podrás volver a ingresar al panel.
              </p>
            </div>

            <div className={styles.sidePills}>
              <span className={`${styles.pill} ${styles.pillMuted}`}>Secure</span>
              <span className={`${styles.pill} ${styles.pillMuted}`}>Recovery</span>
            </div>
          </div>

          {err ? <div className={styles.errBox}>{err}</div> : null}
          {ok ? <div className={styles.okBox}>{ok}</div> : null}

          <form className={styles.form} onSubmit={submit}>
            <div className={styles.field}>
              <label className={styles.label}>Nueva contraseña</label>
              <input
                className="input"
                type="password"
                value={pw1}
                onChange={(e) => setPw1(e.target.value)}
                autoComplete="new-password"
                required
              />
            </div>

            <div className={styles.field}>
              <label className={styles.label}>Repite nueva contraseña</label>
              <input
                className="input"
                type="password"
                value={pw2}
                onChange={(e) => setPw2(e.target.value)}
                autoComplete="new-password"
                required
              />
            </div>

            <div className={styles.actions}>
              <button className="btn btnPrimary" type="submit" disabled={submitting}>
                {submitting ? "Actualizando…" : "Actualizar contraseña"}
              </button>

              <Link className="btn btnGhost" href="/login">
                Volver a Login
              </Link>
            </div>
          </form>

          <div className={styles.bottom}>
            <div className={styles.bottomMini}>
              Si este enlace expiró, vuelve a solicitar recuperación desde{" "}
              <Link className={styles.link} href="/login">
                Login
              </Link>
              .
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
