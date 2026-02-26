"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect } from "react";
import { usePathname } from "next/navigation";
import styles from "./MobileNavDrawer.module.css";

type Props = {
  open: boolean;
  onClose: () => void;
  email?: string | null;
  greetingName?: string | null;
  onLogout: () => void;
};

function isActive(pathname: string, href: string) {
  if (href === "/app") return pathname === "/app";
  return pathname === href || pathname.startsWith(href + "/");
}

export default function MobileNavDrawer({ open, onClose, email, greetingName, onLogout }: Props) {
  const pathname = usePathname() || "/app";

  useEffect(() => {
    if (!open) return;

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };

    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  const links = [
    { href: "/app", label: "Dashboard" },
    { href: "/app/companies", label: "Empresas" },
    { href: "/app/sessions", label: "Charlas" },
    { href: "/app/pdfs", label: "PDFs" },
    { href: "/app/profile", label: "Perfil" },
  ];

  return (
    <>
      <div className={`${styles.backdrop} ${open ? styles.backdropOpen : ""}`} onClick={onClose} />

      <aside className={`${styles.drawer} ${open ? styles.drawerOpen : ""}`} role="dialog" aria-modal="true">
        <div className={styles.head}>
          <div className={styles.brand}>
            <span className={styles.logoBox} aria-hidden="true">
              <Image src="/brand/lzq-mark.svg" alt="LZ" fill priority sizes="42px" className={styles.logoImg} />
            </span>

            <div className={styles.brandText}>
              <div className={styles.title}>LZ Capacita QR</div>
              <div className={styles.sub}>Menú</div>
            </div>
          </div>

          <button className={styles.close} type="button" onClick={onClose} aria-label="Cerrar menú">
            ✕
          </button>
        </div>

        <div className={styles.user}>
          <div className={styles.userName}>{greetingName || "Mi cuenta"}</div>
          <div className={styles.userEmail}>{email || "—"}</div>
        </div>

        <nav className={styles.list} aria-label="Navegación">
          {links.map((l) => {
            const active = isActive(pathname, l.href);
            return (
              <Link
                key={l.href}
                href={l.href}
                className={`${styles.item} ${active ? styles.itemActive : ""}`}
                onClick={onClose}
              >
                {l.label}
              </Link>
            );
          })}
        </nav>

        <div className={styles.bottom}>
          <button className={styles.logout} type="button" onClick={onLogout}>
            Cerrar sesión
          </button>
        </div>
      </aside>
    </>
  );
}
