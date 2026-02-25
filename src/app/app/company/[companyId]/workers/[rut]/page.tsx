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
};

type Worker = {
  rut: string;
  full_name: string | null;
  role: string | null;
};

type HistoryRow = {
  attended_at: string;
  session_id: string;
  code: string;
  topic: string | null;
  trainer_name: string | null;
  session_date: string | null;
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

function fmtDateTimeCL(iso: string | null | undefined) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("es-CL");
  } catch {
    return "—";
  }
}

export default function WorkerDetailPage() {
  const router = useRouter();
  const params = useParams<{ companyId: string; rut: string }>();

  const rawCompanyId = (params?.companyId ?? "") as unknown as string | string[];
  const companyId = (Array.isArray(rawCompanyId) ? rawCompanyId[0] : rawCompanyId).trim();

  const rawRut = (params?.rut ?? "") as unknown as string | string[];
  const rutParam = (Array.isArray(rawRut) ? rawRut[0] : rawRut).trim();

  const invalidCompanyId =
    !companyId || companyId === "undefined" || companyId === "null" || !isUuid(companyId);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [company, setCompany] = useState<Company | null>(null);
  const [worker, setWorker] = useState<Worker | null>(null);
  const [history, setHistory] = useState<HistoryRow[]>([]);

  const [token, setToken] = useState<string | null>(null);
  const tokenRef = useRef<string | null>(null);

  useEffect(() => {
    if (!companyId) return;
    if (!invalidCompanyId) return;

    setError("Empresa inválida. Volviendo…");
    setLoading(false);
    const t = window.setTimeout(() => router.replace("/app/companies"), 700);
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
      const json = await apiFetch<{ company: Company; worker: Worker; history: HistoryRow[] }>(
        `/api/app/companies/${companyId}/workers/${encodeURIComponent(rutParam)}/history`
      );

      setCompany(json?.company ?? null);
      setWorker(json?.worker ?? null);
      setHistory(json?.history ?? []);
    } catch (e: any) {
      setError(e?.message || "No se pudo cargar el trabajador");
      setCompany(null);
      setWorker(null);
      setHistory([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (invalidCompanyId) return;
    if (!token) return;
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId, rutParam, token, invalidCompanyId]);

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

  const title = worker?.full_name ?? "Trabajador";
  const rutFmt = worker?.rut ? formatRutChile(worker.rut) : formatRutChile(rutParam);
  const role = worker?.role ?? null;
  const companyName = company?.name ?? "—";

  const totalCaps = history.length;

  const subtitle = useMemo(() => {
    return `RUT: ${rutFmt}${role ? ` · ${role}` : ""}`;
  }, [rutFmt, role]);

  if (invalidCompanyId) {
    return (
      <div className={styles.page}>
        <div className={`glass ${styles.headerCard}`}>
          <div>
            <div className={styles.title}>Trabajador</div>
            <div className={styles.sub}>Empresa inválida. Redirigiendo…</div>
          </div>
          <button type="button" className="btn" onClick={() => router.push("/app/companies")}>← Volver</button>
        </div>

        {error ? (
          <div className={`glass ${styles.stateCard} border border-red-200/70 bg-red-50/60`}>
            <div className={styles.stateText}>{error}</div>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={`glass ${styles.headerCard}`}>
        <div className={styles.headerLeft}>
          <button type="button" className="btn" onClick={() => router.push(`/app/company/${companyId}`)}>
            ← Volver a empresa
          </button>

          <div>
            <div className={styles.title}>{title}</div>
            <div className={styles.sub}>{subtitle}</div>
            <div className={styles.sub}>
              Empresa: <span className={styles.strong}>{companyName}</span>
            </div>
          </div>
        </div>

        <div className={styles.headerRight}>
          <div className={`glass ${styles.kpiMini}`}>
            <div className={styles.kpiLabel}>Capacitaciones</div>
            <div className={styles.kpiValue}>{totalCaps}</div>
          </div>
        </div>
      </div>

      {error ? (
        <div className={`glass ${styles.stateCard} border border-red-200/70 bg-red-50/60`}>
          <div className={styles.stateText}>{error}</div>
        </div>
      ) : null}

      {notice ? (
        <div className={`glass ${styles.stateCard} border border-emerald-200/60 bg-emerald-50/60`}>
          <div className={styles.stateText}>{notice}</div>
        </div>
      ) : null}

      <div className={`glass ${styles.sectionCard}`}>
        <div className={styles.sectionHead}>
          <div>
            <div className={styles.sectionTitle}>Historial de capacitaciones</div>
            <div className={styles.sectionSub}>Todas las asistencias registradas para este trabajador.</div>
          </div>
        </div>

        {loading ? (
          <div className={styles.empty}>Cargando…</div>
        ) : !history.length ? (
          <div className={styles.empty}>Sin registros de asistencia para este trabajador.</div>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Tema</th>
                  <th>Relator</th>
                  <th>Estado</th>
                  <th style={{ width: 260 }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {history.map((h) => {
                  const code = safeUpper(h.code);
                  const isClosed = (h.status ?? "").toLowerCase() === "closed" || !!h.closed_at;
                  const when = h.session_date ?? h.created_at ?? h.attended_at;

                  const publicUrl = `/c/${encodeURIComponent(code)}`;
                  const adminUrl = `/admin/s/${encodeURIComponent(code)}`;

                  return (
                    <tr key={`${h.session_id}:${h.attended_at}`}>
                      <td className={styles.mono}>{fmtDateTimeCL(when)}</td>
                      <td className={styles.tdStrong}>
                        {h.topic ?? "(Sin tema)"}
                        <div className={styles.subRow}>
                          Código: <span className={styles.mono}>{code}</span>
                        </div>
                      </td>
                      <td>{h.trainer_name ?? "—"}</td>
                      <td>
                        <span className={`${styles.badge} ${isClosed ? styles.badgeClosed : styles.badgeOpen}`}>
                          {isClosed ? "Cerrada" : "Abierta"}
                        </span>
                      </td>
                      <td>
                        <div className={styles.actionsRow}>
                          <button type="button" className="btn" onClick={() => openQr(code)}>QR</button>
                          <button type="button" className="btn" onClick={() => openAdmin(code)}>Admin</button>
                          {h.pdf_path ? (
                            <button type="button" className="btn btnCta" onClick={() => openPdf(String(h.pdf_path))}>
                              PDF
                            </button>
                          ) : null}
                          <button type="button" className="btn" onClick={() => copyText(publicUrl, "Ruta QR copiada ✅")}>
                            Copiar QR
                          </button>
                          <button type="button" className="btn" onClick={() => copyText(adminUrl, "Ruta Admin copiada ✅")}>
                            Copiar Admin
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}