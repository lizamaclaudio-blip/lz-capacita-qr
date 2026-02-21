"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import SignatureCanvas from "react-signature-canvas";
import styles from "./page.module.css";

type SessionInfo = {
  id: string;
  code: string;
  topic: string | null;
  location: string | null;
  session_date: string | null;
  trainer_name: string | null;
  status: string | null;
  closed_at: string | null;
  company: { name: string; address: string | null } | null;
};

function fmtCL(iso?: string | null) {
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

  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [error, setError] = useState<string | null>(null);

  // form
  const [fullName, setFullName] = useState("");
  const [rut, setRut] = useState("");
  const [role, setRole] = useState("");

  const [sending, setSending] = useState(false);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  const sigRef = useRef<SignatureCanvas | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const isClosed = useMemo(() => {
    const st = (session?.status ?? "").toLowerCase();
    return st === "closed" || !!session?.closed_at;
  }, [session]);

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

  async function submit() {
    setError(null);
    setOkMsg(null);

    if (!fullName.trim()) return setError("Ingresa tu nombre.");
    if (!rut.trim()) return setError("Ingresa tu RUT.");
    if (!sigRef.current || sigRef.current.isEmpty()) return setError("Falta tu firma 👇");
    if (isClosed) return setError("Esta charla está cerrada.");

    const signature_data_url = sigRef.current.getTrimmedCanvas().toDataURL("image/png");

    setSending(true);
    try {
      const res = await fetch("/api/public/checkin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code,
          full_name: fullName.trim(),
          rut: rut.trim(),
          role: role.trim() ? role.trim() : null,
          signature_data_url,
        }),
      });

      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error || "No se pudo registrar");

      setOkMsg("✅ Registro realizado. ¡Gracias!");
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
      <div className={styles.card}>
        <div className={styles.brandRow}>
          <img className={styles.logo} src="/brand/lz-capacita-qr.png" alt="LZ Capacita QR" />
          <div>
            <div className={styles.brandTitle}>LZ Capacita QR</div>
            <div className={styles.brandSub}>Registro de asistencia</div>
          </div>
        </div>

        <div className={styles.header}>
          <div className={styles.h1}>Asistencia · {code}</div>
          <div className={styles.sub}>
            {loading ? "Cargando charla…" : session?.company?.name ? session.company.name : "—"}
          </div>
        </div>

        {error && <div className={styles.error}>{error}</div>}
        {okMsg && <div className={styles.ok}>{okMsg}</div>}

        {session && (
          <div className={styles.info}>
            <div>
              <b>Charla:</b> {session.topic || "—"}
            </div>
            <div>
              <b>Relator:</b> {session.trainer_name || "—"}
            </div>
            <div>
              <b>Fecha:</b> {fmtCL(session.session_date)}
            </div>
            <div>
              <b>Lugar:</b> {session.location || "—"}
            </div>
            <div>
              <b>Estado:</b>{" "}
              <span className={`${styles.badge} ${isClosed ? styles.badgeClosed : styles.badgeOpen}`}>
                {isClosed ? "CERRADA" : "ABIERTA"}
              </span>
            </div>
          </div>
        )}

        <div className={styles.form}>
          <div className={styles.field}>
            <label className={styles.label}>Nombre completo *</label>
            <input
              className={styles.input}
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Ej: Juan Pérez"
              disabled={sending || isClosed}
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label}>RUT *</label>
            <input
              className={styles.input}
              value={rut}
              onChange={(e) => setRut(e.target.value)}
              placeholder="Ej: 12.345.678-9"
              disabled={sending || isClosed}
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label}>Cargo</label>
            <input
              className={styles.input}
              value={role}
              onChange={(e) => setRole(e.target.value)}
              placeholder="Ej: Operador, Supervisor..."
              disabled={sending || isClosed}
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label}>Firma *</label>
            <div className={styles.sigWrap}>
              {mounted ? (
                <SignatureCanvas
                  ref={sigRef}
                  canvasProps={{
                    width: 900,
                    height: 220,
                    className: styles.sigCanvas,
                  }}
                />
              ) : (
                <div className={styles.sigPlaceholder} />
              )}
            </div>

            <div className={styles.sigActions}>
              <button
                type="button"
                className={styles.secondaryBtn}
                onClick={() => sigRef.current?.clear()}
                disabled={sending || isClosed}
              >
                Limpiar firma
              </button>

              <button
                type="button"
                className={styles.primaryBtn}
                onClick={submit}
                disabled={sending || isClosed}
              >
                {sending ? "Enviando…" : "Registrar asistencia"}
              </button>
            </div>
          </div>
        </div>

        <div className={styles.footer}>Si tienes problemas, recarga la página o vuelve a escanear el QR.</div>
      </div>
    </div>
  );
}