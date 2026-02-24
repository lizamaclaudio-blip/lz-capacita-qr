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
  match?: (pathname: string) => boolean;
};

export default function Sidebar() {
  const pathname = usePathname();

  const items: NavItem[] = [
    { href: "/app", label: "Dashboard", icon: <IconHome className={styles.icon} />, match: (p) => p === "/app" },
    { href: "/app/profile", label: "Mi perfil", icon: <IconUser className={styles.icon} />, match: (p) => p.startsWith("/app/profile") },

    { href: "/app/companies/new", label: "Crear empresa", icon: <IconPlus className={styles.icon} />, match: (p) => p.startsWith("/app/companies/new") },
    { href: "/app/companies", label: "Mis empresas", icon: <IconBuilding className={styles.icon} />, match: (p) => p.startsWith("/app/companies") || p.startsWith("/app/company/") },

    { href: "/app/sessions/new", label: "Crear charla", icon: <IconPlus className={styles.icon} />, match: (p) => p.startsWith("/app/sessions/new") },
    { href: "/app/sessions", label: "Mis charlas", icon: <IconList className={styles.icon} />, match: (p) => p.startsWith("/app/sessions") },

    { href: "/app/pdfs", label: "Mis PDF", icon: <IconFile className={styles.icon} />, match: (p) => p.startsWith("/app/pdfs") },
  ];

  return (
    <aside className={styles.sidebar}>
      <div className={styles.brand}>
        <div className={styles.brandLogoWrap}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className={styles.brandLogo} src="/brand/lz-capacita-qr.png" alt="LZ Capacita QR" />
        </div>
        <div className={styles.brandText}>
          <div className={styles.brandTitle}>LZ Capacita QR</div>
          <div className={styles.brandSub}>Panel</div>
        </div>
      </div>

      <nav className={styles.nav}>
        {items.map((it) => {
          const active = it.match ? it.match(pathname) : pathname === it.href;
          return (
            <Link key={it.href} href={it.href} className={`${styles.item} ${active ? styles.active : ""}`}>
              <span className={styles.iconWrap}>{it.icon}</span>
              <span className={styles.label}>{it.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className={styles.footer}>© 2026 Claudio Lizama</div>
    </aside>
  );
}