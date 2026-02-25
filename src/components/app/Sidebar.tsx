"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import styles from "./Sidebar.module.css";

import { IconHome, IconUser, IconPlus, IconBuilding, IconList, IconFile } from "./icons";

type Tone = "indigo" | "teal" | "amber";

type NavItem = {
  href: string;
  label: string;
  tone: Tone;
  icon: React.ReactNode;
  match?: (pathname: string) => boolean;
};

export default function Sidebar() {
  const pathname = usePathname();
  const asideRef = useRef<HTMLElement | null>(null);

  const items: NavItem[] = [
    { href: "/app", label: "Dashboard", tone: "indigo", icon: <IconHome className={styles.icon} />, match: (p) => p === "/app" },
    { href: "/app/profile", label: "Mi perfil", tone: "teal", icon: <IconUser className={styles.icon} />, match: (p) => p.startsWith("/app/profile") },

    { href: "/app/companies/new", label: "Crear empresa", tone: "amber", icon: <IconPlus className={styles.icon} />, match: (p) => p.startsWith("/app/companies/new") },
    { href: "/app/companies", label: "Mis empresas", tone: "teal", icon: <IconBuilding className={styles.icon} />, match: (p) => p.startsWith("/app/companies") || p.startsWith("/app/company/") },

    { href: "/app/sessions/new", label: "Crear charla", tone: "amber", icon: <IconPlus className={styles.icon} />, match: (p) => p.startsWith("/app/sessions/new") },
    { href: "/app/sessions", label: "Mis charlas", tone: "indigo", icon: <IconList className={styles.icon} />, match: (p) => p.startsWith("/app/sessions") },

    { href: "/app/pdfs", label: "Mis PDF", tone: "amber", icon: <IconFile className={styles.icon} />, match: (p) => p.startsWith("/app/pdfs") },
  ];

  // Parallax del sidebar (suave, con RAF)
  useEffect(() => {
    const el = asideRef.current;
    if (!el) return;

    let raf = 0;

    const setVars = (rxDeg: number, ryDeg: number, mx: number, my: number) => {
      el.style.setProperty("--rxdeg", `${rxDeg.toFixed(2)}deg`);
      el.style.setProperty("--rydeg", `${ryDeg.toFixed(2)}deg`);
      el.style.setProperty("--mx", `${mx.toFixed(4)}`);
      el.style.setProperty("--my", `${my.toFixed(4)}`);
    };

    const onMove = (e: MouseEvent) => {
      if (raf) cancelAnimationFrame(raf);

      raf = requestAnimationFrame(() => {
        const r = el.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width;  // 0..1
        const y = (e.clientY - r.top) / r.height;  // 0..1
        const nx = x - 0.5; // -0.5..0.5
        const ny = y - 0.5; // -0.5..0.5

        // inclinación: súper sutil
        const rx = nx * -6.5; // deg
        const ry = ny * 5.5;  // deg

        setVars(rx, ry, x, y);
      });
    };

    const onLeave = () => {
      if (raf) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => setVars(0, 0, 0.5, 0.5));
    };

    // init
    setVars(0, 0, 0.5, 0.5);

    el.addEventListener("mousemove", onMove);
    el.addEventListener("mouseleave", onLeave);

    return () => {
      el.removeEventListener("mousemove", onMove);
      el.removeEventListener("mouseleave", onLeave);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <aside ref={asideRef} className={styles.sidebar}>
      {/* LOGO full ancho (holo) */}
      <div className={styles.brand}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className={styles.brandLogoFull} src="/brand/lz-capacita-qr.png" alt="LZ Capacita QR" />
      </div>

      <nav className={styles.nav}>
        {items.map((it) => {
          const active = it.match ? it.match(pathname) : pathname === it.href;

          return (
            <Link
              key={it.href}
              href={it.href}
              data-tone={it.tone}
              className={`${styles.item} ${active ? styles.active : ""}`}
              aria-current={active ? "page" : undefined}
            >
              {/* Neon trace (solo visible si active) */}
              <span className={styles.trace} aria-hidden="true" />

              <span className={styles.iconWrap}>{it.icon}</span>
              <span className={styles.label}>{it.label}</span>
              <span className={styles.chev}>›</span>
            </Link>
          );
        })}
      </nav>

      <div className={styles.footer}>© 2026 Claudio Lizama</div>
    </aside>
  );
}