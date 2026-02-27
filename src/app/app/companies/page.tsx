"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
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

function timeOf(iso?: string | null) {
  if (!iso) return 0;
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : 0;
}

function BuildingIcon() {
  return (
    <svg
      className={styles.buildingIcon}
      viewBox="0 0 64 64"
      role="img"
      aria-label="Empresas"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="b1" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="rgba(99,102,241,0.95)" />
          <stop offset="1" stopColor="rgba(20,184,166,0.85)" />
        </linearGradient>
        <linearGradient id="b2" x1="1" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="rgba(245,158,11,0.95)" />
          <stop offset="1" stopColor="rgba(99,102,241,0.55)" />
        </linearGradient>
      </defs>
      <rect x="8" y="6" width="48" height="52" rx="16" fill="rgba(255,255,255,0.10)" />
      <path
        d="M20 52V22c0-2 1.2-3.8 3-4.6l12-5.3c1.3-.6 2.7-.6 4 0l3 1.3c1.8.8 3 2.6 3 4.6v34"
        fill="url(#b1)"
        opacity="0.95"
      />
      <path d="M14 52V28c0-1.7 1-3.2 2.5-3.9l3.5-1.6V52" fill="url(#b2)" opacity="0.95" />
      <path d="M44 52V24l4 1.8c1.5.7 2.5 2.2 2.5 3.9v22" fill="rgba(255,255,255,0.18)" />
      <g opacity="0.9">
        {[
          [26, 22],
          [34, 22],
          [26, 30],
          [34, 30],
          [26, 38],
          [34, 38],
        ].map(([x, y], i) => (
          <rect key={i} x={x} y={y} width="5" height="5" rx="1.5" fill="rgba(255,255,255,0.75)" />
        ))}
      </g>
      <rect x="30" y="46" width="8" height="6" rx="2" fill="rgba(6,15,35,0.55)" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" className={styles.searchIcon} aria-hidden="true">
      <path
        d="M10.5 18a7.5 7.5 0 1 1 0-15 7.5 7.5 0 0 1 0 15Zm0-2a5.5 5.5 0 1 0 0-11 5.5 5.5 0 0 0 0 11Zm7.9 4.5-4.2-4.2 1.4-1.4 4.2 4.2-1.4 1.4Z"
        fill="currentColor"
      />
    </svg>
  );
}

export default function CompaniesPage() {
  const router = useRouter();
  const searchRef = useRef<HTMLInputElement | null>(null);

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

    for (const p of pdfs) {
      const cid = String((p as any).company_id || "");
      if (!cid) continue;
      map[cid] = map[cid] || { sessions: 0, attendees: 0, pdfs: 0 };
      map[cid].pdfs += 1;
    }

    return map;
  }, [sessions, pdfs]);

  const ordered = useMemo(() => {
    const copy = [...companies];
    copy.sort((a, b) => timeOf(b.created_at) - timeOf(a.created_at));
    return copy;
  }, [companies]);

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();
    if (!qq) return ordered;

    return ordered.filter((c) => {
      const name = (c.name || "").toLowerCase();
      const rut = (c.rut || "").toLowerCase();
      return name.includes(qq) || rut.includes(qq);
    });
  }, [ordered, q]);

  function openEdit(c: Company) {
    setEditing(c);
    setEditOpen(true);
  }

  function openCompany(companyId: string) {
    router.push(`/app/company/${companyId}`);
  }

  function activateSearch() {
    searchRef.current?.focus();
  }

  return (
    <div className={styles.page}>
      <div className={styles.head}>
        <div className={styles.titleWrap}>
          <BuildingIcon />
          <div className={styles.titleText}>
            <h1 className={styles.h1}>Mis Empresas</h1>
            <p className={styles.sub}>Gestiona tus empresas.</p>
          </div>
        </div>

        <div className={styles.headActions}>
          <Link href="/app/companies/new" className="btn btnPrimary">
            + Nueva empresa
          </Link>
        </div>
      </div>

      {err ? <div className={styles.errBox}>{err}</div> : null}

      <div className={styles.toolbar}>
        <input
          ref={searchRef}
          className="input"
          placeholder="Buscar por nombre o RUT…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") setQ("");
          }}
        />
        <button
          type="button"
          className={styles.searchBtn}
          onClick={activateSearch}
          title="Buscar"
          aria-label="Buscar"
        >
          <SearchIcon />
        </button>
      </div>

      <div className={styles.scroller}>
        {loading ? (
          <div className={styles.skel}>Cargando…</div>
        ) : filtered.length === 0 ? (
          <div className={styles.empty}>No hay empresas. Crea la primera ✅</div>
        ) : (
          <div className={styles.list}>
            {filtered.map((c) => {
              const logo = companyLogoPublicUrl((c as any).logo_path);
              const st = statsByCompany[c.id] || { sessions: 0, attendees: 0, pdfs: 0 };

              return (
                <div
                  key={c.id}
                  className={styles.row}
                  role="link"
                  tabIndex={0}
                  aria-label={`Abrir ${c.name || "empresa"}`}
                  onClick={() => openCompany(c.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      openCompany(c.id);
                    }
                  }}
                >
                  <div className={styles.logoBox} aria-hidden="true">
                    {logo ? (
                      <img className={styles.logoImg} src={logo} alt="" />
                    ) : (
                      <div className={styles.logoFallback}>LZ</div>
                    )}
                  </div>

                  <div className={styles.main}>
                    <div className={styles.line}>
                      <div className={styles.title} title={c.name || ""}>
                        {c.name || "Empresa"}
                      </div>

                      <div className={styles.rut} title={c.rut || ""}>
                        {c.rut ? `RUT: ${c.rut}` : "RUT: —"}
                      </div>

                      <div className={styles.pills}>
                        <span className={styles.pill}>{fmtInt(st.sessions)} charlas</span>
                        <span className={styles.pill}>{fmtInt(st.attendees)} asistentes</span>
                        <span className={styles.pill}>{fmtInt(st.pdfs)} PDFs</span>
                      </div>
                    </div>
                  </div>

                  <div className={styles.actions} onClick={(e) => e.stopPropagation()}>
                    <button type="button" className={styles.editBtn} onClick={() => openEdit(c)}>
                      Editar
                    </button>
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