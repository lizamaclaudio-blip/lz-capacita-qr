"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/browser";
import styles from "./page.module.css";

type Company = {
  id: string;
  name: string;
  address: string | null;
  created_at: string;
  // opcional (si después lo agregas en DB/API)
  logo_url?: string | null;
};

function fmtCL(iso: string) {
  try {
    return new Date(iso).toLocaleString("es-CL");
  } catch {
    return iso;
  }
}

function ModuleIcon({ name }: { name: "companies" | "sessions" | "checkin" | "pdf" }) {
  const common = { width: 22, height: 22, "aria-hidden": true as const };
  const color = "currentColor";

  if (name === "companies")
    return (
      <svg viewBox="0 0 24 24" {...common}>
        <path
          fill={color}
          d="M3 21V3h11v6h7v12H3zm2-2h7V5H5v14zm9 0h5V11h-5v8z"
        />
      </svg>
    );

  if (name === "sessions")
    return (
      <svg viewBox="0 0 24 24" {...common}>
        <path
          fill={color}
          d="M4 6h16v2H4V6zm0 5h16v2H4v-2zm0 5h10v2H4v-2z"
        />
      </svg>
    );

  if (name === "checkin")
    return (
      <svg viewBox="0 0 24 24" {...common}>
        <path
          fill={color}
          d="M3 4h18v16H3V4zm2 2v12h14V6H5zm2 2h4v4H7V8zm6 0h4v2h-4V8zm0 4h4v2h-4v-2z"
        />
      </svg>
    );

  return (
    <svg viewBox="0 0 24 24" {...common}>
      <path
        fill={color}
        d="M6 2h9l5 5v15a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2zm8 1.5V8h4.5L14 3.5zM7 12h10v2H7v-2zm0 4h10v2H7v-2z"
      />
    </svg>
  );
}

export default function AppHome() {
  const router = useRouter();
  const sp = useSearchParams();

  const [loading, setLoading] = useState(true);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [isAdmin, setIsAdmin] = useState(false);

  // form
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");

  useEffect(() => {
    const e = sp.get("e");
    if (e) setError(decodeURIComponent(e));
  }, [sp]);

  async function getTokenOrRedirect() {
    const { data } = await supabaseBrowser.auth.getSession();
    const token = data.session?.access_token;
    if (!token) {
      router.replace("/login?e=" + encodeURIComponent("Sesión expirada. Vuelve a ingresar."));
      return null;
    }
    return token;
  }

  async function load() {
    setLoading(true);
    setError(null);

    const token = await getTokenOrRedirect();
    if (!token) return;

    // admin?
    const meRes = await fetch("/api/app/me", {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    const meJson = await meRes.json().catch(() => null);
    if (meRes.ok) setIsAdmin(!!meJson?.is_admin);

    // companies
    const res = await fetch("/api/app/companies", {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });

    const json = await res.json().catch(() => null);

    if (!res.ok) {
      if (res.status === 401) {
        router.replace("/login?e=" + encodeURIComponent("Sesión expirada. Vuelve a ingresar."));
        return;
      }
      setError(json?.error || "No se pudo cargar empresas");
      setCompanies([]);
      setLoading(false);
      return;
    }

    setCompanies(json?.companies ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function createCompany(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const token = await getTokenOrRedirect();
    if (!token) return;

    const res = await fetch("/api/app/companies", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        name,
        address: address.trim() ? address.trim() : null,
      }),
    });

    const json = await res.json().catch(() => null);

    if (!res.ok) {
      if (res.status === 401) {
        router.replace("/login?e=" + encodeURIComponent("Sesión expirada. Vuelve a ingresar."));
        return;
      }
      setError(json?.error || "No se pudo crear empresa");
      return;
    }

    setName("");
    setAddress("");
    await load();
  }

  async function logout() {
    await supabaseBrowser.auth.signOut();
    router.replace("/login");
  }

  const companyCount = companies.length;

  const modules = useMemo(
    () => [
      {
        key: "companies",
        title: "Empresas",
        desc: "Administra tus clientes y sucursales",
        value: String(companyCount),
        status: "OK",
      },
      {
        key: "sessions",
        title: "Charlas",
        desc: "Crea y cierra charlas con firma",
        value: "Pronto",
        status: "EN PROGRESO",
      },
      {
        key: "checkin",
        title: "Asistencia",
        desc: "Formulario público por código",
        value: "Pronto",
        status: "EN PROGRESO",
      },
      {
        key: "pdf",
        title: "PDF Final",
        desc: "Lista + firmas + logo",
        value: "Pronto",
        status: "EN PROGRESO",
      },
    ],
    [companyCount]
  );

  return (
    <div className={styles.wrap}>
      {/* HERO */}
      <div className={styles.hero}>
        <div className={styles.heroLeft}>
          <div className={styles.kicker}>Bienvenido 👋</div>
          <h1 className={styles.h1}>Tu panel de charlas y asistencia</h1>
          <p className={styles.sub}>
            Crea empresas, genera charlas con QR público, cierra con firma del relator y emite PDF final.
          </p>

          <div className={styles.heroBtns}>
            {isAdmin ? (
              <a className={styles.secondaryBtn} href="/admin/new">
                Ir a Admin
              </a>
            ) : null}
            <button className={styles.darkBtn} onClick={logout} type="button">
              Salir
            </button>
          </div>
        </div>

        <div className={styles.heroRight}>
          <div className={styles.logoCard}>
            <Image
              src="/registro-logo.png"
              alt="LZ Capacita QR"
              width={260}
              height={72}
              priority
            />
            <div className={styles.logoHint}>Charlas y Capacitaciones</div>
          </div>
        </div>
      </div>

      {error ? <div className={styles.error}>{error}</div> : null}

      {/* MÓDULOS */}
      <div className={styles.modules}>
        {modules.map((m: any) => (
          <div key={m.key} className={styles.moduleCard}>
            <div className={styles.moduleTop}>
              <div className={styles.moduleIcon}>
                <ModuleIcon name={m.key} />
              </div>
              <span className={m.status === "OK" ? styles.badgeOk : styles.badgeSoon}>
                {m.status === "OK" ? "Listo" : "Pronto"}
              </span>
            </div>

            <div className={styles.moduleTitle}>{m.title}</div>
            <div className={styles.moduleDesc}>{m.desc}</div>

            <div className={styles.moduleValue}>{m.value}</div>
          </div>
        ))}
      </div>

      {/* CREAR EMPRESA */}
      <div className={styles.card}>
        <div className={styles.cardTitle}>Crear empresa</div>
        <div className={styles.cardSub}>Agrega un cliente para luego crear charlas</div>

        <form onSubmit={createCompany} className={styles.form}>
          <div className={styles.field}>
            <label className={styles.label}>Nombre</label>
            <input
              className={styles.input}
              placeholder="Ej: Automotora Berríos"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label}>Dirección (opcional)</label>
            <input
              className={styles.input}
              placeholder="Ej: Puerto Montt"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
            />
          </div>

          <button className={styles.saveBtn} type="submit">
            Guardar empresa
          </button>
        </form>
      </div>

      {/* LISTA EMPRESAS */}
      <div className={styles.card}>
        <div className={styles.cardTitle}>Tus empresas</div>
        <div className={styles.cardSub}>Selecciona una empresa para administrar sus charlas</div>

        {loading ? (
          <div className={styles.muted}>Cargando…</div>
        ) : !companies.length ? (
          <div className={styles.muted}>Aún no creas ninguna empresa.</div>
        ) : (
          <div className={styles.grid}>
            {companies.map((c) => {
              const letter = (c.name?.trim()?.[0] ?? "E").toUpperCase();
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => router.push(`/app/company/${c.id}`)}
                  className={styles.companyCard}
                  title="Abrir empresa"
                >
                  <div className={styles.companyTop}>
                    <div className={styles.avatar}>
                      {c.logo_url ? (
                        // por ahora solo si existe; si no, letra
                        <Image src={c.logo_url} alt={c.name} width={36} height={36} />
                      ) : (
                        <span>{letter}</span>
                      )}
                    </div>

                    <div className={styles.companyInfo}>
                      <div className={styles.companyName}>{c.name}</div>
                      <div className={styles.companyMeta}>
                        {c.address || "Sin dirección"}
                      </div>
                    </div>
                  </div>

                  <div className={styles.companyBottom}>
                    <div className={styles.companyMeta}>
                      Creada: {fmtCL(c.created_at)}
                    </div>
                    <div className={styles.openHint}>Abrir →</div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}