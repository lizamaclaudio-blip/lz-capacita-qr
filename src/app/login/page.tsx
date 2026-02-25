"use client";

import Link from "next/link";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/browser";
import styles from "./page.module.css";

function safeNext(next: string | null) {
  if (!next) return null;
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
    <div className={styles.page}>
      <div className={styles.grid}>
        {/* LEFT - “marketing” */}
        <aside className={styles.left}>
          <div className={styles.brandRow}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className={styles.logo} src="/brand/lz-capacita-qr.png" alt="LZ Capacita QR" />
            <div className={styles.brandText}>
              <div className={styles.brandTitle}>LZ Capacita QR</div>
              <div className={styles.brandSub}>QR · Firma · PDF Final</div>
            </div>
          </div>

          <h1 className={styles.h1}>
            Capacita, firma y respalda
            <br />
            <span className={styles.h1Strong}>sin planillas.</span>
          </h1>

          <p className={styles.p}>
            Accede al panel para gestionar empresas, charlas y asistentes. Cierra con firma del relator y genera un PDF
            final listo para auditoría.
          </p>

          <div className={styles.bullets}>
            <div className={styles.bullet}>✅ RUT + DV validado</div>
            <div className={styles.bullet}>✅ Antiduplicados</div>
            <div className={styles.bullet}>✅ Firma asistentes + relator</div>
            <div className={styles.bullet}>✅ PDF consolidado con logo</div>
          </div>

          <div className={styles.miniCta}>
            <Link href="/signup" className="btn btnCta">
              Probar demo
            </Link>
            <a className="btn btnGhost" href="/">
              Ver landing
            </a>
          </div>

          <div className={styles.foot}>Creado por Claudio Lizama © 2026</div>
        </aside>

        {/* RIGHT - form */}
        <section className={styles.right}>
          <div className={styles.card}>
            <div className={styles.cardHead}>
              <div className={styles.cardTitle}>Iniciar sesión</div>
              <div className={styles.cardSub}>Ingresa con tu correo y contraseña</div>
            </div>

            {err && <div className={styles.errBox}>{err}</div>}

            <div className={styles.form}>
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
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleLogin();
                  }}
                />
              </div>

              <div className={styles.field}>
                <label className={styles.label}>Contraseña</label>

                <div className={styles.passRow}>
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
                    className="btn btnGhost"
                    onClick={() => setShowPass((v) => !v)}
                    title={showPass ? "Ocultar contraseña" : "Mostrar contraseña"}
                    style={{ padding: "11px 12px" }}
                  >
                    {showPass ? "🙈" : "👁️"}
                  </button>
                </div>
              </div>

              <button
                type="button"
                onClick={handleLogin}
                disabled={loading}
                className="btn btnPrimary"
                style={{ width: "100%" }}
              >
                {loading ? "Entrando..." : "Entrar"}
              </button>

              <div className={styles.alt}>
                ¿No tienes cuenta?{" "}
                <Link className={styles.link} href="/signup">
                  Crear cuenta
                </Link>
              </div>
            </div>
          </div>

          <div className={styles.mobileFoot}>LZ Capacita QR © 2026</div>
        </section>
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