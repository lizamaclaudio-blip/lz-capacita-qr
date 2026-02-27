"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
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

function isActive(pathname: string, href: string) {
  if (href === "/app") return pathname === "/app";
  return pathname === href || pathname.startsWith(href + "/");
}

function getInitial(name: string | null, email: string | null) {
  const src = (name || "").trim() || (email || "").trim();
  if (!src) return "👤";
  const c = src[0]?.toUpperCase?.() || "👤";
  return /[A-ZÁÉÍÓÚÑ]/.test(c) ? c : "👤";
}

export default function WorkspaceSidebar({ greetingName, email, onLogout }: Props) {
  const pathname = usePathname() || "/app";

  const [now, setNow] = useState(() => new Date());
  const [weather, setWeather] = useState<{ temp: number | null; code: number | null; city: string | null }>(() => ({
    temp: null,
    code: null,
    city: null,
  }));

  const isOwner = useMemo(() => (email || "").toLowerCase() === "lizamaclaudio@gmail.com", [email]);
  const greet = useMemo(() => greetLabel(now), [now]);
  const dt = useMemo(() => fmtDateTimeCL(now), [now]);
  const wlab = useMemo(() => weatherLabelFromCode(weather.code), [weather.code]);
  const initial = useMemo(() => getInitial(greetingName, email), [greetingName, email]);

  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(t);
  }, []);

  useEffect(() => {
    if (!navigator?.geolocation) return;

    const ac = new AbortController();
    let cancelled = false;

    async function fetchWeather(lat: number, lon: number) {
      const url =
        `https://api.open-meteo.com/v1/forecast?latitude=${lat}` +
        `&longitude=${lon}` +
        `&current=temperature_2m,weather_code&timezone=auto`;

      const res = await fetch(url, { signal: ac.signal, cache: "no-store" });
      if (!res.ok) return { temp: null, code: null };
      const json: any = await res.json();

      const temp = typeof json?.current?.temperature_2m === "number" ? json.current.temperature_2m : null;
      const code = typeof json?.current?.weather_code === "number" ? json.current.weather_code : null;

      return { temp, code };
    }

    async function reverseGeocode(lat: number, lon: number) {
      const gUrl =
        `https://geocoding-api.open-meteo.com/v1/reverse?latitude=${lat}` +
        `&longitude=${lon}` +
        `&count=1&language=es&format=json`;

      const res = await fetch(gUrl, { signal: ac.signal, cache: "no-store" });
      if (!res.ok) return null;

      const json: any = await res.json();
      const first = json?.results?.[0];
      if (!first) return null;

      const name = String(first?.name ?? "").trim();
      const admin1 = String(first?.admin1 ?? "").trim();
      if (!name) return null;

      return admin1 && admin1.toLowerCase() !== name.toLowerCase() ? `${name}, ${admin1}` : name;
    }

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const lat = pos.coords.latitude;
          const lon = pos.coords.longitude;

          const [w, place] = await Promise.all([fetchWeather(lat, lon), reverseGeocode(lat, lon)]);

          if (cancelled) return;
          setWeather({
            temp: w.temp != null ? Math.round(w.temp) : null,
            code: w.code,
            city: place,
          });
        } catch {
          // ignore
        }
      },
      () => {
        // ignore
      },
      { enableHighAccuracy: false, timeout: 4000, maximumAge: 60_000 }
    );

    return () => {
      cancelled = true;
      ac.abort();
    };
  }, []);

  return (
    <aside className={styles.side}>
      {/* BRAND */}
      <div className={styles.brand}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className={styles.brandLogo} src="/brand/lz-capacita-qr.png" alt="LZ Capacita QR" />
        <div className={styles.brandTitle}>LZ CAPACITA QR</div>
        <div className={styles.brandSub}>Workspace</div>
      </div>

      {/* WELCOME */}
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
          <div className={styles.weatherPill} title="Clima y ubicación (Open-Meteo)">
            <div className={styles.weatherTop}>
              <span className={styles.weatherEmoji} aria-hidden>
                {wlab.emoji}
              </span>
              <span className={styles.weatherText}>{wlab.text}</span>
              <span className={styles.temp}>{weather.temp != null ? `${weather.temp}°` : "—"}</span>
            </div>

            {weather.city ? <div className={styles.weatherPlace}>{weather.city}</div> : null}
          </div>
        </div>
      </div>

      {/* NAV */}
      <nav className={styles.nav} aria-label="Navegación">
        <Link href="/app" className={styles.navItem} data-active={isActive(pathname, "/app") ? "true" : "false"}>
          <span className={styles.navIcon} aria-hidden>
            📊
          </span>
          <span className={styles.navText}>Dashboard</span>
        </Link>

        <Link
          href="/app/companies"
          className={styles.navItem}
          data-active={isActive(pathname, "/app/companies") ? "true" : "false"}
        >
          <span className={styles.navIcon} aria-hidden>
            🏢
          </span>
          <span className={styles.navText}>Mis Empresas</span>
        </Link>

        <Link
          href="/app/sessions"
          className={styles.navItem}
          data-active={isActive(pathname, "/app/sessions") ? "true" : "false"}
        >
          <span className={styles.navIcon} aria-hidden>
            🎤
          </span>
          <span className={styles.navText}>Mis Charlas</span>
        </Link>

        <Link
          href="/app/pdfs"
          className={styles.navItem}
          data-active={isActive(pathname, "/app/pdfs") ? "true" : "false"}
        >
          <span className={styles.navIcon} aria-hidden>
            📄
          </span>
          <span className={styles.navText}>Mis PDFs</span>
        </Link>

        <Link
          href="/app/profile"
          className={styles.navItem}
          data-active={isActive(pathname, "/app/profile") ? "true" : "false"}
        >
          <span className={styles.navIcon} aria-hidden>
            👤
          </span>
          <span className={styles.navText}>Mi Perfil</span>
        </Link>

        {isOwner ? (
          <Link
            href="/app/owner"
            className={styles.navItem}
            data-active={isActive(pathname, "/app/owner") ? "true" : "false"}
          >
            <span className={styles.navIcon} aria-hidden>
              🛡️
            </span>
            <span className={styles.navText}>Owner</span>
          </Link>
        ) : null}
      </nav>

      {/* FOOTER */}
      <div className={styles.footer}>
        <div className={styles.userLine}>{email || "—"}</div>

        <button type="button" className={styles.logout} onClick={onLogout}>
          <span className={styles.avatar} aria-hidden>
            {initial}
          </span>
          <span className={styles.logoutText}>Cerrar sesión</span>
        </button>
      </div>
    </aside>
  );
}