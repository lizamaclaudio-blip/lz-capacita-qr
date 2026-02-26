"use client";

import { useEffect, useMemo, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/browser";
import styles from "./page.module.css";

type Company = {
  id: string;
  created_at?: string | null;
};

type Session = {
  id: string;
  created_at?: string | null;
  session_date?: string | null;
  status?: string | null;
  closed_at?: string | null;
  attendees_count?: number | null;
  pdf_path?: string | null;
};

type PdfItem = {
  id: string;
  pdf_generated_at?: string | null;
};

function fmtInt(n: number) {
  try {
    return new Intl.NumberFormat("es-CL").format(n);
  } catch {
    return String(n);
  }
}

function toYMD(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseDate(iso?: string | null) {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  return new Date(t);
}

function buildDailySeries(opts: {
  rangeDays: number;
  items: any[];
  dateOf: (x: any) => Date | null;
  valueOf: (x: any) => number;
}) {
  const { rangeDays, items, dateOf, valueOf } = opts;

  const end = new Date();
  end.setHours(0, 0, 0, 0);

  const start = new Date(end);
  start.setDate(start.getDate() - (rangeDays - 1));

  const values: number[] = [];
  const map = new Map<string, number>();

  for (const it of items) {
    const d = dateOf(it);
    if (!d) continue;
    const dd = new Date(d);
    dd.setHours(0, 0, 0, 0);
    if (dd < start || dd > end) continue;
    const key = toYMD(dd);
    map.set(key, (map.get(key) ?? 0) + valueOf(it));
  }

  const cur = new Date(start);
  while (cur <= end) {
    values.push(map.get(toYMD(cur)) ?? 0);
    cur.setDate(cur.getDate() + 1);
  }

  return values;
}

function buildLinePath(values: number[], w: number, h: number, pad = 10) {
  const n = values.length;
  if (n < 2) return "";

  const max = Math.max(...values, 1);
  const innerW = w - pad * 2;
  const innerH = h - pad * 2;

  const pts = values.map((v, i) => {
    const x = pad + (innerW * i) / (n - 1);
    const y = pad + innerH - (innerH * v) / max;
    return { x, y };
  });

  return pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
}

function buildAreaPath(values: number[], w: number, h: number, pad = 10) {
  const line = buildLinePath(values, w, h, pad);
  if (!line) return "";
  const baseY = h - pad;
  return `${line} L${w - pad},${baseY} L${pad},${baseY} Z`;
}

function TrendChart({ values, tone }: { values: number[]; tone: "indigo" | "blue" | "teal" | "amber" }) {
  const w = 520;
  const h = 160;
  const line = useMemo(() => buildLinePath(values, w, h, 14), [values]);
  const area = useMemo(() => buildAreaPath(values, w, h, 14), [values]);

  return (
    <svg className={styles.chart} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" data-tone={tone}>
      <path className={styles.chartGrid} d={`M0 ${h - 1} H${w}`} />
      {area ? <path className={styles.chartArea} d={area} /> : null}
      {line ? <path className={styles.chartLine} d={line} /> : null}
    </svg>
  );
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

  useEffect(() => {
    let alive = true;

    (async () => {
      setLoading(true);
      setErr(null);

      try {
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
        setSessions(Array.isArray(s.sessions) ? (s.sessions as any) : []);
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

  const stats = useMemo(() => {
    const totalCompanies = companies.length;
    const totalSessions = sessions.length;
    const totalAttendees = sessions.reduce((acc, s) => acc + (Number(s.attendees_count) || 0), 0);
    const totalPdfs = pdfs.length;
    return { totalCompanies, totalSessions, totalAttendees, totalPdfs };
  }, [companies, sessions, pdfs]);

  const seriesCompanies = useMemo(
    () =>
      buildDailySeries({
        rangeDays: 30,
        items: companies,
        dateOf: (c) => parseDate(c.created_at),
        valueOf: () => 1,
      }),
    [companies]
  );

  const seriesSessions = useMemo(
    () =>
      buildDailySeries({
        rangeDays: 30,
        items: sessions,
        dateOf: (s) => parseDate(s.session_date || s.created_at),
        valueOf: () => 1,
      }),
    [sessions]
  );

  const seriesAttendees = useMemo(
    () =>
      buildDailySeries({
        rangeDays: 30,
        items: sessions,
        dateOf: (s) => parseDate(s.session_date || s.created_at),
        valueOf: (s) => Number(s.attendees_count) || 0,
      }),
    [sessions]
  );

  const seriesPdfs = useMemo(
    () =>
      buildDailySeries({
        rangeDays: 30,
        items: pdfs,
        dateOf: (p) => parseDate(p.pdf_generated_at),
        valueOf: () => 1,
      }),
    [pdfs]
  );

  if (loading) {
    return (
      <div className={styles.loading}>
        <div className={styles.loadingCard}>Cargando dashboard…</div>
      </div>
    );
  }

  if (err) {
    return (
      <div className={styles.loading}>
        <div className={styles.loadingCard}>❌ {err}</div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.head}>
        <div>
          <div className={styles.kicker}>Panel</div>
          <h1 className={styles.h1}>Dashboard</h1>
          <div className={styles.sub}>Empresas · Charlas · Evidencia (QR · firma · PDF)</div>
        </div>

        <div className={styles.actions}>
          <a className="btn btnGhost" href="/app/companies/new">+ Empresa</a>
          <a className="btn btnPrimary" href="/app/sessions/new">+ Charla</a>
        </div>
      </div>

      <div className={styles.grid}>
        <div className={styles.panel}>
          <div className={styles.panelHead}>
            <div className={styles.panelTitle}>Empresas</div>
            <div className={styles.panelValue}>{fmtInt(stats.totalCompanies)}</div>
          </div>
          <TrendChart values={seriesCompanies} tone="indigo" />
        </div>

        <div className={styles.panel}>
          <div className={styles.panelHead}>
            <div className={styles.panelTitle}>Charlas</div>
            <div className={styles.panelValue}>{fmtInt(stats.totalSessions)}</div>
          </div>
          <TrendChart values={seriesSessions} tone="blue" />
        </div>

        <div className={styles.panel}>
          <div className={styles.panelHead}>
            <div className={styles.panelTitle}>Asistentes</div>
            <div className={styles.panelValue}>{fmtInt(stats.totalAttendees)}</div>
          </div>
          <TrendChart values={seriesAttendees} tone="teal" />
        </div>

        <div className={styles.panel}>
          <div className={styles.panelHead}>
            <div className={styles.panelTitle}>PDFs</div>
            <div className={styles.panelValue}>{fmtInt(stats.totalPdfs)}</div>
          </div>
          <TrendChart values={seriesPdfs} tone="amber" />
        </div>
      </div>
    </div>
  );
}
