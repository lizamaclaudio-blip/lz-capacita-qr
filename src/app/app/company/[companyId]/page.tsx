"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { formatRutChile } from "@/lib/rut";
import StatNumber from "@/components/app/StatNumber";
import styles from "./page.module.css";

type Company = {
  id: string;
  name: string;
  legal_name?: string | null;
  rut?: string | null;
  address?: string | null;
  logo_path?: string | null;
  company_type?: string | null;
  created_at?: string | null;
};

type Kpis = {
  sessions_total: number;
  workers_unique: number;
  attendances_total: number;
};

type WorkerRow = {
  rut: string;
  full_name: string | null;
  role: string | null;
  last_seen_at: string | null;
  first_seen_at: string | null;
  attendances_total: number;
  sessions_unique: number;
};

type SessionRow = {
  id: string;
  company_id: string;
  code: string;
  topic: string | null;
  location: string | null;
  session_date: string | null;
  trainer_name: string | null;
  status: string | null;
  closed_at: string | null;
  created_at: string | null;
  pdf_path?: string | null;
  pdf_generated_at?: string | null;
};

type TabKey = "sessions" | "workers" | "pdfs";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isUuid(v: string) {
  return UUID_RE.test(v);
}

function safeUpper(s: string | null | undefined) {
  return String(s ?? "").trim().toUpperCase();
}

function fmtCL(iso: string | null | undefined) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("es-CL");
  } catch {
    return "—";
  }
}

function isSessionClosed(s: SessionRow) {
  return (s.status ?? "").toLowerCase() === "closed" || !!s.closed_at;
}

export default function CompanyDetailPage() {
  const router = useRouter();
  const params = useParams<{ companyId: string }>();

  const raw = (params?.companyId ?? "") as unknown as string | string[];
  const companyId = (Array.isArray(raw) ? raw[0] : raw).trim();

  const invalidCompanyId =
    !companyId || companyId === "undefined" || companyId === "null" || !isUuid(companyId);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [company, setCompany] = useState<Company | null>(null);
  const [kpis, setKpis] = useState<Kpis | null>(null);
  const [workers, setWorkers] = useState<WorkerRow[]>([]);
  const [sessions, setSessions] = useState<SessionRow[]>([]);

  const [tab, setTab] = useState<TabKey>("sessions");

  const [token, setToken] = useState<string | null>(null);
  const tokenRef = useRef<string | null>(null);

  const origin = useMemo(() => {
    if (typeof window === "undefined") return "";
    return window.location.origin;
  }, []);

  const companyLogoUrl = useMemo(() => {
    const p = company?.logo_path ?? null;
    if (!p) return null;
    const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!base) return null;
    const clean = String(p).replace(/^company-logos\//, "");
    return `${base}/storage/v1/object/public/company-logos/${clean}`;
  }, [company]);

  useEffect(() => {
    if (!companyId) return;
    if (!invalidCompanyId) return;

    setError("Empresa inválida. Volviendo a Mis empresas…");
    setCompany(null);
    setKpis(null);
    setWorkers([]);
    setSessions([]);
    setLoading(false);

    const t = window.setTimeout(() => {
      router.replace("/app/companies");
    }, 700);

    return () => window.clearTimeout(t);
  }, [companyId, invalidCompanyId, router]);

  useEffect(() => {
    let alive = true;

    async function boot() {
      const { data } = await supabaseBrowser.auth.getSession();
      const t = data.session?.access_token ?? null;
      if (!alive) return;

      if (!t) {
        router.replace("/login?e=" + encodeURIComponent("Sesión expirada. Vuelve a ingresar."));
        return;
      }

      setToken(t);
      tokenRef.current = t;
    }

    boot();

    const { data: sub } = supabaseBrowser.auth.onAuthStateChange((_event, session) => {
      const t = session?.access_token ?? null;
      setToken(t);
      tokenRef.current = t;

      if (!t) {
        router.replace("/login?e=" + encodeURIComponent("Sesión expirada. Vuelve a ingresar."));
      }
    });

    return () => {
      alive = false;
      sub?.subscription?.unsubscribe();
    };
  }, [router]);

  async function ensureTokenOrRedirect() {
    const cached = tokenRef.current ?? token;
    if (cached) return cached;

    const { data } = await supabaseBrowser.auth.getSession();
    const t = data.session?.access_token ?? null;

    if (!t) {
      router.replace("/login?e=" + encodeURIComponent("Sesión expirada. Vuelve a ingresar."));
      return null;
    }

    setToken(t);
    tokenRef.current = t;
    return t;
  }

  async function apiFetch<T>(url: string, init: RequestInit = {}) {
    const t = await ensureTokenOrRedirect();
    if (!t) return null as any;

    const res = await fetch(url, {
      ...init,
      headers: {
        ...(init.headers ?? {}),
        Authorization: `Bearer ${t}`,
      },
      cache: "no-store",
    });

    if (res.status === 401) {
      router.replace("/login?e=" + encodeURIComponent("Sesión expirada. Vuelve a ingresar."));
      return null as any;
    }

    const json = (await res.json().catch(() => null)) as T | null;
    if (!res.ok) {
      const msg = (json as any)?.error || `Error HTTP ${res.status}`;
      throw new Error(msg);
    }

    return json as T;
  }

  async function loadAll() {
    if (invalidCompanyId) return;

    setLoading(true);
    setError(null);

    try {
      const c = await apiFetch<{ company: Company | null }>(`/api/app/companies/${companyId}`);
      setCompany(c?.company ?? null);

      const k = await apiFetch<{ kpis: Kpis }>(`/api/app/companies/${companyId}/summary`);
      setKpis(k?.kpis ?? null);

      const w = await apiFetch<{ workers: WorkerRow[] }>(`/api/app/companies/${companyId}/workers`);
      setWorkers(w?.workers ?? []);

      const s = await apiFetch<{ sessions: SessionRow[] }>(`/api/app/companies/${companyId}/sessions`);
      setSessions(s?.sessions ?? []);
    } catch (e: any) {
      setError(e?.message || "No se pudo cargar la empresa");
      setCompany(null);
      setKpis(null);
      setWorkers([]);
      setSessions([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (invalidCompanyId) return;
    if (!token) return;
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId, token, invalidCompanyId]);

  async function copyText(text: string, msg = "Copiado ✅") {
    try {
      await navigator.clipboard.writeText(text);
      setNotice(msg);
      window.setTimeout(() => setNotice(null), 1400);
    } catch {
      setNotice("No se pudo copiar 😕");
      window.setTimeout(() => setNotice(null), 1400);
    }
  }

  function openAdmin(code: string) {
    window.open(`/admin/s/${encodeURIComponent(safeUpper(code))}`, "_blank", "noopener,noreferrer");
  }

  function openQr(code: string) {
    window.open(`/c/${encodeURIComponent(safeUpper(code))}`, "_blank", "noopener,noreferrer");
  }

  async function openPdf(pdf_path: string) {
    try {
      const json = await apiFetch<{ ok: boolean; signed_url: string }>("/api/app/pdfs/sign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pdf_path }),
      });

      const url = (json as any)?.signed_url;
      if (!url) throw new Error("No recibí URL firmada");
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (e: any) {
      setError(e?.message || "No se pudo abrir el PDF");
    }
  }

  function goWorker(rut: string) {
    router.push(`/app/company/${companyId}/workers/${encodeURIComponent(rut)}`);
  }

  const companyName = company?.name ?? "Empresa";
  const companyLegal = company?.legal_name ?? null;
  const companyRut = company?.rut ? formatRutChile(company.rut) : null;
  const companyAddress = company?.address ?? null;
  const companyInitial = (companyName.trim()[0] ?? "E").toUpperCase();
  const isBranch = (company?.company_type ?? "hq") === "branch";

  const sortedSessions = useMemo(() => {
    const copy = [...sessions];
    copy.sort((a, b) => {
      const ad = new Date(a.session_date ?? a.created_at ?? 0).getTime();
      const bd = new Date(b.session_date ?? b.created_at ?? 0).getTime();
      return bd - ad;
    });
    return copy;
  }, [sessions]);

  const sortedWorkers = useMemo(() => {
    const copy = [...workers];
    copy.sort((a, b) => {
      const an = (a.full_name ?? "").toLowerCase();
      const bn = (b.full_name ?? "").toLowerCase();
      return an.localeCompare(bn);
    });
    return copy;
  }, [workers]);

  const closedSessionsCount = useMemo(() => sortedSessions.filter(isSessionClosed).length, [sortedSessions]);

  const pdfItems = useMemo(() => {
    return sortedSessions
      .filter((s) => !!s.pdf_path)
      .sort((a, b) => {
        const ad = new Date(a.pdf_generated_at ?? a.closed_at ?? a.created_at ?? 0).getTime();
        const bd = new Date(b.pdf_generated_at ?? b.closed_at ?? b.created_at ?? 0).getTime();
        return bd - ad;
      });
  }, [sortedSessions]);

  const createdSessionsCount = kpis?.sessions_total ?? sessions.length;
  const workersCount = kpis?.workers_unique ?? workers.length;
  const attendancesCount = kpis?.attendances_total ?? workers.reduce((acc, w) => acc + (Number(w.attendances_total) || 0), 0);
  const pdfsCount = pdfItems.length;

  return (
    <div className={styles.page}>
      <button
        type="button"
        className={styles.backBtn}
        aria-label="Volver"
        title="Volver"
        onClick={() => router.push("/app/companies")}
      >
        ←
      </button>

      <div className={styles.headerCard}>
        <div className={styles.companyRow}>
          <div className={styles.avatar}>
            {companyLogoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={companyLogoUrl} alt="Logo empresa" className={styles.logo} />
            ) : (
              <div className={styles.initial}>{companyInitial}</div>
            )}
          </div>

          <div className={styles.headerInfo}>
            <div className={styles.nameRow}>
              <h1 className={styles.title}>{companyName}</h1>
              <span className={`${styles.pill} ${isBranch ? styles.pillBranch : styles.pillHQ}`}>
                {isBranch ? "📍 Sucursal" : "🏢 Casa matriz"}
              </span>
            </div>

            <div className={styles.metaLine}>
              {companyLegal ? `Razón social: ${companyLegal}` : "Razón social: —"}
            </div>
            <div className={styles.metaLine}>
              {companyRut ? `RUT: ${companyRut}` : "RUT: —"}
              {companyAddress ? ` · ${companyAddress}` : ""}
            </div>
          </div>
        </div>
      </div>

      {error ? <div className={styles.alertErr}>{error}</div> : null}
      {notice ? <div className={styles.alertOk}>{notice}</div> : null}

      {/* KPI tabs con números en “caja 3D” + scramble */}
      <div className={styles.tabGrid}>
        <button
          type="button"
          className={styles.tabCard}
          data-active={tab === "sessions" ? "true" : "false"}
          onClick={() => setTab("sessions")}
        >
          <div className={styles.tabTop}>
            <div className={styles.tabLabel}>Charlas</div>
            <div className={styles.tabHint}>Creadas vs cerradas</div>
          </div>

          <div className={styles.numRow}>
            <div className={styles.numCube}>
              <div className={styles.numCap}>Creadas</div>
              <div className={styles.numVal}>
                <StatNumber value={createdSessionsCount} loading={loading} format={(n) => new Intl.NumberFormat("es-CL").format(n)} />
              </div>
            </div>

            <div className={styles.numCube}>
              <div className={styles.numCap}>Cerradas</div>
              <div className={styles.numVal}>
                <StatNumber value={closedSessionsCount} loading={loading} format={(n) => new Intl.NumberFormat("es-CL").format(n)} />
              </div>
            </div>
          </div>
        </button>

        <button
          type="button"
          className={styles.tabCard}
          data-active={tab === "workers" ? "true" : "false"}
          onClick={() => setTab("workers")}
        >
          <div className={styles.tabTop}>
            <div className={styles.tabLabel}>Trabajadores</div>
            <div className={styles.tabHint}>Consolidado por asistencia</div>
          </div>

          <div className={styles.numRow}>
            <div className={`${styles.numCube} ${styles.numCubeWide}`}>
              <div className={styles.numCap}>Trabajadores</div>
              <div className={styles.numVal}>
                <StatNumber value={workersCount} loading={loading} format={(n) => new Intl.NumberFormat("es-CL").format(n)} />
              </div>
            </div>

            <div className={`${styles.numCube} ${styles.numCubeWide}`}>
              <div className={styles.numCap}>Registros</div>
              <div className={styles.numVal}>
                <StatNumber value={attendancesCount} loading={loading} format={(n) => new Intl.NumberFormat("es-CL").format(n)} />
              </div>
            </div>
          </div>
        </button>

        <button
          type="button"
          className={styles.tabCard}
          data-active={tab === "pdfs" ? "true" : "false"}
          onClick={() => setTab("pdfs")}
        >
          <div className={styles.tabTop}>
            <div className={styles.tabLabel}>PDFs</div>
            <div className={styles.tabHint}>Cerrados y firmados</div>
          </div>

          <div className={styles.numRow}>
            <div className={`${styles.numCube} ${styles.numCubeSingle}`}>
              <div className={styles.numCap}>Generados</div>
              <div className={styles.numVal}>
                <StatNumber value={pdfsCount} loading={loading} format={(n) => new Intl.NumberFormat("es-CL").format(n)} />
              </div>
            </div>
          </div>
        </button>
      </div>

      <section className={styles.contentPanel}>
        {/* CHARLAS */}
        {tab === "sessions" ? (
          <>
            <div className={styles.panelTop}>
              <div>
                <div className={styles.panelTitle}>Charlas</div>
                <div className={styles.panelSub}>QR · Firmas · Cierre · PDF final</div>
              </div>
            </div>

            {loading ? (
              <div className={styles.stateCard}>Cargando charlas…</div>
            ) : !sortedSessions.length ? (
              <div className={styles.stateCard}>Aún no hay charlas para esta empresa.</div>
            ) : (
              <div className={styles.cards}>
                {sortedSessions.map((s) => {
                  const code = safeUpper(s.code);
                  const isClosed = isSessionClosed(s);
                  const when = s.session_date ?? s.created_at;

                  const publicUrl = origin ? `${origin}/c/${encodeURIComponent(code)}` : `/c/${encodeURIComponent(code)}`;
                  const adminUrl = origin
                    ? `${origin}/admin/s/${encodeURIComponent(code)}`
                    : `/admin/s/${encodeURIComponent(code)}`;

                  return (
                    <div key={s.id} className={styles.sessionCard}>
                      <div className={styles.sessionTop}>
                        <div className={styles.sessionTitleRow}>
                          <span className={`${styles.status} ${isClosed ? styles.statusClosed : styles.statusOpen}`}>
                            {isClosed ? "🔒 Cerrada" : "🟢 Abierta"}
                          </span>
                          <span className={styles.sessionCode}>#{code}</span>
                        </div>

                        <div className={styles.sessionTopic}>{s.topic ?? "(Sin tema)"}</div>

                        <div className={styles.sessionMeta}>
                          {s.location || "—"} · {fmtCL(when)}
                        </div>
                        <div className={styles.sessionMeta}>Relator: {s.trainer_name ?? "—"}</div>
                      </div>

                      {/* ✅ Cerrada => SOLO PDF */}
                      <div className={styles.sessionActions}>
                        {isClosed ? (
                          s.pdf_path ? (
                            <button className={styles.actionPdfPill} type="button" onClick={() => openPdf(String(s.pdf_path))}>
                              🧾 PDF
                            </button>
                          ) : (
                            <span className={styles.actionPdfPillDisabled}>🧾 PDF pendiente</span>
                          )
                        ) : (
                          <>
                            <button className={styles.actionBtn} type="button" onClick={() => copyText(publicUrl, "Link QR copiado ✅")}>
                              📎 QR
                            </button>

                            <button className={styles.actionBtn} type="button" onClick={() => copyText(adminUrl, "Link Firmar copiado ✅")}>
                              📎 Firmar
                            </button>

                            <button className={styles.actionBtn} type="button" onClick={() => openQr(code)}>
                              ↗ Abrir QR
                            </button>

                            {s.pdf_path ? (
                              <button className={styles.actionPdfPill} type="button" onClick={() => openPdf(String(s.pdf_path))}>
                                🧾 PDF
                              </button>
                            ) : null}

                            <button className={styles.actionBtnPrimary} type="button" onClick={() => openAdmin(code)}>
                              Abrir admin →
                            </button>
                          </>
                        )}
                      </div>

                      {!isClosed ? (
                        <div className={styles.sessionHint}>
                          Tip: el PDF se genera en el admin con <b>passcode (RUT relator)</b>.
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            )}
          </>
        ) : null}

        {/* TRABAJADORES */}
        {tab === "workers" ? (
          <>
            <div className={styles.panelTop}>
              <div>
                <div className={styles.panelTitle}>Trabajadores</div>
                <div className={styles.panelSub}>Consolidado desde registros de asistencia</div>
              </div>
            </div>

            {loading ? (
              <div className={styles.stateCard}>Cargando trabajadores…</div>
            ) : !sortedWorkers.length ? (
              <div className={styles.stateCard}>Aún no hay registros de trabajadores para esta empresa.</div>
            ) : (
              <div className={styles.workerList}>
                {sortedWorkers.map((w) => {
                  const rut = w.rut ? formatRutChile(w.rut) : "—";
                  const name = w.full_name ?? "(Sin nombre)";
                  const role = w.role ?? "—";
                  const sessionsUnique = Number(w.sessions_unique) || 0;
                  const attendsTotal = Number(w.attendances_total) || 0;

                  return (
                    <button key={w.rut} type="button" className={styles.workerRow} onClick={() => goWorker(w.rut)}>
                      <div className={styles.workerMain}>
                        <div className={styles.workerName}>{name}</div>
                        <div className={styles.workerMeta}>
                          {rut} · {role}
                        </div>
                      </div>

                      <div className={styles.workerRight}>
                        <span className={styles.workerStat}>{sessionsUnique} charlas</span>
                        <span className={styles.workerDot}>•</span>
                        <span className={styles.workerStat}>{attendsTotal} registros</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </>
        ) : null}

        {/* PDFS */}
        {tab === "pdfs" ? (
          <>
            <div className={styles.panelTop}>
              <div>
                <div className={styles.panelTitle}>PDFs</div>
                <div className={styles.panelSub}>Cierres finalizados con firma del relator</div>
              </div>
            </div>

            {loading ? (
              <div className={styles.stateCard}>Cargando PDFs…</div>
            ) : !pdfItems.length ? (
              <div className={styles.stateCard}>Aún no hay PDFs generados para esta empresa.</div>
            ) : (
              <div className={styles.pdfList}>
                {pdfItems.map((s) => {
                  const code = safeUpper(s.code);
                  const when = s.pdf_generated_at ?? s.closed_at ?? s.created_at;
                  const title = s.topic ?? "(Sin tema)";
                  const trainer = s.trainer_name ?? "—";

                  return (
                    <div key={s.id} className={styles.pdfRow}>
                      <div className={styles.pdfMain}>
                        <div className={styles.pdfTitle}>
                          {title} <span className={styles.pdfCode}>#{code}</span>
                        </div>
                        <div className={styles.pdfMeta}>
                          Relator: {trainer} · {fmtCL(when)}
                        </div>
                      </div>

                      <div className={styles.pdfActions}>
                        {s.pdf_path ? (
                          <button type="button" className={styles.actionPdfPill} onClick={() => openPdf(String(s.pdf_path))}>
                            🧾 Abrir PDF
                          </button>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        ) : null}
      </section>
    </div>
  );
}