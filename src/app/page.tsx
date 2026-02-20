import Link from "next/link";
import AppShell from "@/components/AppShell";
import { ShieldCheck, QrCode, Users } from "lucide-react";

export default function HomePage() {
  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-2xl bg-emerald-400/20 border border-white/15 flex items-center justify-center">
            <ShieldCheck className="h-6 w-6 text-emerald-200" />
          </div>
          <div>
            <div className="text-xl font-semibold">LZ Capacita QR</div>
            <div className="text-xs text-white/70">Registro y PDF con firmas</div>
          </div>
        </div>

        <div className="rounded-2xl border border-white/15 bg-white/10 p-4">
          <div className="text-sm text-white/80">Bienvenido 👋</div>
          <div className="mt-1 text-2xl font-bold">Controla charlas y asistencia</div>
          <div className="mt-2 text-sm text-white/70">
            Crea una charla, comparte el QR y genera el PDF final.
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2">
            <MiniAction icon={<QrCode className="h-4 w-4" />} label="QR" />
            <MiniAction icon={<Users className="h-4 w-4" />} label="Asistencia" />
            <MiniAction icon={<ShieldCheck className="h-4 w-4" />} label="PDF" />
          </div>
        </div>

        <div className="space-y-3">
          <Link
            href="/login"
            className="block text-center rounded-xl bg-emerald-400 text-slate-950 font-semibold py-3 hover:bg-emerald-300 transition"
          >
            Ingresar
          </Link>

          <Link
            href="/signup"
            className="block text-center rounded-xl border border-white/20 bg-white/10 py-3 font-semibold hover:bg-white/15 transition"
          >
            Crear cuenta
          </Link>
        </div>
      </div>
    </AppShell>
  );
}

function MiniAction({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="rounded-xl border border-white/15 bg-white/10 px-3 py-3 text-center">
      <div className="mx-auto mb-1 w-fit text-emerald-200">{icon}</div>
      <div className="text-xs text-white/80">{label}</div>
    </div>
  );
}