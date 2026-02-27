"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./MobileDock.module.css";

type Item = { href: string; label: string; icon: string };

function isActive(pathname: string, href: string) {
  if (href === "/app") return pathname === "/app";
  return pathname === href || pathname.startsWith(href + "/");
}

export default function MobileDock() {
  const pathname = usePathname() || "/app";

  const items: Item[] = [
    { href: "/app", label: "Dashboard", icon: "📊" },
    { href: "/app/companies", label: "Empresas", icon: "🏢" },
    { href: "/app/sessions", label: "Charlas", icon: "🎤" },
    { href: "/app/pdfs", label: "PDFs", icon: "📄" },
    { href: "/app/profile", label: "Perfil", icon: "👤" },
  ];

  return (
    <nav className={styles.dock} aria-label="Navegación rápida">
      {items.map((it) => {
        const active = isActive(pathname, it.href);
        return (
          <Link key={it.href} href={it.href} className={styles.item} data-active={active ? "true" : "false"}>
            <span className={styles.icon} aria-hidden="true">
              {it.icon}
            </span>
            <span className={styles.label}>{it.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}