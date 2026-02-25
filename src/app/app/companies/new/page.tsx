"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { cleanRut, isValidRut } from "@/lib/rut";
import { fileToDataUrl } from "@/lib/file";
import styles from "./page.module.css";

type Company = {
  id: string;
  name: string;
  legal_name?: string | null;
  rut?: string | null;
  logo_path?: string | null;
  company_type?: string | null;
};

export default function CreateCompanyPage() {
  const router = useRouter();

  const [email, setEmail] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Datos empresa
  const [name, setName] = useState(""); // Nombre comercial
  const [legalName, setLegalName] = useState(""); // Razón social
  const [rut, setRut] = useState("");
  const [address, setAddress] = useState("");

  const [companyType, setCompanyType] = useState<"hq" | "branch">("hq");
  const [parentCompanyId, setParentCompanyId] = useState<string>("");

  // Contacto
  const [contactName, setContactName] = useState("");
  const [contactRut, setContactRut] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");

  // Logo
  const [logoFile, setLogoFile] = useState<File | null>(null);

  // Para sucursales
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loadingCompanies, setLoadingCompanies] = useState(false);

  const logoPreview = useMemo(() => {
    if (!logoFile) return null;
    return URL.createObjectURL(logoFile);
  }, [logoFile]);

  useEffect(() => {
    return () => {
      if (logoPreview) URL.revokeObjectURL(logoPreview);
    };
  }, [logoPreview]);

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

  async function loadCompaniesForParent() {
    setLoadingCompanies(true);
    setError(null);

    const token = await getTokenOrRedirect();
    if (!token) return;

    const res = await fetch("/api/app/companies", {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });

    const json = await res.json().catch(() => null);
    setLoadingCompanies(false);

    if (!res.ok) {
      setError(json?.error || "No se pudieron cargar empresas");
      return;
    }

    const list: Company[] = json?.companies ?? [];
    const hq = list.filter((c) => (c.company_type ? c.company_type === "hq" : true));
    setCompanies(hq);
  }

  useEffect(() => {
    getTokenOrRedirect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (companyType === "branch") {
      loadCompaniesForParent();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyType]);

  function validate() {
    const n = name.trim();
    const ln = legalName.trim();
    const addr = address.trim();

    if (!n) return "Nombre comercial es obligatorio.";
    if (!ln) return "Razón social es obligatoria.";

    const rutClean = cleanRut(rut.trim());
    if (!rutClean) return "RUT empresa es obligatorio.";
    if (!isValidRut(rutClean)) return "RUT empresa inválido (dígito verificador incorrecto).";

    if (!addr) return "Dirección empresa es obligatoria.";

    if (companyType === "branch") {
      if (!parentCompanyId) return "Selecciona la casa matriz para esta sucursal.";
    }

    const cRut = cleanRut(contactRut.trim());
    if (contactRut.trim() && !isValidRut(cRut)) return "RUT contacto inválido.";

    return null;
  }

  async function uploadLogoIfAny(token: string) {
    if (!logoFile) return null;

    if (logoFile.size > 2_000_000) {
      throw new Error("Logo demasiado pesado (máx 2MB).");
    }

    const dataUrl = await fileToDataUrl(logoFile);

    const res = await fetch("/api/app/companies/upload-logo", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ data_url: dataUrl }),
    });

    const json = await res.json().catch(() => null);
    if (!res.ok) {
      throw new Error(json?.error || "No se pudo subir el logo");
    }

    return json?.logo_path as string;
  }

  async function createCompany(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setOk(null);

    const v = validate();
    if (v) {
      setError(v);
      return;
    }

    const token = await getTokenOrRedirect();
    if (!token) return;

    setSaving(true);

    try {
      const rutClean = cleanRut(rut.trim());
      const cRutClean = cleanRut(contactRut.trim());

      const logo_path = await uploadLogoIfAny(token);

      const payload: any = {
        name: name.trim(),
        legal_name: legalName.trim(),
        rut: rutClean,
        address: address.trim(),

        company_type: companyType,
        parent_company_id: companyType === "branch" ? parentCompanyId : null,

        contact_name: contactName.trim() ? contactName.trim() : null,
        contact_rut: contactRut.trim() ? cRutClean : null,
        contact_email: contactEmail.trim() ? contactEmail.trim() : null,
        contact_phone: contactPhone.trim() ? contactPhone.trim() : null,

        logo_path: logo_path ?? null,
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
      setSaving(false);

      if (!res.ok) {
        setError(json?.error || "No se pudo crear empresa");
        return;
      }

      setOk("✅ Empresa creada.");
      router.push("/app/companies");
    } catch (err: any) {
      setSaving(false);
      setError(err?.message || "Error inesperado al crear empresa");
    }
  }

  const noHq = companyType === "branch" && !loadingCompanies && companies.length === 0;

  return (
    <div className={styles.page}>
      <div className={styles.headCard}>
        <div>
          <div className={styles.kicker}>Empresas</div>
          <h1 className={styles.h1}>Crear empresa</h1>
          <p className={styles.sub}>Razón social + RUT validado + logo (aparece en QR y PDF).</p>
        </div>

        <div className={styles.headActions}>
          {email ? <div className={styles.emailPill}>{email}</div> : null}
          <button type="button" className="btn btnGhost" onClick={() => router.push("/app/companies")}>
            ← Volver
          </button>
        </div>
      </div>

      {(error || ok) ? (
        <div className={`${styles.alert} ${error ? styles.alertErr : styles.alertOk}`}>
          {error || ok}
        </div>
      ) : null}

      <div className={styles.grid}>
        <aside className={styles.aside}>
          <div className={styles.asideTitle}>Checklist</div>
          <div className={styles.asideItem}>✅ Nombre comercial</div>
          <div className={styles.asideItem}>✅ Razón social</div>
          <div className={styles.asideItem}>✅ RUT con DV válido</div>
          <div className={styles.asideItem}>✅ Dirección</div>
          <div className={styles.asideItem}>✅ Logo opcional (2MB)</div>

          <div className={styles.asideNote}>
            Tip: si creas una <b>Sucursal</b>, debes asociarla a una <b>Casa matriz</b>.
          </div>
        </aside>

        <div className={styles.formCard}>
          <form onSubmit={createCompany} className={styles.form}>
            {/* Tipo empresa */}
            <div className={styles.section}>
              <div className={styles.sectionTitle}>Tipo de empresa</div>

              <div className={styles.segment}>
                <button
                  type="button"
                  className={`${styles.segBtn} ${companyType === "hq" ? styles.segActive : ""}`}
                  onClick={() => setCompanyType("hq")}
                >
                  🏢 Casa matriz
                </button>

                <button
                  type="button"
                  className={`${styles.segBtn} ${companyType === "branch" ? styles.segActive : ""}`}
                  onClick={() => setCompanyType("branch")}
                >
                  📍 Sucursal
                </button>
              </div>

              {companyType === "branch" ? (
                <div className={styles.field}>
                  <label className={styles.label}>Casa matriz</label>
                  <select
                    className={`input ${styles.select}`}
                    value={parentCompanyId}
                    onChange={(e) => setParentCompanyId(e.target.value)}
                    disabled={loadingCompanies}
                  >
                    <option value="">{loadingCompanies ? "Cargando..." : "Selecciona casa matriz"}</option>
                    {companies.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} {c.rut ? `(${c.rut})` : ""}
                      </option>
                    ))}
                  </select>

                  {noHq ? (
                    <div className={styles.warn}>
                      ⚠️ No tienes empresas para usar como casa matriz aún. Crea una casa matriz primero.
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>

            {/* Datos empresa */}
            <div className={styles.section}>
              <div className={styles.sectionTitle}>Datos de la empresa</div>

              <div className={styles.row2}>
                <div className={styles.field}>
                  <label className={styles.label}>Nombre comercial</label>
                  <input
                    className="input"
                    placeholder="Ej: Automotora Berríos"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                </div>

                <div className={styles.field}>
                  <label className={styles.label}>Razón social</label>
                  <input
                    className="input"
                    placeholder="Ej: Automotora Berríos SpA"
                    value={legalName}
                    onChange={(e) => setLegalName(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className={styles.row2}>
                <div className={styles.field}>
                  <label className={styles.label}>RUT empresa</label>
                  <input
                    className="input"
                    placeholder="Ej: 76.123.456-7"
                    value={rut}
                    onChange={(e) => setRut(e.target.value)}
                    required
                  />
                  <div className={styles.hint}>Se valida el dígito verificador.</div>
                </div>

                <div className={styles.field}>
                  <label className={styles.label}>Dirección</label>
                  <input
                    className="input"
                    placeholder="Ej: Puerto Montt"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className={styles.field}>
                <label className={styles.label}>Logo (PNG/JPG, máx 2MB)</label>
                <input
                  className={`input ${styles.file}`}
                  type="file"
                  accept="image/png,image/jpeg,image/jpg"
                  onChange={(e) => setLogoFile(e.target.files?.[0] ?? null)}
                />

                {logoPreview ? (
                  <div className={styles.logoPreviewRow}>
                    <div className={styles.logoPreviewBox}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={logoPreview} alt="logo preview" className={styles.logoPreviewImg} />
                    </div>
                    <div className={styles.logoPreviewText}>
                      Preview del logo. Se verá en Mis empresas, QR y PDF.
                    </div>
                  </div>
                ) : null}
              </div>
            </div>

            {/* Contacto */}
            <div className={styles.section}>
              <div className={styles.sectionTitle}>Contacto principal (opcional)</div>

              <div className={styles.row2}>
                <div className={styles.field}>
                  <label className={styles.label}>Nombre contacto</label>
                  <input
                    className="input"
                    placeholder="Ej: Juan Pérez"
                    value={contactName}
                    onChange={(e) => setContactName(e.target.value)}
                  />
                </div>

                <div className={styles.field}>
                  <label className={styles.label}>RUT contacto</label>
                  <input
                    className="input"
                    placeholder="Ej: 12.345.678-9"
                    value={contactRut}
                    onChange={(e) => setContactRut(e.target.value)}
                  />
                </div>
              </div>

              <div className={styles.row2}>
                <div className={styles.field}>
                  <label className={styles.label}>Email contacto</label>
                  <input
                    className="input"
                    placeholder="Ej: contacto@empresa.cl"
                    value={contactEmail}
                    onChange={(e) => setContactEmail(e.target.value)}
                    inputMode="email"
                  />
                </div>

                <div className={styles.field}>
                  <label className={styles.label}>Teléfono contacto</label>
                  <input
                    className="input"
                    placeholder="Ej: +56 9 1234 5678"
                    value={contactPhone}
                    onChange={(e) => setContactPhone(e.target.value)}
                    inputMode="tel"
                  />
                </div>
              </div>
            </div>

            {/* Acciones */}
            <div className={styles.actions}>
              <button type="button" className="btn btnGhost" onClick={() => router.push("/app/companies")}>
                Cancelar
              </button>

              <button type="submit" className="btn btnCta" disabled={saving}>
                {saving ? "Guardando..." : "Guardar empresa"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}