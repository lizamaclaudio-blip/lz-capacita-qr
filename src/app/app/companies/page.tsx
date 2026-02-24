"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/browser";
import EditCompanyModal, { Company } from "@/components/app/EditCompanyModal";
import styles from "./page.module.css";

export default function CompaniesPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [editingCompany, setEditingCompany] = useState<Company | null>(null);

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

    const list: Company[] = (json?.companies ?? []).filter((c: any) => c?.id);
    setCompanies(list);
    setLoading(false);
  }

  useEffect(() => {
    loadCompanies();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function openCompany(companyId: string) {
    router.push(`/app/company/${companyId}`);
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

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={`glass ${styles.headerCard}`}>
        <div>
          <div className={styles.title}>Mis empresas</div>
          <div className={styles.sub}>Selecciona una empresa para administrar sus charlas</div>
        </div>

        <button className="btn btnCta" onClick={() => router.push("/app/companies/new")}>
          ➕ Crear empresa
        </button>
      </div>

      {/* Estado */}
      {error && (
        <div className={`glass ${styles.stateCard} border border-red-200/70 bg-red-50/60`}>
          <div className="text-sm font-extrabold text-red-700">{error}</div>
        </div>
      )}

      {loading ? (
        <div className={`glass ${styles.stateCard}`}>
          <div className="opacity-70 font-extrabold">Cargando…</div>
        </div>
      ) : !companies.length ? (
        <div className={`glass ${styles.stateCard}`}>
          <div className="opacity-70 font-extrabold">Aún no creas ninguna empresa.</div>
        </div>
      ) : (
        <div className={styles.gridCompanies}>
          {companies.map((c: any) => {
            const logoUrl = logoPublicUrl(c.logo_path ?? null);
            const initial = (c.name?.trim()?.[0] ?? "E").toUpperCase();

            const type: string | null = c.company_type ?? null;
            const isBranch = type === "branch";
            const pillText = isBranch ? "📍 Sucursal" : "🏢 Casa matriz";

            return (
              <div key={c.id} className={`glass ${styles.companyCard}`}>
                <div className={styles.companyTop}>
                  <div className={styles.companyAvatar}>
                    {logoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={logoUrl} alt="logo" className={styles.companyLogo} />
                    ) : (
                      <div className={styles.companyInitial}>{initial}</div>
                    )}
                  </div>

                  <div className={styles.companyInfo}>
                    <div className={styles.companyName}>{c.name}</div>

                    <div className={styles.companyMeta}>
                      {c.legal_name ? `Razón social: ${c.legal_name}` : "Razón social: —"}
                    </div>

                    <div className={styles.companyMeta}>
                      {c.rut ? `RUT: ${c.rut}` : "RUT: —"} {c.address ? `· ${c.address}` : ""}
                    </div>

                    <div className={styles.metaRow}>
                      <span className={`${styles.pill} ${isBranch ? styles.pillBranch : styles.pillHQ}`}>
                        {pillText}
                      </span>

                      {c.contact_name || c.contact_email ? (
                        <span className={styles.pill}>
                          👤 {c.contact_name ?? "—"} · {c.contact_email ?? "—"}
                        </span>
                      ) : (
                        <span className={styles.pill}>👤 Contacto: —</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className={styles.companyBottom}>
                  <div className={styles.companyCreated}>
                    Creada: {c.created_at ? new Date(c.created_at).toLocaleString("es-CL") : "—"}
                  </div>

                  <div className={styles.companyActions}>
                    <button type="button" className="btn" onClick={() => openEdit(c)}>
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