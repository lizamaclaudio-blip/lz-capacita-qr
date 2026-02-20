"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

export default function AdminSession() {
  const params = useParams<{ code: string }>();
  const raw = (params?.code ?? "") as unknown as string | string[];
  const code = (Array.isArray(raw) ? raw[0] : raw).toUpperCase();

  const [passcode, setPasscode] = useState("");
  const [data, setData] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    setErr(null);
    const res = await fetch(`/api/admin/attendees?code=${code}&passcode=${encodeURIComponent(passcode)}`);
    const json = await res.json();
    if (!res.ok) return setErr(json.error || "Error");
    setData(json);
  }

  useEffect(() => {
    if (!passcode) return;
    load();
    const t = setInterval(load, 3000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [passcode]);

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-4">
      <h1 className="text-2xl font-bold">Admin · Asistentes</h1>
      <p className="text-sm text-gray-600">Código: <b>{code}</b></p>

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

      {data?.session && (
        <div className="text-sm text-gray-700 border rounded p-3">
          <div><b>Empresa:</b> {data.session.companies?.name}</div>
          <div><b>Dirección:</b> {data.session.companies?.address || "-"}</div>
          <div><b>Charla:</b> {data.session.topic}</div>
          <div><b>Lugar:</b> {data.session.location || "-"}</div>
          <div><b>Relator:</b> {data.session.trainer_name}</div>
          <div><b>Total asistentes:</b> {data.attendees?.length ?? 0}</div>
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
            {data?.attendees?.map((a: any, i: number) => (
              <tr key={i} className="border-t">
                <td className="p-2">{a.full_name}</td>
                <td className="p-2">{a.rut}</td>
                <td className="p-2">{a.role || "-"}</td>
                <td className="p-2">{new Date(a.created_at).toLocaleString()}</td>
              </tr>
            ))}
            {!data?.attendees?.length && (
              <tr>
                <td className="p-2" colSpan={4}>Aún no hay asistentes…</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}