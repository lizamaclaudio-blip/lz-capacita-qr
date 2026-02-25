"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import styles from "./page.module.css";
import { SignaturePad, type SignaturePadRef } from "@/components/SignaturePad";
import { cleanRut, isValidRut } from "@/lib/rut";

type CompanyInfo = {
  id?: string;
  name?: string | null;
  legal_name?: string | null;
  rut?: string | null;
  address?: string | null;
  logo_path?: string | null;
};

type SessionInfo = {
  id: string;
  code: string;
  topic: string | null;
  location: string | null;
  session_date: string | null;
  trainer_name: string | null;
  status: string | null;
  closed_at: string | null;
  company: CompanyInfo | null;
};

function logoPublicUrl(logo_path?: string | null) {
  if (!logo_path) return null;
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!base) return null;

  const clean = String(logo_path).replace(/^company-logos\//, "");
  return `${base}/storage/v1/object/public/company-logos/${clean}`;
}

export default function PublicCheckinPage() {
  const params = useParams<{ code: string }>();
  const raw = (params?.code ?? "") as unknown as string | string[];
  const code = (Array.isArray(raw) ? raw[0] : raw).toUpperCase().trim();

  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [fullName, setFullName] = useState("");
  const [rut, setRut] = useState("");
  const [role, setRole] = useState("");

  const [sending, setSending] = useState(false);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  // "form" -> formulario
  // "success" -> ventana 5 segundos
  // "done" -> pantalla final sin formulario
  const [mode, setMode] = useState<"form" | "success" | "done">("form");
  const [countdown, setCountdown] = useState(5);

  const sigRef = useRef<SignaturePadRef | null>(null);

  const isClosed = useMemo(() => {
    const st = (session?.status ?? "").toLowerCase();
    return st === "closed" || !!session?.closed_at;
  }, [session]);

  const companyLogo = useMemo(() => logoPublicUrl(session?.company?.logo_path ?? null), [session]);

  async function loadSession() {
    setLoading(true);
    setError(null);

    const res = await fetch(`/api/public/session?code=${encodeURIComponent(code)}`, {
      cache: "no-store",
    });

    const json = await res.json().catch(() => null);

    if (!res.ok) {
      setSession(null);
      setLoading(false);
      setError(json?.error || "No se pudo cargar la charla");
      return;
    }

    setSession(json?.session ?? null);
    setLoading(false);
  }

  useEffect(() => {
    if (!code) return;
    loadSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  // Countdown + transición a pantalla final
  useEffect(() => {
    if (mode !== "success") return;

    setCountdown(5);

    const i = window.setInterval(() => {
      setCountdown((c) => (c <= 1 ? 1 : c - 1));
    }, 1000);

    const t = window.setTimeout(() => {
      setMode("done");
      // Intento cerrar (solo funciona si la ventana fue abierta por script)
      try {
        window.close();
      } catch {}
    }, 5000);

    return () => {
      window.clearInterval(i);
      window.clearTimeout(t);
    };
  }, [mode]);

  async function submit() {
    setError(null);
    setOkMsg(null);

    if (isClosed) return setError("Esta charla está cerrada.");
    if (mode !== "form") return;

    const nm = fullName.trim();
    if (!nm) return setError("Ingresa tu nombre.");

    const rutClean = cleanRut(rut.trim());
    if (!rutClean) return setError("Ingresa tu RUT.");
    if (!isValidRut(rutClean)) return setError("RUT inválido (dígito verificador incorrecto).");

    if (!sigRef.current || sigRef.current.isEmpty()) {
      return setError("Falta tu firma 👇");
    }

    const signature_data_url = sigRef.current.toPngDataUrl();
    if (!signature_data_url) return setError("No se pudo capturar la firma. Intenta de nuevo.");

    setSending(true);

    try {
      const res = await fetch("/api/public/checkin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code,
          full_name: nm,
          rut: rutClean,
          role: role.trim() ? role.trim() : null,
          signature_data_url,
        }),
      });

      const json = await res.json().catch(() => null);

      // Si ya estaba registrado (409), lo dejamos igual “final”
      if (res.status === 409) {
        setMode("done");
        setOkMsg("✅ Este RUT ya estaba registrado en esta charla.");
        return;
      }

      if (!res.ok) throw new Error(json?.error || "No se pudo registrar");

      setOkMsg("✅ Registro realizado. ¡Gracias por asistir! 🙌");
      setMode("success");

      // Limpia formulario (aunque ya no se mostrará)
      setFullName("");
      setRut("");
      setRole("");
      sigRef.current?.clear();

      loadSession();
    } catch (e: any) {
      setError(e?.message || "Error");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <div className={`glass ${styles.card}`}>
          <div className={styles.brandRow}>
            <div className={styles.brandLogo}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/brand/lz-capacita-qr.png" alt="LZ Capacita QR" />
            </div>
            <div className={styles.brandText}>
              <div className={styles.title}>Registro de asistencia</div>
              <div className={styles.sub}>LZ Capacita QR · Código {code}</div>
            </div>
          </div>

          <div className={styles.badges}>
            <span className={`${styles.pill} ${isClosed ? styles.pillWarn : styles.pillOk}`}>
              {isClosed ? "🔒 Charla cerrada" : "🟢 Charla abierta"}
            </span>
            {session?.topic ? <span className={styles.pill}>🎯 {session.topic}</span> : null}
          </div>

          {error && <div className={styles.toastErr}>{error}</div>}
          {okMsg && <div className={styles.toastOk}>{okMsg}</div>}

          {mode === "success" ? (
            <div style={{ marginTop: 14 }}>
              <div className="glass card">
                <div style={{ fontWeight: 950, fontSize: 18 }}>Registro exitoso ✅</div>
                <div style={{ marginTop: 6, opacity: 0.75, fontWeight: 800 }}>
                  Esta ventana se cerrará / finalizará en <b>{countdown}</b> segundo(s).
                </div>
                <div style={{ marginTop: 10, opacity: 0.7, fontWeight: 800 }}>
                  (Si no se cierra automático, puedes cerrarla manualmente.)
                </div>
              </div>
            </div>
          ) : mode === "done" ? (
            <div style={{ marginTop: 14 }}>
              <div className="glass card">
                <div style={{ fontWeight: 950, fontSize: 18 }}>¡Listo! ✅</div>
                <div style={{ marginTop: 6, opacity: 0.75, fontWeight: 800 }}>
                  Tu asistencia quedó registrada. Ya no es posible volver a inscribirse desde esta pantalla.
                </div>
                <div style={{ marginTop: 10, display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <button className="btn" type="button" onClick={() => loadSession()}>
                    Actualizar
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <>
              <div className={styles.formGrid}>
                <div className={styles.field}>
                  <label className={styles.label}>Nombre completo *</label>
                  <input
                    className="input"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Ej: Juan Pérez"
                    disabled={sending || isClosed}
                  />
                </div>

                <div className={styles.field}>
                  <label className={styles.label}>RUT *</label>
                  <input
                    className="input"
                    value={rut}
                    onChange={(e) => setRut(e.target.value)}
                    placeholder="Ej: 12.345.678-9"
                    disabled={sending || isClosed}
                  />
                  <div className={styles.hint}>Se valida dígito verificador.</div>
                </div>

                <div className={styles.field} style={{ gridColumn: "1 / -1" }}>
                  <label className={styles.label}>Cargo</label>
                  <input
                    className="input"
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    placeholder="Ej: Operador, Supervisor..."
                    disabled={sending || isClosed}
                  />
                </div>

                <div className={styles.field} style={{ gridColumn: "1 / -1" }}>
                  <label className={styles.label}>Firma *</label>

                  <div
                    className="glass"
                    style={{
                      borderRadius: 18,
                      overflow: "hidden",
                      border: "1px solid rgba(15,23,42,.10)",
                      background: "rgba(255,255,255,.55)",
                      padding: 10,
                    }}
                  >
                    <SignaturePad ref={sigRef} height={220} />
                  </div>

                  <div className={styles.actions}>
                    <button type="button" className="btn" onClick={() => sigRef.current?.clear()} disabled={sending}>
                      Limpiar firma
                    </button>

                    <button type="button" className="btn btnPrimary" onClick={submit} disabled={sending || isClosed}>
                      {isClosed ? "Charla cerrada" : sending ? "Registrando..." : "Registrar asistencia"}
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Columna empresa */}
        <div className={`glass ${styles.sideCard}`}>
          <div className={styles.sideTitle}>Empresa</div>

          <div className={styles.sideCompany}>
            <div className={styles.sideLogo}>
              {companyLogo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={companyLogo} alt="Logo empresa" />
              ) : (
                <div className={styles.sideLogoFallback}>🏢</div>
              )}
            </div>

            <div>
              <div className={styles.sideCompanyName}>{session?.company?.name ?? "—"}</div>
              <div className={styles.sideMeta}>
                {session?.company?.rut ? `RUT: ${session.company.rut}` : "RUT: —"}
              </div>
              <div className={styles.sideMeta}>
                {session?.company?.address ? session.company.address : "—"}
              </div>
            </div>
          </div>

          <div className={styles.sideTitle} style={{ marginTop: 12 }}>
            Charla
          </div>

          <div className={styles.sideMetaRow}>
            <div className={styles.sideMetaLabel}>Tema</div>
            <div className={styles.sideMetaValue}>{session?.topic ?? "—"}</div>
          </div>

          <div className={styles.sideMetaRow}>
            <div className={styles.sideMetaLabel}>Relator</div>
            <div className={styles.sideMetaValue}>{session?.trainer_name ?? "—"}</div>
          </div>

          <div className={styles.sideMetaRow}>
            <div className={styles.sideMetaLabel}>Lugar</div>
            <div className={styles.sideMetaValue}>{session?.location ?? "—"}</div>
          </div>

          {loading ? (
            <div style={{ marginTop: 10, opacity: 0.7, fontWeight: 800 }}>Cargando…</div>
          ) : null}
        </div>
      </div>
    </div>
  );
}