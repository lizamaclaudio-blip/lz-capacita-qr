"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { cleanRut, isValidRut } from "@/lib/rut";
import { fileToDataUrl } from "@/lib/file";

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

  // Para sucursales: listamos empresas del usuario (idealmente HQ cuando DB tenga company_type)
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

    // Si más adelante tienes company_type, filtramos HQ; si no, mostramos todas
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

    // Validación rápida client-side
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
    <div className="max-w-5xl mx-auto space-y-4">
      <div className="glass card flex items-start justify-between gap-4">
        <div>
          <div className="text-2xl font-black">Crear empresa</div>
          <div className="text-sm opacity-70 font-extrabold">
            Razón social + RUT validado + logo. (Glass premium ✨)
          </div>
        </div>

        <div className="flex items-center gap-3">
          {email && <div className="text-xs font-extrabold opacity-60">{email}</div>}
          <button type="button" className="btn" onClick={() => router.push("/app")}>
            ← Volver
          </button>
        </div>
      </div>

      {(error || ok) && (
        <div
          className={`glass card ${
            error ? "border border-red-200/70 bg-red-50/60" : "border border-emerald-200/70 bg-emerald-50/60"
          }`}
        >
          <div className={`text-sm font-extrabold ${error ? "text-red-700" : "text-emerald-800"}`}>
            {error || ok}
          </div>
        </div>
      )}

      <div className="glass card">
        <form onSubmit={createCompany} className="space-y-5">
          {/* Tipo empresa */}
          <div>
            <div className="text-lg font-black">Tipo de empresa</div>
            <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <button
                type="button"
                className={`btn ${companyType === "hq" ? "btnPrimary" : ""}`}
                style={companyType !== "hq" ? { background: "rgba(255,255,255,.65)", border: "1px solid rgba(15,23,42,.12)" } : undefined}
                onClick={() => setCompanyType("hq")}
              >
                🏢 Casa matriz
              </button>

              <button
                type="button"
                className={`btn ${companyType === "branch" ? "btnPrimary" : ""}`}
                style={companyType !== "branch" ? { background: "rgba(255,255,255,.65)", border: "1px solid rgba(15,23,42,.12)" } : undefined}
                onClick={() => setCompanyType("branch")}
              >
                📍 Sucursal
              </button>
            </div>

            {companyType === "branch" && (
              <div className="mt-3">
                <label className="text-xs font-extrabold opacity-70">Casa matriz</label>
                <select
                  className="input mt-1"
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

                {noHq && (
                  <div className="mt-2 text-sm font-extrabold text-amber-800">
                    ⚠️ No tienes empresas para usar como casa matriz aún. Crea una casa matriz primero.
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Datos empresa */}
          <div>
            <div className="text-lg font-black">Datos de la empresa</div>

            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="text-xs font-extrabold opacity-70">Nombre comercial</label>
                <input
                  className="input mt-1"
                  placeholder="Ej: Automotora Berríos"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>

              <div>
                <label className="text-xs font-extrabold opacity-70">Razón social</label>
                <input
                  className="input mt-1"
                  placeholder="Ej: Automotora Berríos SpA"
                  value={legalName}
                  onChange={(e) => setLegalName(e.target.value)}
                  required
                />
              </div>

              <div>
                <label className="text-xs font-extrabold opacity-70">RUT empresa</label>
                <input
                  className="input mt-1"
                  placeholder="Ej: 76.123.456-7"
                  value={rut}
                  onChange={(e) => setRut(e.target.value)}
                  required
                />
                <div className="mt-1 text-[11px] font-extrabold opacity-60">
                  Se valida el dígito verificador.
                </div>
              </div>

              <div>
                <label className="text-xs font-extrabold opacity-70">Dirección</label>
                <input
                  className="input mt-1"
                  placeholder="Ej: Puerto Montt"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  required
                />
              </div>

              <div className="sm:col-span-2">
                <label className="text-xs font-extrabold opacity-70">Logo (PNG/JPG, máx 2MB)</label>
                <input
                  className="input mt-1"
                  type="file"
                  accept="image/png,image/jpeg,image/jpg"
                  onChange={(e) => setLogoFile(e.target.files?.[0] ?? null)}
                />

                {logoPreview && (
                  <div className="mt-3 flex items-center gap-3">
                    <div className="h-16 w-28 rounded-2xl overflow-hidden border border-white/30 bg-white/60">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={logoPreview} alt="logo preview" className="h-full w-full object-contain p-2" />
                    </div>
                    <div className="text-xs font-extrabold opacity-70">
                      Preview del logo. Se guardará y aparecerá en Mis empresas, QR y PDF.
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Contacto */}
          <div>
            <div className="text-lg font-black">Contacto principal (opcional)</div>

            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="text-xs font-extrabold opacity-70">Nombre contacto</label>
                <input
                  className="input mt-1"
                  placeholder="Ej: Juan Pérez"
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                />
              </div>

              <div>
                <label className="text-xs font-extrabold opacity-70">RUT contacto</label>
                <input
                  className="input mt-1"
                  placeholder="Ej: 12.345.678-9"
                  value={contactRut}
                  onChange={(e) => setContactRut(e.target.value)}
                />
              </div>

              <div>
                <label className="text-xs font-extrabold opacity-70">Email contacto</label>
                <input
                  className="input mt-1"
                  placeholder="Ej: contacto@empresa.cl"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  inputMode="email"
                />
              </div>

              <div>
                <label className="text-xs font-extrabold opacity-70">Teléfono contacto</label>
                <input
                  className="input mt-1"
                  placeholder="Ej: +56 9 1234 5678"
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                  inputMode="tel"
                />
              </div>
            </div>
          </div>

          {/* Acciones */}
          <div className="flex flex-wrap items-center justify-end gap-3 pt-2">
            <button type="button" className="btn" onClick={() => router.push("/app")}>
              Cancelar
            </button>

            <button type="submit" className="btn btnCta" disabled={saving}>
              {saving ? "Guardando..." : "Guardar empresa"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}