"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import styles from "./Topbar.module.css";
import { IconLogout } from "./icons";

type Props = {
  greetingName?: string | null;
  email?: string | null;
  subtitle?: string; // (compat) ya no se muestra
  onLogout: () => void;
};

type WeatherState =
  | { status: "idle" }
  | { status: "loading"; label?: string }
  | { status: "ready"; tempC: number; code: number; icon: string; label: string; place?: string }
  | { status: "off"; reason: "no-geo" | "denied" | "unavailable" }
  | { status: "error"; message: string };

function formatDateCL(d: Date) {
  return new Intl.DateTimeFormat("es-CL", {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "2-digit",
  })
    .format(d)
    .replace(/\./g, ""); // quita puntitos tipo "mar."
}

function formatTimeCL(d: Date) {
  return new Intl.DateTimeFormat("es-CL", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);
}

function wmoToIconLabel(code: number) {
  // WMO weather codes (Open-Meteo)
  if (code === 0) return { icon: "☀️", label: "Despejado" };
  if (code === 1) return { icon: "🌤️", label: "Mayormente despejado" };
  if (code === 2) return { icon: "⛅", label: "Parcial nublado" };
  if (code === 3) return { icon: "☁️", label: "Nublado" };
  if (code === 45 || code === 48) return { icon: "🌫️", label: "Neblina" };

  if ([51, 53, 55, 56, 57].includes(code)) return { icon: "🌦️", label: "Llovizna" };
  if ([61, 63, 65, 66, 67].includes(code)) return { icon: "🌧️", label: "Lluvia" };
  if ([71, 73, 75, 77].includes(code)) return { icon: "🌨️", label: "Nieve" };
  if ([80, 81, 82].includes(code)) return { icon: "🌧️", label: "Chubascos" };
  if ([95, 96, 99].includes(code)) return { icon: "⛈️", label: "Tormenta" };

  return { icon: "🌡️", label: "Clima" };
}

async function fetchWeather(lat: number, lon: number, signal: AbortSignal) {
  const wUrl =
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}` +
    `&longitude=${lon}` +
    `&current=temperature_2m,weather_code` +
    `&temperature_unit=celsius` +
    `&timezone=auto`;

  const res = await fetch(wUrl, { signal, cache: "no-store" });
  if (!res.ok) throw new Error(`Open-Meteo HTTP ${res.status}`);
  const json = await res.json();

  const temp = Number(json?.current?.temperature_2m);
  const code = Number(json?.current?.weather_code);

  if (!Number.isFinite(temp) || !Number.isFinite(code)) throw new Error("Respuesta inválida de clima");

  return { tempC: Math.round(temp), code };
}

async function reverseGeocode(lat: number, lon: number, signal: AbortSignal) {
  // opcional: sacar nombre de lugar (sin API key)
  const gUrl =
    `https://geocoding-api.open-meteo.com/v1/reverse?latitude=${lat}` +
    `&longitude=${lon}` +
    `&count=1&language=es&format=json`;

  const res = await fetch(gUrl, { signal, cache: "no-store" });
  if (!res.ok) return null;

  const json = await res.json();
  const first = json?.results?.[0];
  if (!first) return null;

  // Ej: "Puerto Montt" (o "Puerto Montt, Los Lagos")
  const name = String(first?.name ?? "").trim();
  const admin1 = String(first?.admin1 ?? "").trim();

  if (!name) return null;
  return admin1 && admin1.toLowerCase() !== name.toLowerCase() ? `${name}, ${admin1}` : name;
}

function WeatherChip({ weather }: { weather: WeatherState }) {
  if (weather.status === "idle") return null;

  if (weather.status === "loading") {
    return (
      <div className={`${styles.pill} ${styles.weather}`} data-state="loading" title="Cargando clima...">
        <span className={styles.weatherDot} />
        <span className={styles.pillText}>Clima…</span>
      </div>
    );
  }

  if (weather.status === "off") {
    const msg =
      weather.reason === "denied"
        ? "Clima desactivado (permiso denegado)"
        : weather.reason === "no-geo"
        ? "Clima no disponible (sin geolocalización)"
        : "Clima no disponible";
    return (
      <div className={`${styles.pill} ${styles.weather}`} data-state="off" title={msg}>
        <span className={styles.weatherDot} />
        <span className={styles.pillText}>Clima —</span>
      </div>
    );
  }

  if (weather.status === "error") {
    return (
      <div className={`${styles.pill} ${styles.weather}`} data-state="error" title={weather.message}>
        <span className={styles.weatherDot} />
        <span className={styles.pillText}>Clima ⚠️</span>
      </div>
    );
  }

  // ready
  const place = weather.place ? ` · ${weather.place}` : "";
  return (
    <div
      className={`${styles.pill} ${styles.weather}`}
      data-state="ready"
      title={`${weather.label}${place}`}
    >
      <span className={styles.weatherIcon} aria-hidden="true">
        {weather.icon}
      </span>
      <span className={styles.pillText}>
        {weather.tempC}°C <span className={styles.weatherLabel}>{weather.label}</span>
      </span>
      {weather.place ? <span className={styles.weatherPlace}>· {weather.place}</span> : null}
    </div>
  );
}

export default function Topbar({ greetingName, email, onLogout }: Props) {
  const [now, setNow] = useState<Date>(() => new Date());
  const [weather, setWeather] = useState<WeatherState>({ status: "idle" });

  const abortRef = useRef<AbortController | null>(null);

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

  const dateTimeLine = useMemo(() => {
    // una sola línea, más grande
    return `${dateStr} · ${timeStr}`;
  }, [dateStr, timeStr]);

  const isOwner = (email ?? "").toLowerCase() === "lizamaclaudio@gmail.com";

  useEffect(() => {
    if (typeof window === "undefined") return;

    // cache rápido (opcional)
    try {
      const raw = window.localStorage.getItem("lz_weather_cache_v1");
      if (raw) {
        const cached = JSON.parse(raw);
        if (cached?.tempC != null && cached?.code != null) {
          const { icon, label } = wmoToIconLabel(Number(cached.code));
          setWeather({
            status: "ready",
            tempC: Number(cached.tempC),
            code: Number(cached.code),
            icon,
            label,
            place: typeof cached.place === "string" ? cached.place : undefined,
          });
        }
      }
    } catch {}

    if (!navigator.geolocation) {
      setWeather({ status: "off", reason: "no-geo" });
      return;
    }

    const load = async () => {
      setWeather({ status: "loading" });

      abortRef.current?.abort();
      const ac = new AbortController();
      abortRef.current = ac;

      const getPos = () =>
        new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: false,
            timeout: 6500,
            maximumAge: 10 * 60 * 1000,
          });
        });

      try {
        const pos = await getPos();
        const lat = pos.coords.latitude;
        const lon = pos.coords.longitude;

        const [w, place] = await Promise.all([
          fetchWeather(lat, lon, ac.signal),
          reverseGeocode(lat, lon, ac.signal),
        ]);

        const { icon, label } = wmoToIconLabel(w.code);

        const next: WeatherState = {
          status: "ready",
          tempC: w.tempC,
          code: w.code,
          icon,
          label,
          place: place ?? undefined,
        };

        setWeather(next);

        try {
          window.localStorage.setItem(
            "lz_weather_cache_v1",
            JSON.stringify({ tempC: w.tempC, code: w.code, place })
          );
        } catch {}
      } catch (e: any) {
        // permisos
        if (e?.code === 1) {
          setWeather({ status: "off", reason: "denied" });
          return;
        }
        setWeather({ status: "error", message: e?.message || "No se pudo cargar clima" });
      }
    };

    load();

    // refresco cada 10 min
    const it = window.setInterval(load, 10 * 60 * 1000);

    return () => {
      window.clearInterval(it);
      abortRef.current?.abort();
    };
  }, []);

  return (
    <header className={styles.topbar}>
      <div className={styles.left}>
        <div className={styles.brandPill} title="LZ Capacita QR">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className={styles.brandLogo} src="/brand/lz-capacita-qr.png" alt="LZ" />
        </div>

        <div className={styles.greetingBlock}>
          <div className={styles.title}>Hola, {name} 👋</div>
        </div>
      </div>

      <div className={styles.right}>
        <div className={styles.infoRow}>
          <div className={styles.dateTime}>{dateTimeLine}</div>
          <WeatherChip weather={weather} />
          {email ? <div className={`${styles.pill} ${styles.emailPill}`}>{email}</div> : null}
        </div>

        <div className={styles.btnRow}>
          {isOwner && (
            <Link href="/owner" className={`${styles.btn} ${styles.btnOwner}`} title="Panel maestro (dueño)">
              🛠 Panel Dueño
            </Link>
          )}

          <button type="button" className={`${styles.btn} ${styles.btnLogout}`} onClick={onLogout}>
            <IconLogout className={styles.logoutIcon} />
            <span>Salir</span>
          </button>
        </div>
      </div>
    </header>
  );
}