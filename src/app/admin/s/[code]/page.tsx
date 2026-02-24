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

type Attendee = {
  full_name: string;
  rut: string;
  role: string | null;
  created_at: string;
};

type AdminSession = {
  id: string;
  code: string;
  topic: string | null;
  location: string | null;
  session_date: string | null;
  trainer_name: string | null;
  status: string | null;
  closed_at: string | null;
  pdf_path?: string | null;
  pdf_generated_at?: string | null;
  company: CompanyInfo | null;
  attendees?: Attendee[];
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

export default function AdminSessionPage() {
  const params = useParams<{ code: string }>();
  const raw = (params?.code ?? "") as unknown as string | string[];
  const code = (Array.isArray(raw) ? raw[0] : raw).toUpperCase().trim();

  const sigRef = useRef<SignaturePadRef | null>(null);

  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<AdminSession | null>(null);
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  // cierre / pdf
  const [rutPass, setRutPass] = useState(""); // passcode (rut relator)
  const [closing, setClosing] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);

  const isClosed = useMemo(() => {
    const st = (session?.status ?? "").toLowerCase();
    return st === "closed" || !!session?.closed_at;
  }, [session]);

  const companyLogo = useMemo(() => logoPublicUrl(session?.company?.logo_path ?? null), [session]);

  const publicLink = useMemo(() => {
    if (typeof window === "undefined") return "";
    return `${window.location.origin}/c/${code}`;
  }, [code]);

  const adminLink = useMemo(() => {
    if (typeof window === "undefined") return "";
    return `${window.location.origin}/admin/s/${code}`;
  }, [code]);

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setOk("✅ Copiado al portapapeles.");
      setTimeout(() => setOk(null), 1400);
    } catch {
      setError("No se pudo copiar (permiso del navegador).");
    }
  }

  async function loadSession() {
    setLoading(true);
    setError(null);
    setOk(null);
    setPdfUrl(null);

    // Intento admin session (si existe)
    let res = await fetch(`/api/admin/session?code=${encodeURIComponent(code)}`, { cache: "no-store" });
    let json = await res.json().catch(() => null);

    // Fallback: public session
    if (!res.ok) {
      res = await fetch(`/api/public/session?code=${encodeURIComponent(code)}`, { cache: "no-store" });
      json = await res.json().catch(() => null);
    }

    if (!res.ok) {
      setSession(null);
      setAttendees([]);
      setLoading(false);
      setError(json?.error || "No se pudo cargar la charla");
      return;
    }

    const s = json?.session ?? null;

    // Si el endpoint admin no entrega attendees, intentamos otro endpoint si lo tienes:
    // /api/admin/attendees?code=
    let aList: Attendee[] = s?.attendees ?? [];
    if (!Array.isArray(aList) || aList.length === 0) {
      const aRes = await fetch(`/api/admin/attendees?code=${encodeURIComponent(code)}`, { cache: "no-store" });
      const aJson = await aRes.json().catch(() => null);
      if (aRes.ok && Array.isArray(aJson?.attendees)) aList = aJson.attendees;
    }

    setSession(s);
    setAttendees(Array.isArray(aList) ? aList : []);
    setLoading(false);
  }

  useEffect(() => {
    if (!code) return;
    loadSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  async function closeSession() {
    setError(null);
    setOk(null);

    if (isClosed) {
      setError("Esta charla ya está cerrada.");
      return;
    }

    const rutClean = cleanRut(rutPass.trim());
    if (!rutClean || !isValidRut(rutClean)) {
      setError("RUT/passcode inválido.");
      return;
    }

    if (!sigRef.current || sigRef.current.isEmpty()) {
      setError("Falta la firma del relator.");
      return;
    }

    const signature_data_url = sigRef.current.toPngDataUrl();
    if (!signature_data_url) {
      setError("No se pudo capturar la firma.");
      return;
    }

    setClosing(true);

    try {
      // Endpoint de cierre (ajustable)
      const res = await fetch("/api/admin/close", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code,
          passcode: rutClean,
          trainer_signature_data_url: signature_data_url,
        }),
      });

      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error || "No se pudo cerrar la charla");

      setOk("✅ Charla cerrada.");
      sigRef.current?.clear();
      await loadSession();
    } catch (e: any) {
      setError(e?.message || "Error al cerrar");
    } finally {
      setClosing(false);
    }
  }

  async function generatePdf() {
    setError(null);
    setOk(null);
    setPdfUrl(null);

    const rutClean = cleanRut(rutPass.trim());
    if (!rutClean || !isValidRut(rutClean)) {
      setError("RUT/passcode inválido.");
      return;
    }

    setPdfLoading(true);

    try {
      const res = await fetch("/api/admin/generate-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, passcode: rutClean }),
      });

      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error || "No se pudo generar PDF");

      setPdfUrl(json?.signed_url ?? null);
      setOk("✅ PDF generado.");
      await loadSession();
    } catch (e: any) {
      setError(e?.message || "Error al generar PDF");
    } finally {
      setPdfLoading(false);
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.wrap}>
        <div className={`glass card`}>
          <div className={styles.header}>
            <div className={styles.brand}>
              <div className={styles.logoBox}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/brand/lz-capacita-qr.png" alt="LZ" />
              </div>
              <div className={styles.brandText}>
                <div className={styles.title}>Admin de charla</div>
                <div className={styles.sub}>Código {code} · Cierre con firma + PDF final</div>
              </div>
            </div>

            <div className={styles.actions}>
              <button className="btn" type="button" onClick={() => copy(publicLink)}>
                📎 Copiar link QR
              </button>
              <button className="btn" type="button" onClick={() => copy(adminLink)}>
                📎 Copiar link Admin
              </button>
              <button className="btn btnPrimary" type="button" onClick={loadSession} disabled={loading}>
                {loading ? "Actualizando..." : "Actualizar"}
              </button>
            </div>
          </div>

          <div className={styles.badges} style={{ marginTop: 10 }}>
            <span className={`${styles.pill} ${isClosed ? styles.pillWarn : styles.pillOk}`}>
              {isClosed ? "🔒 Cerrada" : "🟢 Abierta"}
            </span>
            <span className={styles.pill}>👥 Asistentes: {attendees.length}</span>
            {session?.topic ? <span className={styles.pill}>🎯 {session.topic}</span> : null}
          </div>

          {error && <div className={styles.msgErr}>{error}</div>}
          {ok && <div className={styles.msgOk}>{ok}</div>}
        </div>

        <div className={styles.grid2}>
          <div className={`glass card`}>
            <div style={{ fontWeight: 950, fontSize: 16 }}>Asistentes</div>
            <div style={{ fontSize: 12, opacity: 0.72, fontWeight: 800, marginTop: 2 }}>
              Lista registrada por QR
            </div>

            <div style={{ marginTop: 12 }} className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Nombre</th>
                    <th>RUT</th>
                    <th>Cargo</th>
                    <th>Hora</th>
                  </tr>
                </thead>
                <tbody>
                  {attendees.length === 0 ? (
                    <tr>
                      <td className={styles.emptyCell} colSpan={5}>
                        Aún no hay asistentes registrados.
                      </td>
                    </tr>
                  ) : (
                    attendees.map((a, idx) => (
                      <tr key={`${a.rut}-${idx}`}>
                        <td>{idx + 1}</td>
                        <td>{a.full_name}</td>
                        <td>{a.rut}</td>
                        <td>{a.role ?? "-"}</td>
                        <td>{fmtCL(a.created_at)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className={`glass card`}>
            <div style={{ fontWeight: 950, fontSize: 16 }}>Empresa y charla</div>
            <div style={{ fontSize: 12, opacity: 0.72, fontWeight: 800, marginTop: 2 }}>
              Para validar antes de cerrar
            </div>

            <div className={styles.infoBox} style={{ marginTop: 12 }}>
              <div className={styles.companyRow}>
                <div className={styles.companyLogo}>
                  {companyLogo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={companyLogo} alt="Logo empresa" />
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src="/brand/lz-capacita-qr.png"
                      alt="LZ"
                      style={{ width: "100%", height: "100%", objectFit: "contain", padding: 12, opacity: 0.85 }}
                    />
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
                </div>
              </div>

              <div className={styles.kpis}>
                <div className={styles.kpi}>
                  <div className={styles.kpiLabel}>Fecha charla</div>
                  <div className={styles.kpiValue} style={{ fontSize: 14, marginTop: 6 }}>
                    {fmtCL(session?.session_date)}
                  </div>
                </div>

                <div className={styles.kpi}>
                  <div className={styles.kpiLabel}>Relator</div>
                  <div className={styles.kpiValue} style={{ fontSize: 14, marginTop: 6 }}>
                    {session?.trainer_name ?? "—"}
                  </div>
                </div>

                <div className={styles.kpi}>
                  <div className={styles.kpiLabel}>Lugar</div>
                  <div className={styles.kpiValue} style={{ fontSize: 14, marginTop: 6 }}>
                    {session?.location ?? "—"}
                  </div>
                </div>

                <div className={styles.kpi}>
                  <div className={styles.kpiLabel}>Cerrada</div>
                  <div className={styles.kpiValue} style={{ fontSize: 14, marginTop: 6 }}>
                    {fmtCL(session?.closed_at)}
                  </div>
                </div>
              </div>
            </div>

            <div style={{ marginTop: 12 }}>
              <div style={{ fontWeight: 950 }}>RUT relator (passcode)</div>
              <div style={{ fontSize: 12, opacity: 0.72, fontWeight: 800, marginTop: 2 }}>
                Se usa para cerrar y generar el PDF.
              </div>
              <input
                className="input"
                value={rutPass}
                onChange={(e) => setRutPass(e.target.value)}
                placeholder="Ej: 12.345.678-9"
                style={{ marginTop: 8 }}
              />
            </div>

            <div style={{ marginTop: 12 }}>
              <div style={{ fontWeight: 950 }}>Firma del relator</div>
              <div className={styles.sigWrap} style={{ marginTop: 8 }}>
                <SignaturePad ref={sigRef} height={220} />
              </div>

              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "flex-end", marginTop: 10 }}>
                <button className="btn" type="button" onClick={() => sigRef.current?.clear()} disabled={closing}>
                  Limpiar
                </button>

                <button className="btn btnPrimary" type="button" onClick={closeSession} disabled={closing || isClosed}>
                  {closing ? "Cerrando..." : isClosed ? "Cerrada" : "Cerrar charla"}
                </button>

                <button className="btn btnCta" type="button" onClick={generatePdf} disabled={pdfLoading || !isClosed}>
                  {pdfLoading ? "Generando..." : "Generar PDF"}
                </button>
              </div>

              {pdfUrl && (
                <div style={{ marginTop: 10 }}>
                  <a className="btn btnCta" href={pdfUrl} target="_blank" rel="noreferrer">
                    📄 Abrir PDF
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className={`glass card`} style={{ fontSize: 12, opacity: 0.72, fontWeight: 800 }}>
          Tip: el PDF incluye el logo de la empresa si fue cargado en “Mis empresas”. 👌
        </div>
      </div>
    </div>
  );
}