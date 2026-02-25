"use client";

import { useEffect, useMemo, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { cleanRut, isValidRut } from "@/lib/rut";
import { fileToDataUrl } from "@/lib/file";
import styles from "./EditCompanyModal.module.css";

export type Company = {
  id: string;
  name: string;
  legal_name?: string | null;
  rut?: string | null;
  address?: string | null;

  company_type?: "hq" | "branch" | string | null;
  parent_company_id?: string | null;

  contact_name?: string | null;
  contact_rut?: string | null;
  contact_email?: string | null;
  contact_phone?: string | null;

  logo_path?: string | null;

  created_at?: string | null;
};

type Props = {
  open: boolean;
  company: Company | null;
  onClose: () => void;
  onSaved: () => void;
};

type CompanyLite = { id: string; name: string; rut?: string | null; company_type?: string | null };

export default function EditCompanyModal({ open, company, onClose, onSaved }: Props) {
  const [saving, setSaving] = useState(false);
  const [loadingParents, setLoadingParents] = useState(false);

  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [legalName, setLegalName] = useState("");
  const [rut, setRut] = useState("");
  const [address, setAddress] = useState("");

  const [companyType, setCompanyType] = useState<"hq" | "branch">("hq");
  const [parentCompanyId, setParentCompanyId] = useState("");

  const [contactName, setContactName] = useState("");
  const [contactRut, setContactRut] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");

  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [parents, setParents] = useState<CompanyLite[]>([]);

  const logoPreview = useMemo(() => {
    if (!logoFile) return null;
    return URL.createObjectURL(logoFile);
  }, [logoFile]);

  useEffect(() => {
    return () => {
      if (logoPreview) URL.revokeObjectURL(logoPreview);
    };
  }, [logoPreview]);

  // ✅ Evita scroll del body cuando el modal está abierto
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  function logoPublicUrl(logo_path: string | null | undefined) {
    if (!logo_path) return null;
    const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!base) return null;

    const clean = String(logo_path).replace(/^company-logos\//, "");
    return `${base}/storage/v1/object/public/company-logos/${clean}`;
  }

  async function getToken() {
    const { data } = await supabaseBrowser.auth.getSession();
    return data.session?.access_token ?? null;
  }

  async function loadParentOptions() {
    const token = await getToken();
    if (!token) return;

    setLoadingParents(true);
    setErr(null);

    const res = await fetch("/api/app/companies", {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });

    const json = await res.json().catch(() => null);
    setLoadingParents(false);

    if (!res.ok) {
      setParents([]);
      setErr(json?.error || "No se pudieron cargar empresas (casa matriz).");
      return;
    }

    const list: CompanyLite[] = (json?.companies ?? []).filter((c: any) => c?.id && c.id !== company?.id);
    const hq = list.filter((c) => (c.company_type ? c.company_type === "hq" : true));
    setParents(hq);
  }

  useEffect(() => {
    if (!open || !company) return;

    setErr(null);
    setOk(null);
    setSaving(false);

    setName(company.name ?? "");
    setLegalName(company.legal_name ?? "");
    setRut(company.rut ?? "");
    setAddress(company.address ?? "");

    const t = (company.company_type ?? "hq") as any;
    setCompanyType(t === "branch" ? "branch" : "hq");
    setParentCompanyId(company.parent_company_id ?? "");

    setContactName(company.contact_name ?? "");
    setContactRut(company.contact_rut ?? "");
    setContactEmail(company.contact_email ?? "");
    setContactPhone(company.contact_phone ?? "");

    setLogoFile(null);

    if (t === "branch") loadParentOptions();
    else setParents([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, company?.id]);

  useEffect(() => {
    if (!open || !company) return;
    if (companyType === "branch") loadParentOptions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyType, open, company?.id]);

  function validate() {
    const n = name.trim();
    const ln = legalName.trim();
    const addr = address.trim();

    if (!n) return "Nombre comercial es obligatorio.";
    if (!ln) return "Razón social es obligatoria.";

    const r = cleanRut(rut.trim());
    if (!r) return "RUT empresa es obligatorio.";
    if (!isValidRut(r)) return "RUT empresa inválido (dígito verificador incorrecto).";

    if (!addr) return "Dirección empresa es obligatoria.";

    if (companyType === "branch") {
      if (!parentCompanyId) return "Selecciona la casa matriz para esta sucursal.";
    }

    const cRut = cleanRut(contactRut.trim());
    if (contactRut.trim() && !isValidRut(cRut)) return "RUT contacto inválido.";

    if (logoFile && logoFile.size > 2_000_000) return "Logo demasiado pesado (máx 2MB).";

    return null;
  }

  async function uploadLogoIfAny(token: string) {
    if (!logoFile) return null;

    const dataUrl = await fileToDataUrl(logoFile);

    const res = await fetch("/api/app/companies/upload-logo", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ data_url: dataUrl }),
    });

    const json = await res.json().catch(() => null);
    if (!res.ok) throw new Error(json?.error || "No se pudo subir el logo.");

    return json?.logo_path as string;
  }

  async function save() {
    if (!company) return;

    setErr(null);
    setOk(null);

    const v = validate();
    if (v) return setErr(v);

    const token = await getToken();
    if (!token) return setErr("Sesión no encontrada. Vuelve a iniciar sesión.");

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
      };

      if (logo_path) payload.logo_path = logo_path;

      const res = await fetch(`/api/app/companies/${company.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });

      const json = await res.json().catch(() => null);

      if (!res.ok) {
        setSaving(false);
        return setErr(json?.error || "No se pudo guardar la empresa.");
      }

      // ✅ Mensaje + cerrar automático
      setOk("✅ Guardado exitoso.");
      onSaved();

      setSaving(false);

      // deja un momento para que se note el ok, y cierra
      setTimeout(() => onClose(), 650);
    } catch (e: any) {
      setSaving(false);
      setErr(e?.message || "Error inesperado al guardar.");
    }
  }

  if (!open) return null;

  const currentLogoUrl = logoPublicUrl(company?.logo_path ?? null);
  const preview = logoPreview || currentLogoUrl;

  const noParents = companyType === "branch" && !loadingParents && parents.length === 0;

  return (
    <div className={styles.backdrop} onMouseDown={onClose}>
      <div className={styles.modal} onMouseDown={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <div>
            <div className={styles.title}>Editar empresa</div>
            <div className={styles.sub}>Actualiza datos, contacto y logo.</div>
          </div>

          <button className={styles.close} onClick={onClose} title="Cerrar">
            ✕
          </button>
        </div>

        {/* ✅ body scroll interno */}
        <div className={styles.body}>
          {err && <div className={styles.alert}>{err}</div>}
          {ok && <div className={styles.ok}>{ok}</div>}

          {!company ? (
            <div className={styles.empty}>No hay empresa seleccionada.</div>
          ) : (
            <>
              <div className={styles.section}>Tipo de empresa</div>
              <div className={styles.grid2}>
                <div className={styles.field}>
                  <label className={styles.label}>Tipo</label>
                  <select className="input" value={companyType} onChange={(e) => setCompanyType(e.target.value as any)}>
                    <option value="hq">🏢 Casa matriz</option>
                    <option value="branch">📍 Sucursal</option>
                  </select>
                  <div className={styles.hint}>Si es sucursal, debe vincularse a una casa matriz.</div>
                </div>

                <div className={styles.field}>
                  <label className={styles.label}>Casa matriz</label>
                  <select
                    className="input"
                    value={parentCompanyId}
                    onChange={(e) => setParentCompanyId(e.target.value)}
                    disabled={companyType !== "branch" || loadingParents}
                  >
                    <option value="">
                      {companyType !== "branch"
                        ? "No aplica"
                        : loadingParents
                        ? "Cargando..."
                        : "Selecciona casa matriz"}
                    </option>
                    {parents.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} {p.rut ? `(${p.rut})` : ""}
                      </option>
                    ))}
                  </select>
                  {noParents && (
                    <div className={styles.hint} style={{ color: "rgba(180,83,9,.95)" }}>
                      ⚠️ No hay empresas disponibles para casa matriz. Crea una primero.
                    </div>
                  )}
                </div>
              </div>

              <div className={styles.section}>Datos de empresa</div>
              <div className={styles.grid2}>
                <div className={styles.field}>
                  <label className={styles.label}>Nombre comercial</label>
                  <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
                </div>

                <div className={styles.field}>
                  <label className={styles.label}>Razón social</label>
                  <input className="input" value={legalName} onChange={(e) => setLegalName(e.target.value)} />
                </div>

                <div className={styles.field}>
                  <label className={styles.label}>RUT empresa</label>
                  <input
                    className="input"
                    value={rut}
                    onChange={(e) => setRut(e.target.value)}
                    placeholder="76.123.456-7"
                  />
                  <div className={styles.hint}>Se valida dígito verificador.</div>
                </div>

                <div className={styles.field}>
                  <label className={styles.label}>Dirección</label>
                  <input className="input" value={address} onChange={(e) => setAddress(e.target.value)} />
                </div>
              </div>

              <div className={styles.section}>Logo empresa</div>
              <div className={styles.grid2}>
                <div className={styles.field} style={{ gridColumn: "1 / -1" }}>
                  <div className={styles.logoRow}>
                    <div className={styles.logoBox}>
                      {preview ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={preview} alt="logo" className={styles.logoImg} />
                      ) : (
                        <div className={styles.hint}>Sin logo</div>
                      )}
                    </div>

                    <div style={{ flex: 1, minWidth: 240 }}>
                      <label className={styles.label}>Subir / cambiar logo (PNG/JPG, máx 2MB)</label>
                      <input
                        className={styles.file}
                        type="file"
                        accept="image/png,image/jpeg,image/jpg"
                        onChange={(e) => setLogoFile(e.target.files?.[0] ?? null)}
                      />
                      <div className={styles.hint}>Se verá en Mis empresas, página pública y PDF.</div>
                    </div>
                  </div>
                </div>
              </div>

              <div className={styles.section}>Contacto (opcional)</div>
              <div className={styles.grid2}>
                <div className={styles.field}>
                  <label className={styles.label}>Nombre contacto</label>
                  <input className="input" value={contactName} onChange={(e) => setContactName(e.target.value)} />
                </div>

                <div className={styles.field}>
                  <label className={styles.label}>RUT contacto</label>
                  <input
                    className="input"
                    value={contactRut}
                    onChange={(e) => setContactRut(e.target.value)}
                    placeholder="12.345.678-9"
                  />
                </div>

                <div className={styles.field}>
                  <label className={styles.label}>Email contacto</label>
                  <input
                    className="input"
                    value={contactEmail}
                    onChange={(e) => setContactEmail(e.target.value)}
                    placeholder="contacto@empresa.cl"
                  />
                </div>

                <div className={styles.field}>
                  <label className={styles.label}>Teléfono contacto</label>
                  <input
                    className="input"
                    value={contactPhone}
                    onChange={(e) => setContactPhone(e.target.value)}
                    placeholder="+56 9 1234 5678"
                  />
                </div>
              </div>

              <div className={styles.debug}>
                <span className={styles.mono}>ID:</span> <span className={styles.mono}>{company.id}</span>
              </div>

              {/* ✅ footer sticky */}
              <div className={styles.actions}>
                <button type="button" className="btn" onClick={onClose} disabled={saving}>
                  Cancelar
                </button>
                <button type="button" className="btn btnCta" onClick={save} disabled={saving}>
                  {saving ? "Guardando..." : "Guardar cambios"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}