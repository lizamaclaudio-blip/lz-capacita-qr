"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import styles from "./page.module.css";
import { SignaturePad, type SignaturePadRef } from "@/components/SignaturePad";
import { cleanRut, isValidRut } from "@/lib/rut";

function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia(query).matches;
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    const m = window.matchMedia(query);

    const onChange = () => setMatches(!!m.matches);
    onChange();

    // Safari < 14
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const anyM: any = m as any;
    if (typeof anyM.addEventListener === "function") {
      anyM.addEventListener("change", onChange);
      return () => anyM.removeEventListener("change", onChange);
    }

    m.addListener(onChange);
    return () => m.removeListener(onChange);
  }, [query]);

  return matches;
}

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

  // RUT relator (passcode)
  const [rutPass, setRutPass] = useState("");
  const [closing, setClosing] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);

  // ✅ Desktop = panel fijo a la derecha | Mobile = bottom sheet
  const isDesktop = useMediaQuery("(min-width: 1024px)");
  const [sheetOpen, setSheetOpen] = useState(false);

  useEffect(() => {
    if (isDesktop) setSheetOpen(false);
  }, [isDesktop]);

  useEffect(() => {
    if (!sheetOpen) return;

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSheetOpen(false);
    };

    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [sheetOpen]);

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
      setTimeout(() => setError(null), 1800);
    }
  }

  async function loadSessionMeta() {
    setLoading(true);
    setError(null);
    setOk(null);
    setPdfUrl(null);

    const res = await fetch(`/api/public/session?code=${encodeURIComponent(code)}`, { cache: "no-store" });
    const json = await res.json().catch(() => null);

    if (!res.ok) {
      setSession(null);
      setAttendees([]);
      setLoading(false);
      setError(json?.error || "No se pudo cargar la charla");
      return;
    }

    setSession(json?.session ?? null);
    setLoading(false);
  }

  async function loadAttendees() {
    // Solo si hay passcode válido
    const rutClean = cleanRut(rutPass.trim());
    if (!rutClean || !isValidRut(rutClean)) {
      setAttendees([]);
      return;
    }

    const aRes = await fetch(
      `/api/admin/attendees?code=${encodeURIComponent(code)}&passcode=${encodeURIComponent(rutClean)}`,
      { cache: "no-store" }
    );

    const aJson = await aRes.json().catch(() => null);

    if (!aRes.ok) {
      // No “rompemos” la página, solo mostramos el error arriba
      setAttendees([]);
      setError(aJson?.error || "No se pudieron cargar asistentes");
      return;
    }

    setAttendees(Array.isArray(aJson?.attendees) ? aJson.attendees : []);
  }

  async function refreshAll() {
    await loadSessionMeta();
    await loadAttendees();
  }

  useEffect(() => {
    if (!code) return;
    loadSessionMeta();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  // Debounce: al escribir passcode, intenta traer asistentes
  useEffect(() => {
    if (!code) return;
    const t = window.setTimeout(() => {
      loadAttendees();
    }, 350);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rutPass, code]);

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
      // ✅ Endpoint correcto
      const res = await fetch("/api/admin/close-session", {
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
      await refreshAll();
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
      await refreshAll();
    } catch (e: any) {
      setError(e?.message || "Error al generar PDF");
    } finally {
      setPdfLoading(false);
    }
  }

  const RightPanel = (
    <>
      <div className={styles.blockTitle}>Empresa y charla</div>
      <div className={styles.blockSub}>Para validar antes de cerrar</div>

      <div className={styles.companyBox}>
        <div className={styles.companyRow}>
          <div className={styles.companyLogo}>
            {companyLogo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={companyLogo} alt="Logo empresa" />
            ) : (
              <div className={styles.companyFallback}>🏢</div>
            )}
          </div>

          <div className={styles.companyText}>
            <div className={styles.companyName}>{session?.company?.name ?? "Empresa"}</div>
            <div className={styles.companyMeta}>
              {session?.company?.rut ? `RUT: ${session.company.rut}` : "RUT: —"}{" "}
              {session?.company?.address ? `· ${session.company.address}` : ""}
            </div>
          </div>
        </div>

        <div className={styles.infoGrid}>
          <div className={styles.infoCard}>
            <div className={styles.infoLabel}>Fecha charla</div>
            <div className={styles.infoValue}>{fmtCL(session?.session_date)}</div>
          </div>
          <div className={styles.infoCard}>
            <div className={styles.infoLabel}>Relator</div>
            <div className={styles.infoValue}>{session?.trainer_name ?? "—"}</div>
          </div>
          <div className={styles.infoCard}>
            <div className={styles.infoLabel}>Lugar</div>
            <div className={styles.infoValue}>{session?.location ?? "—"}</div>
          </div>
          <div className={styles.infoCard}>
            <div className={styles.infoLabel}>Cerrada</div>
            <div className={styles.infoValue}>{session?.closed_at ? fmtCL(session.closed_at) : "—"}</div>
          </div>
        </div>
      </div>

      <div className={styles.section}>
        <div className={styles.blockTitle}>RUT relator (passcode)</div>
        <div className={styles.blockSub}>Se usa para ver asistentes, cerrar y generar el PDF.</div>

        <input
          className="input"
          placeholder="Ej: 12.345.678-9"
          value={rutPass}
          onChange={(e) => setRutPass(e.target.value)}
        />
      </div>

      <div className={styles.section}>
        <div className={styles.blockTitle}>Firma del relator</div>
        <div className={styles.blockSub}>Obligatoria para cerrar la charla.</div>

        <div className={styles.sigWrap}>
          <SignaturePad ref={sigRef} height={210} />
        </div>

        <div className={styles.actionsRow}>
          <button className="btn" type="button" onClick={() => sigRef.current?.clear()}>
            Limpiar firma
          </button>

          <button className="btn btnPrimary" type="button" onClick={closeSession} disabled={closing || isClosed}>
            {isClosed ? "Cerrada" : closing ? "Cerrando..." : "Cerrar charla"}
          </button>

          <button className="btn btnCta" type="button" onClick={generatePdf} disabled={pdfLoading}>
            {pdfLoading ? "Generando..." : "Generar PDF"}
          </button>
        </div>

        {pdfUrl ? (
          <div className={styles.pdfRow}>
            <a className="btn btnPrimary" href={pdfUrl} target="_blank" rel="noreferrer">
              Abrir PDF final ↗
            </a>
          </div>
        ) : null}
      </div>
    </>
  );

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
              <button className="btn btnPrimary" type="button" onClick={refreshAll} disabled={loading}>
                {loading ? "Actualizando..." : "Actualizar"}
              </button>
            </div>
          </div>

          <div className={styles.badges}>
            <span className={`${styles.pill} ${isClosed ? styles.pillWarn : styles.pillOk}`}>
              {isClosed ? "🔒 Cerrada" : "🟢 Abierta"}
            </span>
            <span className={styles.pill}>👥 Asistentes: {attendees.length}</span>
            {session?.topic ? <span className={styles.pill}>🎯 {session.topic}</span> : null}
          </div>

          {error && <div className={styles.toastErr}>{error}</div>}
          {ok && <div className={styles.toastOk}>{ok}</div>}

          <div className={styles.layout}>
            {/* Asistentes (principal) */}
            <div className={styles.main}>
              <div className={`glass card ${styles.col}`}>
                <div className={styles.blockTitle}>Asistentes</div>
                <div className={styles.blockSub}>Lista registrada por QR</div>

                <div className={styles.tableWrap}>
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
                          <td colSpan={5} className={styles.emptyCell}>
                            {cleanRut(rutPass.trim())
                              ? "Aún no hay asistentes registrados."
                              : "Ingresa RUT relator para ver asistentes."}
                          </td>
                        </tr>
                      ) : (
                        attendees.map((a, i) => (
                          <tr key={`${a.rut}-${a.created_at}`}>
                            <td>{i + 1}</td>
                            <td>{a.full_name}</td>
                            <td>{a.rut}</td>
                            <td>{a.role ?? "—"}</td>
                            <td>{fmtCL(a.created_at)}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Desktop: panel derecho */}
            {isDesktop ? (
              <aside className={styles.aside}>
                <div className={`glass card ${styles.sidePanel}`}>{RightPanel}</div>
              </aside>
            ) : (
              <>
                {/* Mobile: dock */}
                <div className={`glass ${styles.dock}`}>
                  <div className={styles.dockLeft}>
                    <span className={`${styles.dockPill} ${isClosed ? styles.dockPillWarn : styles.dockPillOk}`}>
                      {isClosed ? "🔒 Cerrada" : "🟢 Abierta"}
                    </span>
                    <span className={styles.dockMeta}>👥 {attendees.length}</span>
                  </div>

                  <button type="button" className="btn btnPrimary" onClick={() => setSheetOpen(true)}>
                    Panel
                  </button>
                </div>

                {/* Mobile: bottom sheet */}
                <div
                  className={`${styles.backdrop} ${sheetOpen ? styles.backdropOpen : ""}`}
                  onClick={() => setSheetOpen(false)}
                />

                <div
                  className={`glass ${styles.sheet} ${sheetOpen ? styles.sheetOpen : ""}`}
                  role="dialog"
                  aria-modal="true"
                  aria-label="Panel de cierre"
                >
                  <div className={styles.sheetHeader}>
                    <div className={styles.sheetHandle} />
                    <div className={styles.sheetTitle}>Empresa · Cierre</div>
                    <button type="button" className={styles.sheetClose} onClick={() => setSheetOpen(false)}>
                      ✕
                    </button>
                  </div>

                  <div className={styles.sheetBody}>{RightPanel}</div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}