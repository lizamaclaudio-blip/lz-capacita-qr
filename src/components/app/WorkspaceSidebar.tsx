"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import styles from "./WorkspaceSidebar.module.css";

type Props = {
  greetingName: string | null;
  email: string | null;
  onLogout: () => void;
};

function greetLabel(date = new Date()) {
  const h = date.getHours();
  if (h >= 5 && h < 12) return "Buenos días";
  if (h >= 12 && h < 20) return "Buenas tardes";
  return "Buenas noches";
}

function fmtDateTimeCL(date = new Date()) {
  try {
    const d = date.toLocaleDateString("es-CL", {
      weekday: "short",
      year: "numeric",
      month: "short",
      day: "2-digit",
    });
    const t = date.toLocaleTimeString("es-CL", {
      hour: "2-digit",
      minute: "2-digit",
    });
    return { d, t };
  } catch {
    return { d: "—", t: "—" };
  }
}

function weatherLabelFromCode(code: number | null) {
  if (code == null) return { emoji: "⛅", text: "Clima" };
  // Open-Meteo WMO weather codes
  if (code === 0) return { emoji: "☀️", text: "Despejado" };
  if (code === 1 || code === 2) return { emoji: "🌤️", text: "Parcial" };
  if (code === 3) return { emoji: "☁️", text: "Nublado" };
  if ([45, 48].includes(code)) return { emoji: "🌫️", text: "Niebla" };
  if ([51, 53, 55].includes(code)) return { emoji: "🌦️", text: "Llovizna" };
  if ([61, 63, 65].includes(code)) return { emoji: "🌧️", text: "Lluvia" };
  if ([71, 73, 75, 77].includes(code)) return { emoji: "❄️", text: "Nieve" };
  if ([80, 81, 82].includes(code)) return { emoji: "🌧️", text: "Chubascos" };
  if ([95, 96, 99].includes(code)) return { emoji: "⛈️", text: "Tormenta" };
  return { emoji: "⛅", text: "Clima" };
}

export default function WorkspaceSidebar({ greetingName, email, onLogout }: Props) {
  const [now, setNow] = useState(() => new Date());
  const [weather, setWeather] = useState<{ temp: number | null; code: number | null; city: string | null }>(
    () => ({ temp: null, code: null, city: null })
  );

  const isOwner = useMemo(() => (email || "").toLowerCase() === "lizamaclaudio@gmail.com", [email]);
  const greet = useMemo(() => greetLabel(now), [now]);
  const dt = useMemo(() => fmtDateTimeCL(now), [now]);
  const wlab = useMemo(() => weatherLabelFromCode(weather.code), [weather.code]);

  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(t);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadWeather(lat: number, lon: number) {
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code&timezone=auto`;
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) return;
      const json: any = await res.json();
      const temp = typeof json?.current?.temperature_2m === "number" ? json.current.temperature_2m : null;
      const code = typeof json?.current?.weather_code === "number" ? json.current.weather_code : null;
      if (!cancelled) setWeather((w) => ({ ...w, temp, code }));
    }

    // geolocalización (silencioso): si el usuario no acepta, simplemente no mostramos clima.
    if (!navigator?.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lon = pos.coords.longitude;
        loadWeather(lat, lon).catch(() => undefined);
      },
      () => {
        // ignore
      },
      { enableHighAccuracy: false, timeout: 4000, maximumAge: 60_000 }
    );

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <aside className={styles.side}>
      <div className={styles.brand}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className={styles.brandLogo} src="/brand/lz-capacita-qr.png" alt="LZ Capacita QR" />
        <div className={styles.brandLine}>
          <span className={styles.brandTitle}>Capacita QR</span>
          <span className={styles.brandDot}>·</span>
          <span className={styles.brandSub}>Workspace</span>
        </div>
      </div>

      <div className={styles.welcome}>
        <div className={styles.greet}>
          {greet}
          {greetingName ? `, ${greetingName}` : ""}
        </div>
        <div className={styles.metaRow}>
          <div className={styles.metaPill}>{dt.d}</div>
          <div className={styles.metaPill}>{dt.t}</div>
        </div>
        <div className={styles.weatherRow}>
          <div className={styles.weatherPill} title="Clima (Open‑Meteo)">
            <span aria-hidden>{wlab.emoji}</span>
            <span>{wlab.text}</span>
            <span className={styles.temp}>{weather.temp != null ? `${Math.round(weather.temp)}°` : "—"}</span>
          </div>
        </div>
      </div>

      <nav className={styles.nav}>
        <Link href="/app" className={styles.navItem}>Dashboard</Link>
        <Link href="/app/companies" className={styles.navItem}>Mis Empresas</Link>
        <Link href="/app/sessions" className={styles.navItem}>Mis Charlas</Link>
        <Link href="/app/pdfs" className={styles.navItem}>Mis PDFs</Link>
        <Link href="/app/profile" className={styles.navItem}>Mi Perfil</Link>
        {isOwner ? <Link href="/app/owner" className={styles.navItem}>Owner</Link> : null}
      </nav>

      <div className={styles.footer}>
        <div className={styles.userLine}>{email || "—"}</div>
        <button type="button" className={styles.logout} onClick={onLogout}>
          Cerrar sesión
        </button>
      </div>
    </aside>
  );
}
