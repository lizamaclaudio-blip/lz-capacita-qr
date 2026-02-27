"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { normalizePlanTier, planLabel, PlanTier } from "@/lib/planTier";
import styles from "./WorkspaceSidebar.module.css";

type Props = {
  greetingName?: string | null;
  email?: string | null;
  onLogout: () => void;
};

const OWNER_EMAILS_DEFAULT = ["lizamaclaudio@gmail.com"];

function getOwnerEmails(): string[] {
  const env = (process.env.NEXT_PUBLIC_OWNER_EMAILS || "").trim();
  if (env) return env.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
  return OWNER_EMAILS_DEFAULT;
}

function isActive(pathname: string, href: string) {
  if (href === "/app") return pathname === "/app";
  return pathname === href || pathname.startsWith(href + "/");
}

function initialsFromName(name?: string | null) {
  const t = String(name || "").trim();
  if (!t) return "LZ";
  const parts = t.split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase()).join("") || "LZ";
}

export default function WorkspaceSidebar({ greetingName, email, onLogout }: Props) {
  const pathname = usePathname() || "/app";

  const ownerEmails = useMemo(() => getOwnerEmails(), []);
  const isOwner = useMemo(() => {
    const e = String(email || "").toLowerCase();
    return !!e && ownerEmails.includes(e);
  }, [email, ownerEmails]);

  const [tier, setTier] = useState<PlanTier>("bronce");

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        const { data } = await supabaseBrowser.auth.getUser();
        const md: any = data.user?.user_metadata || {};
        const fromMeta = normalizePlanTier(md.plan_tier || md.plan || md.tier);

        if (!alive) return;
        setTier(isOwner ? "diamante" : fromMeta);
      } catch {
        if (!alive) return;
        setTier(isOwner ? "diamante" : "bronce");
      }
    })();

    return () => {
      alive = false;
    };
  }, [isOwner]);

  const badge = useMemo(() => planLabel(tier, isOwner), [tier, isOwner]);

  const nav = [
    { href: "/app", label: "Dashboard", icon: "📊" },
    { href: "/app/companies", label: "Mis Empresas", icon: "🏢" },
    { href: "/app/sessions", label: "Mis Charlas", icon: "🎤" },
    { href: "/app/pdfs", label: "Mis PDFs", icon: "📄" },
    { href: "/app/profile", label: "Mi Perfil", icon: "👤" },
    ...(isOwner ? [{ href: "/app/owner", label: "Owner", icon: "🛡️" }] : []),
  ];

  return (
    <aside className={styles.sidebar} aria-label="Workspace Sidebar">
      <div className={styles.top}>
        {/* ===== Marco por Plan ===== */}
        <div className={`${styles.planFrame} ${styles[`tier_${tier}`]}`}>
          <div className={styles.planInner}>
            <div className={styles.brandCard}>
              <div className={styles.logoBox} aria-hidden="true">
                <Image
                  src="/brand/lzq-mark.svg"
                  alt="LZ"
                  fill
                  sizes="64px"
                  className={styles.logoImg}
                  priority
                />
              </div>

              <div className={styles.brandTitle}>LZ CAPACITA QR</div>
              <div className={styles.brandSub}>Workspace</div>

              <div className={styles.planBadge}>{badge}</div>
            </div>
          </div>
        </div>

        {/* Saludo simple (mantén tu clima/fecha si ya lo tienes en tu versión) */}
        <div className={styles.greetCard}>
          <div className={styles.greetTitle}>
            {greetingName ? `Buenas, ${greetingName}` : "Bienvenido/a"}
          </div>
          <div className={styles.greetSub}>Panel de trabajo</div>
        </div>
      </div>

      <nav className={styles.nav} aria-label="Menú">
        {nav.map((it) => {
          const active = isActive(pathname, it.href);
          return (
            <Link key={it.href} href={it.href} className={styles.navItem} data-active={active ? "true" : "false"}>
              <span className={styles.navIcon} aria-hidden="true">
                {it.icon}
              </span>
              <span className={styles.navLabel}>{it.label}</span>
              <span className={styles.navPad} aria-hidden="true" />
            </Link>
          );
        })}
      </nav>

      <div className={styles.footer}>
        <div className={styles.footerEmail}>{email || "—"}</div>

        <button className={styles.logoutBtn} type="button" onClick={onLogout}>
          <span className={styles.avatar}>{initialsFromName(greetingName)}</span>
          <span className={styles.logoutText}>Cerrar sesión</span>
        </button>
      </div>
    </aside>
  );
}