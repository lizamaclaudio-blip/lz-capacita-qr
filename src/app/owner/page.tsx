"use client";

import { useEffect, useMemo, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/browser";

type Overview = any;

export default function OwnerPage() {
  const [token, setToken] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [data, setData] = useState<Overview | null>(null);

  const [tab, setTab] = useState<"users" | "companies" | "sessions" | "pdfs">("users");

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

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
    } catch {}
  }

  async function recoveryLink(userId: string) {
    if (!token) return;

    const res = await fetch(`/api/owner/users/${encodeURIComponent(userId)}/recovery-link`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ redirect_to: `${window.location.origin}/login` }),
    });

    const json = await res.json().catch(() => null);

    if (!res.ok) {
      alert(json?.error || "Error generando link");
      return;
    }

    const link = json?.action_link;
    if (!link) {
      alert("No se generó action_link.");
      return;
    }

    await copy(link);
    alert("✅ Link de recuperación copiado al portapapeles.");
  }

  return (
    <div style={{ maxWidth: 1180, margin: "0 auto", padding: 18, display: "grid", gap: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 950 }}>Panel Dueño</h1>
          <div style={{ fontSize: 12, opacity: 0.75 }}>
            Sesión: <b>{email || "—"}</b>
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
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
                <th style={{ textAlign: "right", padding: 10 }}>Empresas</th>
                <th style={{ textAlign: "right", padding: 10 }}>Charlas</th>
                <th style={{ textAlign: "right", padding: 10 }}>PDFs</th>
                <th style={{ textAlign: "left", padding: 10 }}>Acción</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u: any) => (
                <tr key={u.id} style={{ borderTop: "1px solid rgba(0,0,0,.08)" }}>
                  <td style={{ padding: 10 }}>{u.email || "—"}</td>
                  <td style={{ padding: 10 }}>{u.user_metadata?.full_name || "—"}</td>
                  <td style={{ padding: 10 }}>{u.user_metadata?.rut || "—"}</td>
                  <td style={{ padding: 10, textAlign: "right" }}>{u.companies_count ?? 0}</td>
                  <td style={{ padding: 10, textAlign: "right" }}>{u.sessions_count ?? 0}</td>
                  <td style={{ padding: 10, textAlign: "right" }}>{u.pdfs_count ?? 0}</td>
                  <td style={{ padding: 10 }}>
                    <button
                      onClick={() => recoveryLink(u.id)}
                      style={{
                        borderRadius: 10,
                        padding: "8px 10px",
                        border: "1px solid rgba(0,0,0,.12)",
                        background: "#fff",
                        fontWeight: 900,
                        cursor: "pointer",
                      }}
                    >
                      Link reset password
                    </button>
                  </td>
                </tr>
              ))}
              {!users.length && (
                <tr>
                  <td colSpan={7} style={{ padding: 10 }}>
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
                <th style={{ textAlign: "left", padding: 10 }}>Owner ID</th>
                <th style={{ textAlign: "left", padding: 10 }}>Creada</th>
              </tr>
            </thead>
            <tbody>
              {companies.map((c: any) => (
                <tr key={c.id} style={{ borderTop: "1px solid rgba(0,0,0,.08)" }}>
                  <td style={{ padding: 10 }}>{c.name}</td>
                  <td style={{ padding: 10 }}>{c.rut || "—"}</td>
                  <td style={{ padding: 10, fontFamily: "monospace", fontSize: 12 }}>{c.owner_id || "—"}</td>
                  <td style={{ padding: 10 }}>{c.created_at ? new Date(c.created_at).toLocaleString("es-CL") : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === "sessions" && (
        <div style={{ border: "1px solid rgba(0,0,0,.10)", borderRadius: 14, overflow: "hidden" }}>
          <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
            <thead style={{ background: "rgba(0,0,0,.03)" }}>
              <tr>
                <th style={{ textAlign: "left", padding: 10 }}>Código</th>
                <th style={{ textAlign: "left", padding: 10 }}>Tema</th>
                <th style={{ textAlign: "left", padding: 10 }}>Empresa</th>
                <th style={{ textAlign: "left", padding: 10 }}>Estado</th>
                <th style={{ textAlign: "left", padding: 10 }}>Owner</th>
                <th style={{ textAlign: "left", padding: 10 }}>PDF</th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((s: any) => (
                <tr key={s.id} style={{ borderTop: "1px solid rgba(0,0,0,.08)" }}>
                  <td style={{ padding: 10, fontFamily: "monospace" }}>{s.code}</td>
                  <td style={{ padding: 10 }}>{s.topic || "—"}</td>
                  <td style={{ padding: 10 }}>{s.companies?.name || "—"}</td>
                  <td style={{ padding: 10 }}>{s.status}</td>
                  <td style={{ padding: 10, fontFamily: "monospace", fontSize: 12 }}>{s.owner_id}</td>
                  <td style={{ padding: 10 }}>{s.pdf_path ? "✅" : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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
                <th style={{ textAlign: "left", padding: 10 }}>PDF Path</th>
              </tr>
            </thead>
            <tbody>
              {pdfs.map((p: any) => (
                <tr key={p.pdf_path} style={{ borderTop: "1px solid rgba(0,0,0,.08)" }}>
                  <td style={{ padding: 10, fontFamily: "monospace" }}>{p.code}</td>
                  <td style={{ padding: 10 }}>{p.topic || "—"}</td>
                  <td style={{ padding: 10 }}>{p.company_name || "—"}</td>
                  <td style={{ padding: 10, fontFamily: "monospace", fontSize: 12 }}>{p.owner_id}</td>
                  <td style={{ padding: 10, fontFamily: "monospace", fontSize: 12 }}>{p.pdf_path}</td>
                </tr>
              ))}
              {!pdfs.length && (
                <tr>
                  <td colSpan={5} style={{ padding: 10 }}>
                    Sin PDFs…
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <div style={{ fontSize: 12, opacity: 0.7, paddingTop: 8 }}>
        Tip: si te sale “Not owner”, revisa que tu correo esté en <b>OWNER_EMAILS</b> en Vercel.
      </div>
    </div>
  );
}