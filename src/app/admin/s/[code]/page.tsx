"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { QRCodeCanvas } from "qrcode.react";
import styles from "./page.module.css";
import { SignaturePad, type SignaturePadRef } from "@/components/SignaturePad";
import { cleanRut, isValidRut, formatRutChile, normalizeRutInput } from "@/lib/rut";

function useMediaQuery(query: string) {
  // OJO: SSR-safe => SIEMPRE false en el primer render (evita hydration mismatch)
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const m = window.matchMedia(query);
    const onChange = () => setMatches(!!m.matches);

    onChange();

    // Safari compatibility
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
    // Mantiene consistente SSR/CSR usando TZ fija Chile
    return new Intl.DateTimeFormat("es-CL", {
      dateStyle: "short",
      timeStyle: "short",
      timeZone: "America/Santiago",
    }).format(new Date(iso));
  } catch {
    try {
      return new Date(iso).toISOString();
    } catch {
      return "—";
    }
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
  const router = useRouter();
  const params = useParams<{ code: string }>();
  const raw = (params?.code ?? "") as unknown as string | string[];
  const code = (Array.isArray(raw) ? raw[0] : raw).toUpperCase().trim();

  const sigRef = useRef<SignaturePadRef | null>(null);
  const qrCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<AdminSession | null>(null);
  const [attendees, setAttendees] = useState<Attendee[]>([]);

  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  // passcode (RUT relator)
  const [rutPass, setRutPass] = useState("");
  const [closing, setClosing] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);

  // Desktop: side panel | Mobile: bottom sheet
  const isDesktop = useMediaQuery("(min-width: 1024px)");
  const [sheetOpen, setSheetOpen] = useState(false);

  const [origin, setOrigin] = useState<string>("");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (typeof window !== "undefined") setOrigin(window.location.origin);
  }, []);

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

  const passClean = useMemo(() => cleanRut(rutPass.trim()), [rutPass]);
  const passLooksComplete = useMemo(() => passClean.length >= 8, [passClean]);
  const passOk = useMemo(() => (passClean ? isValidRut(passClean) : false), [passClean]);

  const companyLogo = useMemo(() => logoPublicUrl(session?.company?.logo_path ?? null), [session]);

  const publicLink = useMemo(() => (origin ? `${origin}/c/${code}` : ""), [origin, code]);
  const adminLink = useMemo(() => (origin ? `${origin}/admin/s/${code}` : ""), [origin, code]);

  const qrValue = useMemo(() => {
    // SSR/CSR consistente: antes de mount usamos un valor estable
    if (!mounted) return `https://lz.local/c/${code}`;
    return publicLink || `https://lz.local/c/${code}`;
  }, [mounted, publicLink, code]);

  async function copy(text: string, msg = "✅ Copiado.") {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setOk(msg);
      window.setTimeout(() => setOk(null), 1400);
    } catch {
      setError("No se pudo copiar (permiso del navegador).");
      window.setTimeout(() => setError(null), 1800);
    }
  }

  function downloadQrPng() {
    // QRCodeCanvas normalmente es canvas; si el ref no engancha, buscamos el primer canvas dentro del qrBox
    const canvas = qrCanvasRef.current || (document.querySelector(`.${styles.qrBox} canvas`) as HTMLCanvasElement | null);
    if (!canvas) {
      setError("No se encontró el canvas del QR.");
      window.setTimeout(() => setError(null), 1600);
      return;
    }
    const dataUrl = canvas.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = `QR-${code || "charla"}.png`;
    a.click();
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
    if (!passOk) {
      setAttendees([]);
      return;
    }

    const aRes = await fetch(
      `/api/admin/attendees?code=${encodeURIComponent(code)}&passcode=${encodeURIComponent(passClean)}`,
      { cache: "no-store" }
    );

    const aJson = await aRes.json().catch(() => null);

    if (!aRes.ok) {
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

  useEffect(() => {
    if (!code) return;
    const t = window.setTimeout(() => {
      loadAttendees();
    }, 320);
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
    if (!passOk) {
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
      const res = await fetch("/api/admin/close-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code,
          passcode: passClean,
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

    if (!passOk) {
      setError("RUT/passcode inválido.");
      return;
    }

    if (!isClosed) {
      setError("Primero cierra la charla con firma del relator.");
      return;
    }

    setPdfLoading(true);
    try {
      const res = await fetch("/api/admin/generate-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, passcode: passClean }),
      });

      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error || "No se pudo generar PDF");

      const url = (json?.signed_url ?? null) as string | null;
      setPdfUrl(url);
      setOk("✅ PDF generado. Abriendo…");

      // 1) Abrir PDF
      if (url) {
        try {
          window.open(url, "_blank", "noopener,noreferrer");
        } catch {
          // ignore
        }
      }

      // 2) Volver a Mis charlas
      window.setTimeout(() => {
        router.replace("/app/sessions");
      }, 250);

      await refreshAll();
    } catch (e: any) {
      setError(e?.message || "Error al generar PDF");
    } finally {
      setPdfLoading(false);
    }
  }

  const RightPanel = (
    <div className={styles.sideStack}>
      {/* Paso 1: QR */}
      <div className={styles.stepCard}>
        <div className={styles.stepHead}>
          <div>
            <div className={styles.stepKicker}>Paso 1</div>
            <div className={styles.stepTitle}>Mostrar QR</div>
            <div className={styles.stepSub}>Los asistentes registran desde su celular.</div>
          </div>

          <span className={`${styles.badge} ${isClosed ? styles.badgeClosed : styles.badgeOpen}`}>
            {isClosed ? "Cerrada" : "Abierta"}
          </span>
        </div>

        <div className={styles.qrBox}>
          {!mounted ? (
            <div className={styles.qrSkeleton}>QR</div>
          ) : (
            <QRCodeCanvas value={qrValue} includeMargin size={220} ref={qrCanvasRef} />
          )}
        </div>

        <div className={styles.stepActions}>
          <button
            className="btn btnGhost"
            type="button"
            disabled={!publicLink}
            onClick={() => publicLink && window.open(publicLink, "_blank", "noopener,noreferrer")}
          >
            Abrir registro
          </button>
          <button
            className="btn btnGhost"
            type="button"
            disabled={!publicLink}
            onClick={() => copy(publicLink, "✅ Link público copiado.")}
          >
            Copiar link
          </button>
          <button className="btn btnCta" type="button" onClick={downloadQrPng} disabled={!mounted}>
            Descargar PNG
          </button>
        </div>
      </div>

      {/* Paso 2: Passcode */}
      <div className={styles.stepCard}>
        <div className={styles.stepHead}>
          <div>
            <div className={styles.stepKicker}>Paso 2</div>
            <div className={styles.stepTitle}>Passcode relator</div>
            <div className={styles.stepSub}>RUT para ver asistentes, cerrar y generar PDF.</div>
          </div>

          <span
            className={`${styles.badge} ${
              passClean && passLooksComplete ? (passOk ? styles.badgeOk : styles.badgeBad) : styles.badgeMuted
            }`}
            title="Validación por DV"
          >
            {passClean && passLooksComplete ? (passOk ? "DV OK" : "DV inválido") : "Chile"}
          </span>
        </div>

        <input
          className="input"
          placeholder="12345678-5"
          value={rutPass}
          onChange={(e) => setRutPass(normalizeRutInput(e.target.value))}
          onBlur={() => setRutPass(formatRutChile(rutPass))}
        />

        <div className={styles.micro}>Tip: usa el RUT del relator (sin puntos). DV se valida automáticamente.</div>
      </div>

      {/* Paso 3: Cierre */}
      <div className={styles.stepCard}>
        <div className={styles.stepHead}>
          <div>
            <div className={styles.stepKicker}>Paso 3</div>
            <div className={styles.stepTitle}>Firma y cierre</div>
            <div className={styles.stepSub}>Bloquea el registro y deja evidencia.</div>
          </div>
          <span className={`${styles.badge} ${isClosed ? styles.badgeClosed : styles.badgeMuted}`}>
            {isClosed ? "Cerrada" : "Pendiente"}
          </span>
        </div>

        <div className={styles.sigWrap}>
          <SignaturePad ref={sigRef} height={210} />
        </div>

        <div className={styles.stepActions}>
          <button className="btn btnGhost" type="button" onClick={() => sigRef.current?.clear()}>
            Limpiar
          </button>

          <button className="btn btnPrimary" type="button" onClick={closeSession} disabled={closing || isClosed || !passOk}>
            {isClosed ? "Cerrada" : closing ? "Cerrando…" : "Cerrar charla"}
          </button>
        </div>

        {!passOk ? <div className={styles.micro}>Para cerrar: ingresa un passcode válido.</div> : null}
      </div>

      {/* Paso 4: PDF */}
      <div className={styles.stepCard}>
        <div className={styles.stepHead}>
          <div>
            <div className={styles.stepKicker}>Paso 4</div>
            <div className={styles.stepTitle}>PDF final</div>
            <div className={styles.stepSub}>Respaldo para auditoría (lista + firmas).</div>
          </div>

          <span className={`${styles.badge} ${session?.pdf_generated_at ? styles.badgeOk : styles.badgeMuted}`}>
            {session?.pdf_generated_at ? "Generado" : "—"}
          </span>
        </div>

        <div className={styles.pdfMeta}>
          <div className={styles.pdfRow}>
            <span className={styles.pdfLabel}>Generado</span>
            <span className={styles.pdfValue}>{session?.pdf_generated_at ? fmtCL(session.pdf_generated_at) : "—"}</span>
          </div>
          <div className={styles.pdfRow}>
            <span className={styles.pdfLabel}>Asistentes</span>
            <span className={styles.pdfValue}>{attendees.length}</span>
          </div>
        </div>

        <div className={styles.stepActions}>
          <button className="btn btnCta" type="button" onClick={generatePdf} disabled={pdfLoading || !passOk || !isClosed}>
            {pdfLoading ? "Generando…" : "Generar PDF"}
          </button>

          {pdfUrl ? (
            <a className="btn btnPrimary" href={pdfUrl} target="_blank" rel="noreferrer">
              Abrir PDF ↗
            </a>
          ) : null}

          {pdfUrl ? (
            <button className="btn btnGhost" type="button" onClick={() => copy(pdfUrl, "✅ Link PDF copiado.")}>
              Copiar link PDF
            </button>
          ) : null}
        </div>

        {!isClosed ? <div className={styles.micro}>Para generar PDF: primero cierra la charla.</div> : null}
      </div>
    </div>
  );

  if (loading) {
    // Mantener HTML estable (evita mismatches)
    return (
      <div className={styles.page}>
        <div className={styles.wrap}>
          <div className={styles.topCard}>
            <div className={styles.title}>Cargando…</div>
            <div className={styles.sub}>Preparando admin</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.wrap}>
        <div className={styles.topCard}>
          <div className={styles.topRow}>
            <div className={styles.brand}>
              <span className={styles.logoBox} aria-hidden="true">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/brand/lzq-mark.svg" alt="LZ" />
              </span>

              <div className={styles.brandText}>
                <div className={styles.title}>Admin de charla</div>
                <div className={styles.sub}>Código {code} · Cierre con firma + PDF final</div>
              </div>
            </div>

            <div className={styles.actions}>
              <button className="btn btnGhost" type="button" disabled={!publicLink} onClick={() => copy(publicLink, "✅ Link QR copiado.")}>
                Copiar link QR
              </button>
              <button className="btn btnGhost" type="button" disabled={!adminLink} onClick={() => copy(adminLink, "✅ Link admin copiado.")}>
                Copiar link admin
              </button>
              <button className="btn btnPrimary" type="button" onClick={refreshAll} disabled={loading}>
                {loading ? "Actualizando…" : "Actualizar"}
              </button>
            </div>
          </div>

          <div className={styles.metaBar}>
            <span className={`${styles.pill} ${isClosed ? styles.pillClosed : styles.pillOpen}`}>{isClosed ? "Cerrada" : "Abierta"}</span>
            <span className={styles.pill}>Asistentes: {attendees.length}</span>
            {session?.topic ? <span className={styles.pill}>{session.topic}</span> : null}
            {session?.company?.name ? <span className={styles.pill}>{session.company.name}</span> : null}
          </div>

          {error ? <div className={styles.alertErr}>{error}</div> : null}
          {ok ? <div className={styles.alertOk}>{ok}</div> : null}
        </div>

        <div className={styles.layout}>
          <main className={styles.main}>
            <div className={styles.card}>
              <div className={styles.cardHead}>
                <div>
                  <div className={styles.cardTitle}>Asistentes</div>
                  <div className={styles.cardSub}>
                    {passOk ? "Listado registrado por QR." : "Ingresa passcode (RUT relator) para ver asistentes."}
                  </div>
                </div>

                <div className={styles.cardRight}>
                  <span className={`${styles.badge} ${passOk ? styles.badgeOk : styles.badgeMuted}`}>
                    {passOk ? "Acceso OK" : "Passcode"}
                  </span>
                </div>
              </div>

              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Nombre</th>
                      <th>RUT</th>
                      <th className={styles.thHideSm}>Cargo</th>
                      <th className={styles.thHideSm}>Hora</th>
                    </tr>
                  </thead>
                  <tbody>
                    {!passOk ? (
                      <tr>
                        <td colSpan={5} className={styles.emptyCell}>
                          Ingresa el passcode (RUT relator) para acceder al listado.
                        </td>
                      </tr>
                    ) : attendees.length === 0 ? (
                      <tr>
                        <td colSpan={5} className={styles.emptyCell}>
                          Aún no hay asistentes registrados.
                        </td>
                      </tr>
                    ) : (
                      attendees.map((a, i) => (
                        <tr key={`${a.rut}-${a.created_at}`}>
                          <td>{i + 1}</td>
                          <td className={styles.tdMain}>{a.full_name}</td>
                          <td>{a.rut}</td>
                          <td className={styles.tdHideSm}>{a.role ?? "—"}</td>
                          <td className={styles.tdHideSm}>{fmtCL(a.created_at)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className={styles.card}>
              <div className={styles.cardHead}>
                <div>
                  <div className={styles.cardTitle}>Empresa y detalle</div>
                  <div className={styles.cardSub}>Verifica antes de cerrar.</div>
                </div>
              </div>

              <div className={styles.companyBox}>
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
                    <div className={styles.companyName}>{session?.company?.name ?? "Empresa"}</div>
                    <div className={styles.companyMeta}>
                      {session?.company?.rut ? `RUT: ${session.company.rut}` : "RUT: —"}
                      {session?.company?.address ? ` · ${session.company.address}` : ""}
                    </div>
                  </div>
                </div>

                <div className={styles.infoGrid}>
                  <div className={styles.infoItem}>
                    <div className={styles.infoLabel}>Tema</div>
                    <div className={styles.infoValue}>{session?.topic ?? "—"}</div>
                  </div>

                  <div className={styles.infoItem}>
                    <div className={styles.infoLabel}>Fecha / hora</div>
                    <div className={styles.infoValue}>{fmtCL(session?.session_date)}</div>
                  </div>

                  <div className={styles.infoItem}>
                    <div className={styles.infoLabel}>Relator</div>
                    <div className={styles.infoValue}>{session?.trainer_name ?? "—"}</div>
                  </div>

                  <div className={styles.infoItem}>
                    <div className={styles.infoLabel}>Lugar</div>
                    <div className={styles.infoValue}>{session?.location ?? "—"}</div>
                  </div>
                </div>
              </div>
            </div>
          </main>

          {/* SIEMPRE renderizamos ambos. CSS decide qué se ve (sin hydration mismatch). */}
          <aside className={styles.aside}>
            <div className={styles.sidePanel}>{RightPanel}</div>
          </aside>

          <div className={styles.dock}>
            <div className={styles.dockLeft}>
              <span className={`${styles.badge} ${isClosed ? styles.badgeClosed : styles.badgeOpen}`}>
                {isClosed ? "Cerrada" : "Abierta"}
              </span>
              <span className={styles.dockMeta}>👥 {attendees.length}</span>
            </div>

            <button type="button" className="btn btnPrimary" onClick={() => setSheetOpen(true)}>
              Cierre / PDF
            </button>
          </div>

          <div className={`${styles.backdrop} ${sheetOpen ? styles.backdropOpen : ""}`} onClick={() => setSheetOpen(false)} />

          <div className={`${styles.sheet} ${sheetOpen ? styles.sheetOpen : ""}`} role="dialog" aria-modal="true" aria-label="Panel de cierre">
            <div className={styles.sheetHeader}>
              <div className={styles.sheetHandle} />
              <div className={styles.sheetTitle}>Cierre del relator</div>
              <button type="button" className={styles.sheetClose} onClick={() => setSheetOpen(false)}>
                ✕
              </button>
            </div>

            <div className={styles.sheetBody}>{RightPanel}</div>
          </div>
        </div>
      </div>
    </div>
  );
}