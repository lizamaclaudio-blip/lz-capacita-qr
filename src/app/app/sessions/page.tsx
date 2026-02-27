"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/browser";
import styles from "./page.module.css";

type Session = {
  id: string;
  company_id?: string | null;
  code: string;
  topic?: string | null;
  location?: string | null;
  session_date?: string | null;
  created_at?: string | null;
  status?: string | null;
  closed_at?: string | null;
  attendees_count?: number | null;
  pdf_path?: string | null;
  companies?: { id?: string; name?: string | null; rut?: string | null; logo_path?: string | null } | null;
};

function fmtInt(n: number) {
  try {
    return new Intl.NumberFormat("es-CL").format(n);
  } catch {
    return String(n);
  }
}

function fmtDateShort(iso?: string | null) {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("es-CL", { year: "numeric", month: "2-digit", day: "2-digit" });
  } catch {
    return "—";
  }
}

function isClosed(s: Session) {
  const st = (s.status || "").toLowerCase();
  return st === "closed" || !!s.closed_at;
}

function companyLogoPublicUrl(logo_path?: string | null) {
  if (!logo_path) return null;
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!base) return null;
  const clean = String(logo_path).replace(/^company-logos\//, "");
  return `${base}/storage/v1/object/public/company-logos/${clean}`;
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" className={styles.searchIcon} aria-hidden="true">
      <path
        d="M10.5 18a7.5 7.5 0 1 1 0-15 7.5 7.5 0 0 1 0 15Zm0-2a5.5 5.5 0 1 0 0-11 5.5 5.5 0 0 0 0 11Zm7.9 4.5-4.2-4.2 1.4-1.4 4.2 4.2-1.4 1.4Z"
        fill="currentColor"
      />
    </svg>
  );
}

function SessionsIcon() {
  return (
    <svg className={styles.sessionsIcon} viewBox="0 0 64 64" role="img" aria-label="Charlas" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="s1" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="rgba(99,102,241,0.95)" />
          <stop offset="1" stopColor="rgba(20,184,166,0.85)" />
        </linearGradient>
        <linearGradient id="s2" x1="1" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="rgba(245,158,11,0.95)" />
          <stop offset="1" stopColor="rgba(99,102,241,0.55)" />
        </linearGradient>
      </defs>
      <rect x="8" y="6" width="48" height="52" rx="16" fill="rgba(255,255,255,0.10)" />
      <path
        d="M18 22c0-3 2.4-5.5 5.5-5.5h17c3 0 5.5 2.5 5.5 5.5v18c0 3-2.5 5.5-5.5 5.5h-4.5l-7 6-7-6H23.5C20.4 46 18 43.5 18 40V22Z"
        fill="url(#s1)"
        opacity="0.95"
      />
      <path d="M22 24h20" stroke="rgba(255,255,255,0.78)" strokeWidth="3" strokeLinecap="round" opacity="0.9" />
      <path d="M22 32h14" stroke="rgba(255,255,255,0.70)" strokeWidth="3" strokeLinecap="round" opacity="0.85" />
      <circle cx="46" cy="44" r="9" fill="url(#s2)" opacity="0.92" />
      <path d="M46 40v4l3 2" stroke="rgba(6,15,35,0.85)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

async function fetchWithToken<T>(url: string, router: ReturnType<typeof useRouter>): Promise<T> {
  const { data } = await supabaseBrowser.auth.getSession();
  const token = data.session?.access_token;

  if (!token) {
    router.replace("/login");
    throw new Error("Unauthorized");
  }

  const res = await fetch(url, {
    cache: "no-store",
    headers: { Authorization: `Bearer ${token}` },
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((json as any)?.error || "Error al cargar");
  return json as T;
}

export default function SessionsPage() {
  const router = useRouter();
  const searchRef = useRef<HTMLInputElement | null>(null);

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [q, setQ] = useState("");

  // ===== Split PDF viewer state =====
  const [pdfSession, setPdfSession] = useState<Session | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [pdfCache, setPdfCache] = useState<Record<string, string>>({});

  useEffect(() => {
    let alive = true;

    (async () => {
      setLoading(true);
      setErr(null);
      try {
        const data = await fetchWithToken<{ sessions?: Session[] }>("/api/app/sessions", router);
        if (!alive) return;
        setSessions(Array.isArray(data.sessions) ? data.sessions : []);
      } catch (e: any) {
        if (!alive) return;
        setErr(e?.message || "No se pudo cargar");
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [router]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closePdf();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pdfSession, pdfUrl]);

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();
    if (!qq) return sessions;

    return sessions.filter((s) => {
      const companyName = (s.companies?.name || "").toLowerCase();
      return (
        (s.topic || "").toLowerCase().includes(qq) ||
        (s.code || "").toLowerCase().includes(qq) ||
        companyName.includes(qq)
      );
    });
  }, [sessions, q]);

  const openList = useMemo(() => filtered.filter((s) => !isClosed(s)), [filtered]);
  const closedList = useMemo(() => filtered.filter((s) => isClosed(s)), [filtered]);

  function activateSearch() {
    searchRef.current?.focus();
  }

  function openAdmin(s: Session) {
    router.push(`/admin/s/${s.code}`);
  }

  function closePdf() {
    setPdfSession(null);
    setPdfLoading(false);
    setPdfError(null);
    setPdfUrl(null);
  }

  async function openPdfForSession(s: Session) {
    const path = (s.pdf_path || "").trim();
    if (!path) return;

    setPdfSession(s);
    setPdfError(null);

    if (pdfCache[path]) {
      setPdfUrl(pdfCache[path]);
      return;
    }

    setPdfLoading(true);
    setPdfUrl(null);

    try {
      const { data } = await supabaseBrowser.auth.getSession();
      const token = data.session?.access_token;
      if (!token) {
        router.replace("/login");
        throw new Error("Unauthorized");
      }

      const res = await fetch("/api/app/pdfs/sign", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ pdf_path: path }),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((json as any)?.error || "No se pudo abrir el PDF");

      const signed = (json as any)?.signed_url as string | undefined;
      if (!signed) throw new Error("No se pudo firmar la URL del PDF");

      setPdfCache((prev) => ({ ...prev, [path]: signed }));
      setPdfUrl(signed);
    } catch (e: any) {
      setPdfError(e?.message || "Error al abrir PDF");
    } finally {
      setPdfLoading(false);
    }
  }

  const splitOpen = !!pdfSession;

  return (
    <div className={styles.page}>
      <div className={styles.head}>
        <div className={styles.titleWrap}>
          <SessionsIcon />
          <div className={styles.titleText}>
            <h1 className={styles.h1}>Mis Charlas</h1>
            <p className={styles.sub}>Crea, abre el QR y cierra con firma (PDF final).</p>
          </div>
        </div>

        <div className={styles.headActions}>
          <Link href="/app/sessions/new" className="btn btnCta">
            + Crear charla
          </Link>
        </div>
      </div>

      {err ? <div className={styles.errBox}>{err}</div> : null}

      <div className={styles.toolbar}>
        <input
          ref={searchRef}
          className="input"
          placeholder="Buscar por charla, código o empresa…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") setQ("");
          }}
        />

        <button type="button" className={styles.searchBtn} onClick={activateSearch} title="Buscar" aria-label="Buscar">
          <SearchIcon />
        </button>
      </div>

      {/* ✅ ÚNICO scroll de la página */}
      <div className={styles.pageScroller}>
        <div className={`${styles.split} ${splitOpen ? styles.splitOpen : ""}`}>
          {/* LEFT */}
          <div className={styles.left}>
            {loading ? (
              <div className={styles.skel}>Cargando…</div>
            ) : sessions.length === 0 ? (
              <div className={styles.empty}>No hay charlas aún. Crea la primera ✅</div>
            ) : filtered.length === 0 ? (
              <div className={styles.empty}>No hay resultados. Prueba con otra búsqueda.</div>
            ) : (
              <div className={styles.list}>
                <div className={styles.sectionHead}>
                  <div className={styles.sectionTitle}>Abiertas</div>
                  <div className={styles.sectionCount}>{fmtInt(openList.length)}</div>
                </div>

                {openList.length === 0 ? (
                  <div className={styles.sectionEmpty}>No hay charlas abiertas.</div>
                ) : (
                  <div className={styles.sectionList}>
                    {openList.map((s) => {
                      const attendees = Number(s.attendees_count) || 0;
                      const companyName = s.companies?.name || "—";
                      const logo = companyLogoPublicUrl(s.companies?.logo_path);

                      return (
                        <div
                          key={s.id}
                          className={styles.row}
                          role="link"
                          tabIndex={0}
                          aria-label={`Abrir admin de ${s.topic || "charla"}`}
                          onClick={() => openAdmin(s)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              openAdmin(s);
                            }
                          }}
                        >
                          <div className={styles.logoBox} aria-hidden="true">
                            {logo ? <img className={styles.logoImg} src={logo} alt="" /> : <div className={styles.logoFallback}>LZ</div>}
                          </div>

                          <div className={styles.main}>
                            <div className={styles.line}>
                              <div className={styles.title} title={s.topic || ""}>
                                {s.topic || "Charla"}
                              </div>

                              <div className={styles.company} title={companyName}>
                                {companyName}
                              </div>

                              <div className={styles.code} title={`Código ${s.code}`}>
                                Código: {s.code}
                              </div>

                              <div className={styles.pills}>
                                <span className={styles.pill}>{fmtInt(attendees)} asistentes</span>
                                <span className={styles.pill}>{fmtDateShort(s.session_date || s.created_at)}</span>
                                <span className={`${styles.pill} ${styles.pillOpen}`}>Abierta</span>
                              </div>
                            </div>
                          </div>

                          <div className={styles.actions} onClick={(e) => e.stopPropagation()}>
                            <a className="btn btnGhost" href={`/c/${s.code}`} target="_blank" rel="noreferrer">
                              Abrir
                            </a>
                            <a className="btn btnPrimary" href={`/admin/s/${s.code}`} target="_blank" rel="noreferrer">
                              Firmar
                            </a>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                <div className={styles.sectionHead}>
                  <div className={styles.sectionTitle}>Cerradas</div>
                  <div className={styles.sectionCount}>{fmtInt(closedList.length)}</div>
                </div>

                {closedList.length === 0 ? (
                  <div className={styles.sectionEmpty}>No hay charlas cerradas.</div>
                ) : (
                  <div className={styles.sectionList}>
                    {closedList.map((s) => {
                      const attendees = Number(s.attendees_count) || 0;
                      const companyName = s.companies?.name || "—";
                      const logo = companyLogoPublicUrl(s.companies?.logo_path);
                      const hasPdf = !!s.pdf_path;
                      const selected = pdfSession?.id === s.id;

                      const rowProps = hasPdf
                        ? {
                            role: "button" as const,
                            tabIndex: 0,
                            onClick: () => openPdfForSession(s),
                            onKeyDown: (e: React.KeyboardEvent) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                openPdfForSession(s);
                              }
                            },
                          }
                        : { role: "group" as const };

                      return (
                        <div
                          key={s.id}
                          className={`${styles.row} ${hasPdf ? "" : styles.rowStatic} ${selected ? styles.rowSelected : ""}`}
                          aria-label={`${s.topic || "Charla"} (cerrada)`}
                          {...rowProps}
                        >
                          <div className={styles.logoBox} aria-hidden="true">
                            {logo ? <img className={styles.logoImg} src={logo} alt="" /> : <div className={styles.logoFallback}>LZ</div>}
                          </div>

                          <div className={styles.main}>
                            <div className={styles.line}>
                              <div className={styles.title} title={s.topic || ""}>
                                {s.topic || "Charla"}
                              </div>

                              <div className={styles.company} title={companyName}>
                                {companyName}
                              </div>

                              <div className={styles.code} title={`Código ${s.code}`}>
                                Código: {s.code}
                              </div>

                              <div className={styles.pills}>
                                <span className={styles.pill}>{fmtInt(attendees)} asistentes</span>
                                <span className={styles.pill}>{fmtDateShort(s.session_date || s.created_at)}</span>
                                <span className={`${styles.pill} ${styles.pillClosed}`}>Cerrada</span>
                              </div>
                            </div>
                          </div>

                          <div className={styles.actions} onClick={(e) => e.stopPropagation()}>
                            {hasPdf ? (
                              <button type="button" className="btn btnCta" onClick={() => openPdfForSession(s)}>
                                PDF
                              </button>
                            ) : (
                              <span className={styles.pdfPending}>PDF pendiente</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* RIGHT: Split Viewer */}
          {splitOpen ? (
            <aside className={styles.viewer} aria-label="Visor PDF">
              <div className={styles.viewerCard}>
                <div className={styles.viewerHead}>
                  <div className={styles.viewerHeadLeft}>
                    <div className={styles.viewerKicker}>Visor PDF</div>
                    <div
                      className={styles.viewerTitle}
                      title={`${pdfSession?.topic || "Charla"} • ${pdfSession?.companies?.name || "Empresa"} • ${pdfSession?.code || ""}`}
                    >
                      {pdfSession?.topic || "Charla"} • {pdfSession?.companies?.name || "Empresa"} • {pdfSession?.code || ""}
                    </div>
                  </div>

                  <div className={styles.viewerBtns}>
                    {pdfUrl ? (
                      <a className="btn btnGhost" href={pdfUrl} target="_blank" rel="noreferrer">
                        Abrir en pestaña
                      </a>
                    ) : (
                      <button className="btn btnGhost" type="button" disabled>
                        Abrir en pestaña
                      </button>
                    )}

                    <button className="btn btnPrimary" type="button" onClick={closePdf}>
                      Cerrar
                    </button>
                  </div>
                </div>

                <div className={styles.viewerBody}>
                  {pdfLoading ? (
                    <div className={styles.viewerState}>Cargando PDF…</div>
                  ) : pdfError ? (
                    <div className={styles.viewerStateErr}>{pdfError}</div>
                  ) : pdfUrl ? (
                    <iframe className={styles.viewerFrame} src={pdfUrl} title="PDF" />
                  ) : (
                    <div className={styles.viewerState}>Preparando…</div>
                  )}
                </div>
              </div>
            </aside>
          ) : null}
        </div>
      </div>
    </div>
  );
}