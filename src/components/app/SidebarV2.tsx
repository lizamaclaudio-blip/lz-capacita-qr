"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./sidebarV2.module.css";

const NAV = [
  { label: "Dashboard", href: "/app/dashboard", icon: "🏠" },
  { label: "Mi Perfil", href: "/app/profile", icon: "👤" },
  { label: "Crear Empresa", href: "/app/companies/new", icon: "➕" },
  { label: "Mis Empresas", href: "/app/companies", icon: "🏢" },
  { label: "Mis Charlas", href: "/app/sessions", icon: "🎤" },
  { label: "Mis PDF", href: "/app/pdfs", icon: "📄" },
];

export default function SidebarV2() {
  const pathname = usePathname();

  return (
    <aside className={styles.sidebar}>
      <div className={styles.brand}>
        <div className={styles.brandIcon}>LZ</div>
        <div className={styles.brandText}>
          <div className={styles.brandTitle}>LZ Capacita QR</div>
          <div className={styles.brandSub}>Panel Administrador</div>
        </div>
      </div>

      <nav className={styles.nav}>
        {NAV.map((item) => {
          const active =
            pathname === item.href ||
            (item.href !== "/app/dashboard" && pathname.startsWith(item.href));

          return (
            <Link
              key={item.href}
              href={item.href}
              className={styles.navItem}
              data-active={active ? "true" : "false"}
            >
              <span className={styles.icon}>{item.icon}</span>
              <span className={styles.label}>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className={styles.footer}>© {new Date().getFullYear()} LZ Capacita</div>
    </aside>
  );
}