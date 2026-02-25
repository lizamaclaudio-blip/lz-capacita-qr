"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/browser";
import EditCompanyModal, { Company } from "@/components/app/EditCompanyModal";
import styles from "./page.module.css";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isUuid(v: unknown) {
  return typeof v === "string" && UUID_RE.test(v.trim());
}

function fmtCL(iso?: string | null) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("es-CL");
  } catch {
    return "—";
  }
}

type TypeFilter = "all" | "hq" | "branch";
type SortKey = "newest" | "oldest" | "az";

export default function CompaniesPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [editingCompany, setEditingCompany] = useState<Company | null>(null);

  // UI controls
  const [q, setQ] = useState("");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [sortKey, setSortKey] = useState<SortKey>("newest");

  async function getTokenOrRedirect() {
    const { data } = await supabaseBrowser.auth.getSession();
    const session = data.session;

    if (!session?.access_token) {
      router.replace("/login");
      return null;
    }
    return session.access_token;
  }

  async function loadCompanies() {
    setLoading(true);
    setError(null);

    const token = await getTokenOrRedirect();
    if (!token) return;

    const res = await fetch("/api/app/companies", {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });

    const json = await res.json().catch(() => null);

    if (!res.ok) {
      setCompanies([]);
      setLoading(false);
      setError(json?.error || "No se pudo cargar empresas");
      return;
    }

    const list: Company[] = (json?.companies ?? []).filter((c: any) => c?.id && isUuid(c.id));
    setCompanies(list);
    setLoading(false);
  }

  useEffect(() => {
    loadCompanies();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function openCompany(companyId: unknown) {
    const id = typeof companyId === "string" ? companyId.trim() : "";

    if (!isUuid(id)) {
      setError("⚠️ No pude abrir la empresa (ID inválido). Actualiza e intenta nuevamente.");
      return;
    }

    // ✅ Ruta canónica
    router.push(`/app/company/${id}`);
  }

  function openEdit(company: Company) {
    setEditingCompany(company);
  }

  function logoPublicUrl(logo_path: string | null) {
    if (!logo_path) return null;
    const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!base) return null;

    const clean = String(logo_path).replace(/^company-logos\//, "");
    return `${base}/storage/v1/object/public/company-logos/${clean}`;
  }

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    let list = [...companies];

    if (typeFilter !== "all") {
      list = list.filter((c: any) => (c.company_type ?? "hq") === typeFilter);
    }

    if (query) {
      list = list.filter((c: any) => {
        const hay = [
          c.name,
          c.legal_name,
          c.rut,
          c.address,
          c.contact_name,
          c.contact_email,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return hay.includes(query);
      });
    }

    list.sort((a: any, b: any) => {
      if (sortKey === "az") {
        const an = (a?.name ?? "").toString().toLowerCase();
        const bn = (b?.name ?? "").toString().toLowerCase();
        return an.localeCompare(bn);
      }

      const ad = a?.created_at ? new Date(a.created_at).getTime() : 0;
      const bd = b?.created_at ? new Date(b.created_at).getTime() : 0;

      if (sortKey === "oldest") return ad - bd;
      return bd - ad; // newest
    });

    return list;
  }, [companies, q, typeFilter, sortKey]);

  const countLabel = useMemo(() => {
    const total = companies.length;
    const shown = filtered.length;
    if (loading) return "Cargando…";
    if (!q && typeFilter === "all") return `${total} empresa(s)`;
    return `${shown} de ${total}`;
  }, [companies.length, filtered.length, loading, q, typeFilter]);

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.head}>
        <div>
          <div className={styles.kicker}>Empresas</div>
          <h1 className={styles.h1}>Mis empresas</h1>
          <p className={styles.sub}>Selecciona una empresa para ver resumen, charlas y trabajadores.</p>
        </div>

        <div className={styles.headActions}>
          <div className={styles.counter}>{countLabel}</div>
          <button className="btn btnCta" onClick={() => router.push("/app/companies/new")}>
            ➕ Crear empresa
          </button>
        </div>
      </div>

      {/* Toolbar */}
      <div className={styles.toolbar}>
        <div className={styles.searchWrap}>
          <span className={styles.searchIcon}>⌕</span>
          <input
            className={styles.searchInput}
            placeholder="Buscar por nombre, RUT, dirección, contacto…"
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
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as TypeFilter)}
          >
            <option value="all">Todas</option>
            <option value="hq">Casa matriz</option>
            <option value="branch">Sucursal</option>
          </select>

          <select
            className={styles.select}
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value as SortKey)}
          >
            <option value="newest">Más nuevas</option>
            <option value="oldest">Más antiguas</option>
            <option value="az">A–Z</option>
          </select>

          <button className="btn btnGhost" type="button" onClick={loadCompanies}>
            Actualizar
          </button>
        </div>
      </div>

      {/* States */}
      {error ? <div className={styles.errBox}>{error}</div> : null}

      {loading ? (
        <div className={styles.stateCard}>Cargando empresas…</div>
      ) : filtered.length === 0 ? (
        <div className={styles.stateCard}>
          {companies.length === 0 ? (
            <>
              Aún no tienes empresas. Crea la primera ✅{" "}
              <button className={styles.inlineLink} onClick={() => router.push("/app/companies/new")}>
                Crear empresa
              </button>
            </>
          ) : (
            <>No hay resultados con los filtros actuales.</>
          )}
        </div>
      ) : (
        <div className={styles.grid}>
          {filtered.map((c: any) => {
            const logoUrl = logoPublicUrl(c.logo_path ?? null);
            const initial = (c.name?.trim()?.[0] ?? "E").toUpperCase();

            const type: string | null = c.company_type ?? "hq";
            const isBranch = type === "branch";

            return (
              <div key={c.id} className={styles.card}>
                <div className={styles.cardTop}>
                  <div className={styles.avatar}>
                    {logoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={logoUrl} alt="logo" className={styles.logoImg} />
                    ) : (
                      <div className={styles.initial}>{initial}</div>
                    )}
                  </div>

                  <div className={styles.info}>
                    <div className={styles.nameRow}>
                      <div className={styles.name}>{c.name || "Empresa"}</div>
                      <span className={`${styles.pill} ${isBranch ? styles.pillBranch : styles.pillHQ}`}>
                        {isBranch ? "📍 Sucursal" : "🏢 Casa matriz"}
                      </span>
                    </div>

                    <div className={styles.meta}>
                      {c.legal_name ? `Razón social: ${c.legal_name}` : "Razón social: —"}
                    </div>

                    <div className={styles.meta}>
                      {c.rut ? `RUT: ${c.rut}` : "RUT: —"} {c.address ? `· ${c.address}` : ""}
                    </div>

                    <div className={styles.meta}>
                      {c.contact_name || c.contact_email ? (
                        <>
                          👤 {c.contact_name ?? "—"} · {c.contact_email ?? "—"}
                        </>
                      ) : (
                        <>👤 Contacto: —</>
                      )}
                    </div>
                  </div>
                </div>

                <div className={styles.cardBottom}>
                  <div className={styles.created}>Creada: {fmtCL(c.created_at)}</div>

                  <div className={styles.actions}>
                    <button type="button" className="btn btnGhost" onClick={() => openEdit(c)}>
                      Editar
                    </button>

                    <button type="button" className="btn btnPrimary" onClick={() => openCompany(c.id)}>
                      Abrir →
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <EditCompanyModal
        open={!!editingCompany}
        company={editingCompany}
        onClose={() => setEditingCompany(null)}
        onSaved={loadCompanies}
      />
    </div>
  );
}