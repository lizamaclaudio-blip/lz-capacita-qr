"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabaseBrowser } from "@/lib/supabase/browser";
import styles from "./page.module.css";

type UserRow = {
  id: string;
  email: string | null;
  created_at: string;
  last_sign_in_at: string | null;
  banned_until: string | null;
  user_metadata: Record<string, any>;
  first_name: string | null;
  last_name: string | null;
  full_name: string | null;
};

type CompanyRow = {
  id: string;
  owner_id: string;
  name: string | null;
  rut: string | null;
  logo_path: string | null;
  created_at: string | null;
  stats?: { sessions: number; attendees: number; pdfs: number };
};

type SessionRow = {
  id: string;
  owner_id: string;
  company_id: string | null;
  code: string;
  topic?: string | null;
  location?: string | null;
  session_date?: string | null;
  created_at?: string | null;
  status?: string | null;
  closed_at?: string | null;
  pdf_path?: string | null;
  pdf_generated_at?: string | null;
  trainer_signature_path?: string | null;
  attendees_count?: number | null;
};

type UserDetail = {
  user: {
    id: string;
    email: string | null;
    created_at: string;
    last_sign_in_at: string | null;
    banned_until: string | null;
    user_metadata: Record<string, any>;
  };
  companies: CompanyRow[];
  sessions: SessionRow[];
};

async function getToken() {
  const { data } = await supabaseBrowser.auth.getSession();
  return data.session?.access_token ?? null;
}

async function apiGet<T>(url: string, router: ReturnType<typeof useRouter>): Promise<T> {
  const token = await getToken();
  if (!token) {
    router.replace("/login");
    throw new Error("No session");
  }

  const res = await fetch(url, { method: "GET", headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((json as any)?.error || `HTTP ${res.status}`);
  return json as T;
}

async function apiPost<T>(url: string, body: any, router: ReturnType<typeof useRouter>): Promise<T> {
  const token = await getToken();
  if (!token) {
    router.replace("/login");
    throw new Error("No session");
  }

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((json as any)?.error || `HTTP ${res.status}`);
  return json as T;
}

function fmtInt(n: number) {
  try {
    return new Intl.NumberFormat("es-CL").format(n);
  } catch {
    return String(n);
  }
}

function fmtDate(iso?: string | null) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("es-CL");
  } catch {
    return "—";
  }
}

function companyLogoPublicUrl(logo_path?: string | null) {
  if (!logo_path) return null;
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!base) return null;
  const clean = String(logo_path).replace(/^company-logos\//, "");
  return `${base}/storage/v1/object/public/company-logos/${clean}`;
}

function isClosed(s: SessionRow) {
  const st = (s.status || "").toLowerCase();
  return st === "closed" || !!s.closed_at;
}

async function confirmDanger(action: string) {
  const v = window.prompt(`Modo Dios — escribe BORRAR para confirmar: ${action}`);
  return (v || "").trim().toUpperCase() === "BORRAR";
}

export default function OwnerPage() {
  const router = useRouter();

  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const [loadingUsers, setLoadingUsers] = useState(false);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [q, setQ] = useState("");

  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detail, setDetail] = useState<UserDetail | null>(null);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);

  async function loadUsers() {
    setLoadingUsers(true);
    setErr(null);
    try {
      const r = await apiGet<{ users: UserRow[] }>("/api/owner/users/list", router);
      const list = Array.isArray(r.users) ? r.users : [];
      setUsers(list);

      // Auto-selección del primer usuario (mejora UX y evita pantallas vacías)
      if (!selectedUserId && list.length && list[0]?.id) {
        const firstId = String(list[0].id).trim();
        if (firstId) {
          setSelectedUserId(firstId);
          loadDetail(firstId);
        }
      }
    } catch (e: any) {
      setErr(e?.message || "No se pudo cargar usuarios");
    } finally {
      setLoadingUsers(false);
    }
  }

  async function loadDetail(userId: string) {
    const clean = String(userId || "").trim();
    if (!clean) {
      setErr("userId is required");
      setDetail(null);
      return;
    }

    setDetailLoading(true);
    setErr(null);
    try {
      const r = await apiGet<UserDetail>(`/api/owner/users/${encodeURIComponent(clean)}`, router);
      setDetail(r);
      setSelectedCompanyId(null);
    } catch (e: any) {
      setErr(e?.message || "No se pudo cargar detalle");
      setDetail(null);
    } finally {
      setDetailLoading(false);
    }
  }

  useEffect(() => {
    loadUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredUsers = useMemo(() => {
    const qq = q.trim().toLowerCase();
    if (!qq) return users;

    return users.filter((u) => {
      const name = (u.full_name || "").toLowerCase();
      const email = (u.email || "").toLowerCase();
      const last = (u.last_name || "").toLowerCase();
      return name.includes(qq) || email.includes(qq) || last.includes(qq);
    });
  }, [users, q]);

  const companies = detail?.companies ?? [];
  const sessions = detail?.sessions ?? [];

  const companySessions = useMemo(() => {
    if (!selectedCompanyId) return [];
    return sessions.filter((s) => s.company_id === selectedCompanyId);
  }, [sessions, selectedCompanyId]);

  async function forceDeleteCompany(companyId: string) {
    if (!detail?.user?.id) return;

    const okConfirm = await confirmDanger("Eliminar empresa + todas sus charlas + asistentes");
    if (!okConfirm) return;

    setErr(null);
    setOk(null);

    try {
      await apiPost("/api/owner/force/delete-company", { company_id: companyId }, router);
      setOk("Empresa eliminada (modo dios) ✅");
      await loadDetail(detail.user.id);
      await loadUsers();
    } catch (e: any) {
      setErr(e?.message || "Error eliminando empresa");
    }
  }

  async function forceDeleteSession(sessionId: string) {
    if (!detail?.user?.id) return;

    const okConfirm = await confirmDanger("Eliminar charla + asistentes + archivos");
    if (!okConfirm) return;

    setErr(null);
    setOk(null);

    try {
      await apiPost("/api/owner/force/delete-session", { session_id: sessionId }, router);
      setOk("Charla eliminada (modo dios) ✅");
      await loadDetail(detail.user.id);
      await loadUsers();
    } catch (e: any) {
      setErr(e?.message || "Error eliminando charla");
    }
  }

  async function forceDeleteUser(userId: string) {
    const okConfirm = await confirmDanger("Eliminar usuario + TODA su data (empresas/charlas/asistentes/PDFs)");
    if (!okConfirm) return;

    setErr(null);
    setOk(null);

    try {
      await apiPost("/api/owner/force/delete-user", { user_id: userId }, router);
      setOk("Usuario eliminado (modo dios) ✅");
      setDetail(null);
      setSelectedUserId(null);
      setSelectedCompanyId(null);
      await loadUsers();
    } catch (e: any) {
      setErr(e?.message || "Error eliminando usuario");
    }
  }

  async function seedDemo(reset: boolean) {
    setErr(null);
    setOk(null);
    try {
      const r = await apiPost<{ ok: boolean; demo_email: string }>("/api/owner/demo/seed", { reset }, router);
      setOk(`Demo listo ✅ (${r.demo_email})`);
      await loadUsers();
    } catch (e: any) {
      setErr(e?.message || "No se pudo crear demo");
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.head}>
        <div>
          <div className={styles.kicker}>🛡️ Owner</div>
          <h1 className={styles.h1}>Consola</h1>
          <p className={styles.sub}>Modo administración (usuarios · empresas · charlas). Borrado forzado disponible.</p>
        </div>

        <div className={styles.headActions}>
          <Link href="/app" className="btn btnGhost">
            ← Volver
          </Link>
          <button type="button" className="btn btnPrimary" onClick={loadUsers}>
            {loadingUsers ? "…" : "Actualizar"}
          </button>
          <button type="button" className="btn btnGhost" onClick={() => seedDemo(false)}>
            + Demo
          </button>
          <button type="button" className="btn btnGhost" onClick={() => seedDemo(true)}>
            Reset Demo
          </button>
        </div>
      </div>

      {err ? <div className={styles.errBox}>{err}</div> : null}
      {ok ? <div className={styles.okBox}>{ok}</div> : null}

      <div className={styles.shell}>
        {/* Users list */}
        <div className={styles.left}>
          <div className={styles.leftHead}>
            <div className={styles.leftTitle}>Usuarios</div>
            <div className={styles.leftSub}>Ordenados por apellido</div>
          </div>

          <input
            className={`${styles.search} input`}
            placeholder="Buscar por apellido / nombre / email…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />

          <div className={styles.userList}>
            {loadingUsers ? (
              <div className={styles.skel}>Cargando usuarios…</div>
            ) : filteredUsers.length === 0 ? (
              <div className={styles.empty}>Sin resultados.</div>
            ) : (
              filteredUsers.map((u) => {
                const active = selectedUserId === u.id;
                const name = u.full_name || u.email || "Usuario";
                const last = u.last_name || "";

                return (
                  <button
                    key={u.id}
                    type="button"
                    className={`${styles.userCard} ${active ? styles.userCardActive : ""}`}
                    onClick={() => {
                      setSelectedUserId(u.id);
                      loadDetail(u.id);
                    }}
                  >
                    <div className={styles.userTop}>
                      <div className={styles.userName}>{name}</div>
                      {last ? <div className={styles.userTag}>{last}</div> : null}
                    </div>
                    <div className={styles.userEmail}>{u.email || "—"}</div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Detail */}
        <div className={styles.right}>
          {!selectedUserId ? (
            <div className={styles.placeholder}>
              <div className={styles.placeholderTitle}>Selecciona un usuario</div>
              <div className={styles.placeholderSub}>Verás sus empresas, charlas y acciones modo dios.</div>
            </div>
          ) : detailLoading ? (
            <div className={styles.placeholder}>Cargando detalle…</div>
          ) : !detail ? (
            <div className={styles.placeholder}>No pude cargar el detalle.</div>
          ) : (
            <>
              <div className={styles.detailHead}>
                <div>
                  <div className={styles.detailTitle}>{detail.user.user_metadata?.full_name || detail.user.email || "Usuario"}</div>
                  <div className={styles.detailSub}>
                    {detail.user.email || "—"} · Creado {fmtDate(detail.user.created_at)} · Último login {fmtDate(detail.user.last_sign_in_at)}
                  </div>
                </div>

                <div className={styles.detailPills}>
                  <span className={styles.pill}>{fmtInt(companies.length)} empresas</span>
                  <span className={styles.pill}>{fmtInt(sessions.length)} charlas</span>
                  <button type="button" className="btn btnDanger" onClick={() => forceDeleteUser(detail.user.id)}>
                    Eliminar usuario
                  </button>
                </div>
              </div>

              <div className={styles.detailGrid}>
                {/* Companies */}
                <div className={styles.panel}>
                  <div className={styles.panelHead}>
                    <div>
                      <div className={styles.panelTitle}>Empresas</div>
                      <div className={styles.panelSub}>Clic para ver sus charlas</div>
                    </div>
                  </div>

                  <div className={styles.companyList}>
                    {companies.length === 0 ? (
                      <div className={styles.empty}>Sin empresas.</div>
                    ) : (
                      companies.map((c) => {
                        const active = selectedCompanyId === c.id;
                        const logo = companyLogoPublicUrl(c.logo_path);
                        const st = c.stats || { sessions: 0, attendees: 0, pdfs: 0 };

                        return (
                          <div
                            key={c.id}
                            className={`${styles.companyCard} ${active ? styles.companyCardActive : ""}`}
                            onClick={() => setSelectedCompanyId(c.id)}
                            role="button"
                            tabIndex={0}
                          >
                            <div className={styles.companyTop}>
                              <div className={styles.logoBox} aria-hidden="true">
                                {logo ? <img className={styles.logoImg} src={logo} alt="" /> : <div className={styles.logoFallback}>LZ</div>}
                              </div>
                              <div className={styles.companyMeta}>
                                <div className={styles.companyName}>{c.name || "Empresa"}</div>
                                <div className={styles.companyRut}>{c.rut ? `RUT: ${c.rut}` : "RUT: —"}</div>
                              </div>
                            </div>

                            <div className={styles.companyPills}>
                              <span className={styles.pillSm}>{fmtInt(st.sessions)} charlas</span>
                              <span className={styles.pillSm}>{fmtInt(st.attendees)} asistentes</span>
                              <span className={styles.pillSm}>{fmtInt(st.pdfs)} PDFs</span>
                            </div>

                            <div className={styles.companyActions}>
                              <button
                                type="button"
                                className={styles.dangerBtn}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  forceDeleteCompany(c.id);
                                }}
                              >
                                Eliminar empresa
                              </button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* Sessions */}
                <div className={styles.panel}>
                  <div className={styles.panelHead}>
                    <div>
                      <div className={styles.panelTitle}>Charlas</div>
                      <div className={styles.panelSub}>
                        {selectedCompanyId ? "Filtrado por empresa" : "Selecciona una empresa"}
                      </div>
                    </div>
                  </div>

                  <div className={styles.sessionList}>
                    {!selectedCompanyId ? (
                      <div className={styles.placeholderSub}>Elige una empresa a la izquierda.</div>
                    ) : companySessions.length === 0 ? (
                      <div className={styles.empty}>Sin charlas en esta empresa.</div>
                    ) : (
                      companySessions.map((s) => {
                        const closed = isClosed(s);
                        return (
                          <div key={s.id} className={styles.sessionCard}>
                            <div className={styles.sessionTop}>
                              <div className={styles.sessionTitle}>{s.topic || "Charla"}</div>
                              <div className={`${styles.badge} ${closed ? styles.badgeClosed : styles.badgeOpen}`}>
                                {closed ? "Cerrada" : "Abierta"}
                              </div>
                            </div>
                            <div className={styles.sessionMeta}>
                              Código {s.code} · {fmtInt(Number(s.attendees_count) || 0)} asistentes
                            </div>
                            <div className={styles.sessionActions}>
                              <a className={styles.smallBtn} href={`/c/${s.code}`} target="_blank" rel="noreferrer">
                                Abrir
                              </a>
                              <a className={styles.smallBtnPrimary} href={`/admin/s/${s.code}`} target="_blank" rel="noreferrer">
                                Firmar
                              </a>
                              <button type="button" className={styles.dangerBtn} onClick={() => forceDeleteSession(s.id)}>
                                Eliminar charla
                              </button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
