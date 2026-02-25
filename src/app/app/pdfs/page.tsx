"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/browser";
import styles from "./page.module.css";

type SessionRow = {
  id: string;
  code: string;
  topic?: string | null;
  location?: string | null;
  trainer_name?: string | null;
  session_date?: string | null;
  status?: string | null;
  closed_at?: string | null;

  pdf_path?: string | null;
  pdf_generated_at?: string | null;

  company?: { name?: string | null } | null;
};

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

async function postWithToken<T>(url: string, body: any): Promise<T> {
  const { data } = await supabaseBrowser.auth.getSession();
  const token = data.session?.access_token;

  const res = await fetch(url, {
    method: "POST",
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((json as any)?.error || "Error");
  return json as T;
}

export default function PdfsPage() {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [rows, setRows] = useState<SessionRow[]>([]);

  // UI
  const [q, setQ] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("newest");

  async function load() {
    setLoading(true);
    setErr(null);

    try {
      // ✅ Usamos tu endpoint existente de sesiones y filtramos las que tienen pdf_path
      const s = await fetchWithToken<{ sessions?: SessionRow[] }>("/api/app/sessions");
      const list = Array.isArray(s.sessions) ? s.sessions : [];
      setRows(list.filter((x) => !!x.pdf_path));
    } catch (e: any) {
      setRows([]);
      setErr(e?.message || "No se pudieron cargar los PDFs");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    let list = [...rows];

    if (term) {
      list = list.filter((r) => {
        const hay = [
          r.code,
          r.topic,
          r.location,
          r.trainer_name,
          r.company?.name,
          r.pdf_path,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return hay.includes(term);
      });
    }

    list.sort((a, b) => {
      if (sortKey === "az") {
        const an = (a.topic ?? a.code ?? "").toLowerCase();
        const bn = (b.topic ?? b.code ?? "").toLowerCase();
        return an.localeCompare(bn);
      }

      const ad = new Date(a.pdf_generated_at ?? a.closed_at ?? a.session_date ?? 0).getTime();
      const bd = new Date(b.pdf_generated_at ?? b.closed_at ?? b.session_date ?? 0).getTime();

      if (sortKey === "oldest") return ad - bd;
      return bd - ad;
    });

    return list;
  }, [rows, q, sortKey]);

  const countLabel = useMemo(() => {
    if (loading) return "Cargando…";
    if (!q) return `${rows.length} PDF(s)`;
    return `${filtered.length} de ${rows.length}`;
  }, [loading, rows.length, filtered.length, q]);

  async function copy(text: string, msg = "Copiado ✅") {
    try {
      await navigator.clipboard.writeText(text);
      setNotice(msg);
      setTimeout(() => setNotice(null), 1400);
    } catch {
      setNotice("No se pudo copiar 😕");
      setTimeout(() => setNotice(null), 1400);
    }
  }

  async function openPdf(pdf_path: string) {
    setErr(null);
    try {
      const res = await postWithToken<{ ok: boolean; signed_url: string }>("/api/app/pdfs/sign", { pdf_path });
      if (!res?.signed_url) throw new Error("No recibí URL firmada");
      window.open(res.signed_url, "_blank", "noopener,noreferrer");
    } catch (e: any) {
      setErr(e?.message || "No se pudo abrir el PDF");
    }
  }

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.head}>
        <div>
          <div className={styles.kicker}>PDFs</div>
          <h1 className={styles.h1}>Reportes PDF</h1>
          <p className={styles.sub}>Accede a los PDFs finales generados desde el Admin de cada charla.</p>
        </div>

        <div className={styles.headActions}>
          <div className={styles.counter}>{countLabel}</div>
          <button className="btn btnGhost" type="button" onClick={load}>
            Actualizar
          </button>
        </div>
      </div>

      {err ? <div className={styles.errBox}>{err}</div> : null}
      {notice ? <div className={styles.okBox}>{notice}</div> : null}

      {/* Toolbar */}
      <div className={styles.toolbar}>
        <div className={styles.searchWrap}>
          <span className={styles.searchIcon}>⌕</span>
          <input
            className={styles.searchInput}
            placeholder="Buscar por código, tema, empresa, relator…"
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
          <select className={styles.select} value={sortKey} onChange={(e) => setSortKey(e.target.value as SortKey)}>
            <option value="newest">Más recientes</option>
            <option value="oldest">Más antiguos</option>
            <option value="az">A–Z</option>
          </select>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className={styles.stateCard}>Cargando PDFs…</div>
      ) : filtered.length === 0 ? (
        <div className={styles.stateCard}>
          {rows.length === 0 ? (
            <>
              Aún no tienes PDFs. Genera uno desde el Admin de una charla ✅{" "}
              <Link className={styles.inlineLink} href="/app/sessions">
                Ir a charlas
              </Link>
            </>
          ) : (
            <>No hay resultados con tu búsqueda.</>
          )}
        </div>
      ) : (
        <div className={styles.grid}>
          {filtered.map((r) => {
            const code = (r.code || "").toUpperCase();
            const companyName = r.company?.name ?? "Empresa";
            const when = r.pdf_generated_at ?? r.closed_at ?? r.session_date ?? null;

            const isClosed = (r.status || "").toLowerCase() === "closed" || !!r.closed_at;

            return (
              <div key={r.id} className={styles.card}>
                <div className={styles.cardHead}>
                  <div className={styles.titleRow}>
                    <span className={`${styles.pill} ${isClosed ? styles.pillClosed : styles.pillOpen}`}>
                      {isClosed ? "🔒 Cerrada" : "🟢 Abierta"}
                    </span>
                    <span className={styles.code}>#{code}</span>
                  </div>

                  <div className={styles.topic}>{r.topic || "Charla"}</div>
                  <div className={styles.meta}>
                    {companyName} · {r.location || "—"}
                  </div>
                  <div className={styles.meta}>
                    Relator: {r.trainer_name || "—"} · PDF: {fmtCL(when)}
                  </div>
                </div>

                <div className={styles.actions}>
                  <button
                    type="button"
                    className={styles.smallBtn}
                    onClick={() => copy(code, "Código copiado ✅")}
                    title="Copiar código"
                  >
                    📎 Código
                  </button>

                  <button
                    type="button"
                    className={styles.smallBtn}
                    onClick={() => copy(`/admin/s/${code}`, "Link admin copiado ✅")}
                    title="Copiar link admin"
                  >
                    📎 Admin
                  </button>

                  <button
                    type="button"
                    className={styles.smallBtnCta}
                    onClick={() => openPdf(String(r.pdf_path))}
                    title="Abrir PDF"
                  >
                    🧾 Abrir PDF
                  </button>

                  <Link className={styles.smallBtnPrimary} href={`/admin/s/${code}`}>
                    Ir a Admin →
                  </Link>
                </div>

                <div className={styles.hint}>
                  Nota: el PDF se genera/actualiza en Admin con el <b>passcode (RUT relator)</b>.
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}