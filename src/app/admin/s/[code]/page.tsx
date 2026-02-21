"use client";

import { useParams } from "next/navigation";
import { useEffect, useState, useRef } from "react";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { SignaturePad, type SignaturePadRef } from "@/components/SignaturePad";

export default function AdminSession() {
  const params = useParams<{ code: string }>();
  const raw = (params?.code ?? "") as unknown as string | string[];
  const code = (Array.isArray(raw) ? raw[0] : raw).toUpperCase().trim();

  const [token, setToken] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);

  const [data, setData] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);

  const sigRef = useRef<SignaturePadRef | null>(null);
  const [closing, setClosing] = useState(false);
  const [closeMsg, setCloseMsg] = useState<string | null>(null);

  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [pdfMsg, setPdfMsg] = useState<string | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);

  useEffect(() => {
    let mounted = true;

    supabaseBrowser.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      const s = data.session;
      setToken(s?.access_token ?? null);
      setEmail(s?.user?.email ?? null);
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
    setCloseMsg(null);

    if (!token) {
      setErr("Debes iniciar sesión.");
      return;
    }

    const res = await fetch(`/api/admin/attendees?code=${encodeURIComponent(code)}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });

    const json = await res.json().catch(() => null);

    if (!res.ok) {
      setData(null);
      setErr(json?.error || "Error cargando asistentes");
      return;
    }

    setData(json);
  }

  useEffect(() => {
    if (!token) return;

    load();
    const t = setInterval(load, 3000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, code]);

  async function closeSession() {
    setCloseMsg(null);
    setErr(null);

    if (!token) return setCloseMsg("Debes iniciar sesión.");
    if (!sigRef.current || sigRef.current.isEmpty()) return setCloseMsg("Falta firma del relator 👇");

    const trainer_signature_data_url = sigRef.current.toPngDataUrl();
    if (!trainer_signature_data_url) return setCloseMsg("No se pudo capturar la firma.");

    setClosing(true);
    try {
      const res = await fetch("/api/admin/close-session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ code, trainer_signature_data_url }),
      });

      const json = await res.json().catch(() => null);

      if (!res.ok) {
        setCloseMsg(json?.error || "Error cerrando charla");
        return;
      }

      setCloseMsg("✅ Charla cerrada con firma del relator.");
      sigRef.current?.clear();
      await load();
    } finally {
      setClosing(false);
    }
  }

  async function generatePdf() {
    setPdfMsg(null);
    setPdfUrl(null);
    setErr(null);

    if (!token) return setPdfMsg("Debes iniciar sesión.");

    setPdfLoading(true);
    try {
      const res = await fetch("/api/admin/generate-pdf", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ code }),
      });

      const json = await res.json().catch(() => null);

      if (!res.ok) {
        setPdfMsg(json?.error || "Error generando PDF");
        return;
      }

      setPdfMsg("✅ PDF generado.");
      setPdfUrl(json?.signed_url || null);

      if (json?.signed_url) window.open(json.signed_url, "_blank", "noopener,noreferrer");
    } finally {
      setPdfLoading(false);
    }
  }

  async function logout() {
    await supabaseBrowser.auth.signOut();
  }

  const session = data?.session;
  const attendees = data?.attendees ?? [];
  const status = session?.status ?? "—";
  const isOpen = String(status).toLowerCase() === "open";

  return (
    <div style={{ maxWidth: 980, margin: "0 auto", padding: 20, display: "grid", gap: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 900, margin: 0 }}>Admin · Asistentes</h1>
          <div style={{ fontSize: 13, opacity: 0.8 }}>
            Código: <b>{code}</b>
          </div>
          <div style={{ fontSize: 12, opacity: 0.7 }}>
            Sesión: <b>{email || "—"}</b>
          </div>
        </div>

        <button
          onClick={logout}
          style={{
            borderRadius: 12,
            padding: "10px 12px",
            border: "1px solid rgba(0,0,0,.12)",
            background: "#fff",
            fontWeight: 900,
            cursor: "pointer",
          }}
        >
          Cerrar sesión
        </button>
      </div>

      {err && (
        <div style={{ padding: "10px 12px", borderRadius: 12, background: "#fff1f1", border: "1px solid #ffd0d0", color: "#9b1c1c", fontWeight: 850 }}>
          {err}
        </div>
      )}

      {session && (
        <div style={{ border: "1px solid rgba(0,0,0,.10)", borderRadius: 14, padding: 12, fontSize: 13, display: "grid", gap: 4 }}>
          <div><b>Empresa:</b> {session.companies?.name}</div>
          <div><b>Dirección:</b> {session.companies?.address || "-"}</div>
          <div><b>Charla:</b> {session.topic}</div>
          <div><b>Lugar:</b> {session.location || "-"}</div>
          <div><b>Relator:</b> {session.trainer_name}</div>
          <div><b>Estado:</b> {status}{session.closed_at ? ` (cerrada: ${new Date(session.closed_at).toLocaleString("es-CL")})` : ""}</div>
          <div><b>Total asistentes:</b> {attendees.length}</div>
        </div>
      )}

      <div style={{ border: "1px solid rgba(0,0,0,.10)", borderRadius: 14, overflow: "hidden" }}>
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
            {attendees.map((a: any, i: number) => (
              <tr key={i} style={{ borderTop: "1px solid rgba(0,0,0,.08)" }}>
                <td style={{ padding: 10 }}>{a.full_name}</td>
                <td style={{ padding: 10 }}>{a.rut}</td>
                <td style={{ padding: 10 }}>{a.role || "-"}</td>
                <td style={{ padding: 10 }}>{new Date(a.created_at).toLocaleString("es-CL")}</td>
              </tr>
            ))}
            {!attendees.length && (
              <tr><td style={{ padding: 10 }} colSpan={4}>Aún no hay asistentes…</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {session && isOpen && (
        <div style={{ border: "1px solid rgba(0,0,0,.10)", borderRadius: 14, padding: 12, display: "grid", gap: 10 }}>
          <div style={{ fontWeight: 950 }}>Cerrar charla (firma relator)</div>

          <div style={{ border: "1px solid rgba(0,0,0,.12)", borderRadius: 14, overflow: "hidden", background: "#fff" }}>
            <SignaturePad ref={sigRef} height={220} />
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button
              style={{ flex: 1, minWidth: 160, borderRadius: 12, padding: "10px 12px", border: "1px solid rgba(0,0,0,.12)", background: "#fff", fontWeight: 900, cursor: "pointer" }}
              onClick={() => sigRef.current?.clear()}
              disabled={closing}
            >
              Limpiar firma
            </button>

            <button
              style={{ flex: 1, minWidth: 160, borderRadius: 12, padding: "10px 12px", border: "none", background: "#0b1220", color: "#fff", fontWeight: 950, cursor: "pointer", opacity: closing ? 0.7 : 1 }}
              disabled={closing}
              onClick={closeSession}
            >
              {closing ? "Cerrando..." : "Firmar y cerrar"}
            </button>
          </div>

          {closeMsg && <div style={{ fontSize: 13, fontWeight: 900, opacity: 0.85 }}>{closeMsg}</div>}
        </div>
      )}

      {session && !isOpen && (
        <div style={{ border: "1px solid rgba(0,0,0,.10)", borderRadius: 14, padding: 12, display: "grid", gap: 10 }}>
          <div style={{ fontWeight: 950 }}>PDF del registro</div>

          <button
            style={{ borderRadius: 12, padding: "10px 12px", border: "none", background: "#0b1220", color: "#fff", fontWeight: 950, cursor: "pointer", opacity: pdfLoading ? 0.7 : 1 }}
            disabled={pdfLoading}
            onClick={generatePdf}
          >
            {pdfLoading ? "Generando..." : "Generar PDF"}
          </button>

          {pdfMsg && <div style={{ fontSize: 13, fontWeight: 900, opacity: 0.85 }}>{pdfMsg}</div>}

          {pdfUrl && (
            <a style={{ fontSize: 13, textDecoration: "underline", wordBreak: "break-all" }} href={pdfUrl} target="_blank" rel="noreferrer">
              Descargar PDF
            </a>
          )}
        </div>
      )}
    </div>
  );
}