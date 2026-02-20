"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./Sidebar.module.css";
import {
  IconHome,
  IconUser,
  IconPlus,
  IconBuilding,
  IconList,
  IconFile,
} from "./icons";

type NavItem = {
  href: string;
  label: string;
  icon: React.ReactNode;
};

export default function Sidebar() {
  const pathname = usePathname();

  const items: NavItem[] = [
    { href: "/app/dashboard", label: "Dashboard", icon: <IconHome className={styles.icon} /> },
    { href: "/app/profile", label: "Mi perfil", icon: <IconUser className={styles.icon} /> },
    { href: "/app/companies/new", label: "Crear empresa", icon: <IconPlus className={styles.icon} /> },
    { href: "/app/companies", label: "Mis empresas", icon: <IconBuilding className={styles.icon} /> },
    { href: "/app/sessions", label: "Mis charlas", icon: <IconList className={styles.icon} /> },
    { href: "/app/pdfs", label: "Mis PDF", icon: <IconFile className={styles.icon} /> },
  ];

  function isActive(href: string) {
    if (href === "/app/dashboard") return pathname === "/app" || pathname === "/app/dashboard";
    return pathname.startsWith(href);
  }

  return (
    <aside className={styles.sidebar}>
      <div className={styles.brandCard}>
        {/* ✅ IMPORTANTE:
            pon tu logo en: /public/app-logo.png (PNG ideal transparente)
        */}
        <img className={styles.brandLogo} src="/app-logo.png" alt="LZ Capacita QR" />
        <div className={styles.brandTitle}>LZ Capacita QR</div>
        <div className={styles.brandSub}>Charlas y Capacitaciones</div>
      </div>

      <nav className={styles.nav}>
        {items.map((it) => (
          <Link
            key={it.href}
            href={it.href}
            className={`${styles.navItem} ${isActive(it.href) ? styles.active : ""}`}
          >
            <span className={styles.iconWrap}>{it.icon}</span>
            <span className={styles.label}>{it.label}</span>
          </Link>
        ))}
      </nav>

      <div className={styles.footer}>Creado por Claudio Lizama © 2026</div>
    </aside>
  );
}