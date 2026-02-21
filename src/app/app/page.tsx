"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/browser";
import styles from "./page.module.css";

export default function DashboardPage() {
  const router = useRouter();
  const sp = useSearchParams();

  const [loading, setLoading] = useState(true);
  const [companiesCount, setCompaniesCount] = useState<number>(0);
  const [sessionsCount, setSessionsCount] = useState<number | null>(null);

  const [error, setError] = useState<string | null>(null);

  // ✅ Mostrar mensaje ?e=... una vez y limpiar URL
  useEffect(() => {
    const e = sp.get("e");
    if (!e) return;

    const msg = decodeURIComponent(e);
    setError(msg);

    // limpia la URL para que no siga apareciendo
    router.replace("/app");
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  async function loadDashboard() {
    setLoading(true);

    const token = await getTokenOrRedirect();
    if (!token) return;

    try {
      // Empresas
      const cRes = await fetch("/api/app/companies", {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      const cJson = await cRes.json().catch(() => null);
      if (!cRes.ok) throw new Error(cJson?.error || "No se pudieron cargar empresas");
      const companies = cJson?.companies ?? [];
      setCompaniesCount(companies.length);

      // Charlas (si existe /api/app/sessions)
      try {
        const sRes = await fetch("/api/app/sessions", {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        });
        if (sRes.ok) {
          const sJson = await sRes.json().catch(() => null);
          setSessionsCount((sJson?.sessions ?? []).length);
        } else {
          setSessionsCount(null);
        }
      } catch {
        setSessionsCount(null);
      }
    } catch (e: any) {
      setCompaniesCount(0);
      setSessionsCount(null);
      setError(e?.message || "No se pudo cargar el dashboard");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDashboard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className={styles.page}>
      <div className={styles.head}>
        <div>
          <div className={styles.title}>Dashboard</div>
          <div className={styles.sub}>Resumen general de tu panel. Accesos rápidos para avanzar.</div>
        </div>

        <button className={styles.refreshBtn} onClick={loadDashboard} disabled={loading}>
          {loading ? "Cargando…" : "Actualizar"}
        </button>
      </div>

      {error && (
        <div className={styles.error}>
          {error}
        </div>
      )}

      <div className={styles.kpis}>
        <button className={styles.kpi} onClick={() => router.push("/app/companies")}>
          <div className={styles.kpiIcon}>🏢</div>
          <div className={styles.kpiText}>
            <div className={styles.kpiTitle}>Empresas</div>
            <div className={styles.kpiSub}>Clientes y contactos</div>
          </div>
          <div className={styles.kpiBadge}>{loading ? "…" : companiesCount}</div>
        </button>

        <button className={styles.kpi} onClick={() => router.push("/app/sessions")}>
          <div className={styles.kpiIcon}>📋</div>
          <div className={styles.kpiText}>
            <div className={styles.kpiTitle}>Charlas</div>
            <div className={styles.kpiSub}>Crear, QR, cierre</div>
          </div>
          <div className={styles.kpiBadgeMuted}>
            {loading ? "…" : sessionsCount === null ? "Pronto" : sessionsCount}
          </div>
        </button>

        <div className={styles.kpiDisabled}>
          <div className={styles.kpiIcon}>🪪</div>
          <div className={styles.kpiText}>
            <div className={styles.kpiTitle}>Asistencia</div>
            <div className={styles.kpiSub}>Registro público por QR</div>
          </div>
          <div className={styles.kpiBadgeMuted}>Pronto</div>
        </div>

        <div className={styles.kpiDisabled}>
          <div className={styles.kpiIcon}>📄</div>
          <div className={styles.kpiText}>
            <div className={styles.kpiTitle}>PDF Final</div>
            <div className={styles.kpiSub}>Lista + firmas + logo</div>
          </div>
          <div className={styles.kpiBadgeMuted}>Pronto</div>
        </div>
      </div>

      <div className={styles.card}>
        <div className={styles.cardTitle}>Acciones rápidas</div>
        <div className={styles.cardSub}>Atajos para avanzar más rápido</div>

        <div className={styles.actions}>
          <button className={styles.actionBtn} onClick={() => router.push("/app/companies/new")}>
            ➕ Crear empresa
          </button>
          <button className={styles.actionBtn} onClick={() => router.push("/app/companies")}>
            🏢 Ver mis empresas
          </button>
          <button className={styles.actionBtn} onClick={() => router.push("/app/sessions")}>
            📋 Ir a mis charlas
          </button>
          <button className={styles.actionBtn} onClick={() => router.push("/app/pdfs")}>
            📄 Ver mis PDF
          </button>
        </div>
      </div>

      <div className={styles.footer}>Creado por Claudio Lizama © 2026</div>
    </div>
  );
}