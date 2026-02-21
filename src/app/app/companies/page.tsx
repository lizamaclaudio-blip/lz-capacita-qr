"use client";

import { useEffect, useMemo, useState } from "react";
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
    // clave: pasar el company completo con id
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
      {error && <div className={styles.error}>{error}</div>}

      <div className={styles.headerRow}>
        <div>
          <div className={styles.title}>Mis empresas</div>
          <div className={styles.sub}>Selecciona una empresa para administrar sus charlas</div>
        </div>

        <button className={styles.primary} onClick={() => router.push("/app/companies/new")}>
          ➕ Crear empresa
        </button>
      </div>

      {loading ? (
        <div className={styles.muted}>Cargando…</div>
      ) : !companies.length ? (
        <div className={styles.muted}>Aún no creas ninguna empresa.</div>
      ) : (
        <div className={styles.gridCompanies}>
          {companies.map((c) => {
            const logoUrl = logoPublicUrl((c as any).logo_path ?? null);
            const initial = (c.name?.trim()?.[0] ?? "E").toUpperCase();

            return (
              <div key={c.id} className={styles.companyCard}>
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
                      {(c as any).address ? `— ${(c as any).address}` : "— Sin dirección"}
                    </div>
                    <div className={styles.companyMeta}>
                      Contacto: {(c as any).contact_name ?? "—"} · {(c as any).contact_email ?? "—"}
                    </div>
                  </div>
                </div>

                <div className={styles.companyBottom}>
                  <div className={styles.companyCreated}>
                    Creada: {new Date((c as any).created_at).toLocaleString("es-CL")}
                  </div>

                  <div className={styles.companyActions}>
                    <button type="button" className={styles.editBtn} onClick={() => openEdit(c)}>
                      Editar
                    </button>

                    <button type="button" className={styles.openBtn} onClick={() => openCompany(c.id)}>
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