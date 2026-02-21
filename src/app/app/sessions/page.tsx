"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/browser";
import EditSessionModal, { SessionRow } from "@/components/app/EditSessionModal";
import QrModal from "@/components/app/QrModal";
import styles from "./page.module.css";

type Company = { id: string; name: string; address: string | null };

type SessionWithCompany = SessionRow & {
  companies?: Company | null;
  attendees_count?: number;
  pdf_path?: string | null;
  pdf_generated_at?: string | null;
};

type PipeKey = "open_empty" | "open_progress" | "closed" | "pdf";

function fmtCL(iso?: string | null) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("es-CL");
  } catch {
    return "—";
  }
}

function isClosed(s: any) {
  const st = (s.status ?? "").toLowerCase();
  return st === "closed" || !!s.closed_at;
}

export default function SessionsPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [sessions, setSessions] = useState<SessionWithCompany[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [q, setQ] = useState("");
  const [toast, setToast] = useState<string | null>(null);

  const [pipe, setPipe] = useState<PipeKey>("open_empty");
  const [editing, setEditing] = useState<SessionRow | null>(null);

  // ✅ QR Modal state
  const [qrOpen, setQrOpen] = useState(false);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [qrUrl, setQrUrl] = useState<string | null>(null);

  const baseUrl = useMemo(() => {
    if (typeof window === "undefined") return "";
    return window.location.origin;
  }, []);

  async function getTokenOrRedirect() {
    const { data } = await supabaseBrowser.auth.getSession();
    const token = data.session?.access_token;
    if (!token) {
      router.replace("/login?e=" + encodeURIComponent("Sesión expirada. Vuelve a ingresar."));
      return null;
    }
    return token;
  }

  async function loadAll() {
    setLoading(true);
    setError(null);

    const token = await getTokenOrRedirect();
    if (!token) return;

    const res = await fetch("/api/app/sessions", {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });

    if (res.status === 401) {
      router.replace("/login?e=" + encodeURIComponent("Sesión expirada. Vuelve a ingresar."));
      return;
    }

    const json = await res.json().catch(() => null);
    if (!res.ok) {
      setSessions([]);
      setError(json?.error || "No se pudieron cargar las charlas");
      setLoading(false);
      return;
    }

    setSessions(json?.sessions ?? []);
    setLoading(false);
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function copy(text: string, msg = "Copiado ✅") {
    try {
      await navigator.clipboard.writeText(text);
      setToast(msg);
      setTimeout(() => setToast(null), 1200);
    } catch {
      setToast("No se pudo copiar 😕");
      setTimeout(() => setToast(null), 1800);
    }
  }

  async function signAndOpenPdf(pdf_path: string) {
    const token = await getTokenOrRedirect();
    if (!token) return;

    setToast("Abriendo PDF…");
    try {
      const res = await fetch("/api/app/pdfs/sign", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ pdf_path }),
      });

      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error || "No se pudo abrir el PDF");

      window.open(json.signed_url, "_blank", "noopener,noreferrer");
      setToast("PDF abierto ✅");
      setTimeout(() => setToast(null), 1200);
    } catch (e: any) {
      setToast(e?.message || "Error al abrir PDF");
      setTimeout(() => setToast(null), 2200);
    }
  }

  async function generatePdf(code: string) {
    const token = await getTokenOrRedirect();
    if (!token) return;

    setToast("Generando PDF…");
    try {
      const res = await fetch("/api/admin/generate-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ code }),
      });

      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error || "No se pudo generar PDF");

      window.open(json.signed_url, "_blank", "noopener,noreferrer");
      setToast("PDF listo ✅");
      setTimeout(() => setToast(null), 1200);

      await loadAll();
    } catch (e: any) {
      setToast(e?.message || "Error PDF");
      setTimeout(() => setToast(null), 2200);
    }
  }

  function openQr(code: string) {
    const upper = code.toUpperCase();
    const url = baseUrl ? `${baseUrl}/c/${encodeURIComponent(upper)}` : `/c/${encodeURIComponent(upper)}`;
    setQrCode(upper);
    setQrUrl(url);
    setQrOpen(true);
  }

  const counts = useMemo(() => {
    const openEmpty = sessions.filter((s) => !isClosed(s) && (s.attendees_count ?? 0) === 0).length;
    const openProgress = sessions.filter((s) => !isClosed(s) && (s.attendees_count ?? 0) > 0).length;
    const closedNoPdf = sessions.filter((s) => isClosed(s) && !s.pdf_path).length;
    const pdfGen = sessions.filter((s) => !!s.pdf_path).length;
    return { openEmpty, openProgress, closedNoPdf, pdfGen };
  }, [sessions]);

  const filtered = useMemo(() => {
    let list = [...sessions];

    if (pipe === "open_empty") list = list.filter((s) => !isClosed(s) && (s.attendees_count ?? 0) === 0);
    if (pipe === "open_progress") list = list.filter((s) => !isClosed(s) && (s.attendees_count ?? 0) > 0);
    if (pipe === "closed") list = list.filter((s) => isClosed(s) && !s.pdf_path);
    if (pipe === "pdf") list = list.filter((s) => !!s.pdf_path);

    const term = q.trim().toLowerCase();
    if (term) {
      list = list.filter((s: any) => {
        const company = s.companies?.name ?? "";
        const topic = s.topic ?? "";
        const code = s.code ?? "";
        const trainer = s.trainer_name ?? "";
        const loc = s.location ?? "";
        return (
          company.toLowerCase().includes(term) ||
          topic.toLowerCase().includes(term) ||
          code.toLowerCase().includes(term) ||
          trainer.toLowerCase().includes(term) ||
          loc.toLowerCase().includes(term)
        );
      });
    }

    list.sort((a, b) => {
      const ad = new Date(a.created_at ?? a.session_date ?? 0).getTime();
      const bd = new Date(b.created_at ?? b.session_date ?? 0).getTime();
      return bd - ad;
    });

    return list;
  }, [sessions, q, pipe]);

  return (
    <div className={styles.page}>
      <div className={styles.head}>
        <div>
          <div className={styles.title}>Mis charlas</div>
          <div className={styles.sub}>Abierta → En desarrollo → Cerrada → PDF generado</div>
        </div>

        <div className={styles.actionsTop}>
          <button className={styles.secondary} onClick={() => router.push("/app/sessions/new")} type="button">
            ➕ Crear charla
          </button>
          <button className={styles.primary} onClick={loadAll} disabled={loading} type="button">
            {loading ? "Cargando…" : "Actualizar"}
          </button>
        </div>
      </div>

      {error && <div className={styles.error}>{error}</div>}

      <div className={styles.pipeline}>
        <button type="button" className={`${styles.pipeStep} ${pipe === "open_empty" ? styles.pipeActive : ""}`} onClick={() => setPipe("open_empty")}>
          Abierta <span className={styles.pipeBadge}>{counts.openEmpty}</span>
        </button>
        <button type="button" className={`${styles.pipeStep} ${pipe === "open_progress" ? styles.pipeActive : ""}`} onClick={() => setPipe("open_progress")}>
          En desarrollo <span className={styles.pipeBadge}>{counts.openProgress}</span>
        </button>
        <button type="button" className={`${styles.pipeStep} ${pipe === "closed" ? styles.pipeActive : ""}`} onClick={() => setPipe("closed")}>
          Cerrada <span className={styles.pipeBadge}>{counts.closedNoPdf}</span>
        </button>
        <button type="button" className={`${styles.pipeStep} ${pipe === "pdf" ? styles.pipeActive : ""}`} onClick={() => setPipe("pdf")}>
          PDF generado <span className={styles.pipeBadge}>{counts.pdfGen}</span>
        </button>
      </div>

      <div className={styles.toolbar}>
        <input className={styles.search} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por empresa, tema, código, relator o lugar…" />
        {toast && <div className={styles.toast}>{toast}</div>}
      </div>

      <div className={styles.listCard}>
        {loading ? (
          <div className={styles.muted}>Cargando…</div>
        ) : !filtered.length ? (
          <div className={styles.muted}>No hay charlas para este estado.</div>
        ) : (
          <div className={styles.rows}>
            {filtered.map((s: any) => {
              const closed = isClosed(s);
              const code = String(s.code ?? "").toUpperCase();
              const adminPath = `/admin/s/${encodeURIComponent(code)}`;
              const count = s.attendees_count ?? 0;

              const badgeLabel = s.pdf_path ? "PDF GENERADO" : closed ? "CERRADA" : count > 0 ? "EN DESARROLLO" : "ABIERTA";

              return (
                <div key={s.id} className={styles.row}>
                  <div className={styles.rowMain}>
                    <div className={styles.rowTopLine}>
                      <span className={styles.topic}>{s.topic || "(Sin tema)"}</span>
                      <span className={`${styles.badge} ${closed ? styles.badgeClosed : styles.badgeOpen}`}>{badgeLabel}</span>
                    </div>

                    <div className={styles.meta}>
                      <span className={styles.mono}>{code}</span>
                      <span className={styles.dot}>•</span>
                      <span>{s.companies?.name ?? "—"}</span>
                      <span className={styles.dot}>•</span>
                      <span>{s.trainer_name ?? "—"}</span>
                      <span className={styles.dot}>•</span>
                      <span>{fmtCL(s.session_date)}</span>
                      <span className={styles.dot}>•</span>
                      <span>{count} asistente(s)</span>
                    </div>
                  </div>

                  <div className={styles.rowActions}>
                    {/* ✅ QR en modal */}
                    <button className={styles.btn} onClick={() => openQr(code)} type="button">
                      QR
                    </button>

                    <button className={styles.btnDark} onClick={() => router.push(adminPath)} type="button">
                      Admin
                    </button>

                    <button
                      className={styles.btnThin}
                      onClick={() => copy(baseUrl ? `${baseUrl}/c/${code}` : `/c/${code}`, "Link QR copiado ✅")}
                      type="button"
                    >
                      Copiar
                    </button>

                    <button className={styles.btnThin} onClick={() => setEditing(s)} type="button">
                      Editar
                    </button>

                    {closed && (
                      <>
                        {s.pdf_path ? (
                          <button className={styles.btnPdf} onClick={() => signAndOpenPdf(String(s.pdf_path))} type="button">
                            Abrir PDF
                          </button>
                        ) : (
                          <button className={styles.btnPdf} onClick={() => generatePdf(code)} type="button">
                            Generar PDF
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <EditSessionModal open={!!editing} session={editing} onClose={() => setEditing(null)} onSaved={loadAll} />

      {/* ✅ Modal QR */}
      <QrModal open={qrOpen} code={qrCode} publicUrl={qrUrl} onClose={() => setQrOpen(false)} />
    </div>
  );
}