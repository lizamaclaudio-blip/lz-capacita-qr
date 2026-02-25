"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/browser";
import styles from "./page.module.css";

type Session = {
  id: string;
  code: string;
  topic: string | null;
  location: string | null;
  session_date: string | null;
  trainer_name: string | null;
  status: string | null;
  closed_at: string | null;
  company_id: string | null;
  company?: { name?: string | null } | null;
  created_at?: string | null;
};

type StatusFilter = "all" | "open" | "closed";
type SortKey = "newest" | "oldest" | "az";

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

export default function SessionsPage() {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);

  // UI
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [sortKey, setSortKey] = useState<SortKey>("newest");

  const origin = useMemo(() => (typeof window !== "undefined" ? window.location.origin : ""), []);

  async function loadSessions() {
    setLoading(true);
    setErr(null);

    try {
      const s = await fetchWithToken<{ sessions?: Session[] }>("/api/app/sessions");
      setSessions(Array.isArray(s.sessions) ? s.sessions : []);
    } catch (e: any) {
      setSessions([]);
      setErr(e?.message || "No se pudieron cargar las charlas");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadSessions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // sin ruido
    }
  }

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    let list = [...sessions];

    list = list.map((s) => ({
      ...s,
      code: (s.code || "").toUpperCase(),
    }));

    if (statusFilter !== "all") {
      list = list.filter((s) => {
        const closed = (s.status || "").toLowerCase() === "closed" || !!s.closed_at;
        return statusFilter === "closed" ? closed : !closed;
      });
    }

    if (query) {
      list = list.filter((s) => {
        const hay = [
          s.code,
          s.topic,
          s.location,
          s.trainer_name,
          s.company?.name,
          s.status,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return hay.includes(query);
      });
    }

    list.sort((a, b) => {
      if (sortKey === "az") {
        const an = (a.topic ?? a.code ?? "").toLowerCase();
        const bn = (b.topic ?? b.code ?? "").toLowerCase();
        return an.localeCompare(bn);
      }

      const ad = a.session_date ? new Date(a.session_date).getTime() : 0;
      const bd = b.session_date ? new Date(b.session_date).getTime() : 0;

      if (sortKey === "oldest") return ad - bd;
      return bd - ad; // newest
    });

    return list;
  }, [sessions, q, statusFilter, sortKey]);

  const countLabel = useMemo(() => {
    if (loading) return "Cargando…";
    if (!q && statusFilter === "all") return `${sessions.length} charla(s)`;
    return `${filtered.length} de ${sessions.length}`;
  }, [loading, sessions.length, filtered.length, q, statusFilter]);

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.head}>
        <div>
          <div className={styles.kicker}>Charlas</div>
          <h1 className={styles.h1}>Mis charlas</h1>
          <p className={styles.sub}>
            Copia links, abre el admin para cierre con firma y genera PDF final.
          </p>
        </div>

        <div className={styles.headActions}>
          <div className={styles.counter}>{countLabel}</div>
          <Link href="/app/sessions/new" className="btn btnCta">
            ➕ Crear charla
          </Link>
        </div>
      </div>

      {/* Toolbar */}
      <div className={styles.toolbar}>
        <div className={styles.searchWrap}>
          <span className={styles.searchIcon}>⌕</span>
          <input
            className={styles.searchInput}
            placeholder="Buscar por código, tema, empresa, relator, estado…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          {q ? (
            <button className={styles.clearBtn} type="button" onClick={() => setQ("")} aria-label="Limpiar búsqueda">
              ✕
            </button>
          ) : null}
        </div>

        <div className={styles.filters}>
          <select
            className={styles.select}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
          >
            <option value="all">Todas</option>
            <option value="open">Abiertas</option>
            <option value="closed">Cerradas</option>
          </select>

          <select className={styles.select} value={sortKey} onChange={(e) => setSortKey(e.target.value as SortKey)}>
            <option value="newest">Más recientes</option>
            <option value="oldest">Más antiguas</option>
            <option value="az">A–Z</option>
          </select>

          <button className="btn btnGhost" type="button" onClick={loadSessions}>
            Actualizar
          </button>
        </div>
      </div>

      {err ? <div className={styles.errBox}>{err}</div> : null}

      {loading ? (
        <div className={styles.stateCard}>Cargando charlas…</div>
      ) : filtered.length === 0 ? (
        <div className={styles.stateCard}>
          {sessions.length === 0 ? (
            <>
              Aún no tienes charlas. Crea la primera ✅{" "}
              <Link className={styles.inlineLink} href="/app/sessions/new">
                Crear charla
              </Link>
            </>
          ) : (
            <>No hay resultados con los filtros actuales.</>
          )}
        </div>
      ) : (
        <div className={styles.grid}>
          {filtered.map((s) => {
            const code = (s.code || "").toUpperCase();
            const isClosed = (s.status || "").toLowerCase() === "closed" || !!s.closed_at;

            const qrLink = origin ? `${origin}/c/${code}` : `/c/${code}`;
            const adminLink = origin ? `${origin}/admin/s/${code}` : `/admin/s/${code}`;

            return (
              <div key={s.id} className={styles.card}>
                <div className={styles.cardHead}>
                  <div className={styles.titleRow}>
                    <span className={`${styles.pill} ${isClosed ? styles.pillClosed : styles.pillOpen}`}>
                      {isClosed ? "🔒 Cerrada" : "🟢 Abierta"}
                    </span>
                    <span className={styles.code}>#{code}</span>
                  </div>

                  <div className={styles.topic}>{s.topic || "Charla"}</div>
                  <div className={styles.meta}>
                    {s.company?.name ? `${s.company.name} · ` : ""}
                    {s.location || "—"} · {fmtCL(s.session_date)}
                  </div>
                  <div className={styles.meta}>
                    Relator: {s.trainer_name || "—"} {s.closed_at ? `· Cerrada: ${fmtCL(s.closed_at)}` : ""}
                  </div>
                </div>

                <div className={styles.cardActions}>
                  <button className={styles.iconBtn} type="button" onClick={() => copy(qrLink)} title="Copiar link QR">
                    📎 QR
                  </button>

                  <button
                    className={styles.iconBtn}
                    type="button"
                    onClick={() => copy(adminLink)}
                    title="Copiar link Admin"
                  >
                    📎 Admin
                  </button>

                  <a className={styles.iconBtn} href={qrLink} target="_blank" rel="noreferrer" title="Abrir QR">
                    ↗ QR
                  </a>

                  <Link className={`btn btnPrimary ${styles.openBtn}`} href={`/admin/s/${code}`}>
                    Abrir admin →
                  </Link>
                </div>

                <div className={styles.hint}>
                  Tip: el PDF final se genera dentro del admin con <b>passcode (RUT relator)</b>.
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}