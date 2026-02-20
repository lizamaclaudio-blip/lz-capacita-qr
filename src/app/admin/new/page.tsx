"use client";

import { useState } from "react";
import { QRCodeCanvas } from "qrcode.react";

export default function AdminNew() {
  const [passcode, setPasscode] = useState("");
  const [company_name, setCompanyName] = useState("");
  const [company_address, setCompanyAddress] = useState("");
  const [topic, setTopic] = useState("");
  const [location, setLocation] = useState("");
  const [trainer_name, setTrainerName] = useState("");
  const [trainer_email, setTrainerEmail] = useState("");

  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  async function create() {
    setError(null);
    setResult(null);

    const res = await fetch("/api/admin/create-session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        passcode,
        company_name,
        company_address,
        topic,
        location,
        trainer_name,
        trainer_email,
      }),
    });

    const data = await res.json();
    if (!res.ok) return setError(data.error || "Error");
    setResult(data);
  }

  return (
    <div className="max-w-xl mx-auto p-6 space-y-5">
      <h1 className="text-2xl font-bold">Crear charla (Admin)</h1>

      <div className="space-y-2">
        <label className="text-sm">Passcode admin</label>
        <input className="w-full border rounded p-2" value={passcode} onChange={(e) => setPasscode(e.target.value)} />
      </div>

      <div className="space-y-2">
        <label className="text-sm">Empresa</label>
        <input className="w-full border rounded p-2" value={company_name} onChange={(e) => setCompanyName(e.target.value)} />
      </div>

      <div className="space-y-2">
        <label className="text-sm">Dirección</label>
        <input className="w-full border rounded p-2" value={company_address} onChange={(e) => setCompanyAddress(e.target.value)} />
      </div>

      <div className="space-y-2">
        <label className="text-sm">Tema / Charla</label>
        <input className="w-full border rounded p-2" value={topic} onChange={(e) => setTopic(e.target.value)} />
      </div>

      <div className="space-y-2">
        <label className="text-sm">Lugar</label>
        <input className="w-full border rounded p-2" value={location} onChange={(e) => setLocation(e.target.value)} />
      </div>

      <div className="space-y-2">
        <label className="text-sm">Relator</label>
        <input className="w-full border rounded p-2" value={trainer_name} onChange={(e) => setTrainerName(e.target.value)} />
      </div>

      <div className="space-y-2">
        <label className="text-sm">Email relator (opcional)</label>
        <input className="w-full border rounded p-2" value={trainer_email} onChange={(e) => setTrainerEmail(e.target.value)} />
      </div>

      <button className="w-full bg-black text-white rounded p-2" onClick={create}>
        Crear charla + QR
      </button>

      {error && <p className="text-red-600">{error}</p>}

      {result && (
        <div className="border rounded p-4 space-y-3">
          <div className="font-semibold">Código: {result.code}</div>
          <div className="flex justify-center">
            <QRCodeCanvas value={result.public_url} size={220} />
          </div>
          <p className="text-sm break-all">Link público: {result.public_url}</p>
          <p className="text-sm break-all">Panel asistentes: {result.admin_url}</p>
        </div>
      )}
    </div>
  );
}