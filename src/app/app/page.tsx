"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/browser";

type Company = {
  id: string;
  name: string;
  address: string | null;
  created_at: string;
};

export default function AppHome() {
  const router = useRouter();
  const sp = useSearchParams();

  const [loading, setLoading] = useState(true);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [isAdmin, setIsAdmin] = useState(false);

  // form
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");

  useEffect(() => {
    const e = sp.get("e");
    if (e) setError(decodeURIComponent(e));
  }, [sp]);

  async function load() {
    setLoading(true);
    setError(null);

    const sb = supabaseBrowser;
    const { data } = await sb.auth.getSession();
    const token = data.session?.access_token;

    if (!token) {
      router.replace("/login");
      return;
    }

    // 1) saber si es admin
    const meRes = await fetch("/api/app/me", {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    const meJson = await meRes.json().catch(() => null);
    if (meRes.ok) setIsAdmin(!!meJson?.is_admin);

    // 2) traer companies
    const res = await fetch("/api/app/companies", {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });

    const json = await res.json().catch(() => null);

    if (!res.ok) {
      setError(json?.error || "No se pudo cargar empresas");
      setCompanies([]);
      setLoading(false);
      return;
    }

    setCompanies(json.companies ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function createCompany(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const { data } = await supabaseBrowser.auth.getSession();
    const token = data.session?.access_token;

    if (!token) {
      router.replace("/login");
      return;
    }

    const res = await fetch("/api/app/companies", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        name,
        address: address.trim() ? address.trim() : null,
      }),
    });

    const json = await res.json().catch(() => null);

    if (!res.ok) {
      setError(json?.error || "No se pudo crear empresa");
      return;
    }

    setName("");
    setAddress("");
    await load();
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
          <p className="text-gray-600 text-sm">
            Crea empresas y luego cursos/charlas por sucursal.
          </p>
        </div>

        <div className="flex gap-2">
          {isAdmin && (
            <a
              href="/admin/new"
              className="rounded-lg border px-3 py-2 text-sm bg-white"
            >
              Ir a Admin
            </a>
          )}
          <button
            onClick={logout}
            className="rounded-lg bg-black text-white px-3 py-2 text-sm"
          >
            Salir
          </button>
        </div>
      </div>

      {error && (
        <div className="text-sm text-red-700 border border-red-200 bg-red-50 p-3 rounded">
          {error}
        </div>
      )}

      <div className="bg-white border rounded-2xl p-5">
        <h2 className="font-semibold">Crear empresa</h2>
        <form onSubmit={createCompany} className="mt-3 grid md:grid-cols-3 gap-3">
          <input
            className="border rounded p-2 md:col-span-1"
            placeholder="Nombre empresa"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
          <input
            className="border rounded p-2 md:col-span-2"
            placeholder="Dirección (opcional)"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
          />
          <button className="md:col-span-3 bg-emerald-600 text-white rounded p-2 font-semibold">
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
                <div className="text-sm text-gray-600 mt-1">
                  {c.address || "Sin dirección"}
                </div>
                <div className="text-xs text-gray-500 mt-2">
                  Creada: {new Date(c.created_at).toLocaleString("es-CL")}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="text-center text-xs opacity-60">
        Creado por Claudio Lizama © 2026
      </div>
    </div>
  );
}