"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/browser";
import styles from "./page.module.css";

type Company = {
  id: string;
  name: string;
  address: string | null;
  rut?: string | null;
  logo_path?: string | null;
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

function safeUpper(s: string) {
  return (s ?? "").toUpperCase();
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

  // search in sessions list
  const [q, setQ] = useState("");

  // auto open qr toggle
  const [autoOpenQr, setAutoOpenQr] = useState(false);

  // cache token en memoria (evita “rebotes”)
  const [token, setToken] = useState<string | null>(null);
  const tokenRef = useRef<string | null>(null);

  const baseUrl = useMemo(() => {
    if (typeof window === "undefined") return "";
    return window.location.origin;
  }, []);

  const companyLogoUrl = useMemo(() => {
    const p = (company as any)?.logo_path ?? null;
    if (!p) return null;
    const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!base) return null;
    const clean = String(p).replace(/^company-logos\//, "");
    return `${base}/storage/v1/object/public/company-logos/${clean}`;
  }, [company]);

  // Persist toggle (localStorage)
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem("lz_auto_open_qr");
      if (raw === "1") setAutoOpenQr(true);
      if (raw === "0") setAutoOpenQr(false);
    } catch {}
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem("lz_auto_open_qr", autoOpenQr ? "1" : "0");
    } catch {}
  }, [autoOpenQr]);

  // Mantener token estable
  useEffect(() => {
    let alive = true;

    async function boot() {
      const { data } = await supabaseBrowser.auth.getSession();
      const t = data.session?.access_token ?? null;

      if (!alive) return;

      if (!t) {
        router.replace("/login?e=" + encodeURIComponent("Sesión expirada. Vuelve a ingresar."));
        return;
      }

      setToken(t);
      tokenRef.current = t;
    }

    boot();

    const { data: sub } = supabaseBrowser.auth.onAuthStateChange((_event, session) => {
      const t = session?.access_token ?? null;
      setToken(t);
      tokenRef.current = t;

      if (!t) {
        router.replace("/login?e=" + encodeURIComponent("Sesión expirada. Vuelve a ingresar."));
      }
    });

    return () => {
      alive = false;
      sub?.subscription?.unsubscribe();
    };
  }, [router]);

  async function ensureTokenOrRedirect() {
    const cached = tokenRef.current ?? token;
    if (cached) return cached;

    const { data } = await supabaseBrowser.auth.getSession();
    const t = data.session?.access_token ?? null;

    if (!t) {
      router.replace("/login?e=" + encodeURIComponent("Sesión expirada. Vuelve a ingresar."));
      return null;
    }

    setToken(t);
    tokenRef.current = t;
    return t;
  }

  async function apiFetch<T>(url: string, init: RequestInit = {}) {
    const t = await ensureTokenOrRedirect();
    if (!t) return null as any;

    const res = await fetch(url, {
      ...init,
      headers: {
        ...(init.headers ?? {}),
        Authorization: `Bearer ${t}`,
      },
      cache: "no-store",
    });

    if (res.status === 401) {
      router.replace("/login?e=" + encodeURIComponent("Sesión expirada. Vuelve a ingresar."));
      return null as any;
    }

    const json = (await res.json().catch(() => null)) as T | null;

    if (!res.ok) {
      const msg = (json as any)?.error || `Error HTTP ${res.status} al consultar la API.`;
      throw new Error(msg);
    }

    return json as T;
  }

  async function loadAll() {
    if (!companyId) return;

    setLoading(true);
    setError(null);

    try {
      const cJson = await apiFetch<{ company: Company | null }>(`/api/app/companies/${companyId}`);
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
    if (!token) return;
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId, token]);

  async function copyText(text: string, okMsg = "Copiado ✅") {
    try {
      await navigator.clipboard.writeText(text);
      setNotice(okMsg);
      window.setTimeout(() => setNotice(null), 1500);
    } catch {
      setNotice("No pude copiar (permiso del navegador).");
      window.setTimeout(() => setNotice(null), 1800);
    }
  }

  function openSessionAdmin(code: string) {
    router.push(`/admin/s/${encodeURIComponent(code)}`);
  }

  function openSessionAdminNewTab(code: string) {
    window.open(`/admin/s/${encodeURIComponent(code)}`, "_blank", "noopener,noreferrer");
  }

  function openPublicCheckin(code: string) {
    window.open(`/c/${encodeURIComponent(code)}`, "_blank", "noopener,noreferrer");
  }

  async function copyAllFor(code: string) {
    const up = safeUpper(code);
    const qr = baseUrl ? `${baseUrl}/c/${encodeURIComponent(up)}` : `/c/${encodeURIComponent(up)}`;
    const admin = baseUrl
      ? `${baseUrl}/admin/s/${encodeURIComponent(up)}`
      : `/admin/s/${encodeURIComponent(up)}`;

    const blob = `Código: ${up}\nQR: ${qr}\nAdmin: ${admin}`;
    await copyText(blob, "✅ Copié código + links");
  }

  async function createSession() {
    setError(null);
    setNotice(null);
    setJustCreated(null);

    if (!topic.trim() || !trainerName.trim()) {
      setError("Tema y relator son obligatorios.");
      return;
    }

    const t = await ensureTokenOrRedirect();
    if (!t) return;

    // ✅ Anti popup-blocker:
    // si autoOpenQr = true, abrimos la pestaña "en blanco" inmediatamente (dentro del click)
    // y después (cuando ya tengamos code) la redirigimos.
    let qrTab: Window | null = null;
    if (autoOpenQr && typeof window !== "undefined") {
      qrTab = window.open("about:blank", "_blank", "noopener,noreferrer");
    }

    setCreating(true);

    try {
      const topicSnapshot = topic.trim(); // guardar antes de limpiar

      const res = await fetch(`/api/app/companies/${companyId}/sessions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${t}`,
        },
        body: JSON.stringify({
          topic: topicSnapshot,
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
        // si abrimos tab y falló, la cerramos
        try { qrTab?.close(); } catch {}
        return;
      }

      const codeRaw: string | null = json?.code || json?.session?.code || json?.data?.code || null;

      // limpiar form
      setTopic("");
      setLocation("");
      setTrainerName("");
      setSessionDate("");

      await loadAll();

      if (codeRaw) {
        const code = safeUpper(codeRaw);

        const publicPath = `/c/${encodeURIComponent(code)}`;
        const adminPath = `/admin/s/${encodeURIComponent(code)}`;

        const publicUrl = baseUrl ? `${baseUrl}${publicPath}` : publicPath;
        const adminUrl = baseUrl ? `${baseUrl}${adminPath}` : adminPath;

        setJustCreated({
          code,
          topic: json?.session?.topic ?? topicSnapshot ?? "Charla creada",
          publicUrl,
          adminUrl,
        });

        setNotice("Charla creada ✅");
        window.setTimeout(() => setNotice(null), 1500);

        // ✅ auto open QR (redirige la pestaña pre-abierta)
        if (autoOpenQr) {
          if (qrTab) {
            try {
              qrTab.location.href = publicPath;
            } catch {
              // fallback
              openPublicCheckin(code);
            }
          } else {
            openPublicCheckin(code);
          }
        }
      } else {
        setNotice("Charla creada ✅ (no recibí el código en la respuesta)");
        window.setTimeout(() => setNotice(null), 2000);
        try { qrTab?.close(); } catch {}
      }
    } catch (e: any) {
      setError(e?.message || "No se pudo crear la charla");
      try { qrTab?.close(); } catch {}
    } finally {
      setCreating(false);
    }
  }

  const sortedSessions = useMemo(() => {
    const copy = [...sessions];
    copy.sort((a, b) => {
      const ad = new Date(a.created_at ?? a.session_date ?? 0).getTime();
      const bd = new Date(b.created_at ?? b.session_date ?? 0).getTime();
      return bd - ad;
    });
    return copy;
  }, [sessions]);

  const filteredSessions = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return sortedSessions;

    return sortedSessions.filter((s) => {
      const t = (s.topic ?? "").toLowerCase();
      const c = (s.code ?? "").toLowerCase();
      const tr = (s.trainer_name ?? "").toLowerCase();
      const loc = (s.location ?? "").toLowerCase();
      return t.includes(term) || c.includes(term) || tr.includes(term) || loc.includes(term);
    });
  }, [q, sortedSessions]);

  const companyTitle = company?.name || "Empresa";
  const companySub = company?.address ? company.address : "Sin dirección";

  return (
    <div className={styles.wrap}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <button type="button" onClick={() => router.push("/app/companies")} className={styles.back}>
            ← Volver a empresas
          </button>

          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {companyLogoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={companyLogoUrl}
                alt="Logo empresa"
                style={{ height: 44, width: "auto", borderRadius: 12, background: "rgba(255,255,255,0.7)", padding: 6 }}
              />
            ) : null}
            <h1 className={styles.h1} style={{ margin: 0 }}>{companyTitle}</h1>
          </div>
          <p className={styles.sub}>
            {companySub} · Administra charlas y comparte el QR público de asistencia.
          </p>
        </div>

        <div className={styles.headerRight}>
          <button type="button" className={styles.ghostBtn} onClick={() => router.push("/app/sessions")}>
            📋 Mis charlas
          </button>

          <button type="button" className={styles.ghostBtn} onClick={loadAll} disabled={loading}>
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
                Código: <span className={styles.mono}>{safeUpper(justCreated.code)}</span>
                {justCreated.topic ? ` · ${justCreated.topic}` : ""}
              </div>
            </div>

            <div className={styles.quickTopBtns}>
              <button
                type="button"
                className={styles.copyBtn}
                onClick={() => copyText(justCreated.code, "Código copiado ✅")}
              >
                Copiar código
              </button>

              <button type="button" className={styles.copyBtn} onClick={() => copyAllFor(justCreated.code)}>
                Copiar todo
              </button>
            </div>
          </div>

          <div className={styles.quickActions}>
            <button type="button" className={styles.primaryBtn} onClick={() => openPublicCheckin(justCreated.code)}>
              Abrir QR (público)
            </button>

            <button
              type="button"
              className={styles.secondaryBtn}
              onClick={() => copyText(justCreated.publicUrl, "Link QR copiado ✅")}
            >
              Copiar link QR
            </button>

            <button type="button" className={styles.darkBtn} onClick={() => openSessionAdmin(justCreated.code)}>
              Admin
            </button>

            <button type="button" className={styles.secondaryBtn} onClick={() => openSessionAdminNewTab(justCreated.code)}>
              Admin (nueva pestaña)
            </button>

            <button
              type="button"
              className={styles.secondaryBtn}
              onClick={() => copyText(justCreated.adminUrl, "Link Admin copiado ✅")}
            >
              Copiar link Admin
            </button>
          </div>

          <div className={styles.quickToggles}>
            <label className={styles.toggle}>
              <input
                type="checkbox"
                checked={autoOpenQr}
                onChange={(e) => setAutoOpenQr(e.target.checked)}
              />
              Auto-abrir QR al crear
            </label>
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

          <button type="button" disabled={creating} onClick={createSession} className={styles.createBtn}>
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
              {loading ? "Cargando…" : `${filteredSessions.length} charla(s)`}
            </div>
          </div>

          <input
            className={styles.search}
            placeholder="Buscar por tema, código, relator o lugar…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>

        {loading ? (
          <div className={styles.empty}>Cargando…</div>
        ) : !filteredSessions.length ? (
          <div className={styles.empty}>Aún no hay charlas (o tu búsqueda no tiene resultados).</div>
        ) : (
          <div className={styles.grid}>
            {filteredSessions.map((s) => {
              const status = (s.status ?? "").toLowerCase();
              const isClosed = status === "closed" || !!s.closed_at;

              const code = safeUpper(s.code);
              const publicUrl = baseUrl ? `${baseUrl}/c/${encodeURIComponent(code)}` : `/c/${encodeURIComponent(code)}`;
              const adminUrl = baseUrl
                ? `${baseUrl}/admin/s/${encodeURIComponent(code)}`
                : `/admin/s/${encodeURIComponent(code)}`;

              return (
                <div key={s.id} className={styles.sessionCard}>
                  <div className={styles.sessionTop}>
                    <div>
                      <div className={styles.sessionTitle}>{s.topic || "(Sin tema)"}</div>
                      <div className={styles.metaLine}>
                        Código: <span className={styles.mono}>{code}</span>
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
                    <button type="button" className={styles.darkBtn} onClick={() => openSessionAdmin(code)}>
                      Admin
                    </button>

                    <button type="button" className={styles.secondaryBtn} onClick={() => openPublicCheckin(code)}>
                      Abrir QR
                    </button>

                    <button type="button" className={styles.copyBtn} onClick={() => copyText(publicUrl, "Link QR copiado ✅")}>
                      Copiar QR
                    </button>

                    <button type="button" className={styles.copyBtn} onClick={() => copyText(adminUrl, "Link Admin copiado ✅")}>
                      Copiar Admin
                    </button>

                    <button type="button" className={styles.copyBtn} onClick={() => copyAllFor(code)}>
                      Copiar todo
                    </button>
                  </div>

                  <div className={styles.linkHint}>
                    Público: <span className={styles.mono}>/c/{code}</span>
                    <span className={styles.dot}>•</span>
                    Admin: <span className={styles.mono}>/admin/s/{code}</span>
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