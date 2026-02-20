import { supabaseServer } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { createCompany } from "./server-actions";

export default async function AppHome({ searchParams }: { searchParams?: { e?: string } }) {
  const sb = supabaseServer();
  const { data: userData } = await sb.auth.getUser();
  if (!userData.user) redirect("/login");

  const error = searchParams?.e ? decodeURIComponent(searchParams.e) : null;

  const { data: companies } = await sb
    .from("companies")
    .select("id, name, address, created_at")
    .eq("owner_id", userData.user.id)
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Tu panel</h1>
        <p className="text-gray-600 text-sm">Crea empresas y luego cursos/charlas por sucursal.</p>
      </div>

      {error && (
        <div className="text-sm text-red-600 border border-red-200 bg-red-50 p-3 rounded">
          {error}
        </div>
      )}

      <div className="bg-white border rounded-2xl p-5">
        <h2 className="font-semibold">Crear empresa</h2>
        <form action={createCompany} className="mt-3 grid md:grid-cols-3 gap-3">
          <input name="name" className="border rounded p-2 md:col-span-1" placeholder="Nombre empresa" required />
          <input name="address" className="border rounded p-2 md:col-span-2" placeholder="Dirección (opcional)" />
          <button className="md:col-span-3 bg-black text-white rounded p-2">
            Guardar empresa
          </button>
        </form>
      </div>

      <div className="bg-white border rounded-2xl p-5">
        <h2 className="font-semibold">Tus empresas</h2>

        {!companies?.length ? (
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
    </div>
  );
}