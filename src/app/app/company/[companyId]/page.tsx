"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/browser";
import styles from "./page.module.css";

type Company = {
  id: string;
  name: string;
  address: string | null;
  created_at: string;
};

type SessionRow = {
  id: string;
  company_id: string;
  code: string;
  topic: string | null;
  location: string | null;
  session_date: string | null;
  trainer_name: string | null;
  status: string | null;
  closed_at: string | null;
  created_at: string | null;
};

type JustCreated = {
  code: string;
  topic: string;
  adminUrl: string;
  publicUrl: string;
};

function fmtDateTimeCL(iso: string | null | undefined) {
  if (!iso) return "Sin fecha";
  try {
    return new Date(iso).toLocaleString("es-CL");
  } catch {
    return "Sin fecha";
  }
}

export default function CompanyPage() {
  const router = useRouter();
  const params = useParams<{ companyId: string }>();
  const companyId = (params?.companyId ?? "") as string;

  const [loading, setLoading] = useState(true);
  const [company, setCompany] = useState<Company | null>(null);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // form
  const [topic, setTopic] = useState("");
  const [location, setLocation] = useState("");
  const [trainerName, setTrainerName] = useState("");
  const [sessionDate, setSessionDate] = useState(""); // datetime-local
  const [creating, setCreating] = useState(false);

  // post-create card
  const [justCreated, setJustCreated] = useState<JustCreated | null>(null);

  const baseUrl = useMemo(() => {
    // para copiar links completos (funciona en localhost y en producción)
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

  async function apiFetch<T>(url: string, init: RequestInit = {}) {
    const token = await getTokenOrRedirect();
    if (!token) return null as any;

    const res = await fetch(url, {
      ...init,
      headers: {
        ...(init.headers ?? {}),
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
    });

    if (res.status === 401) {
      router.replace("/login?e=" + encodeURIComponent("Sesión expirada. Vuelve a ingresar."));
      return null as any;
    }

    const json = (await res.json().catch(() => null)) as T | null;

    if (!res.ok) {
      const msg =
        (json as any)?.error ||
        `Error HTTP ${res.status} al consultar la API.`;
      throw new Error(msg);
    }

    return json as T;
  }

  async function loadAll() {
    setLoading(true);
    setError(null);

    try {
      const cJson = await apiFetch<{ company: Company | null }>(
        `/api/app/companies/${companyId}`
      );
      setCompany(cJson?.company ?? null);

      const sJson = await apiFetch<{ sessions: SessionRow[] }>(
        `/api/app/companies/${companyId}/sessions`
      );
      setSessions(sJson?.sessions ?? []);
    } catch (e: any) {
      setError(e?.message || "No se pudo cargar la empresa/charlas");
      setCompany(null);
      setSessions([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!companyId) return;
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId]);

  async function copyText(text: string, okMsg = "Copiado ✅") {
    try {
      await navigator.clipboard.writeText(text);
      setNotice(okMsg);
      window.setTimeout(() => setNotice(null), 1600);
    } catch {
      setNotice("No pude copiar (permiso del navegador).");
      window.setTimeout(() => setNotice(null), 1800);
    }
  }

  async function createSession() {
    setError(null);
    setNotice(null);
    setJustCreated(null);

    if (!topic.trim() || !trainerName.trim()) {
      setError("Tema y relator son obligatorios.");
      return;
    }

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
          location: location.trim() ? location.trim() : null,
          trainer_name: trainerName.trim(),
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

      // Intenta tomar el code de distintas formas, según tu API.
      const code =
        json?.code ||
        json?.session?.code ||
        json?.data?.code ||
        null;

      // limpiar form
      setTopic("");
      setLocation("");
      setTrainerName("");
      setSessionDate("");

      await loadAll();

      if (code) {
        const publicPath = `/c/${encodeURIComponent(code)}`;
        const adminPath = `/admin/s/${encodeURIComponent(code)}`;

        setJustCreated({
          code,
          topic: (json?.session?.topic ?? topic.trim()) || "Charla creada",
          publicUrl: baseUrl ? `${baseUrl}${publicPath}` : publicPath,
          adminUrl: baseUrl ? `${baseUrl}${adminPath}` : adminPath,
        });

        setNotice("Charla creada ✅");
        window.setTimeout(() => setNotice(null), 1600);
      } else {
        setNotice("Charla creada ✅ (no recibí el código en la respuesta)");
        window.setTimeout(() => setNotice(null), 2000);
      }
    } catch (e: any) {
      setError(e?.message || "No se pudo crear la charla");
    } finally {
      setCreating(false);
    }
  }

  function openSessionAdmin(code: string) {
    router.push(`/admin/s/${encodeURIComponent(code)}`);
  }

  function openPublicCheckin(code: string) {
    window.open(`/c/${encodeURIComponent(code)}`, "_blank", "noopener,noreferrer");
  }

  const sortedSessions = useMemo(() => {
    // orden: más nuevas arriba por created_at / session_date
    const copy = [...sessions];
    copy.sort((a, b) => {
      const ad = new Date(a.created_at ?? a.session_date ?? 0).getTime();
      const bd = new Date(b.created_at ?? b.session_date ?? 0).getTime();
      return bd - ad;
    });
    return copy;
  }, [sessions]);

  const companyTitle = company?.name || "Empresa";
  const companySub = company?.address ? company.address : "Sin dirección";

  return (
    <div className={styles.wrap}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <button
            type="button"
            onClick={() => router.push("/app")}
            className={styles.back}
          >
            ← Volver
          </button>

          <h1 className={styles.h1}>{companyTitle}</h1>
          <p className={styles.sub}>
            {companySub} · Administra charlas y comparte el QR público de asistencia.
          </p>
        </div>

        <div className={styles.headerRight}>
          <button
            type="button"
            className={styles.ghostBtn}
            onClick={loadAll}
            disabled={loading}
            title="Recargar"
          >
            {loading ? "Cargando…" : "Actualizar"}
          </button>
        </div>
      </div>

      {/* Alerts */}
      {error && <div className={styles.error}>{error}</div>}
      {notice && <div className={styles.notice}>{notice}</div>}

      {/* Post-create quick actions */}
      {justCreated && (
        <section className={styles.quickCard}>
          <div className={styles.quickTop}>
            <div>
              <div className={styles.quickTitle}>Charla lista ✅</div>
              <div className={styles.quickSub}>
                Código: <span className={styles.mono}>{justCreated.code}</span>
                {justCreated.topic ? ` · ${justCreated.topic}` : ""}
              </div>
            </div>

            <button
              type="button"
              className={styles.copyBtn}
              onClick={() => copyText(justCreated.code, "Código copiado ✅")}
            >
              Copiar código
            </button>
          </div>

          <div className={styles.quickActions}>
            <button
              type="button"
              className={styles.primaryBtn}
              onClick={() => openPublicCheckin(justCreated.code)}
            >
              Abrir QR (público)
            </button>

            <button
              type="button"
              className={styles.secondaryBtn}
              onClick={() => copyText(justCreated.publicUrl, "Link QR copiado ✅")}
            >
              Copiar link QR
            </button>

            <button
              type="button"
              className={styles.darkBtn}
              onClick={() => openSessionAdmin(justCreated.code)}
            >
              Admin
            </button>
          </div>

          <div className={styles.quickLinks}>
            <div>
              Público: <span className={styles.mono}>{justCreated.publicUrl}</span>
            </div>
            <div>
              Admin: <span className={styles.mono}>{justCreated.adminUrl}</span>
            </div>
          </div>
        </section>
      )}

      {/* Create session */}
      <section className={styles.card}>
        <div className={styles.cardHeader}>
          <div>
            <div className={styles.cardTitle}>Crear charla</div>
            <div className={styles.cardSub}>
              Tema y relator obligatorios. Luego comparte el QR público con asistentes.
            </div>
          </div>
        </div>

        <div className={styles.form}>
          <div className={styles.field}>
            <label className={styles.label}>Tema / Charla *</label>
            <input
              className={styles.input}
              placeholder="Ej: Uso de Extintores"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label}>Relator *</label>
            <input
              className={styles.input}
              placeholder="Ej: Claudio Lizama"
              value={trainerName}
              onChange={(e) => setTrainerName(e.target.value)}
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label}>Lugar</label>
            <input
              className={styles.input}
              placeholder="Ej: Puerto Montt"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
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

          <button
            type="button"
            disabled={creating}
            onClick={createSession}
            className={styles.createBtn}
          >
            {creating ? "Creando…" : "Crear charla"}
          </button>
        </div>
      </section>

      {/* Sessions list */}
      <section className={styles.card}>
        <div className={styles.cardHeader}>
          <div>
            <div className={styles.cardTitle}>Charlas</div>
            <div className={styles.cardSub}>
              {loading ? "Cargando…" : `${sortedSessions.length} charla(s)`}
            </div>
          </div>
        </div>

        {loading ? (
          <div className={styles.empty}>Cargando…</div>
        ) : !sortedSessions.length ? (
          <div className={styles.empty}>Aún no has creado charlas.</div>
        ) : (
          <div className={styles.grid}>
            {sortedSessions.map((s) => {
              const status = (s.status ?? "").toLowerCase();
              const isClosed = status === "closed" || !!s.closed_at;

              return (
                <div key={s.id} className={styles.sessionCard}>
                  <div className={styles.sessionTop}>
                    <div>
                      <div className={styles.sessionTitle}>{s.topic || "(Sin tema)"}</div>
                      <div className={styles.metaLine}>
                        Código: <span className={styles.mono}>{s.code}</span>
                      </div>
                    </div>

                    <span className={`${styles.badge} ${isClosed ? styles.badgeClosed : styles.badgeOpen}`}>
                      {isClosed ? "Cerrada" : "Abierta"}
                    </span>
                  </div>

                  <div className={styles.metaBlock}>
                    <div className={styles.metaItem}>
                      <span className={styles.metaLabel}>Fecha:</span>{" "}
                      <span className={styles.metaValue}>{fmtDateTimeCL(s.session_date)}</span>
                    </div>
                    <div className={styles.metaItem}>
                      <span className={styles.metaLabel}>Lugar:</span>{" "}
                      <span className={styles.metaValue}>{s.location || "—"}</span>
                    </div>
                    <div className={styles.metaItem}>
                      <span className={styles.metaLabel}>Relator:</span>{" "}
                      <span className={styles.metaValue}>{s.trainer_name || "—"}</span>
                    </div>
                  </div>

                  <div className={styles.sessionActions}>
                    <button
                      type="button"
                      className={styles.darkBtn}
                      onClick={() => openSessionAdmin(s.code)}
                    >
                      Admin
                    </button>

                    <button
                      type="button"
                      className={styles.secondaryBtn}
                      onClick={() => openPublicCheckin(s.code)}
                    >
                      Abrir QR
                    </button>

                    <button
                      type="button"
                      className={styles.copyBtn}
                      onClick={() =>
                        copyText(
                          baseUrl ? `${baseUrl}/c/${s.code}` : `/c/${s.code}`,
                          "Link QR copiado ✅"
                        )
                      }
                    >
                      Copiar link
                    </button>
                  </div>

                  <div className={styles.linkHint}>
                    Público: <span className={styles.mono}>/c/{s.code}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}