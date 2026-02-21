"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/browser";
import styles from "./page.module.css";

export default function CreateCompanyPage() {
  const router = useRouter();

  const [email, setEmail] = useState<string | null>(null);
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
    return session.access_token;
  }

  useEffect(() => {
    getTokenOrRedirect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

    // al crear, lo mandamos a Mis empresas
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