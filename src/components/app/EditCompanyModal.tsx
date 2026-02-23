"use client";

import { useEffect, useMemo, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { cleanRut, isValidRut } from "@/lib/rut";
import styles from "./EditCompanyModal.module.css";

export type Company = {
  id: string;
  name: string;
  rut: string | null;
  address: string | null;

  contact_name: string | null;
  contact_rut: string | null;
  contact_email: string | null;
  contact_phone: string | null;

  logo_path: string | null;
  created_at: string;
};

export default function EditCompanyModal({
  open,
  company,
  onClose,
  onSaved,
}: {
  open: boolean;
  company: Company | null;
  onClose: () => void;
  onSaved: () => Promise<void> | void;
}) {
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  // ✅ La clave: el ID SIEMPRE viene desde company?.id
  const companyId = company?.id ?? null;

  // form state
  const [name, setName] = useState("");
  const [rut, setRut] = useState("");
  const [address, setAddress] = useState("");

  const [contactName, setContactName] = useState("");
  const [contactRut, setContactRut] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");

  // logo
  const [logoFile, setLogoFile] = useState<File | null>(null);

  const logoPreview = useMemo(() => {
    if (!logoFile) return null;
    return URL.createObjectURL(logoFile);
  }, [logoFile]);

  const currentLogoUrl = useMemo(() => {
    if (!company?.logo_path) return null;
    const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!base) return null;
    const clean = String(company.logo_path).replace(/^company-logos\//, "");
    return `${base}/storage/v1/object/public/company-logos/${clean}`;
  }, [company?.logo_path]);

  useEffect(() => {
    if (!open) return;

    setMsg(null);
    setLogoFile(null);

    // ✅ Si por alguna razón abren modal sin company
    if (!company) {
      setName("");
      setRut("");
      setAddress("");
      setContactName("");
      setContactRut("");
      setContactEmail("");
      setContactPhone("");
      return;
    }

    // ✅ Cargamos campos desde la empresa seleccionada
    setName(company.name ?? "");
    setRut(company.rut ?? "");
    setAddress(company.address ?? "");
    setContactName(company.contact_name ?? "");
    setContactRut(company.contact_rut ?? "");
    setContactEmail(company.contact_email ?? "");
    setContactPhone(company.contact_phone ?? "");
  }, [open, company]);

  if (!open) return null;

  async function getSessionOrThrow() {
    const { data } = await supabaseBrowser.auth.getSession();
    const session = data.session;
    if (!session?.access_token) throw new Error("Sesión expirada. Vuelve a iniciar sesión.");
    return session;
  }

  async function saveChanges() {
    setMsg(null);

    if (!companyId) {
      setMsg("Missing companyId (la empresa no tiene id).");
      return;
    }

    if (!name.trim()) {
      setMsg("El nombre de la empresa es obligatorio.");
      return;
    }

    // Validaciones RUT (si vienen)
    const rutRaw = rut.trim();
    const rutCleaned = rutRaw ? cleanRut(rutRaw) : null;
    if (rutCleaned && !isValidRut(rutCleaned)) {
      setMsg("RUT empresa inválido.");
      return;
    }

    const cRutRaw = contactRut.trim();
    const cRutCleaned = cRutRaw ? cleanRut(cRutRaw) : null;
    if (cRutCleaned && !isValidRut(cRutCleaned)) {
      setMsg("RUT contacto inválido.");
      return;
    }

    setSaving(true);
    try {
      const session = await getSessionOrThrow();
      const token = session.access_token;

      let logoPathToSave: string | null | undefined = undefined;
      if (logoFile && session.user?.id && companyId) {
        const safeName = String(logoFile.name || "logo")
          .toLowerCase()
          .replace(/[^a-z0-9.\-_]/g, "-")
          .slice(0, 80);

        const path = `${session.user.id}/${companyId}/${Date.now()}-${safeName}`;

        const up = await supabaseBrowser.storage
          .from("company-logos")
          .upload(path, logoFile, { upsert: true, contentType: logoFile.type || "image/png" });

        if (up.error) throw up.error;
        logoPathToSave = path;
      }

      const payload = {
        name: name.trim(),
        rut: rutCleaned,
        address: address.trim() ? address.trim() : null,

        contact_name: contactName.trim() ? contactName.trim() : null,
        contact_rut: cRutCleaned,
        contact_email: contactEmail.trim() ? contactEmail.trim() : null,
        contact_phone: contactPhone.trim() ? contactPhone.trim() : null,
        ...(typeof logoPathToSave !== "undefined" ? { logo_path: logoPathToSave } : {}),
      };

      const res = await fetch(`/api/app/companies/${companyId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const json = await res.json().catch(() => null);

      if (!res.ok) {
        setMsg(json?.error || "No se pudo guardar cambios");
        setSaving(false);
        return;
      }

      setMsg("✅ Cambios guardados.");
      await onSaved?.();
      // opcional: cerrar modal al guardar
      // onClose();
    } catch (e: any) {
      setMsg(e?.message || "Error guardando cambios");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={styles.backdrop} onMouseDown={onClose}>
      <div className={styles.modal} onMouseDown={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <div>
            <div className={styles.title}>
              Editar empresa · {company?.name ?? "—"}
            </div>
            <div className={styles.sub}>
              Edita los datos del cliente y su contacto principal
            </div>
          </div>

          <button className={styles.close} onClick={onClose} aria-label="Cerrar">
            ✕
          </button>
        </div>

        {msg && <div className={styles.alert}>{msg}</div>}

        {!company ? (
          <div className={styles.empty}>
            No se encontró la empresa seleccionada (company = null).
          </div>
        ) : (
          <>
            <div className={styles.section}>Datos Empresa</div>

            <div className={styles.grid2}>
              <div className={styles.field}>
                <label className={styles.label}>Nombre empresa</label>
                <input
                  className={styles.input}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>

              <div className={styles.field}>
                <label className={styles.label}>RUT empresa</label>
                <input
                  className={styles.input}
                  value={rut}
                  onChange={(e) => setRut(e.target.value)}
                />
              </div>

              <div className={styles.field}>
                <label className={styles.label}>Dirección empresa</label>
                <input
                  className={styles.input}
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                />
              </div>

              <div className={styles.field}>
                <label className={styles.label}>
                  Logo empresa
                </label>
                <input
                  className={styles.file}
                  type="file"
                  accept="image/*"
                  onChange={(e) => setLogoFile(e.target.files?.[0] ?? null)}
                />

                {(logoPreview || currentLogoUrl) && (
                  <div className={styles.previewWrap}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={logoPreview || currentLogoUrl || ""}
                      className={styles.previewImg}
                      alt="logo"
                    />
                  </div>
                )}
              </div>
            </div>

            <div className={styles.section}>Contacto Principal</div>

            <div className={styles.grid2}>
              <div className={styles.field}>
                <label className={styles.label}>Nombre contacto</label>
                <input
                  className={styles.input}
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                />
              </div>

              <div className={styles.field}>
                <label className={styles.label}>RUT contacto</label>
                <input
                  className={styles.input}
                  value={contactRut}
                  onChange={(e) => setContactRut(e.target.value)}
                />
              </div>

              <div className={styles.field}>
                <label className={styles.label}>Mail contacto</label>
                <input
                  className={styles.input}
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                />
              </div>

              <div className={styles.field}>
                <label className={styles.label}>Teléfono contacto</label>
                <input
                  className={styles.input}
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                />
              </div>
            </div>

            <div className={styles.actions}>
              <button className={styles.cancel} onClick={onClose}>
                Cancelar
              </button>

              <button
                className={styles.save}
                onClick={saveChanges}
                disabled={saving}
              >
                {saving ? "Guardando..." : "Guardar cambios"}
              </button>
            </div>

            {/* Debug útil para confirmar id */}
            <div className={styles.debug}>
              <b>Debug:</b> company.id = <span className={styles.mono}>{companyId ?? "null"}</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}