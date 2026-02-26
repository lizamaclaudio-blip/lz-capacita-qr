"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import styles from "./AppTopNav.module.css";

type Props = {
  greetingName?: string | null;
  email?: string | null;
  subtitle?: string;
  onLogout: () => void;
  onOpenMobile: () => void;
};

type NavItem = { href: string; label: string };

function isActive(pathname: string, href: string) {
  if (href === "/app") return pathname === "/app";
  return pathname === href || pathname.startsWith(href + "/");
}

export default function AppTopNav({ greetingName, email, subtitle, onLogout, onOpenMobile }: Props) {
  const pathname = usePathname() || "/app";

  const items: NavItem[] = useMemo(
    () => [
      { href: "/app", label: "Dashboard" },
      { href: "/app/companies", label: "Empresas" },
      { href: "/app/sessions", label: "Charlas" },
      { href: "/app/pdfs", label: "PDFs" },
      { href: "/app/profile", label: "Perfil" },
    ],
    []
  );

  const displayName = greetingName || (email ? email.split("@")[0] : "Usuario");

  // Dropdown simple (click afuera / ESC)
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!menuOpen) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };

    const onClick = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!menuRef.current) return;
      if (!menuRef.current.contains(t)) setMenuOpen(false);
    };

    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onClick);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onClick);
    };
  }, [menuOpen]);

  return (
    <header className={styles.header}>
      <div className={styles.nav}>
        {/* Left: Brand + Mobile button */}
        <div className={styles.left}>
          <button className={styles.burger} type="button" onClick={onOpenMobile} aria-label="Abrir menú">
            <span />
            <span />
            <span />
          </button>

          <Link href="/app" className={styles.brand}>
            <span className={styles.logoBox} aria-hidden="true">
              <Image src="/brand/lzq-mark.svg" alt="LZ" fill priority sizes="42px" className={styles.logoImg} />
            </span>

            <div className={styles.brandText}>
              <div className={styles.brandTitle}>LZ Capacita QR</div>
              <div className={styles.brandSub}>{subtitle || "Panel"}</div>
            </div>
          </Link>
        </div>

        {/* Center: Tabs */}
        <nav className={styles.tabs} aria-label="Secciones">
          {items.map((it) => {
            const active = isActive(pathname, it.href);
            return (
              <Link key={it.href} href={it.href} className={`${styles.tab} ${active ? styles.tabActive : ""}`}>
                {it.label}
              </Link>
            );
          })}
        </nav>

        {/* Right: user menu */}
        <div className={styles.right} ref={menuRef}>
          <button className={styles.userBtn} type="button" onClick={() => setMenuOpen((v) => !v)}>
            <span className={styles.userDot} aria-hidden="true" />
            <span className={styles.userName}>{displayName}</span>
            <span className={styles.userChevron}>{menuOpen ? "▴" : "▾"}</span>
          </button>

          {menuOpen ? (
            <div className={styles.menu}>
              <div className={styles.menuHead}>
                <div className={styles.menuName}>{greetingName || "Mi cuenta"}</div>
                <div className={styles.menuEmail}>{email || "—"}</div>
              </div>

              <Link className={styles.menuItem} href="/app/profile" onClick={() => setMenuOpen(false)}>
                Perfil
              </Link>

              <Link className={styles.menuItem} href="/app" onClick={() => setMenuOpen(false)}>
                Dashboard
              </Link>

              <div className={styles.sep} />

              <button className={styles.menuDanger} type="button" onClick={onLogout}>
                Cerrar sesión
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}
