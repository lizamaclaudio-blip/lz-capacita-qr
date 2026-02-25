"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { formatRutChile } from "@/lib/rut";
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
  last_seen_at: string;
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

  const [qWorkers, setQWorkers] = useState("");
  const [qSessions, setQSessions] = useState("");
  const [showAllWorkers, setShowAllWorkers] = useState(false);
  const [showAllSessions, setShowAllSessions] = useState(false);

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

  const filteredWorkers = useMemo(() => {
    const term = qWorkers.trim().toLowerCase();
    if (!term) return workers;
    return workers.filter((w) => {
      const name = (w.full_name ?? "").toLowerCase();
      const rut = (w.rut ?? "").toLowerCase();
      const role = (w.role ?? "").toLowerCase();
      return name.includes(term) || rut.includes(term) || role.includes(term);
    });
  }, [workers, qWorkers]);

  const sortedSessions = useMemo(() => {
    const copy = [...sessions];
    copy.sort((a, b) => {
      const ad = new Date(a.session_date ?? a.created_at ?? 0).getTime();
      const bd = new Date(b.session_date ?? b.created_at ?? 0).getTime();
      return bd - ad;
    });
    return copy;
  }, [sessions]);

  const filteredSessions = useMemo(() => {
    const term = qSessions.trim().toLowerCase();
    if (!term) return sortedSessions;
    return sortedSessions.filter((s) => {
      const code = (s.code ?? "").toLowerCase();
      const topic = (s.topic ?? "").toLowerCase();
      const trainer = (s.trainer_name ?? "").toLowerCase();
      const status = (s.status ?? "").toLowerCase();
      return code.includes(term) || topic.includes(term) || trainer.includes(term) || status.includes(term);
    });
  }, [sortedSessions, qSessions]);

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

  if (invalidCompanyId) {
    return (
      <div className={styles.page}>
        <div className={styles.headerCard}>
          <div>
            <div className={styles.kicker}>Empresa</div>
            <div className={styles.h1}>Empresa inválida</div>
            <div className={styles.sub}>Redirigiendo…</div>
          </div>
          <button type="button" className="btn btnGhost" onClick={() => router.push("/app/companies")}>
            ← Volver
          </button>
        </div>

        {error ? <div className={styles.alertErr}>{error}</div> : null}
      </div>
    );
  }

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.headerCard}>
        <div className={styles.headerLeft}>
          <button type="button" className="btn btnGhost" onClick={() => router.push("/app/companies")}>
            ← Volver
          </button>

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
              <div className={styles.kicker}>Empresa</div>
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

        <div className={styles.headerRight}>
          <button
            type="button"
            className="btn btnCta"
            onClick={() => router.push(`/app/sessions/new?companyId=${encodeURIComponent(companyId)}`)}
          >
            ➕ Crear charla
          </button>

          <button type="button" className="btn btnPrimary" onClick={loadAll} disabled={loading}>
            {loading ? "Cargando…" : "Actualizar"}
          </button>
        </div>
      </div>

      {error ? <div className={styles.alertErr}>{error}</div> : null}
      {notice ? <div className={styles.alertOk}>{notice}</div> : null}

      {/* KPIs */}
      <div className={styles.kpiGrid}>
        <div className={styles.kpiCard}>
          <div className={styles.kpiLabel}>Charlas</div>
          <div className={styles.kpiValue}>{kpis?.sessions_total ?? 0}</div>
          <div className={styles.kpiHint}>Total creadas</div>
        </div>

        <div className={styles.kpiCard}>
          <div className={styles.kpiLabel}>Trabajadores</div>
          <div className={styles.kpiValue}>{kpis?.workers_unique ?? 0}</div>
          <div className={styles.kpiHint}>Únicos con asistencia</div>
        </div>

        <div className={styles.kpiCard}>
          <div className={styles.kpiLabel}>Asistencias</div>
          <div className={styles.kpiValue}>{kpis?.attendances_total ?? 0}</div>
          <div className={styles.kpiHint}>Registros totales</div>
        </div>
      </div>

      {/* Content */}
      <div className={styles.grid}>
        {/* Sessions */}
        <section className={styles.panel}>
          <div className={styles.panelHead}>
            <div>
              <div className={styles.panelTitle}>Charlas</div>
              <div className={styles.panelSub}>Links QR/Admin + cierre + PDF final</div>
            </div>

            <div className={styles.panelActions}>
              <input
                className={styles.searchInput}
                value={qSessions}
                onChange={(e) => setQSessions(e.target.value)}
                placeholder="Buscar (tema / código / relator / estado)…"
              />
              <button type="button" className="btn btnGhost" onClick={() => setShowAllSessions((v) => !v)}>
                {showAllSessions ? "Ver menos" : "Ver todas"}
              </button>
            </div>
          </div>

          {loading ? (
            <div className={styles.stateCard}>Cargando charlas…</div>
          ) : !filteredSessions.length ? (
            <div className={styles.stateCard}>Aún no hay charlas para esta empresa.</div>
          ) : (
            <div className={styles.cards}>
              {(showAllSessions ? filteredSessions : filteredSessions.slice(0, 10)).map((s) => {
                const code = safeUpper(s.code);
                const isClosed = (s.status ?? "").toLowerCase() === "closed" || !!s.closed_at;
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

                    <div className={styles.sessionActions}>
                      <button className={styles.smallBtn} type="button" onClick={() => copyText(publicUrl, "Link QR copiado ✅")}>
                        📎 QR
                      </button>
                      <button className={styles.smallBtn} type="button" onClick={() => copyText(adminUrl, "Link Admin copiado ✅")}>
                        📎 Admin
                      </button>

                      <button className={styles.smallBtn} type="button" onClick={() => openQr(code)}>
                        ↗ Abrir QR
                      </button>

                      {s.pdf_path ? (
                        <button className={styles.smallBtnCta} type="button" onClick={() => openPdf(String(s.pdf_path))}>
                          🧾 PDF
                        </button>
                      ) : null}

                      <button className={styles.smallBtnPrimary} type="button" onClick={() => openAdmin(code)}>
                        Abrir admin →
                      </button>
                    </div>

                    <div className={styles.sessionHint}>
                      Tip: el PDF se genera en el admin con <b>passcode (RUT relator)</b>.
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Workers */}
        <section className={styles.panel}>
          <div className={styles.panelHead}>
            <div>
              <div className={styles.panelTitle}>Trabajadores</div>
              <div className={styles.panelSub}>Se generan automáticamente desde asistencias</div>
            </div>

            <div className={styles.panelActions}>
              <input
                className={styles.searchInput}
                value={qWorkers}
                onChange={(e) => setQWorkers(e.target.value)}
                placeholder="Buscar (nombre / RUT / cargo)…"
              />
              <button type="button" className="btn btnGhost" onClick={() => setShowAllWorkers((v) => !v)}>
                {showAllWorkers ? "Ver menos" : "Ver todos"}
              </button>
            </div>
          </div>

          {loading ? (
            <div className={styles.stateCard}>Cargando trabajadores…</div>
          ) : !filteredWorkers.length ? (
            <div className={styles.stateCard}>Aún no hay trabajadores registrados para esta empresa.</div>
          ) : (
            <div className={styles.workerList}>
              {(showAllWorkers ? filteredWorkers : filteredWorkers.slice(0, 12)).map((w) => (
                <button key={w.rut} type="button" className={styles.workerRow} onClick={() => goWorker(w.rut)}>
                  <div className={styles.workerMain}>
                    <div className={styles.workerName}>{w.full_name ?? "(Sin nombre)"}</div>
                    <div className={styles.workerMeta}>
                      {formatRutChile(w.rut)} · {w.role ?? "—"}
                    </div>
                  </div>
                  <div className={styles.workerRight}>→</div>
                </button>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}