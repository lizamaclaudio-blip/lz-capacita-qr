"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/browser";
import styles from "./page.module.css";

type PdfItem = {
  id: string;
  company_id?: string | null;
  code?: string | null;
  topic?: string | null;
  session_date?: string | null;
  created_at?: string | null;
  status?: string | null;
  closed_at?: string | null;
  pdf_path?: string | null;
  pdf_generated_at?: string | null;
  signed_url?: string | null;
  companies?: { name?: string | null; logo_path?: string | null; rut?: string | null } | null;
};

function fmtDateShort(iso?: string | null) {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("es-CL", { year: "numeric", month: "2-digit", day: "2-digit" });
  } catch {
    return "—";
  }
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

export default function PdfsPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [pdfs, setPdfs] = useState<PdfItem[]>([]);

  const [q, setQ] = useState("");

  useEffect(() => {
    let alive = true;

    (async () => {
      setLoading(true);
      setErr(null);
      try {
        const data = await fetchWithToken<{ pdfs?: PdfItem[] }>("/api/app/pdfs", router);
        if (!alive) return;
        setPdfs(Array.isArray(data.pdfs) ? data.pdfs : []);
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
    if (!qq) return pdfs;

    return pdfs.filter((p) => {
      const company = (p.companies?.name || "").toLowerCase();
      return (
        (p.topic || "").toLowerCase().includes(qq) ||
        (p.code || "").toLowerCase().includes(qq) ||
        company.includes(qq)
      );
    });
  }, [pdfs, q]);

  function openPdf(p: PdfItem) {
    if (!p.signed_url) return;
    window.open(p.signed_url, "_blank", "noopener,noreferrer");
  }

  return (
    <div className={styles.page}>
      <div className={styles.head}>
        <div>
          <div className={styles.kicker}>PDF</div>
          <h1 className={styles.h1}>Mis PDFs</h1>
          <p className={styles.sub}>Reportes cerrados y firmados (clic para abrir).</p>
        </div>

        <div className={styles.headActions}>
          <Link href="/app" className="btn btnGhost">
            ← Dashboard
          </Link>
          <Link href="/app/sessions" className="btn btnGhost">
            Ver charlas
          </Link>
        </div>
      </div>

      {err ? <div className={styles.errBox}>{err}</div> : null}

      <div className={styles.toolbar}>
        <input
          className="input"
          placeholder="Buscar por empresa, charla o código…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      <div className={styles.scroller}>
        {loading ? (
          <div className={styles.skel}>Cargando…</div>
        ) : filtered.length === 0 ? (
          <div className={styles.empty}>No hay PDFs disponibles.</div>
        ) : (
          <div className={styles.grid}>
            {filtered.map((p) => {
              const companyName = p.companies?.name || "—";
              return (
                <button
                  key={p.id}
                  type="button"
                  className={styles.card}
                  onClick={() => openPdf(p)}
                  disabled={!p.signed_url}
                  title={p.signed_url ? "Abrir PDF" : "PDF no disponible"}
                >
                  <div className={styles.cardTop}>
                    <div className={styles.title}>{p.topic || "PDF"}</div>
                    <div className={styles.badge}>Firmado</div>
                  </div>

                  <div className={styles.meta}>
                    {companyName} · {p.code ? `Código ${p.code}` : "—"}
                  </div>
                  <div className={styles.meta}>Generado: {fmtDateShort(p.pdf_generated_at)}</div>

                  <div className={styles.actions}>
                    <span className={styles.btnPrimary}>{p.signed_url ? "Ver PDF" : "No disponible"}</span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
