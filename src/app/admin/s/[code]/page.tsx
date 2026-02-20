"use client";

import { useParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import SignatureCanvas from "react-signature-canvas";

export default function AdminSession() {
  const params = useParams<{ code: string }>();
  const raw = (params?.code ?? "") as unknown as string | string[];
  const code = (Array.isArray(raw) ? raw[0] : raw).toUpperCase();

  const [passcode, setPasscode] = useState("");
  const [data, setData] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);

  const sigRef = useRef<SignatureCanvas | null>(null);
  const [mounted, setMounted] = useState(false);

  const [closing, setClosing] = useState(false);
  const [closeMsg, setCloseMsg] = useState<string | null>(null);

  // ✅ PDF states
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [pdfMsg, setPdfMsg] = useState<string | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);

  useEffect(() => setMounted(true), []);

  // si cambia el código, limpiamos el link del PDF
  useEffect(() => {
    setPdfUrl(null);
    setPdfMsg(null);
  }, [code]);

  async function load() {
    setErr(null);

    const res = await fetch(
      `/api/admin/attendees?code=${code}&passcode=${encodeURIComponent(passcode)}`
    );
    const json = await res.json();
    if (!res.ok) return setErr(json.error || "Error");
    setData(json);
  }

  useEffect(() => {
    if (!passcode) return;

    load();
    const t = setInterval(() => {
      load();
    }, 3000);

    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [passcode, code]);

  async function closeSession() {
    setCloseMsg(null);
    const sig = sigRef.current;

    if (!passcode) return setCloseMsg("Falta passcode");
    if (!sig || sig.isEmpty()) return setCloseMsg("Falta firma del relator 👇");

    setClosing(true);
    const trainer_signature_data_url = sig.getTrimmedCanvas().toDataURL("image/png");

    const res = await fetch("/api/admin/close-session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ passcode, code, trainer_signature_data_url }),
    });

    const json = await res.json();
    setClosing(false);

    if (!res.ok) return setCloseMsg(json.error || "Error");
    setCloseMsg("✅ Charla cerrada con firma del relator.");
    sig.clear();
    load();
  }

  async function generatePdf() {
    setPdfMsg(null);
    setPdfUrl(null);

    if (!passcode) return setPdfMsg("Falta passcode");

    setPdfLoading(true);
    const res = await fetch("/api/admin/generate-pdf", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ passcode, code }),
    });

    const json = await res.json();
    setPdfLoading(false);

    if (!res.ok) return setPdfMsg(json.error || "Error generando PDF");
    setPdfMsg("✅ PDF generado.");
    setPdfUrl(json.signed_url);
  }

  const session = data?.session;
  const attendees = data?.attendees ?? [];
  const status = session?.status ?? "—";

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-4">
      <h1 className="text-2xl font-bold">Admin · Asistentes</h1>
      <p className="text-sm text-gray-600">
        Código: <b>{code}</b>
      </p>

      <div className="flex gap-2">
        <input
          className="flex-1 border rounded p-2"
          placeholder="Passcode admin"
          value={passcode}
          onChange={(e) => setPasscode(e.target.value)}
        />
        <button className="bg-black text-white rounded px-4" onClick={load}>
          Cargar
        </button>
      </div>

      {err && <p className="text-red-600">{err}</p>}

      {session && (
        <div className="text-sm text-gray-700 border rounded p-3 space-y-1">
          <div>
            <b>Empresa:</b> {session.companies?.name}
          </div>
          <div>
            <b>Dirección:</b> {session.companies?.address || "-"}
          </div>
          <div>
            <b>Charla:</b> {session.topic}
          </div>
          <div>
            <b>Lugar:</b> {session.location || "-"}
          </div>
          <div>
            <b>Relator:</b> {session.trainer_name}
          </div>
          <div>
            <b>Estado:</b> {status}
            {session.closed_at ? ` (cerrada: ${new Date(session.closed_at).toLocaleString()})` : ""}
          </div>
          <div>
            <b>Total asistentes:</b> {attendees.length}
          </div>
        </div>
      )}

      <div className="border rounded">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left p-2">Nombre</th>
              <th className="text-left p-2">RUT</th>
              <th className="text-left p-2">Cargo</th>
              <th className="text-left p-2">Hora</th>
            </tr>
          </thead>
          <tbody>
            {attendees.map((a: any, i: number) => (
              <tr key={i} className="border-t">
                <td className="p-2">{a.full_name}</td>
                <td className="p-2">{a.rut}</td>
                <td className="p-2">{a.role || "-"}</td>
                <td className="p-2">{new Date(a.created_at).toLocaleString()}</td>
              </tr>
            ))}
            {!attendees.length && (
              <tr>
                <td className="p-2" colSpan={4}>
                  Aún no hay asistentes…
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Cerrar charla */}
      {session && session.status === "open" && (
        <div className="border rounded p-4 space-y-2">
          <h2 className="font-semibold">Cerrar charla (firma relator)</h2>

          <div className="border rounded">
            {mounted ? (
              <SignatureCanvas
  ref={(r) => {
    sigRef.current = r;
  }}
  canvasProps={{ width: 900, height: 200, className: "w-full h-[200px]" }}
/>
            ) : (
              <div className="w-full h-[200px]" />
            )}
          </div>

          <div className="flex gap-2">
            <button className="flex-1 border rounded p-2" onClick={() => sigRef.current?.clear()}>
              Limpiar firma relator
            </button>
            <button
              className="flex-1 bg-black text-white rounded p-2"
              disabled={closing}
              onClick={closeSession}
            >
              {closing ? "Cerrando..." : "Firmar y cerrar"}
            </button>
          </div>

          {closeMsg && <p className="text-sm">{closeMsg}</p>}
        </div>
      )}

      {/* Si está cerrada */}
      {session && session.status !== "open" && (
        <div className="border rounded p-4 text-sm space-y-3">
          <div>✅ Esta charla ya está cerrada.</div>

          {/* Generar PDF */}
          <div className="border rounded p-4 space-y-2">
            <h2 className="font-semibold">PDF del registro</h2>

            <button
              className="w-full bg-black text-white rounded p-2"
              disabled={pdfLoading}
              onClick={generatePdf}
            >
              {pdfLoading ? "Generando..." : "Generar PDF"}
            </button>

            {pdfMsg && <p className="text-sm">{pdfMsg}</p>}

            {pdfUrl && (
              <a className="text-sm underline break-all" href={pdfUrl} target="_blank" rel="noreferrer">
                Descargar PDF
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}