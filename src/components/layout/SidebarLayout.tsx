"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import React from "react";

type NavItem = {
  label: string;
  href: string;
  icon: string; // emoji por ahora (simple y cero dependencias)
};

const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/app/dashboard", icon: "🏠" },
  { label: "Mi Perfil", href: "/app/profile", icon: "👤" },
  { label: "Crear Empresa", href: "/app/companies/new", icon: "➕" },
  { label: "Mis Empresas", href: "/app/companies", icon: "🏢" },
  { label: "Mis Charlas", href: "/app/sessions", icon: "🎤" },
  { label: "Mis PDF", href: "/app/pdfs", icon: "📄" },
];

function getTitleFromPath(pathname: string): string {
  const found = NAV_ITEMS.find((i) => i.href === pathname);
  if (found) return found.label;

  // títulos “inteligentes” para subrutas
  if (pathname.startsWith("/app/companies/new")) return "Crear Empresa";
  if (pathname.startsWith("/app/companies")) return "Mis Empresas";
  if (pathname.startsWith("/app/sessions")) return "Mis Charlas";
  if (pathname.startsWith("/app/pdfs")) return "Mis PDF";
  if (pathname.startsWith("/app/profile")) return "Mi Perfil";

  return "Dashboard";
}

export default function SidebarLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const title = getTitleFromPath(pathname);

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="flex">
        {/* SIDEBAR */}
        <aside className="hidden md:flex md:w-72 md:flex-col bg-blue-700 text-white min-h-screen">
          <div className="px-6 py-5 border-b border-white/15">
            <div className="flex items-center gap-3">
              {/* Logo placeholder (luego aquí ponemos el logo grande/transparente) */}
              <div className="h-10 w-10 rounded-xl bg-white/15 flex items-center justify-center font-semibold">
                LZ
              </div>
              <div>
                <div className="text-base font-semibold leading-tight">LZ Capacita QR</div>
                <div className="text-xs opacity-80">Panel Administrador</div>
              </div>
            </div>
          </div>

          <nav className="px-3 py-4 flex flex-col gap-1">
            {NAV_ITEMS.map((item) => {
              const active =
                pathname === item.href ||
                (item.href !== "/app/dashboard" && pathname.startsWith(item.href));

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={[
                    "flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition",
                    active ? "bg-white/15" : "hover:bg-white/10",
                  ].join(" ")}
                >
                  <span className="text-lg">{item.icon}</span>
                  <span className="font-medium">{item.label}</span>
                </Link>
              );
            })}
          </nav>

          <div className="mt-auto px-6 py-5 border-t border-white/15 text-xs opacity-80">
            © {new Date().getFullYear()} LZ Capacita
          </div>
        </aside>

        {/* MAIN */}
        <main className="flex-1 min-w-0">
          {/* TOPBAR (ÚNICA) */}
          <header className="sticky top-0 z-10 bg-white border-b">
            <div className="h-14 px-4 md:px-6 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="md:hidden">
                  {/* En la siguiente iteración le metemos menú mobile si lo necesitas */}
                  <div className="h-9 w-9 rounded-lg bg-blue-700 text-white flex items-center justify-center font-semibold">
                    LZ
                  </div>
                </div>
                <div className="text-sm md:text-base font-semibold">{title}</div>
              </div>

              <div className="flex items-center gap-2">
                {/* Placeholder usuario/acciones */}
                <div className="text-xs text-slate-600 hidden sm:block">Sesión activa</div>
                <div className="h-9 w-9 rounded-full bg-slate-200" title="Usuario" />
              </div>
            </div>
          </header>

          {/* CONTENT */}
          <div className="px-4 md:px-6 py-6">{children}</div>
        </main>
      </div>
    </div>
  );
}