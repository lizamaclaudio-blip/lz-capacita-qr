"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { cleanRut, isValidRut } from "@/lib/rut";
import styles from "./page.module.css";

export default function CreateCompanyPage() {
  const router = useRouter();

  const [email, setEmail] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // form create
  const [name, setName] = useState("");
  const [rut, setRut] = useState("");
  const [address, setAddress] = useState("");

  const [contactName, setContactName] = useState("");
  const [contactRut, setContactRut] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");

  const [logoFile, setLogoFile] = useState<File | null>(null);

  const logoPreview = useMemo(() => {
    if (!logoFile) return null;
    return URL.createObjectURL(logoFile);
  }, [logoFile]);

  async function getTokenOrRedirect() {
    const { data } = await supabaseBrowser.auth.getSession();
    const session = data.session;

    if (!session?.access_token) {
      router.replace("/login");
      return null;
    }

    setEmail(session.user?.email ?? null);
    setUserId(session.user?.id ?? null);
    return session.access_token;
  }

  useEffect(() => {
    getTokenOrRedirect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function createCompany(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!name.trim()) return setError("Razón social / nombre empresa es obligatorio.");

    // RUT empresa: requerido + validado
    const rutRaw = rut.trim();
    const rutCleaned = rutRaw ? cleanRut(rutRaw) : "";
    if (!rutCleaned) return setError("RUT empresa es obligatorio.");
    if (!isValidRut(rutCleaned)) return setError("RUT empresa inválido.");

    // RUT contacto: opcional pero validado si viene
    const contactRutRaw = contactRut.trim();
    const contactRutCleaned = contactRutRaw ? cleanRut(contactRutRaw) : null;
    if (contactRutCleaned && !isValidRut(contactRutCleaned)) return setError("RUT contacto inválido.");

    const token = await getTokenOrRedirect();
    if (!token) return;

    const { data: s } = await supabaseBrowser.auth.getSession();
    const uid = s.session?.user?.id ?? userId;

    const payload = {
      name: name.trim(),
      rut: rutCleaned,
      address: address.trim() ? address.trim() : null,

      contact_name: contactName.trim() ? contactName.trim() : null,
      contact_rut: contactRutCleaned,
      contact_email: contactEmail.trim() ? contactEmail.trim() : null,
      contact_phone: contactPhone.trim() ? contactPhone.trim() : null,

      // logo_path lo conectamos luego (bucket)
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

    // Si hay logo, lo subimos a Storage y luego guardamos logo_path
    const companyId: string | null = json?.company?.id ?? null;

    if (logoFile && companyId && uid) {
      try {
        const safeName = String(logoFile.name || "logo")
          .toLowerCase()
          .replace(/[^a-z0-9.\-_]/g, "-")
          .slice(0, 80);

        const path = `${uid}/${companyId}/${Date.now()}-${safeName}`;

        const up = await supabaseBrowser.storage
          .from("company-logos")
          .upload(path, logoFile, { upsert: true, contentType: logoFile.type || "image/png" });

        if (up.error) throw up.error;

        // Guardar en DB
        await fetch(`/api/app/companies/${companyId}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ logo_path: path }),
        });
      } catch (e: any) {
        // Empresa ya creada. Solo avisamos.
        setError(`Empresa creada, pero el logo no se pudo subir: ${e?.message || "Error"}`);
        // igual continuamos al listado
      }
    }

    router.push("/app/companies");
  }

  return (
    <div className={styles.page}>
      <div className={styles.headerRow}>
        <div>
          <div className={styles.title}>Crear empresa</div>
          <div className={styles.sub}>Completa los datos del cliente y su contacto principal</div>
        </div>

        {email && <div className={styles.muted}>{email}</div>}
      </div>

      {error && <div className={styles.error}>{error}</div>}

      <div className={styles.card}>
        <form onSubmit={createCompany} className={styles.form}>
          <div className={styles.sectionTitle}>Datos Empresa</div>

          <div className={styles.grid2}>
            <div className={styles.field}>
              <label className={styles.label}>Razón social / Nombre empresa</label>
              <input
                className={styles.input}
                placeholder="Ej: Automotora Berríos"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            <div className={styles.field}>
              <label className={styles.label}>RUT empresa *</label>
              <input
                className={styles.input}
                placeholder="Ej: 76.123.456-7"
                value={rut}
                onChange={(e) => setRut(e.target.value)}
                required
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

          <div className={styles.actions}>
            <button type="button" className={styles.secondary} onClick={() => router.push("/app")}>
              ← Volver
            </button>
            <button className={styles.submit} type="submit">
              Guardar empresa
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}