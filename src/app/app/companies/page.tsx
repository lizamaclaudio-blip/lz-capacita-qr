"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/browser";
import EditCompanyModal, { Company } from "@/components/app/EditCompanyModal";
import styles from "./page.module.css";

type Session = {
  id: string;
  company_id?: string | null;
  attendees_count?: number | null;
  pdf_path?: string | null;
};

type PdfItem = {
  id: string;
  company_id?: string | null;
};

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

function fmtInt(n: number) {
  try {
    return new Intl.NumberFormat("es-CL").format(n);
  } catch {
    return String(n);
  }
}

function companyLogoPublicUrl(logo_path?: string | null) {
  if (!logo_path) return null;
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!base) return null;
  const clean = String(logo_path).replace(/^company-logos\//, "");
  return `${base}/storage/v1/object/public/company-logos/${clean}`;
}

export default function CompaniesPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [companies, setCompanies] = useState<Company[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [pdfs, setPdfs] = useState<PdfItem[]>([]);

  const [q, setQ] = useState("");

  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState<Company | null>(null);

  async function reloadAll() {
    setLoading(true);
    setErr(null);
    try {
      const c = await fetchWithToken<{ companies?: Company[] }>("/api/app/companies", router);
      const s = await fetchWithToken<{ sessions?: any[] }>("/api/app/sessions", router);

      let p: { pdfs?: any[] } = {};
      try {
        p = await fetchWithToken<{ pdfs?: any[] }>("/api/app/pdfs", router);
      } catch {
        p = {};
      }

      setCompanies(Array.isArray(c.companies) ? c.companies : []);
      setSessions(Array.isArray(s.sessions) ? s.sessions : []);
      setPdfs(Array.isArray(p.pdfs) ? p.pdfs : []);
    } catch (e: any) {
      setErr(e?.message || "No se pudo cargar");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    reloadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const statsByCompany = useMemo(() => {
    const map: Record<string, { sessions: number; attendees: number; pdfs: number }> = {};

    for (const s of sessions) {
      const cid = String((s as any).company_id || "");
      if (!cid) continue;
      map[cid] = map[cid] || { sessions: 0, attendees: 0, pdfs: 0 };
      map[cid].sessions += 1;
      map[cid].attendees += Number((s as any).attendees_count) || 0;
      if ((s as any).pdf_path) map[cid].pdfs += 1;
    }

    // pdfs endpoint returns only with pdf_path, but we still count by company.
    for (const p of pdfs) {
      const cid = String((p as any).company_id || "");
      if (!cid) continue;
      map[cid] = map[cid] || { sessions: 0, attendees: 0, pdfs: 0 };
      map[cid].pdfs += 1;
    }

    return map;
  }, [sessions, pdfs]);

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();
    if (!qq) return companies;

    return companies.filter((c) => {
      const name = (c.name || "").toLowerCase();
      const rut = (c.rut || "").toLowerCase();
      return name.includes(qq) || rut.includes(qq);
    });
  }, [companies, q]);

  function openEdit(c: Company) {
    setEditing(c);
    setEditOpen(true);
  }

  return (
    <div className={styles.page}>
      <div className={styles.head}>
        <div>
          <div className={styles.kicker}>Empresas</div>
          <h1 className={styles.h1}>Mis Empresas</h1>
          <p className={styles.sub}>Tarjetas compactas (logo · nombre · RUT).</p>
        </div>

        <div className={styles.headActions}>
          <Link href="/app" className="btn btnGhost">
            ← Dashboard
          </Link>
          <Link href="/app/companies/new" className="btn btnPrimary">
            + Nueva empresa
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
          placeholder="Buscar por nombre o RUT…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <button type="button" className={styles.refreshBtn} onClick={reloadAll} disabled={loading}>
          {loading ? "…" : "Actualizar"}
        </button>
      </div>

      <div className={styles.scroller}>
        {loading ? (
          <div className={styles.skel}>Cargando…</div>
        ) : filtered.length === 0 ? (
          <div className={styles.empty}>No hay empresas. Crea la primera ✅</div>
        ) : (
          <div className={styles.grid}>
            {filtered.map((c) => {
              const logo = companyLogoPublicUrl((c as any).logo_path);
              const st = statsByCompany[c.id] || { sessions: 0, attendees: 0, pdfs: 0 };

              return (
                <div key={c.id} className={styles.card}>
                  <div className={styles.cardTop}>
                    <div className={styles.logoBox} aria-hidden="true">
                      {logo ? <img className={styles.logoImg} src={logo} alt="" /> : <div className={styles.logoFallback}>LZ</div>}
                    </div>

                    <div className={styles.cardMeta}>
                      <div className={styles.title}>{c.name || "Empresa"}</div>
                      <div className={styles.subMeta}>{c.rut ? `RUT: ${c.rut}` : "RUT: —"}</div>
                    </div>

                    <div className={styles.cardActions}><Link href={`/app/company/${c.id}`} className={styles.openBtn}>Abrir</Link><button type="button" className={styles.editBtn} onClick={() => openEdit(c)}>Editar</button></div>
                  </div>

                  <div className={styles.pills}>
                    <span className={styles.pill}>{fmtInt(st.sessions)} charlas</span>
                    <span className={styles.pill}>{fmtInt(st.attendees)} asistentes</span>
                    <span className={styles.pill}>{fmtInt(st.pdfs)} PDFs</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {editOpen && editing ? (
        <EditCompanyModal
          open={editOpen}
          company={editing}
          onClose={() => {
            setEditOpen(false);
            setEditing(null);
          }}
          onSaved={() => {
            setEditOpen(false);
            setEditing(null);
            reloadAll();
          }}
        />
      ) : null}
    </div>
  );
}
