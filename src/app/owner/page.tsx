"use client";

import { useEffect, useMemo, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/browser";

type Overview = any;

function fmtCL(x?: string | null) {
  if (!x) return "—";
  try {
    return new Date(x).toLocaleString("es-CL");
  } catch {
    return "—";
  }
}

function randomPassword(len = 12) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%";
  let out = "";
  for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

export default function OwnerPage() {
  const [token, setToken] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [data, setData] = useState<Overview | null>(null);

  const [tab, setTab] = useState<"users" | "companies" | "sessions" | "pdfs">("users");

  // filters
  const [q, setQ] = useState("");

  // session drilldown
  const [openSessionId, setOpenSessionId] = useState<string | null>(null);
  const [attendeesLoading, setAttendeesLoading] = useState(false);
  const [attendeesErr, setAttendeesErr] = useState<string | null>(null);
  const [attendeesData, setAttendeesData] = useState<any>(null);

  useEffect(() => {
    let mounted = true;

    supabaseBrowser.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setToken(data.session?.access_token ?? null);
      setEmail(data.session?.user?.email ?? null);
    });

    const { data: sub } = supabaseBrowser.auth.onAuthStateChange((_evt, session) => {
      setToken(session?.access_token ?? null);
      setEmail(session?.user?.email ?? null);
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
    } catch {}
  }

  async function load() {
    setErr(null);
    setLoading(true);
    setData(null);

    if (!token) {
      setErr("Debes iniciar sesión para entrar al panel dueño.");
      setLoading(false);
      return;
    }

    const res = await fetch("/api/owner/overview", {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });

    const json = await res.json().catch(() => null);

    if (!res.ok) {
      setErr(json?.error || "No se pudo cargar el panel dueño");
      setLoading(false);
      return;
    }

    setData(json);
    setLoading(false);
  }

  useEffect(() => {
    if (!token) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const stats = data?.stats ?? null;

  const users = useMemo(() => data?.users ?? [], [data]);
  const companies = useMemo(() => data?.companies ?? [], [data]);
  const sessions = useMemo(() => data?.sessions ?? [], [data]);
  const pdfs = useMemo(() => data?.pdfs ?? [], [data]);

  const qNorm = q.trim().toLowerCase();

  const usersF = useMemo(() => {
    if (!qNorm) return users;
    return users.filter((u: any) => {
      const e = String(u.email ?? "").toLowerCase();
      const n = String(u.user_metadata?.full_name ?? "").toLowerCase();
      const r = String(u.user_metadata?.rut ?? "").toLowerCase();
      return e.includes(qNorm) || n.includes(qNorm) || r.includes(qNorm);
    });
  }, [users, qNorm]);

  const companiesF = useMemo(() => {
    if (!qNorm) return companies;
    return companies.filter((c: any) => {
      const n = String(c.name ?? "").toLowerCase();
      const r = String(c.rut ?? "").toLowerCase();
      const o = String(c.owner_email ?? "").toLowerCase();
      return n.includes(qNorm) || r.includes(qNorm) || o.includes(qNorm);
    });
  }, [companies, qNorm]);

  const sessionsF = useMemo(() => {
    if (!qNorm) return sessions;
    return sessions.filter((s: any) => {
      const code = String(s.code ?? "").toLowerCase();
      const topic = String(s.topic ?? "").toLowerCase();
      const owner = String(s.owner_email ?? "").toLowerCase();
      const comp = String(s.companies?.name ?? "").toLowerCase();
      return code.includes(qNorm) || topic.includes(qNorm) || owner.includes(qNorm) || comp.includes(qNorm);
    });
  }, [sessions, qNorm]);

  const pdfsF = useMemo(() => {
    if (!qNorm) return pdfs;
    return pdfs.filter((p: any) => {
      const code = String(p.code ?? "").toLowerCase();
      const topic = String(p.topic ?? "").toLowerCase();
      const owner = String(p.owner_email ?? "").toLowerCase();
      const comp = String(p.company_name ?? "").toLowerCase();
      const path = String(p.pdf_path ?? "").toLowerCase();
      return code.includes(qNorm) || topic.includes(qNorm) || owner.includes(qNorm) || comp.includes(qNorm) || path.includes(qNorm);
    });
  }, [pdfs, qNorm]);

  async function generateMagicLink(userId: string) {
    if (!token) return;
    const res = await fetch(`/api/owner/users/${encodeURIComponent(userId)}/magic-link`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ redirect_to: `${window.location.origin}/app` }),
    });
    const json = await res.json().catch(() => null);
    if (!res.ok) return alert(json?.error || "Error generando magic link");
    if (!json?.action_link) return alert("No se generó link.");
    await copy(json.action_link);
    alert("✅ Magic link copiado. Ábrelo en ventana incógnita para no salirte del owner.");
  }

  async function resetPassword(userId: string) {
    if (!token) return;
    const suggested = randomPassword(12);
    const p = prompt("Password temporal (min 8):", suggested);
    if (!p) return;
    const res = await fetch(`/api/owner/users/${encodeURIComponent(userId)}/set-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ password: p }),
    });
    const json = await res.json().catch(() => null);
    if (!res.ok) return alert(json?.error || "Error seteando password");
    await copy(p);
    alert("✅ Password seteado y copiado al portapapeles.");
  }

  async function banUser(userId: string, action: "ban" | "unban") {
    if (!token) return;
    const ok = confirm(action === "ban" ? "¿Bloquear usuario?" : "¿Desbloquear usuario?");
    if (!ok) return;

    const res = await fetch(`/api/owner/users/${encodeURIComponent(userId)}/ban`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ action }),
    });
    const json = await res.json().catch(() => null);
    if (!res.ok) return alert(json?.error || "Error");
    alert(action === "ban" ? "✅ Usuario bloqueado" : "✅ Usuario desbloqueado");
    load();
  }

  async function openAttendees(sessionId: string) {
    if (!token) return;
    setOpenSessionId(sessionId);
    setAttendeesLoading(true);
    setAttendeesErr(null);
    setAttendeesData(null);

    const res = await fetch(`/api/owner/sessions/${encodeURIComponent(sessionId)}/attendees`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });

    const json = await res.json().catch(() => null);
    if (!res.ok) {
      setAttendeesErr(json?.error || "Error cargando asistentes");
      setAttendeesLoading(false);
      return;
    }

    setAttendeesData(json);
    setAttendeesLoading(false);
  }

  async function openPdf(sessionId: string) {
    if (!token) return;
    const res = await fetch(`/api/owner/sessions/${encodeURIComponent(sessionId)}/pdf-url`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    const json = await res.json().catch(() => null);
    if (!res.ok) return alert(json?.error || "No se pudo obtener PDF");
    if (json?.signed_url) window.open(json.signed_url, "_blank", "noopener,noreferrer");
  }

  return (
    <div style={{ maxWidth: 1240, margin: "0 auto", padding: 18, display: "grid", gap: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 950 }}>Owner Console</h1>
          <div style={{ fontSize: 12, opacity: 0.75 }}>
            Sesión: <b>{email || "—"}</b>
          </div>
        </div>

        <button
          onClick={load}
          style={{
            borderRadius: 12,
            padding: "10px 12px",
            border: "none",
            background: "#0b1220",
            color: "#fff",
            fontWeight: 900,
            cursor: "pointer",
            opacity: loading ? 0.7 : 1,
          }}
          disabled={loading}
        >
          {loading ? "Cargando..." : "Recargar"}
        </button>
      </div>

      {err && (
        <div style={{ padding: "10px 12px", borderRadius: 12, background: "#fff1f1", border: "1px solid #ffd0d0", color: "#9b1c1c", fontWeight: 850 }}>
          {err}
        </div>
      )}

      {stats && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 10 }}>
          {[
            ["Usuarios", stats.users],
            ["Empresas", stats.companies],
            ["Charlas", stats.sessions],
            ["PDFs", stats.pdfs],
          ].map(([k, v]) => (
            <div key={k as string} style={{ border: "1px solid rgba(0,0,0,.1)", borderRadius: 14, padding: 12 }}>
              <div style={{ fontSize: 12, opacity: 0.7 }}>{k}</div>
              <div style={{ fontSize: 22, fontWeight: 950 }}>{v as any}</div>
            </div>
          ))}
        </div>
      )}

      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Buscar por email / nombre / RUT / empresa / código…"
        style={{ borderRadius: 12, padding: "10px 12px", border: "1px solid rgba(0,0,0,.12)" }}
      />

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {(["users", "companies", "sessions", "pdfs"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              borderRadius: 999,
              padding: "8px 12px",
              border: "1px solid rgba(0,0,0,.12)",
              background: tab === t ? "#0b1220" : "#fff",
              color: tab === t ? "#fff" : "#111",
              fontWeight: 900,
              cursor: "pointer",
            }}
          >
            {t === "users" ? "Usuarios" : t === "companies" ? "Empresas" : t === "sessions" ? "Charlas" : "PDFs"}
          </button>
        ))}
      </div>

      {tab === "users" && (
        <div style={{ border: "1px solid rgba(0,0,0,.10)", borderRadius: 14, overflow: "hidden" }}>
          <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
            <thead style={{ background: "rgba(0,0,0,.03)" }}>
              <tr>
                <th style={{ textAlign: "left", padding: 10 }}>Email</th>
                <th style={{ textAlign: "left", padding: 10 }}>Nombre</th>
                <th style={{ textAlign: "left", padding: 10 }}>RUT</th>
                <th style={{ textAlign: "left", padding: 10 }}>Baneo</th>
                <th style={{ textAlign: "right", padding: 10 }}>Empresas</th>
                <th style={{ textAlign: "right", padding: 10 }}>Charlas</th>
                <th style={{ textAlign: "right", padding: 10 }}>PDFs</th>
                <th style={{ textAlign: "left", padding: 10 }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {usersF.map((u: any) => {
                const banned = !!u.banned_until && new Date(u.banned_until).getTime() > Date.now();
                return (
                  <tr key={u.id} style={{ borderTop: "1px solid rgba(0,0,0,.08)" }}>
                    <td style={{ padding: 10 }}>{u.email || "—"}</td>
                    <td style={{ padding: 10 }}>{u.user_metadata?.full_name || "—"}</td>
                    <td style={{ padding: 10 }}>{u.user_metadata?.rut || "—"}</td>
                    <td style={{ padding: 10 }}>{banned ? `🚫 hasta ${fmtCL(u.banned_until)}` : "—"}</td>
                    <td style={{ padding: 10, textAlign: "right" }}>{u.companies_count ?? 0}</td>
                    <td style={{ padding: 10, textAlign: "right" }}>{u.sessions_count ?? 0}</td>
                    <td style={{ padding: 10, textAlign: "right" }}>{u.pdfs_count ?? 0}</td>
                    <td style={{ padding: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <button onClick={() => generateMagicLink(u.id)} style={{ borderRadius: 10, padding: "8px 10px", border: "1px solid rgba(0,0,0,.12)", background: "#fff", fontWeight: 900, cursor: "pointer" }}>
                        Impersonate
                      </button>
                      <button onClick={() => resetPassword(u.id)} style={{ borderRadius: 10, padding: "8px 10px", border: "1px solid rgba(0,0,0,.12)", background: "#fff", fontWeight: 900, cursor: "pointer" }}>
                        Set password
                      </button>
                      <button
                        onClick={() => banUser(u.id, banned ? "unban" : "ban")}
                        style={{
                          borderRadius: 10,
                          padding: "8px 10px",
                          border: "1px solid rgba(0,0,0,.12)",
                          background: banned ? "#fff7ed" : "#fff1f1",
                          fontWeight: 900,
                          cursor: "pointer",
                        }}
                      >
                        {banned ? "Unban" : "Ban"}
                      </button>
                    </td>
                  </tr>
                );
              })}
              {!usersF.length && (
                <tr>
                  <td colSpan={8} style={{ padding: 10 }}>
                    Sin usuarios…
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {tab === "companies" && (
        <div style={{ border: "1px solid rgba(0,0,0,.10)", borderRadius: 14, overflow: "hidden" }}>
          <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
            <thead style={{ background: "rgba(0,0,0,.03)" }}>
              <tr>
                <th style={{ textAlign: "left", padding: 10 }}>Empresa</th>
                <th style={{ textAlign: "left", padding: 10 }}>RUT</th>
                <th style={{ textAlign: "left", padding: 10 }}>Owner</th>
                <th style={{ textAlign: "left", padding: 10 }}>Creada</th>
              </tr>
            </thead>
            <tbody>
              {companiesF.map((c: any) => (
                <tr key={c.id} style={{ borderTop: "1px solid rgba(0,0,0,.08)" }}>
                  <td style={{ padding: 10 }}>{c.name}</td>
                  <td style={{ padding: 10 }}>{c.rut || "—"}</td>
                  <td style={{ padding: 10 }}>{c.owner_email || c.owner_id || "—"}</td>
                  <td style={{ padding: 10 }}>{fmtCL(c.created_at)}</td>
                </tr>
              ))}
              {!companiesF.length && (
                <tr>
                  <td colSpan={4} style={{ padding: 10 }}>
                    Sin empresas…
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {tab === "sessions" && (
        <>
          <div style={{ border: "1px solid rgba(0,0,0,.10)", borderRadius: 14, overflow: "hidden" }}>
            <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
              <thead style={{ background: "rgba(0,0,0,.03)" }}>
                <tr>
                  <th style={{ textAlign: "left", padding: 10 }}>Código</th>
                  <th style={{ textAlign: "left", padding: 10 }}>Tema</th>
                  <th style={{ textAlign: "left", padding: 10 }}>Empresa</th>
                  <th style={{ textAlign: "left", padding: 10 }}>Owner</th>
                  <th style={{ textAlign: "left", padding: 10 }}>Estado</th>
                  <th style={{ textAlign: "right", padding: 10 }}>Asistentes</th>
                  <th style={{ textAlign: "left", padding: 10 }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {sessionsF.map((s: any) => (
                  <tr key={s.id} style={{ borderTop: "1px solid rgba(0,0,0,.08)" }}>
                    <td style={{ padding: 10, fontFamily: "monospace" }}>{s.code}</td>
                    <td style={{ padding: 10 }}>{s.topic || "—"}</td>
                    <td style={{ padding: 10 }}>{s.companies?.name || "—"}</td>
                    <td style={{ padding: 10 }}>{s.owner_email || s.owner_id || "—"}</td>
                    <td style={{ padding: 10 }}>{s.status}</td>
                    <td style={{ padding: 10, textAlign: "right" }}>{s.attendees_count ?? 0}</td>
                    <td style={{ padding: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <button onClick={() => openAttendees(s.id)} style={{ borderRadius: 10, padding: "8px 10px", border: "1px solid rgba(0,0,0,.12)", background: "#fff", fontWeight: 900, cursor: "pointer" }}>
                        Ver asistentes
                      </button>
                      <button onClick={() => openPdf(s.id)} style={{ borderRadius: 10, padding: "8px 10px", border: "1px solid rgba(0,0,0,.12)", background: "#fff", fontWeight: 900, cursor: "pointer" }}>
                        Abrir PDF
                      </button>
                    </td>
                  </tr>
                ))}
                {!sessionsF.length && (
                  <tr>
                    <td colSpan={7} style={{ padding: 10 }}>
                      Sin charlas…
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {openSessionId && (
            <div style={{ border: "1px solid rgba(0,0,0,.12)", borderRadius: 14, padding: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
                <div style={{ fontWeight: 950 }}>Asistentes · Session ID: <span style={{ fontFamily: "monospace" }}>{openSessionId}</span></div>
                <button
                  onClick={() => { setOpenSessionId(null); setAttendeesData(null); setAttendeesErr(null); }}
                  style={{ borderRadius: 10, padding: "8px 10px", border: "1px solid rgba(0,0,0,.12)", background: "#fff", fontWeight: 900, cursor: "pointer" }}
                >
                  Cerrar
                </button>
              </div>

              {attendeesLoading && <div style={{ paddingTop: 10, opacity: 0.75 }}>Cargando asistentes…</div>}
              {attendeesErr && <div style={{ paddingTop: 10, color: "#9b1c1c", fontWeight: 900 }}>{attendeesErr}</div>}

              {attendeesData?.attendees && (
                <div style={{ marginTop: 10, border: "1px solid rgba(0,0,0,.10)", borderRadius: 12, overflow: "hidden" }}>
                  <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
                    <thead style={{ background: "rgba(0,0,0,.03)" }}>
                      <tr>
                        <th style={{ textAlign: "left", padding: 10 }}>Nombre</th>
                        <th style={{ textAlign: "left", padding: 10 }}>RUT</th>
                        <th style={{ textAlign: "left", padding: 10 }}>Cargo</th>
                        <th style={{ textAlign: "left", padding: 10 }}>Hora</th>
                      </tr>
                    </thead>
                    <tbody>
                      {attendeesData.attendees.map((a: any, i: number) => (
                        <tr key={i} style={{ borderTop: "1px solid rgba(0,0,0,.08)" }}>
                          <td style={{ padding: 10 }}>{a.full_name}</td>
                          <td style={{ padding: 10 }}>{a.rut}</td>
                          <td style={{ padding: 10 }}>{a.role || "—"}</td>
                          <td style={{ padding: 10 }}>{fmtCL(a.created_at)}</td>
                        </tr>
                      ))}
                      {!attendeesData.attendees.length && (
                        <tr><td colSpan={4} style={{ padding: 10 }}>Sin asistentes…</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {tab === "pdfs" && (
        <div style={{ border: "1px solid rgba(0,0,0,.10)", borderRadius: 14, overflow: "hidden" }}>
          <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
            <thead style={{ background: "rgba(0,0,0,.03)" }}>
              <tr>
                <th style={{ textAlign: "left", padding: 10 }}>Código</th>
                <th style={{ textAlign: "left", padding: 10 }}>Tema</th>
                <th style={{ textAlign: "left", padding: 10 }}>Empresa</th>
                <th style={{ textAlign: "left", padding: 10 }}>Owner</th>
                <th style={{ textAlign: "left", padding: 10 }}>Generado</th>
                <th style={{ textAlign: "left", padding: 10 }}>Path</th>
              </tr>
            </thead>
            <tbody>
              {pdfsF.map((p: any) => (
                <tr key={p.pdf_path} style={{ borderTop: "1px solid rgba(0,0,0,.08)" }}>
                  <td style={{ padding: 10, fontFamily: "monospace" }}>{p.code}</td>
                  <td style={{ padding: 10 }}>{p.topic || "—"}</td>
                  <td style={{ padding: 10 }}>{p.company_name || "—"}</td>
                  <td style={{ padding: 10 }}>{p.owner_email || p.owner_id || "—"}</td>
                  <td style={{ padding: 10 }}>{fmtCL(p.pdf_generated_at)}</td>
                  <td style={{ padding: 10, fontFamily: "monospace", fontSize: 12 }}>{p.pdf_path}</td>
                </tr>
              ))}
              {!pdfsF.length && (
                <tr><td colSpan={6} style={{ padding: 10 }}>Sin PDFs…</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <div style={{ fontSize: 12, opacity: 0.7 }}>
        Si te sale “Not owner”, revisa <b>OWNER_EMAILS</b> y que estés logueado con ese correo.
      </div>
    </div>
  );
}