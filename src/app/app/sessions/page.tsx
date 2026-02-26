"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/browser";
import styles from "./page.module.css";

type Session = {
  id: string;
  company_id?: string | null;
  code: string;
  topic?: string | null;
  location?: string | null;
  session_date?: string | null;
  created_at?: string | null;
  status?: string | null;
  closed_at?: string | null;
  attendees_count?: number | null;
  pdf_path?: string | null;
  companies?: { id?: string; name?: string | null; rut?: string | null; logo_path?: string | null } | null;
};

type StatusFilter = "all" | "open" | "closed";

function fmtInt(n: number) {
  try {
    return new Intl.NumberFormat("es-CL").format(n);
  } catch {
    return String(n);
  }
}

function fmtDateShort(iso?: string | null) {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("es-CL", { year: "numeric", month: "2-digit", day: "2-digit" });
  } catch {
    return "—";
  }
}

function isClosed(s: Session) {
  const st = (s.status || "").toLowerCase();
  return st === "closed" || !!s.closed_at;
}

async function fetchWithToken<T>(url: string, router: ReturnType<typeof useRouter>): Promise<T> {
  const { data } = await supabaseBrowser.auth.getSession();
  const token = data.session?.access_token;

  if (!token) {
    router.replace("/login");
    throw new Error("Unauthorized");
  }

  const res = await fetch(url, {
    cache: "no-store",
    headers: { Authorization: `Bearer ${token}` },
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((json as any)?.error || "Error al cargar");
  return json as T;
}

export default function SessionsPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);

  const [q, setQ] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");

  useEffect(() => {
    let alive = true;

    (async () => {
      setLoading(true);
      setErr(null);
      try {
        const data = await fetchWithToken<{ sessions?: Session[] }>("/api/app/sessions", router);
        if (!alive) return;
        setSessions(Array.isArray(data.sessions) ? data.sessions : []);
      } catch (e: any) {
        if (!alive) return;
        setErr(e?.message || "No se pudo cargar");
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [router]);

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();

    return sessions.filter((s) => {
      const closed = isClosed(s);
      if (status === "open" && closed) return false;
      if (status === "closed" && !closed) return false;

      if (!qq) return true;
      const companyName = (s.companies?.name || "").toLowerCase();
      return (
        (s.topic || "").toLowerCase().includes(qq) ||
        (s.code || "").toLowerCase().includes(qq) ||
        companyName.includes(qq)
      );
    });
  }, [sessions, q, status]);

  const counts = useMemo(() => {
    const total = sessions.length;
    const open = sessions.filter((s) => !isClosed(s)).length;
    const closed = total - open;
    return { total, open, closed };
  }, [sessions]);

  return (
    <div className={styles.page}>
      <div className={styles.head}>
        <div>
          <div className={styles.kicker}>Charlas</div>
          <h1 className={styles.h1}>Mis Charlas</h1>
          <p className={styles.sub}>Crea, abre el QR y cierra con firma (PDF final).</p>
        </div>

        <div className={styles.headActions}>
          <Link href="/app" className="btn btnGhost">
            ← Dashboard
          </Link>
          <Link href="/app/sessions/new" className="btn btnCta">
            + Nueva charla
          </Link>
        </div>
      </div>

      {err ? <div className={styles.errBox}>{err}</div> : null}

      <div className={styles.toolbar}>
        <input
          className="input"
          placeholder="Buscar por charla, código o empresa…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />

        <div className={styles.filters}>
          <button
            type="button"
            className={`${styles.filterBtn} ${status === "all" ? styles.filterBtnActive : ""}`}
            onClick={() => setStatus("all")}
          >
            Todas ({fmtInt(counts.total)})
          </button>
          <button
            type="button"
            className={`${styles.filterBtn} ${status === "open" ? styles.filterBtnActive : ""}`}
            onClick={() => setStatus("open")}
          >
            Abiertas ({fmtInt(counts.open)})
          </button>
          <button
            type="button"
            className={`${styles.filterBtn} ${status === "closed" ? styles.filterBtnActive : ""}`}
            onClick={() => setStatus("closed")}
          >
            Cerradas ({fmtInt(counts.closed)})
          </button>
        </div>
      </div>

      <div className={styles.scroller}>
        {loading ? (
          <div className={styles.skel}>Cargando…</div>
        ) : filtered.length === 0 ? (
          <div className={styles.empty}>No hay resultados. Prueba con otro filtro.</div>
        ) : (
          <div className={styles.grid}>
            {filtered.map((s) => {
              const closed = isClosed(s);
              const badge = closed ? "Cerrada" : "Abierta";
              const attendees = Number(s.attendees_count) || 0;
              const companyName = s.companies?.name || "—";

              return (
                <div key={s.id} className={styles.card}>
                  <div className={styles.cardTop}>
                    <div className={styles.title}>{s.topic || "Charla"}</div>
                    <div className={`${styles.badge} ${closed ? styles.badgeClosed : styles.badgeOpen}`}>{badge}</div>
                  </div>

                  <div className={styles.meta}>
                    {companyName} · Código {s.code}
                  </div>
                  <div className={styles.meta}>
                    {fmtInt(attendees)} asistentes · {fmtDateShort(s.session_date || s.created_at)}
                  </div>

                  <div className={styles.actions}>
                    <a className={styles.btn} href={`/c/${s.code}`} target="_blank" rel="noreferrer">
                      Abrir
                    </a>
                    <a className={styles.btnPrimary} href={`/admin/s/${s.code}`} target="_blank" rel="noreferrer">
                      Firmar
                    </a>
                    {s.pdf_path ? (
                      <Link className={styles.btnGhost} href="/app/pdfs">
                        PDF
                      </Link>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
