import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import Link from "next/link";
import { signOut } from "./server-actions";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const sb = supabaseServer();
  const { data } = await sb.auth.getUser();
  if (!data.user) redirect("/login");

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/app" className="font-bold">
            Prevenidos · Panel
          </Link>
          <div className="flex items-center gap-3 text-sm">
            <span className="text-gray-600">{data.user.email}</span>
            <form action={signOut}>
              <button className="px-3 py-2 rounded border">Salir</button>
            </form>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">{children}</main>
    </div>
  );
}