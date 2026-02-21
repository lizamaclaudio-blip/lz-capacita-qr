"use client";

import { useEffect, useMemo, useState } from "react";
import styles from "./Topbar.module.css";
import { IconLogout } from "./icons";

type Props = {
  greetingName?: string | null;
  email?: string | null;
  subtitle?: string;
  onLogout: () => void;
};

function formatDateCL(d: Date) {
  // ej: "vie, 21 feb 2026"
  return new Intl.DateTimeFormat("es-CL", {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "2-digit",
  }).format(d);
}

function formatTimeCL(d: Date) {
  // ej: "20:32"
  return new Intl.DateTimeFormat("es-CL", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);
}

export default function Topbar({ greetingName, email, subtitle = "Panel LZ Capacita QR", onLogout }: Props) {
  const [now, setNow] = useState<Date>(() => new Date());

  // actualiza cada 30s (suficiente para reloj)
  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(t);
  }, []);

  const name = useMemo(() => {
    const n = (greetingName ?? "").trim();
    if (n) return n;
    if (email) return email.split("@")[0] ?? "usuario";
    return "usuario";
  }, [greetingName, email]);

  const dateStr = useMemo(() => formatDateCL(now), [now]);
  const timeStr = useMemo(() => formatTimeCL(now), [now]);

  return (
    <header className={styles.topbar}>
      <div className={styles.left}>
        <div className={styles.titleRow}>
          <div className={styles.title}>Hola, bienvenido {name} 👋</div>
        </div>
        <div className={styles.subtitle}>{subtitle}</div>
      </div>

      <div className={styles.right}>
        <div className={styles.datetime}>
          <div className={styles.time}>{timeStr}</div>
          <div className={styles.date}>{dateStr}</div>
        </div>

        {email && <div className={styles.email}>{email}</div>}

        <button type="button" className={styles.logout} onClick={onLogout}>
          <IconLogout className={styles.logoutIcon} />
          <span>Salir</span>
        </button>
      </div>
    </header>
  );
}