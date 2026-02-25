"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/browser";
import styles from "./page.module.css";

type Company = {
  id: string;
  name: string | null;
  rut?: string | null;
  created_at?: string | null;
  logo_path?: string | null;
};

type Session = {
  id: string;
  code: string;
  topic?: string | null;
  location?: string | null;
  session_date?: string | null;
  trainer_name?: string | null;
  status?: string | null;
  closed_at?: string | null;
  company_id?: string | null;
  company?: { name?: string | null } | null;
};

type PdfItem = {
  id?: string;
  path?: string | null;
  created_at?: string | null;
  session_code?: string | null;
};

function fmtCL(iso?: string | null) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("es-CL");
  } catch {
    return "—";
  }
}

async function fetchWithToken<T>(url: string): Promise<T> {
  const { data } = await supabaseBrowser.auth.getSession();
  const token = data.session?.access_token;
  const res = await fetch(url, {
    cache: "no-store",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((json as any)?.error || "Error al cargar");
  return json as T;
}

export default function AppDashboardPage() {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [companies, setCompanies] = useState<Company[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [pdfs, setPdfs] = useState<PdfItem[]>([]);

  const [email, setEmail] = useState<string | null>(null);
  const isOwner = useMemo(() => (email || "").toLowerCase() === "lizamaclaudio@gmail.com", [email]);

  useEffect(() => {
    let alive = true;

    (async () => {
      setLoading(true);
      setErr(null);

      try {
        const { data: u } = await supabaseBrowser.auth.getUser();
        if (!alive) return;
        setEmail(u.user?.email ?? null);

        const c = await fetchWithToken<{ companies?: Company[] }>("/api/app/companies");
        const s = await fetchWithToken<{ sessions?: Session[] }>("/api/app/sessions");
        let p: { pdfs?: PdfItem[] } = {};
        try {
          p = await fetchWithToken<{ pdfs?: PdfItem[] }>("/api/app/pdfs");
        } catch {
          p = {};
        }

        if (!alive) return;

        setCompanies(Array.isArray(c.companies) ? c.companies : []);
        setSessions(Array.isArray(s.sessions) ? s.sessions : []);
        setPdfs(Array.isArray(p.pdfs) ? p.pdfs : []);
      } catch (e: any) {
        if (!alive) return;
        setErr(e?.message || "No se pudo cargar el dashboard");
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  const kpis = useMemo(() => {
    const totalCompanies = companies.length;
    const totalSessions = sessions.length;
    const closed = sessions.filter((x) => (x.status || "").toLowerCase() === "closed" || !!x.closed_at).length;
    const totalPdfs = pdfs.length;

    return { totalCompanies, totalSessions, closed, totalPdfs };
  }, [companies, sessions, pdfs]);

  const recentCompanies = useMemo(() => companies.slice(0, 5), [companies]);
  const recentSessions = useMemo(() => sessions.slice(0, 6), [sessions]);

  return (
    <div className={styles.page}>
      <div className={styles.head}>
        <div>
          <div className={styles.kicker}>Panel</div>
          <h1 className={styles.h1}>Dashboard</h1>
          <p className={styles.sub}>Estado general de tus empresas y charlas (sin planillas 🙌)</p>
        </div>

        <div className={styles.actions}>
          {isOwner ? (
            <Link href="/app/owner" className="btn btnGhost">
              🛡️ Owner
            </Link>
          ) : null}

          <Link href="/app/companies" className="btn btnPrimary">
            + Nueva empresa
          </Link>
          <Link href="/app/sessions/new" className="btn btnCta">
            + Nueva charla
          </Link>
        </div>
      </div>

      {err ? <div className={styles.errBox}>{err}</div> : null}

      <section className={styles.kpiGrid}>
        <div className={styles.kpiCard}>
          <div className={styles.kpiLabel}>Empresas</div>
          <div className={styles.kpiValue}>{loading ? "…" : kpis.totalCompanies}</div>
          <div className={styles.kpiHint}>Total registradas</div>
        </div>

        <div className={styles.kpiCard}>
          <div className={styles.kpiLabel}>Charlas</div>
          <div className={styles.kpiValue}>{loading ? "…" : kpis.totalSessions}</div>
          <div className={styles.kpiHint}>Creadas en el sistema</div>
        </div>

        <div className={styles.kpiCard}>
          <div className={styles.kpiLabel}>Cerradas</div>
          <div className={styles.kpiValue}>{loading ? "…" : kpis.closed}</div>
          <div className={styles.kpiHint}>Con firma del relator</div>
        </div>

        <div className={styles.kpiCard}>
          <div className={styles.kpiLabel}>PDFs</div>
          <div className={styles.kpiValue}>{loading ? "…" : kpis.totalPdfs}</div>
          <div className={styles.kpiHint}>Reportes generados</div>
        </div>
      </section>

      <section className={styles.grid}>
        <div className={styles.panel}>
          <div className={styles.panelHead}>
            <div>
              <div className={styles.panelTitle}>Empresas recientes</div>
              <div className={styles.panelSub}>Últimas creadas por ti</div>
            </div>
            <Link href="/app/companies" className={styles.panelLink}>
              Ver todas →
            </Link>
          </div>

          <div className={styles.list}>
            {loading ? (
              <div className={styles.skel}>Cargando…</div>
            ) : recentCompanies.length === 0 ? (
              <div className={styles.empty}>Aún no tienes empresas. Crea la primera ✅</div>
            ) : (
              recentCompanies.map((c) => (
                <Link key={c.id} href="/app/companies" className={styles.row}>
                  <div className={styles.rowMain}>
                    <div className={styles.rowTitle}>{c.name || "Empresa"}</div>
                    <div className={styles.rowSub}>{c.rut ? `RUT: ${c.rut}` : "RUT: —"}</div>
                  </div>
                  <div className={styles.rowMeta}>{fmtCL(c.created_at)}</div>
                </Link>
              ))
            )}
          </div>
        </div>

        <div className={styles.panel}>
          <div className={styles.panelHead}>
            <div>
              <div className={styles.panelTitle}>Charlas recientes</div>
              <div className={styles.panelSub}>Códigos y estado</div>
            </div>
            <Link href="/app/sessions" className={styles.panelLink}>
              Ver todas →
            </Link>
          </div>

          <div className={styles.list}>
            {loading ? (
              <div className={styles.skel}>Cargando…</div>
            ) : recentSessions.length === 0 ? (
              <div className={styles.empty}>Crea una charla para ver el registro.</div>
            ) : (
              recentSessions.map((s) => {
                const isClosed = (s.status || "").toLowerCase() === "closed" || !!s.closed_at;
                return (
                  <Link key={s.id} href={`/admin/s/${s.code}`} className={styles.row}>
                    <div className={styles.rowMain}>
                      <div className={styles.rowTitle}>
                        <span className={`${styles.pill} ${isClosed ? styles.pillWarn : styles.pillOk}`}>
                          {isClosed ? "Cerrada" : "Abierta"}
                        </span>
                        <span className={styles.code}>#{String(s.code || "").toUpperCase()}</span>
                        <span className={styles.topic}>{s.topic || "Charla"}</span>
                      </div>
                      <div className={styles.rowSub}>
                        {s.company?.name ? `${s.company.name} · ` : ""}
                        {s.location || "—"} · {fmtCL(s.session_date)}
                      </div>
                    </div>
                    <div className={styles.rowMeta}>{isClosed ? "PDF →" : "Admin →"}</div>
                  </Link>
                );
              })
            )}
          </div>
        </div>
      </section>

      <div className={styles.note}>
        Tip: entra a una charla reciente para ver <b>panel admin + firma + PDF</b>.
      </div>
    </div>
  );
}