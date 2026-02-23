"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { QRCodeCanvas } from "qrcode.react";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { cleanRut, isValidRut } from "@/lib/rut";
import styles from "./page.module.css";

type Company = {
  id: string;
  name: string;
  address: string | null;
  logo_path: string | null;
};

export default function CreateSessionPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [companies, setCompanies] = useState<Company[]>([]);
  const [companyId, setCompanyId] = useState("");

  // form
  const [topic, setTopic] = useState("");
  const [trainerName, setTrainerName] = useState("");
  const [trainerRut, setTrainerRut] = useState(""); // ✅ nuevo
  const [location, setLocation] = useState("");
  const [sessionDate, setSessionDate] = useState(""); // datetime-local

  // result
  const [created, setCreated] = useState<null | {
    code: string;
    publicUrl: string;
    adminUrl: string;
  }>(null);

  const baseUrl = useMemo(() => {
    if (typeof window === "undefined") return "";
    return window.location.origin;
  }, []);

  async function getTokenOrRedirect() {
    const { data } = await supabaseBrowser.auth.getSession();
    const token = data.session?.access_token;

    if (!token) {
      router.replace("/login?e=" + encodeURIComponent("Sesión expirada. Vuelve a ingresar."));
      return null;
    }
    return token;
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

    if (res.status === 401) {
      router.replace("/login?e=" + encodeURIComponent("Sesión expirada. Vuelve a ingresar."));
      return;
    }

    const json = await res.json().catch(() => null);
    if (!res.ok) {
      setCompanies([]);
      setError(json?.error || "No se pudieron cargar empresas");
      setLoading(false);
      return;
    }

    const list: Company[] = (json?.companies ?? []).filter((c: any) => c?.id);
    setCompanies(list);

    if (!companyId && list.length) setCompanyId(list[0].id);

    setLoading(false);
  }

  useEffect(() => {
    loadCompanies();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedCompany = useMemo(() => {
    return companies.find((c) => c.id === companyId) ?? null;
  }, [companies, companyId]);

  async function copyText(text: string, msg = "Copiado ✅") {
    try {
      await navigator.clipboard.writeText(text);
      setError(msg);
      setTimeout(() => setError(null), 1200);
    } catch {
      setError("No se pudo copiar 😕");
      setTimeout(() => setError(null), 1200);
    }
  }

  async function createSession() {
    setError(null);
    setCreated(null);

    if (!companyId) return setError("Selecciona una empresa.");
    if (!topic.trim()) return setError("Tema es obligatorio.");
    if (!trainerName.trim()) return setError("Relator es obligatorio.");
    if (!trainerRut.trim()) return setError("RUT del relator es obligatorio (clave admin).");

    const trainerRutClean = cleanRut(trainerRut);
    if (!isValidRut(trainerRutClean)) return setError("RUT del relator inválido.");

    const token = await getTokenOrRedirect();
    if (!token) return;

    setCreating(true);

    try {
      const res = await fetch(`/api/app/companies/${companyId}/sessions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          topic: topic.trim(),
          trainer_name: trainerName.trim(),
          trainer_rut: trainerRutClean, // ✅ nuevo (se guarda como admin_passcode)
          location: location.trim() ? location.trim() : null,
          session_date: sessionDate ? new Date(sessionDate).toISOString() : null,
        }),
      });

      if (res.status === 401) {
        router.replace("/login?e=" + encodeURIComponent("Sesión expirada. Vuelve a ingresar."));
        return;
      }

      const json = await res.json().catch(() => null);
      if (!res.ok) {
        setError(json?.error || "No se pudo crear la charla");
        return;
      }

      const codeRaw = json?.code || json?.session?.code || null;
      if (!codeRaw) {
        setError("Charla creada, pero la API no devolvió el código.");
        return;
      }

      const code = String(codeRaw).toUpperCase().trim();
      const publicPath = `/c/${encodeURIComponent(code)}`;
      const adminPath = `/admin/s/${encodeURIComponent(code)}`;

      setCreated({
        code,
        publicUrl: baseUrl ? `${baseUrl}${publicPath}` : publicPath,
        adminUrl: baseUrl ? `${baseUrl}${adminPath}` : adminPath,
      });

      // reset form
      setTopic("");
      setTrainerName("");
      setTrainerRut("");
      setLocation("");
      setSessionDate("");
    } catch (e: any) {
      setError(e?.message || "No se pudo crear la charla");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.head}>
        <div>
          <div className={styles.title}>Crear charla</div>
          <div className={styles.sub}>Selecciona una empresa, crea la charla y obtén el QR + Admin.</div>
        </div>

        <div className={styles.topActions}>
          <button className={styles.secondary} onClick={() => router.push("/app/sessions")} type="button">
            📋 Mis charlas
          </button>
          <button className={styles.secondary} onClick={() => router.push("/app/companies")} type="button">
            🏢 Mis empresas
          </button>
        </div>
      </div>

      {error && <div className={styles.error}>{error}</div>}

      <div className={styles.card}>
        <div className={styles.cardTitle}>Datos de la charla</div>
        <div className={styles.cardSub}>Tema, relator y RUT relator obligatorios.</div>

        <div className={styles.form}>
          <div className={styles.field}>
            <label className={styles.label}>Empresa</label>
            <select
              className={styles.input}
              value={companyId}
              onChange={(e) => setCompanyId(e.target.value)}
              disabled={loading}
            >
              {!companies.length && <option value="">(Sin empresas)</option>}
              {companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            {selectedCompany?.address ? (
              <div className={styles.hint}>📍 {selectedCompany.address}</div>
            ) : (
              <div className={styles.hint}>📍 Sin dirección</div>
            )}
          </div>

          <div className={styles.field}>
            <label className={styles.label}>Tema *</label>
            <input
              className={styles.input}
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="Ej: Uso de Extintores"
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label}>Relator *</label>
            <input
              className={styles.input}
              value={trainerName}
              onChange={(e) => setTrainerName(e.target.value)}
              placeholder="Ej: Claudio Lizama"
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label}>RUT Relator (clave admin) *</label>
            <input
              className={styles.input}
              value={trainerRut}
              onChange={(e) => setTrainerRut(e.target.value)}
              placeholder="Ej: 12.345.678-9"
            />
            <div className={styles.hint}>🔐 Este RUT será la clave para cerrar la charla y generar el PDF.</div>
          </div>

          <div className={styles.field}>
            <label className={styles.label}>Lugar</label>
            <input
              className={styles.input}
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Ej: Puerto Montt"
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label}>Fecha y hora</label>
            <input
              className={styles.input}
              type="datetime-local"
              value={sessionDate}
              onChange={(e) => setSessionDate(e.target.value)}
            />
          </div>

          <button className={styles.primary} onClick={createSession} disabled={creating || loading} type="button">
            {creating ? "Creando…" : "Crear charla + QR"}
          </button>
        </div>
      </div>

      {created && (
        <div className={styles.result}>
          <div className={styles.resultTop}>
            <div>
              <div className={styles.resultTitle}>Charla creada ✅</div>
              <div className={styles.resultSub}>
                Código: <span className={styles.mono}>{created.code}</span>
              </div>
            </div>

            <button
              className={styles.copyBtn}
              onClick={() =>
                copyText(
                  `Código: ${created.code}\nQR: ${created.publicUrl}\nAdmin: ${created.adminUrl}`,
                  "Copiado ✅"
                )
              }
              type="button"
            >
              Copiar todo
            </button>
          </div>

          <div className={styles.qrWrap}>
            <QRCodeCanvas value={created.publicUrl} size={200} />
          </div>

          <div className={styles.links}>
            <div className={styles.linkRow}>
              <span className={styles.linkLabel}>Link público</span>
              <button className={styles.copyBtn} onClick={() => copyText(created.publicUrl, "Link QR copiado ✅")} type="button">
                Copiar
              </button>
            </div>
            <div className={styles.linkMono}>{created.publicUrl}</div>

            <div className={styles.linkRow}>
              <span className={styles.linkLabel}>Admin</span>
              <button className={styles.copyBtn} onClick={() => copyText(created.adminUrl, "Link Admin copiado ✅")} type="button">
                Copiar
              </button>
            </div>
            <div className={styles.linkMono}>{created.adminUrl}</div>

            <div className={styles.btnRow}>
              <button className={styles.secondary} onClick={() => window.open(created.publicUrl, "_blank")} type="button">
                Abrir QR
              </button>
              <button className={styles.dark} onClick={() => router.push(`/admin/s/${encodeURIComponent(created.code)}`)} type="button">
                Admin
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}