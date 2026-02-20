"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/browser";

type Company = { id: string; name: string; address: string | null; created_at: string };
type SessionRow = {
  id: string;
  code: string;
  topic: string | null;
  location: string | null;
  session_date: string | null;
  trainer_name: string | null;
  status: string | null;
  closed_at: string | null;
  company_id: string | null;
};

export default function AppHome() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [loading, setLoading] = useState(true);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [q, setQ] = useState("");

  const error = searchParams?.get("e") ? decodeURIComponent(searchParams.get("e")!) : null;

  const filteredSessions = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return sessions;
    return sessions.filter((x) =>
      `${x.code} ${x.topic ?? ""} ${x.trainer_name ?? ""}`.toLowerCase().includes(s)
    );
  }, [q, sessions]);

  async function loadAll() {
    const { data } = await supabaseBrowser.auth.getSession();
    const session = data.session;
    if (!session) {
      router.replace("/login");
      return;
    }

    const token = session.access_token;

    const [cRes, sRes] = await Promise.all([
      fetch("/api/app/companies", { headers: { Authorization: `Bearer ${token}` } }),
      fetch("/api/app/sessions", { headers: { Authorization: `Bearer ${token}` } }),
    ]);

    const cJson = await cRes.json();
    const sJson = await sRes.json();

    if (!cRes.ok) {
      console.error(cJson);
      router.replace("/login");
      return;
    }
    if (!sRes.ok) {
      console.error(sJson);
      router.replace("/login");
      return;
    }

    setCompanies(cJson.companies ?? []);
    setSessions(sJson.sessions ?? []);
    setLoading(false);
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onCreateCompany(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const form = new FormData(e.currentTarget);
    const name = String(form.get("name") ?? "").trim();
    const address = String(form.get("address") ?? "").trim();

    const { data } = await supabaseBrowser.auth.getSession();
    const token = data.session?.access_token;
    if (!token) return router.replace("/login");

    const res = await fetch("/api/app/companies", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ name, address: address || null }),
    });

    const json = await res.json();
    if (!res.ok) {
      alert(json?.error || "No se pudo crear la empresa");
      return;
    }

    (e.currentTarget as HTMLFormElement).reset();
    await loadAll();
  }

  async function logout() {
    await supabaseBrowser.auth.signOut();
    router.replace("/login");
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Tu panel</h1>
          <p className="text-gray-600 text-sm">Crea empresas y revisa registros de charlas.</p>
        </div>
        <button onClick={logout} className="border rounded-lg px-3 py-2 text-sm hover:opacity-80 bg-white">
          Cerrar sesión
        </button>
      </div>

      {error && (
        <div className="text-sm text-red-600 border border-red-200 bg-red-50 p-3 rounded">
          {error}
        </div>
      )}

      <div className="bg-white border rounded-2xl p-5">
        <h2 className="font-semibold">Crear empresa</h2>
        <form onSubmit={onCreateCompany} className="mt-3 grid md:grid-cols-3 gap-3">
          <input name="name" className="border rounded p-2 md:col-span-1" placeholder="Nombre empresa" required />
          <input name="address" className="border rounded p-2 md:col-span-2" placeholder="Dirección (opcional)" />
          <button className="md:col-span-3 bg-black text-white rounded p-2">
            Guardar empresa
          </button>
        </form>
      </div>

      <div className="bg-white border rounded-2xl p-5">
        <h2 className="font-semibold">Tus empresas</h2>

        {loading ? (
          <p className="text-sm text-gray-600 mt-3">Cargando…</p>
        ) : !companies.length ? (
          <p className="text-sm text-gray-600 mt-3">Aún no creas ninguna empresa.</p>
        ) : (
          <div className="mt-3 grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {companies.map((c) => (
              <div key={c.id} className="border rounded-xl p-4 bg-gray-50">
                <div className="font-semibold">{c.name}</div>
                <div className="text-sm text-gray-600 mt-1">{c.address || "Sin dirección"}</div>
                <div className="text-xs text-gray-500 mt-2">ID: {c.id}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-white border rounded-2xl p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-semibold">Registros (Sesiones)</h2>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por código/tema/relator…"
            className="border rounded p-2 text-sm w-full max-w-sm"
          />
        </div>

        {loading ? (
          <p className="text-sm text-gray-600 mt-3">Cargando…</p>
        ) : !filteredSessions.length ? (
          <p className="text-sm text-gray-600 mt-3">Aún no hay sesiones asociadas a tus empresas.</p>
        ) : (
          <div className="mt-3 overflow-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-gray-600">
                <tr>
                  <th className="py-2 pr-3">Código</th>
                  <th className="py-2 pr-3">Tema</th>
                  <th className="py-2 pr-3">Fecha</th>
                  <th className="py-2 pr-3">Estado</th>
                  <th className="py-2 pr-3">Acción</th>
                </tr>
              </thead>
              <tbody>
                {filteredSessions.map((s) => (
                  <tr key={s.id} className="border-t">
                    <td className="py-2 pr-3 font-medium">{s.code}</td>
                    <td className="py-2 pr-3">{s.topic ?? "-"}</td>
                    <td className="py-2 pr-3">
                      {s.session_date ? new Date(s.session_date).toLocaleString("es-CL") : "-"}
                    </td>
                    <td className="py-2 pr-3">{s.status ?? "-"}</td>
                    <td className="py-2 pr-3">
                      <button
                        onClick={() => router.push(`/admin/s/${s.code}`)}
                        className="border rounded-lg px-3 py-1 hover:opacity-80"
                      >
                        Ver asistentes
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="text-center text-xs opacity-60">
        Creado por Claudio Lizama © 2026
      </div>
    </div>
  );
}