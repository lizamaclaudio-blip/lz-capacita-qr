"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import SignatureCanvas from "react-signature-canvas";
import Image from "next/image";
import { supabaseBrowser } from "@/lib/supabase/browser";
import styles from "./page.module.css";

type AdminPayload = {
  session: any;
  attendees: any[];
};

export default function AdminSession() {
  const router = useRouter();
  const params = useParams<{ code: string }>();
  const raw = (params?.code ?? "") as unknown as string | string[];
  const code = (Array.isArray(raw) ? raw[0] : raw).toUpperCase();

  // Auth modes
  const [token, setToken] = useState<string | null>(null);
  const [showPasscode, setShowPasscode] = useState(false);
  const [passcode, setPasscode] = useState("");

  // Data
  const [data, setData] = useState<AdminPayload | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Signature
  const sigRef = useRef<SignatureCanvas | null>(null);
  const [mounted, setMounted] = useState(false);

  // Closing
  const [closing, setClosing] = useState(false);
  const [closeMsg, setCloseMsg] = useState<string | null>(null);

  // PDF
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [pdfMsg, setPdfMsg] = useState<string | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);

  const baseUrl = useMemo(() => {
    if (typeof window === "undefined") return "";
    return window.location.origin;
  }, []);

  useEffect(() => setMounted(true), []);

  // Detecta sesión Supabase (para “modo sesión”)
  useEffect(() => {
    let alive = true;

    (async () => {
      const { data } = await supabaseBrowser.auth.getSession();
      if (!alive) return;
      setToken(data.session?.access_token ?? null);
    })();

    const { data: sub } = supabaseBrowser.auth.onAuthStateChange((_evt, session) => {
      if (!alive) return;
      setToken(session?.access_token ?? null);
    });

    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  // Si cambia el código, limpiamos PDF + mensajes
  useEffect(() => {
    setPdfUrl(null);
    setPdfMsg(null);
    setErr(null);
    setNotice(null);
    setCloseMsg(null);
    setData(null);
  }, [code]);

  async function copyText(text: string, okMsg = "Copiado ✅") {
    try {
      await navigator.clipboard.writeText(text);
      setNotice(okMsg);
      window.setTimeout(() => setNotice(null), 1600);
    } catch {
      setNotice("No pude copiar (permiso del navegador).");
      window.setTimeout(() => setNotice(null), 1800);
    }
  }

  function buildHeaders() {
    const h: Record<string, string> = {};
    if (token) h.Authorization = `Bearer ${token}`;
    return h;
  }

  async function load() {
    setErr(null);

    // Permitimos cargar si hay token o si hay passcode
    if (!token && !passcode) {
      setErr("Ingresa passcode o inicia sesión para administrar.");
      return;
    }

    const qs = new URLSearchParams({ code });
    if (passcode) qs.set("passcode", passcode);

    const res = await fetch(`/api/admin/attendees?${qs.toString()}`, {
      headers: buildHeaders(),
      cache: "no-store",
    });

    const json = await res.json().catch(() => null);

    if (!res.ok) {
      // Mensaje amigable si tu API aún exige passcode
      const msg = json?.error || "Error cargando asistentes";
      setErr(msg);

      // Si hay token pero API no lo acepta, sugerimos passcode
      if (token && !passcode) {
        setShowPasscode(true);
        setNotice("Tu API parece requerir passcode. Ingresa passcode para continuar.");
        window.setTimeout(() => setNotice(null), 2500);
      }
      return;
    }

    setData(json as AdminPayload);
  }

  // Auto-load en modo sesión (sin passcode) o modo passcode
  useEffect(() => {
    if (!code) return;

    // Si tenemos token, intentamos cargar sin passcode
    if (token) {
      load();
      const t = setInterval(load, 3000);
      return () => clearInterval(t);
    }

    // Si no hay token, usamos passcode (cuando exista)
    if (!passcode) return;
    load();
    const t = setInterval(load, 3000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, passcode, code]);

  async function closeSession() {
    setCloseMsg(null);

    const sig = sigRef.current;

    // Reglas:
    // - Si hay token, no exigimos passcode (ideal)
    // - Si no hay token, exigimos passcode
    if (!token && !passcode) return setCloseMsg("Falta passcode o sesión iniciada.");
    if (!sig || sig.isEmpty()) return setCloseMsg("Falta firma del relator 👇");

    setClosing(true);

    const trainer_signature_data_url = sig.getTrimmedCanvas().toDataURL("image/png");

    const res = await fetch("/api/admin/close-session", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...buildHeaders(),
      },
      body: JSON.stringify({
        code,
        passcode: passcode || null,
        trainer_signature_data_url,
      }),
    });

    const json = await res.json().catch(() => null);

    setClosing(false);

    if (!res.ok) {
      setCloseMsg(json?.error || "Error al cerrar");
      if (token && !passcode) setShowPasscode(true);
      return;
    }

    setCloseMsg("✅ Charla cerrada con firma del relator.");
    sig.clear();
    load();
  }

  async function generatePdf() {
    setPdfMsg(null);
    setPdfUrl(null);

    if (!token && !passcode) {
      setPdfMsg("Falta passcode o sesión iniciada.");
      return;
    }

    setPdfLoading(true);

    const res = await fetch("/api/admin/generate-pdf", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...buildHeaders(),
      },
      body: JSON.stringify({ code, passcode: passcode || null }),
    });

    const json = await res.json().catch(() => null);

    setPdfLoading(false);

    if (!res.ok) {
      setPdfMsg(json?.error || "Error generando PDF");
      if (token && !passcode) setShowPasscode(true);
      return;
    }

    setPdfMsg("✅ PDF generado.");
    setPdfUrl(json?.signed_url ?? null);
  }

  const session = data?.session;
  const attendees = data?.attendees ?? [];
  const status = session?.status ?? "—";
  const isClosed = session && session.status !== "open";

  const publicUrl = `${baseUrl}/c/${encodeURIComponent(code)}`;
  const adminUrl = `${baseUrl}/admin/s/${encodeURIComponent(code)}`;

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.top}>
          <div className={styles.brand}>
            <div className={styles.logoBox}>
              <Image
                src="/brand/lz-logo.png"
                alt="LZ Capacita QR"
                width={150}
                height={40}
                priority
              />
            </div>

            <div className={styles.brandMeta}>
              <div className={styles.title}>Admin · Asistentes</div>
              <div className={styles.subtitle}>
                Código: <span className={styles.mono}>{code}</span>
              </div>
            </div>
          </div>

          <div className={styles.actions}>
            <button
              type="button"
              className={styles.ghostBtn}
              onClick={() => router.push("/app")}
              title="Volver al panel"
            >
              ← Panel
            </button>

            <button type="button" className={styles.copyBtn} onClick={() => copyText(publicUrl, "Link público copiado ✅")}>
              Copiar link QR
            </button>

            <button type="button" className={styles.copyBtn} onClick={() => copyText(adminUrl, "Link admin copiado ✅")}>
              Copiar link Admin
            </button>
          </div>
        </div>

        {/* estado auth */}
        <div className={styles.authRow}>
          <span className={`${styles.badge} ${token ? styles.badgeOk : styles.badgeWarn}`}>
            {token ? "Sesión detectada (sin passcode)" : "Modo passcode"}
          </span>

          <button
            type="button"
            className={styles.linkBtn}
            onClick={() => setShowPasscode((v) => !v)}
          >
            {showPasscode ? "Ocultar passcode" : "Usar passcode"}
          </button>
        </div>

        {showPasscode && (
          <div className={styles.passRow}>
            <input
              className={styles.input}
              placeholder="Passcode admin (fallback)"
              value={passcode}
              onChange={(e) => setPasscode(e.target.value)}
            />
            <button className={styles.darkBtn} onClick={load} type="button">
              Cargar
            </button>
          </div>
        )}

        {err && <div className={styles.error}>{err}</div>}
        {notice && <div className={styles.notice}>{notice}</div>}

        {/* Info sesión */}
        {session && (
          <section className={styles.info}>
            <div className={styles.infoGrid}>
              <div className={styles.infoItem}>
                <div className={styles.infoLabel}>Empresa</div>
                <div className={styles.infoValue}>{session.companies?.name ?? "—"}</div>
              </div>
              <div className={styles.infoItem}>
                <div className={styles.infoLabel}>Dirección</div>
                <div className={styles.infoValue}>{session.companies?.address || "—"}</div>
              </div>
              <div className={styles.infoItem}>
                <div className={styles.infoLabel}>Charla</div>
                <div className={styles.infoValue}>{session.topic || "—"}</div>
              </div>
              <div className={styles.infoItem}>
                <div className={styles.infoLabel}>Lugar</div>
                <div className={styles.infoValue}>{session.location || "—"}</div>
              </div>
              <div className={styles.infoItem}>
                <div className={styles.infoLabel}>Relator</div>
                <div className={styles.infoValue}>{session.trainer_name || "—"}</div>
              </div>
              <div className={styles.infoItem}>
                <div className={styles.infoLabel}>Estado</div>
                <div className={styles.infoValue}>
                  <span className={`${styles.badge} ${isClosed ? styles.badgeClosed : styles.badgeOpen}`}>
                    {status}
                  </span>
                  {session.closed_at ? (
                    <span className={styles.smallMuted}>
                      {" "}
                      · cerrada: {new Date(session.closed_at).toLocaleString("es-CL")}
                    </span>
                  ) : null}
                </div>
              </div>
            </div>

            <div className={styles.kpis}>
              <div className={styles.kpi}>
                <div className={styles.kpiLabel}>Asistentes</div>
                <div className={styles.kpiValue}>{attendees.length}</div>
              </div>

              <div className={styles.kpi}>
                <div className={styles.kpiLabel}>Link público</div>
                <div className={styles.kpiValueMono}>/c/{code}</div>
              </div>
            </div>
          </section>
        )}

        {/* Tabla asistentes */}
        <section className={styles.section}>
          <div className={styles.sectionTitle}>Asistentes</div>

          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>RUT</th>
                  <th>Cargo</th>
                  <th>Hora</th>
                </tr>
              </thead>
              <tbody>
                {attendees.map((a: any, i: number) => (
                  <tr key={i}>
                    <td>{a.full_name}</td>
                    <td className={styles.mono}>{a.rut}</td>
                    <td>{a.role || "—"}</td>
                    <td>{new Date(a.created_at).toLocaleString("es-CL")}</td>
                  </tr>
                ))}
                {!attendees.length && (
                  <tr>
                    <td colSpan={4} className={styles.emptyCell}>
                      Aún no hay asistentes…
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* Cerrar charla */}
        {session && session.status === "open" && (
          <section className={styles.section}>
            <div className={styles.sectionTitle}>Cerrar charla (firma relator)</div>

            <div className={styles.sigBox}>
              {mounted ? (
                <SignatureCanvas
                  ref={(r) => {
                    sigRef.current = r;
                  }}
                  canvasProps={{
                    width: 900,
                    height: 200,
                    className: styles.sigCanvas,
                  }}
                />
              ) : (
                <div className={styles.sigPlaceholder} />
              )}
            </div>

            <div className={styles.rowBtns}>
              <button className={styles.secondaryBtn} type="button" onClick={() => sigRef.current?.clear()}>
                Limpiar firma
              </button>

              <button className={styles.darkBtn} type="button" disabled={closing} onClick={closeSession}>
                {closing ? "Cerrando…" : "Firmar y cerrar"}
              </button>
            </div>

            {closeMsg && <div className={styles.smallMsg}>{closeMsg}</div>}
          </section>
        )}

        {/* PDF */}
        {session && session.status !== "open" && (
          <section className={styles.section}>
            <div className={styles.sectionTitle}>PDF del registro</div>

            <button
              className={styles.darkBtnWide}
              type="button"
              disabled={pdfLoading}
              onClick={generatePdf}
            >
              {pdfLoading ? "Generando…" : "Generar PDF"}
            </button>

            {pdfMsg && <div className={styles.smallMsg}>{pdfMsg}</div>}

            {pdfUrl && (
              <a className={styles.link} href={pdfUrl} target="_blank" rel="noreferrer">
                Descargar PDF
              </a>
            )}
          </section>
        )}
      </div>
    </div>
  );
}