"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/browser";
import EditCompanyModal, { Company } from "@/components/app/EditCompanyModal";
import styles from "./page.module.css";

export default function AppHome() {
  const router = useRouter();
  const sp = useSearchParams();

  const [loading, setLoading] = useState(true);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [email, setEmail] = useState<string | null>(null);

  // Modal edit
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);

  // form create
  const [name, setName] = useState("");
  const [rut, setRut] = useState("");
  const [address, setAddress] = useState("");

  const [contactName, setContactName] = useState("");
  const [contactRut, setContactRut] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");

  // logo (por ahora lo guardamos después cuando conectemos bucket)
  const [logoFile, setLogoFile] = useState<File | null>(null);

  const logoPreview = useMemo(() => {
    if (!logoFile) return null;
    return URL.createObjectURL(logoFile);
  }, [logoFile]);

  useEffect(() => {
    const e = sp.get("e");
    if (e) setError(decodeURIComponent(e));
  }, [sp]);

  async function getTokenOrRedirect() {
    const { data } = await supabaseBrowser.auth.getSession();
    const session = data.session;

    if (!session?.access_token) {
      router.replace("/login");
      return null;
    }

    setEmail(session.user?.email ?? null);
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

    // ✅ Clave: aseguramos que venga id y lo guardamos completo
    const list: Company[] = (json?.companies ?? []).filter((c: any) => c?.id);

    setCompanies(list);
    setLoading(false);
  }

  useEffect(() => {
    loadCompanies();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function logout() {
    await supabaseBrowser.auth.signOut();
    router.replace("/login");
  }

  async function createCompany(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!name.trim()) return setError("Nombre empresa es obligatorio.");

    const token = await getTokenOrRedirect();
    if (!token) return;

    const payload = {
      name: name.trim(),
      rut: rut.trim() ? rut.trim() : null,
      address: address.trim() ? address.trim() : null,

      contact_name: contactName.trim() ? contactName.trim() : null,
      contact_rut: contactRut.trim() ? contactRut.trim() : null,
      contact_email: contactEmail.trim() ? contactEmail.trim() : null,
      contact_phone: contactPhone.trim() ? contactPhone.trim() : null,

      // logo_path lo conectamos cuando hagamos el bucket
      logo_path: null,
    };

    const res = await fetch("/api/app/companies", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });

    const json = await res.json().catch(() => null);

    if (!res.ok) {
      setError(json?.error || "No se pudo crear empresa");
      return;
    }

    // reset
    setName("");
    setRut("");
    setAddress("");
    setContactName("");
    setContactRut("");
    setContactEmail("");
    setContactPhone("");
    setLogoFile(null);

    await loadCompanies();
  }

  function openCompany(companyId: string) {
    router.push(`/app/company/${companyId}`);
  }

  function openEdit(company: Company) {
    // ✅ aquí está el fix: guardamos el objeto completo (incluye id)
    setEditingCompany(company);
  }

  function logoPublicUrl(logo_path: string | null) {
    if (!logo_path) return null;
    const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!base) return null;

    // si guardaste con prefijo, lo limpiamos
    const clean = logo_path.replace(/^company-logos\//, "");
    return `${base}/storage/v1/object/public/company-logos/${clean}`;
  }

  return (
    <div className={styles.page}>
      <div className={styles.topbar}>
        <div className={styles.topbarTitle}>Dashboard</div>

        <div className={styles.topbarRight}>
          {email && <div className={styles.email}>{email}</div>}
          <button className={styles.logoutBtn} onClick={logout}>
            → Salir
          </button>
        </div>
      </div>

      {error && <div className={styles.error}>{error}</div>}

      <div className={styles.kpis}>
        <div className={styles.kpi}>
          <div className={styles.kpiIcon}>🏢</div>
          <div>
            <div className={styles.kpiTitle}>Empresas</div>
            <div className={styles.kpiSub}>Clientes, sucursales y contacto</div>
          </div>
          <div className={styles.kpiBadge}>{companies.length}</div>
        </div>

        <div className={styles.kpi}>
          <div className={styles.kpiIcon}>📋</div>
          <div>
            <div className={styles.kpiTitle}>Charlas</div>
            <div className={styles.kpiSub}>Crea y cierra con firma</div>
          </div>
          <div className={styles.kpiBadgeMuted}>Pronto</div>
        </div>

        <div className={styles.kpi}>
          <div className={styles.kpiIcon}>🪪</div>
          <div>
            <div className={styles.kpiTitle}>Asistencia</div>
            <div className={styles.kpiSub}>Formulario público por QR</div>
          </div>
          <div className={styles.kpiBadgeMuted}>Pronto</div>
        </div>

        <div className={styles.kpi}>
          <div className={styles.kpiIcon}>📄</div>
          <div>
            <div className={styles.kpiTitle}>PDF Final</div>
            <div className={styles.kpiSub}>Registro + firmas + logo</div>
          </div>
          <div className={styles.kpiBadgeMuted}>Pronto</div>
        </div>
      </div>

      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <div className={styles.cardTitle}>Crear empresa</div>
          <div className={styles.cardSub}>
            Completa los datos del cliente y su contacto principal
          </div>
        </div>

        <form onSubmit={createCompany} className={styles.form}>
          <div className={styles.sectionTitle}>Datos Empresa</div>

          <div className={styles.grid2}>
            <div className={styles.field}>
              <label className={styles.label}>Nombre empresa</label>
              <input
                className={styles.input}
                placeholder="Ej: Automotora Berríos"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            <div className={styles.field}>
              <label className={styles.label}>RUT empresa</label>
              <input
                className={styles.input}
                placeholder="Ej: 76.123.456-7"
                value={rut}
                onChange={(e) => setRut(e.target.value)}
              />
            </div>

            <div className={styles.field}>
              <label className={styles.label}>Dirección empresa</label>
              <input
                className={styles.input}
                placeholder="Ej: Puerto Montt"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
              />
            </div>

            <div className={styles.field}>
              <label className={styles.label}>Logo empresa</label>
              <input
                className={styles.file}
                type="file"
                accept="image/*"
                onChange={(e) => setLogoFile(e.target.files?.[0] ?? null)}
              />
              {logoPreview && (
                <div className={styles.previewWrap}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img className={styles.previewImg} src={logoPreview} alt="preview" />
                </div>
              )}
            </div>
          </div>

          <div className={styles.sectionTitle}>Contacto Principal</div>

          <div className={styles.grid2}>
            <div className={styles.field}>
              <label className={styles.label}>Nombre contacto</label>
              <input
                className={styles.input}
                placeholder="Ej: Juan Pérez"
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
              />
            </div>

            <div className={styles.field}>
              <label className={styles.label}>RUT contacto</label>
              <input
                className={styles.input}
                placeholder="Ej: 12.345.678-9"
                value={contactRut}
                onChange={(e) => setContactRut(e.target.value)}
              />
            </div>

            <div className={styles.field}>
              <label className={styles.label}>Mail contacto</label>
              <input
                className={styles.input}
                placeholder="Ej: contacto@empresa.cl"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
              />
            </div>

            <div className={styles.field}>
              <label className={styles.label}>Teléfono contacto</label>
              <input
                className={styles.input}
                placeholder="Ej: +56 9 1234 5678"
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
              />
            </div>
          </div>

          <button className={styles.submit} type="submit">
            Guardar empresa
          </button>
        </form>
      </div>

      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <div className={styles.cardTitle}>Tus empresas</div>
          <div className={styles.cardSub}>Selecciona una empresa para administrar sus charlas</div>
        </div>

        {loading ? (
          <div className={styles.muted}>Cargando…</div>
        ) : !companies.length ? (
          <div className={styles.muted}>Aún no creas ninguna empresa.</div>
        ) : (
          <div className={styles.gridCompanies}>
            {companies.map((c) => {
              const logoUrl = logoPublicUrl(c.logo_path);
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
                        {c.address ? `— ${c.address}` : "— Sin dirección"}
                      </div>
                      <div className={styles.companyMeta}>
                        Contacto: {c.contact_name ?? "—"} · {c.contact_email ?? "—"}
                      </div>
                    </div>
                  </div>

                  <div className={styles.companyBottom}>
                    <div className={styles.companyCreated}>
                      Creada: {new Date(c.created_at).toLocaleString("es-CL")}
                    </div>

                    <div className={styles.companyActions}>
                      <button
                        type="button"
                        className={styles.editBtn}
                        onClick={() => openEdit(c)}
                      >
                        Editar
                      </button>

                      <button
                        type="button"
                        className={styles.openBtn}
                        onClick={() => openCompany(c.id)}
                      >
                        Abrir →
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className={styles.footer}>Creado por Claudio Lizama © 2026</div>

      {/* ✅ Modal Edit (la clave está en pasar company COMPLETO) */}
      <EditCompanyModal
        open={!!editingCompany}
        company={editingCompany}
        onClose={() => setEditingCompany(null)}
        onSaved={loadCompanies}
      />
    </div>
  );
}