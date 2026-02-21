"use client";

import { useParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import SignatureCanvas from "react-signature-canvas";
import { supabaseBrowser } from "@/lib/supabase/browser";

type Mode = "authed" | "passcode";

export default function AdminSession() {
  const params = useParams<{ code: string }>();
  const raw = (params?.code ?? "") as unknown as string | string[];
  const code = (Array.isArray(raw) ? raw[0] : raw).toUpperCase();

  const [mode, setMode] = useState<Mode>("passcode");

  const [token, setToken] = useState<string | null>(null);
  const tokenRef = useRef<string | null>(null);

  const [passcode, setPasscode] = useState("");
  const [data, setData] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);

  const sigRef = useRef<SignatureCanvas | null>(null);
  const [mounted, setMounted] = useState(false);

  const [closing, setClosing] = useState(false);
  const [closeMsg, setCloseMsg] = useState<string | null>(null);

  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [pdfMsg, setPdfMsg] = useState<string | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    setPdfUrl(null);
    setPdfMsg(null);
    setData(null);
    setErr(null);
    setCloseMsg(null);
  }, [code]);

  useEffect(() => {
    let alive = true;

    async function boot() {
      const { data } = await supabaseBrowser.auth.getSession();
      const t = data.session?.access_token ?? null;

      if (!alive) return;

      setToken(t);
      tokenRef.current = t;
      setMode(t ? "authed" : "passcode");
    }

    boot();

    const { data: sub } = supabaseBrowser.auth.onAuthStateChange((_evt, session) => {
      const t = session?.access_token ?? null;
      setToken(t);
      tokenRef.current = t;
      setMode(t ? "authed" : "passcode");
    });

    return () => {
      alive = false;
      sub?.subscription?.unsubscribe();
    };
  }, []);

  async function loadAuthed() {
    setErr(null);

    const t = tokenRef.current ?? token;
    if (!t) {
      setErr("No hay sesión activa. Usa passcode.");
      setMode("passcode");
      return;
    }

    const res = await fetch(`/api/app/admin/attendees?code=${encodeURIComponent(code)}`, {
      headers: { Authorization: `Bearer ${t}` },
      cache: "no-store",
    });

    const json = await res.json().catch(() => null);
    if (!res.ok) {
      setErr(json?.error || "No pude cargar por sesión. Usa passcode.");
      setMode("passcode");
      return;
    }

    setData(json);
  }

  async function loadPasscode() {
    setErr(null);
    if (!passcode) return setErr("Falta passcode");

    const res = await fetch(
      `/api/admin/attendees?code=${encodeURIComponent(code)}&passcode=${encodeURIComponent(passcode)}`,
      { cache: "no-store" }
    );
    const json = await res.json().catch(() => null);
    if (!res.ok) return setErr(json?.error || "Error");
    setData(json);
  }

  useEffect(() => {
    if (mode === "authed") {
      loadAuthed();
      const t = setInterval(() => loadAuthed(), 3000);
      return () => clearInterval(t);
    }

    if (!passcode) return;
    loadPasscode();
    const t = setInterval(() => loadPasscode(), 3000);
    return () => clearInterval(t);

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, passcode, code]);

  async function closeSession() {
    setCloseMsg(null);

    const sig = sigRef.current;
    if (!sig || sig.isEmpty()) return setCloseMsg("Falta firma del relator 👇");

    const trainer_signature_data_url = sig.getTrimmedCanvas().toDataURL("image/png");
    setClosing(true);

    try {
      // ✅ AUTENTICADO: Bearer
      if (mode === "authed" && (tokenRef.current ?? token)) {
        const t = tokenRef.current ?? token;
        const res = await fetch("/api/admin/close-session", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${t}`,
          },
          body: JSON.stringify({ code, trainer_signature_data_url }),
        });

        const json = await res.json().catch(() => null);
        if (!res.ok) return setCloseMsg(json?.error || "Error");
        setCloseMsg("✅ Charla cerrada con firma del relator.");
        sig.clear();
        loadAuthed();
        return;
      }

      // 🔒 PASSCODE
      if (!passcode) return setCloseMsg("Falta passcode");
      const res = await fetch("/api/admin/close-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passcode, code, trainer_signature_data_url }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) return setCloseMsg(json?.error || "Error");
      setCloseMsg("✅ Charla cerrada con firma del relator.");
      sig.clear();
      loadPasscode();
    } finally {
      setClosing(false);
    }
  }

  async function generatePdf() {
    setPdfMsg(null);
    setPdfUrl(null);

    setPdfLoading(true);
    try {
      // ✅ AUTENTICADO: Bearer
      if (mode === "authed" && (tokenRef.current ?? token)) {
        const t = tokenRef.current ?? token;
        const res = await fetch("/api/admin/generate-pdf", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${t}`,
          },
          body: JSON.stringify({ code }),
        });

        const json = await res.json().catch(() => null);
        if (!res.ok) return setPdfMsg(json?.error || "Error generando PDF");
        setPdfMsg("✅ PDF generado.");
        setPdfUrl(json?.signed_url ?? null);
        return;
      }

      // 🔒 PASSCODE
      if (!passcode) return setPdfMsg("Falta passcode");
      const res = await fetch("/api/admin/generate-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passcode, code }),
      });

      const json = await res.json().catch(() => null);
      if (!res.ok) return setPdfMsg(json?.error || "Error generando PDF");
      setPdfMsg("✅ PDF generado.");
      setPdfUrl(json?.signed_url ?? null);
    } finally {
      setPdfLoading(false);
    }
  }

  const session = data?.session;
  const attendees = data?.attendees ?? [];
  const status = session?.status ?? "—";

  return (
    <div style={{ maxWidth: 980, margin: "0 auto", padding: 16 }}>
      <h1 style={{ fontSize: 22, fontWeight: 900 }}>Admin · Asistentes</h1>
      <p style={{ opacity: 0.75, marginTop: 6 }}>
        Código: <b>{code}</b>{" "}
        <span style={{ marginLeft: 10, padding: "4px 10px", borderRadius: 999, border: "1px solid rgba(0,0,0,.12)" }}>
          {mode === "authed" ? "✅ Acceso por sesión" : "🔒 Acceso por passcode"}
        </span>
      </p>

      {mode === "passcode" && (
        <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
          <input
            style={{ flex: 1, border: "1px solid rgba(0,0,0,.12)", borderRadius: 12, padding: "10px 12px" }}
            placeholder="Passcode admin"
            value={passcode}
            onChange={(e) => setPasscode(e.target.value)}
          />
          <button style={{ borderRadius: 12, padding: "10px 14px", fontWeight: 900, cursor: "pointer" }} onClick={loadPasscode}>
            Cargar
          </button>
        </div>
      )}

      {mode === "authed" && (
        <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
          <button style={{ borderRadius: 12, padding: "10px 14px", fontWeight: 900, cursor: "pointer" }} onClick={loadAuthed}>
            Actualizar
          </button>
        </div>
      )}

      {err && (
        <div style={{ marginTop: 12, padding: 10, borderRadius: 12, background: "#fff1f1", border: "1px solid #ffd0d0", color: "#9b1c1c", fontWeight: 900 }}>
          {err}
        </div>
      )}

      {session && (
        <div style={{ marginTop: 12, padding: 12, borderRadius: 12, border: "1px solid rgba(0,0,0,.12)", background: "#fff" }}>
          <div><b>Empresa:</b> {session.companies?.name}</div>
          <div><b>Dirección:</b> {session.companies?.address || "-"}</div>
          <div><b>Charla:</b> {session.topic}</div>
          <div><b>Lugar:</b> {session.location || "-"}</div>
          <div><b>Relator:</b> {session.trainer_name}</div>
          <div><b>Estado:</b> {status}{session.closed_at ? ` (cerrada: ${new Date(session.closed_at).toLocaleString("es-CL")})` : ""}</div>
          <div><b>Total asistentes:</b> {attendees.length}</div>
        </div>
      )}

      <div style={{ marginTop: 12, borderRadius: 12, overflow: "hidden", border: "1px solid rgba(0,0,0,.12)", background: "#fff" }}>
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
              <tr key={i} style={{ borderTop: "1px solid rgba(0,0,0,.06)" }}>
                <td style={{ padding: 10 }}>{a.full_name}</td>
                <td style={{ padding: 10 }}>{a.rut}</td>
                <td style={{ padding: 10 }}>{a.role || "-"}</td>
                <td style={{ padding: 10 }}>{new Date(a.created_at).toLocaleString("es-CL")}</td>
              </tr>
            ))}
            {!attendees.length && (
              <tr>
                <td style={{ padding: 10 }} colSpan={4}>
                  Aún no hay asistentes…
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {session && session.status === "open" && (
        <div style={{ marginTop: 14, padding: 14, borderRadius: 12, border: "1px solid rgba(0,0,0,.12)", background: "#fff" }}>
          <h2 style={{ fontWeight: 950 }}>Cerrar charla (firma relator)</h2>

          <div style={{ marginTop: 10, borderRadius: 12, overflow: "hidden", border: "1px solid rgba(0,0,0,.12)" }}>
            {mounted ? (
              <SignatureCanvas
                ref={(r) => {
                  sigRef.current = r;
                }}
                canvasProps={{ width: 900, height: 200, className: "w-full h-[200px]" }}
              />
            ) : (
              <div style={{ width: "100%", height: 200 }} />
            )}
          </div>

          <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
            <button
              style={{ flex: 1, borderRadius: 12, padding: "10px 12px", fontWeight: 900, cursor: "pointer", border: "1px solid rgba(0,0,0,.12)", background: "#fff" }}
              onClick={() => sigRef.current?.clear()}
            >
              Limpiar firma
            </button>
            <button
              style={{ flex: 1, borderRadius: 12, padding: "10px 12px", fontWeight: 950, cursor: "pointer", border: "none", background: "#0b1220", color: "#fff", opacity: closing ? 0.7 : 1 }}
              disabled={closing}
              onClick={closeSession}
            >
              {closing ? "Cerrando…" : "Firmar y cerrar"}
            </button>
          </div>

          {closeMsg && <p style={{ marginTop: 10, fontWeight: 900 }}>{closeMsg}</p>}
        </div>
      )}

      {session && session.status !== "open" && (
        <div style={{ marginTop: 14, padding: 14, borderRadius: 12, border: "1px solid rgba(0,0,0,.12)", background: "#fff" }}>
          <div style={{ fontWeight: 950 }}>✅ Esta charla ya está cerrada.</div>

          <div style={{ marginTop: 12, padding: 14, borderRadius: 12, border: "1px solid rgba(0,0,0,.10)", background: "rgba(0,0,0,.02)" }}>
            <h2 style={{ fontWeight: 950 }}>PDF del registro</h2>

            <button
              style={{ marginTop: 10, width: "100%", borderRadius: 12, padding: "10px 12px", fontWeight: 950, cursor: "pointer", border: "none", background: "#0b1220", color: "#fff", opacity: pdfLoading ? 0.7 : 1 }}
              disabled={pdfLoading}
              onClick={generatePdf}
            >
              {pdfLoading ? "Generando…" : "Generar PDF"}
            </button>

            {pdfMsg && <p style={{ marginTop: 10, fontWeight: 900 }}>{pdfMsg}</p>}

            {pdfUrl && (
              <a style={{ display: "block", marginTop: 10, textDecoration: "underline", wordBreak: "break-all" }} href={pdfUrl} target="_blank" rel="noreferrer">
                Descargar PDF
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}