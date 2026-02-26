"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import styles from "./page.module.css";
import { SignaturePad, type SignaturePadRef } from "@/components/SignaturePad";
import { cleanRut, isValidRut, formatRutChile, normalizeRutInput } from "@/lib/rut";

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

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("es-CL");
  } catch {
    return "—";
  }
}

export default function PublicCheckinPage() {
  const params = useParams<{ code: string }>();
  const raw = (params?.code ?? "") as unknown as string | string[];
  const code = (Array.isArray(raw) ? raw[0] : raw).toUpperCase().trim();

  const sigRef = useRef<SignaturePadRef | null>(null);

  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  const [session, setSession] = useState<SessionInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  // form
  const [fullName, setFullName] = useState("");
  const [rut, setRut] = useState("");
  const [role, setRole] = useState("");

  // "form" -> formulario
  // "success" -> thanks + countdown
  // "done" -> pantalla final (sin formulario)
  const [mode, setMode] = useState<"form" | "success" | "done">("form");
  const [countdown, setCountdown] = useState(5);

  const isClosed = useMemo(() => {
    const st = (session?.status || "").toLowerCase();
    return st === "closed" || !!session?.closed_at;
  }, [session]);

  const companyLogo = useMemo(() => logoPublicUrl(session?.company?.logo_path ?? null), [session?.company?.logo_path]);

  const rutClean = useMemo(() => cleanRut(rut), [rut]);
  const rutLooksComplete = useMemo(() => rutClean.length >= 8, [rutClean]);
  const rutOk = useMemo(() => (rutClean ? isValidRut(rutClean) : false), [rutClean]);

  async function loadSession() {
    setError(null);

    try {
      const res = await fetch(`/api/public/session?code=${encodeURIComponent(code)}`, { cache: "no-store" });
      const json = await res.json().catch(() => null);

      if (!res.ok) throw new Error(json?.error || "No se pudo cargar la charla");

      setSession(json?.session ?? null);
    } catch (e: any) {
      setError(e?.message || "Error al cargar la charla");
      setSession(null);
    }
  }

  useEffect(() => {
    let alive = true;

    (async () => {
      if (!code) {
        setError("Código inválido.");
        setLoading(false);
        return;
      }

      setLoading(true);
      await loadSession();

      if (!alive) return;
      setLoading(false);
    })();

    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  useEffect(() => {
    if (mode !== "success") return;

    // scroll top for a clean "thanks" view
    try {
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch {
      // ignore
    }

    setCountdown(5);
    const t = window.setInterval(() => {
      setCountdown((v) => {
        if (v <= 1) {
          window.clearInterval(t);
          setMode("done");
          return 0;
        }
        return v - 1;
      });
    }, 1000);

    return () => window.clearInterval(t);
  }, [mode]);

  async function submit() {
    setError(null);
    setOkMsg(null);

    if (!session) return setError("No se encontró la charla.");
    if (isClosed) return setError("Esta charla ya está cerrada. No es posible registrar asistencia.");

    const nm = fullName.trim();
    if (!nm) return setError("Ingresa tu nombre completo.");

    const r = cleanRut(rut);
    if (!r || !isValidRut(r)) return setError("RUT inválido (revisa dígito verificador).");

    const rl = role.trim();
    if (!rl) return setError("Indica tu cargo.");

    const signature_data_url = sigRef.current?.toPngDataUrl();
    if (!signature_data_url) return setError("No se pudo capturar la firma. Intenta de nuevo.");

    setSending(true);

    try {
      const res = await fetch("/api/public/checkin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code,
          full_name: nm,
          rut: r,
          role: rl,
          signature_data_url,
        }),
      });

      const json = await res.json().catch(() => null);

      // 409 => ya registrado
      if (res.status === 409) {
        setOkMsg("Este RUT ya estaba registrado en esta charla.");
        setMode("done");
        return;
      }

      if (!res.ok) throw new Error(json?.error || "No se pudo registrar");

      setOkMsg("Registro realizado. ¡Gracias por asistir!");
      setMode("success");

      // Limpia formulario
      setFullName("");
      setRut("");
      setRole("");
      sigRef.current?.clear();

      loadSession();
    } catch (e: any) {
      setError(e?.message || "No se pudo registrar");
    } finally {
      setSending(false);
    }
  }

  if (loading) {
    return (
      <main className={styles.shell}>
        <div className={styles.centerCard}>
          <div className={styles.centerTitle}>Cargando…</div>
          <div className={styles.centerSub}>Preparando registro</div>
        </div>
      </main>
    );
  }

  return (
    <main className={styles.shell}>
      <div className={styles.container}>
        {/* Header */}
        <header className={styles.header}>
          <div className={styles.brand}>
            <div className={styles.brandMark}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/brand/lzq-mark.svg" alt="LZ" />
            </div>

            <div className={styles.brandText}>
              <div className={styles.brandTitle}>Registro de asistencia</div>
              <div className={styles.brandSub}>Código {code} · LZ Capacita QR</div>
            </div>
          </div>

          <div className={styles.headerRight}>
            <span className={`${styles.pill} ${isClosed ? styles.pillClosed : styles.pillOpen}`}>
              {isClosed ? "Charla cerrada" : "Charla abierta"}
            </span>
          </div>
        </header>

        {error ? <div className={`${styles.alert} ${styles.alertErr}`}>{error}</div> : null}
        {okMsg ? <div className={`${styles.alert} ${styles.alertOk}`}>{okMsg}</div> : null}

        <div className={styles.grid}>
          {/* Left */}
          <section className={styles.card}>
            <div className={styles.cardHead}>
              <div>
                <div className={styles.cardTitle}>Tus datos</div>
                <div className={styles.cardSub}>RUT + DV y firma como respaldo.</div>
              </div>

              <span
                className={`${styles.pill} ${
                  rutClean && rutLooksComplete ? (rutOk ? styles.pillOk : styles.pillWarn) : styles.pillMuted
                }`}
              >
                {rutClean && rutLooksComplete ? (rutOk ? "DV OK" : "Revisar DV") : "RUT"}
              </span>
            </div>

            {mode === "success" ? (
              <div className={styles.thanks}>
                <div className={styles.bigIcon} aria-hidden="true">
                  ✓
                </div>
                <div className={styles.thanksTitle}>¡Listo!</div>
                <div className={styles.thanksSub}>Tu asistencia quedó registrada.</div>
                <div className={styles.thanksMicro}>Puedes cerrar esta pestaña. Finaliza automáticamente en {countdown}s.</div>

                <button className="btn btnGhost" type="button" onClick={() => setMode("done")}>
                  Continuar
                </button>
              </div>
            ) : mode === "done" ? (
              <div className={styles.thanks}>
                <div className={styles.bigIcon} aria-hidden="true">
                  ✓
                </div>
                <div className={styles.thanksTitle}>Registro confirmado</div>
                <div className={styles.thanksSub}>Gracias por asistir.</div>
                <div className={styles.thanksMicro}>Si necesitas corregir un dato, habla con el relator.</div>

                <div className={styles.thanksActions}>
                  <button className="btn btnGhost" type="button" onClick={() => loadSession()}>
                    Actualizar
                  </button>
                  <button className="btn btnPrimary" type="button" onClick={() => window.close()}>
                    Cerrar
                  </button>
                </div>
              </div>
            ) : (
              <div className={styles.form}>
                <div className={styles.row2}>
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
                    <div className={styles.labelRow}>
                      <label className={styles.label}>RUT *</label>
                      <span
                        className={`${styles.rutPill} ${
                          rutClean && rutLooksComplete ? (rutOk ? styles.rutOk : styles.rutBad) : styles.rutIdle
                        }`}
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
                      disabled={sending || isClosed}
                    />
                    <div className={styles.hint}>Formato Chile: XXXXXXXX-X (sin puntos).</div>
                  </div>
                </div>

                <div className={styles.field}>
                  <label className={styles.label}>Cargo *</label>
                  <input
                    className="input"
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    placeholder="Ej: Operador, Supervisor…"
                    disabled={sending || isClosed}
                  />
                </div>

                <div className={styles.field}>
                  <label className={styles.label}>Firma *</label>

                  <div className={styles.signatureBox}>
                    <SignaturePad ref={sigRef} height={220} />
                  </div>

                  <div className={styles.actions}>
                    <button
                      type="button"
                      className="btn btnGhost"
                      onClick={() => sigRef.current?.clear()}
                      disabled={sending}
                    >
                      Limpiar firma
                    </button>

                    <button type="button" className="btn btnPrimary" onClick={submit} disabled={sending || isClosed}>
                      {sending ? "Registrando…" : "Registrar asistencia"}
                    </button>
                  </div>

                  <div className={styles.micro}>
                    Al registrar, aceptas el uso de estos datos como respaldo de capacitación.
                  </div>
                </div>
              </div>
            )}
          </section>

          {/* Right */}
          <aside className={styles.side}>
            <div className={styles.sideCard}>
              <div className={styles.sideTitle}>Detalle de la charla</div>

              <div className={styles.companyRow}>
                <span className={styles.companyLogo}>
                  {companyLogo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={companyLogo} alt="Logo empresa" />
                  ) : (
                    <span className={styles.companyInitial}>{(session?.company?.name?.[0] || "E").toUpperCase()}</span>
                  )}
                </span>

                <div className={styles.companyText}>
                  <div className={styles.companyName}>{session?.company?.name || "Empresa"}</div>
                  <div className={styles.companyMeta}>{session?.topic ? session.topic : "—"}</div>
                </div>
              </div>

              <div className={styles.infoGrid}>
                <div className={styles.infoItem}>
                  <div className={styles.infoLabel}>Relator</div>
                  <div className={styles.infoValue}>{session?.trainer_name || "—"}</div>
                </div>
                <div className={styles.infoItem}>
                  <div className={styles.infoLabel}>Fecha / hora</div>
                  <div className={styles.infoValue}>{fmtDate(session?.session_date || null)}</div>
                </div>
                <div className={styles.infoItem}>
                  <div className={styles.infoLabel}>Lugar</div>
                  <div className={styles.infoValue}>{session?.location || "—"}</div>
                </div>
                <div className={styles.infoItem}>
                  <div className={styles.infoLabel}>Estado</div>
                  <div className={styles.infoValue}>{isClosed ? "Cerrada" : "Abierta"}</div>
                </div>
              </div>

              <button className="btn btnGhost" type="button" onClick={() => loadSession()}>
                Actualizar detalle
              </button>

              <div className={styles.sideHint}>Si la charla se cierra, el registro se bloquea automáticamente.</div>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}
