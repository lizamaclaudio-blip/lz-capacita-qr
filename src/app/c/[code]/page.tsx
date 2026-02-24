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
  company_type?: string | null;
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

function fmtCL(iso?: string | null) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("es-CL");
  } catch {
    return "—";
  }
}

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
  const [successMode, setSuccessMode] = useState(false);

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

  async function submit() {
    setError(null);
    setOkMsg(null);

    if (isClosed) return setError("Esta charla está cerrada.");

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
      if (!res.ok) throw new Error(json?.error || "No se pudo registrar");

      // ✅ UX “ventana de gracia”
      setSuccessMode(true);
      setOkMsg("✅ Registro realizado. ¡Gracias por asistir! Que tengas un buen día 🙌");

      setFullName("");
      setRut("");
      setRole("");
      sigRef.current?.clear();

      // refresca para mostrar conteo/estado actualizado si lo agregas después
      loadSession();

      // se “cierra” visualmente unos segundos
      window.setTimeout(() => setSuccessMode(false), 4500);
    } catch (e: any) {
      setError(e?.message || "Error");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        {/* Columna principal */}
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

          {/* Success view */}
          {successMode ? (
            <div style={{ marginTop: 14 }}>
              <div className="glass card">
                <div style={{ fontWeight: 950, fontSize: 18 }}>¡Gracias! ✅</div>
                <div style={{ marginTop: 6, opacity: 0.75, fontWeight: 800 }}>
                  Tu asistencia quedó registrada. Si necesitas corregir datos, habla con el relator.
                </div>
                <div style={{ marginTop: 10, display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <button className="btn btnPrimary" type="button" onClick={() => setSuccessMode(false)}>
                    Registrar otra persona
                  </button>
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
                    <button
                      type="button"
                      className="btn"
                      onClick={() => sigRef.current?.clear()}
                      disabled={sending || isClosed}
                    >
                      Limpiar firma
                    </button>

                    <button
                      type="button"
                      className="btn btnCta"
                      onClick={submit}
                      disabled={sending || isClosed}
                    >
                      {sending ? "Enviando…" : "Registrar asistencia"}
                    </button>
                  </div>

                  <div className={styles.hint}>Si tienes problemas, recarga la página o vuelve a escanear el QR.</div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Columna lateral (info empresa/charla) */}
        <div className={`glass ${styles.card}`}>
          <div className={styles.sideTitle}>Detalles de la charla</div>
          <div className={styles.sideSub}>{loading ? "Cargando…" : "Revisa antes de firmar"}</div>

          <div className={styles.companyBox}>
            <div className={styles.companyRow}>
              <div className={styles.companyLogo}>
                {companyLogo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={companyLogo} alt="Logo empresa" />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src="/brand/lz-capacita-qr.png" alt="LZ" style={{ width: "100%", height: "100%", objectFit: "contain", padding: 12, opacity: 0.85 }} />
                )}
              </div>

              <div style={{ minWidth: 0 }}>
                <div className={styles.companyName}>{session?.company?.name ?? "Empresa"}</div>
                <div className={styles.companyMeta}>
                  {session?.company?.legal_name ? `Razón social: ${session.company.legal_name}` : ""}
                </div>
                <div className={styles.companyMeta}>
                  {session?.company?.rut ? `RUT: ${session.company.rut}` : ""}{" "}
                  {session?.company?.address ? `· ${session.company.address}` : ""}
                </div>
                {session?.company?.company_type ? (
                  <div className={styles.companyMeta}>
                    {session.company.company_type === "branch" ? "📍 Sucursal" : "🏢 Casa matriz"}
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          <div style={{ marginTop: 12, display: "grid", gap: 8 }}>
            <div className={styles.pill}>🎯 Tema: {session?.topic ?? "—"}</div>
            <div className={styles.pill}>👤 Relator: {session?.trainer_name ?? "—"}</div>
            <div className={styles.pill}>📍 Lugar: {session?.location ?? "—"}</div>
            <div className={styles.pill}>🗓️ Fecha: {fmtCL(session?.session_date)}</div>
          </div>
        </div>
      </div>
    </div>
  );
}