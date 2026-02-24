"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/browser";
import styles from "./page.module.css";

type Counts = {
  companies: number;
  sessions: number;
  pdfs: number;
};

export default function DashboardPage() {
  const [counts, setCounts] = useState<Counts>({ companies: 0, sessions: 0, pdfs: 0 });
  const [loading, setLoading] = useState(true);

  async function refresh() {
    setLoading(true);

    const { data } = await supabaseBrowser.auth.getSession();
    const token = data.session?.access_token;

    if (!token) {
      setLoading(false);
      return;
    }

    try {
      const [cRes, sRes, pRes] = await Promise.all([
        fetch("/api/app/companies", { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" }),
        fetch("/api/app/sessions", { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" }),
        fetch("/api/app/pdfs", { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" }),
      ]);

      const cJ = await cRes.json().catch(() => ({}));
      const sJ = await sRes.json().catch(() => ({}));
      const pJ = await pRes.json().catch(() => ({}));

      setCounts({
        companies: Array.isArray(cJ?.companies) ? cJ.companies.length : 0,
        sessions: Array.isArray(sJ?.sessions) ? sJ.sessions.length : 0,
        pdfs: Array.isArray(pJ?.pdfs) ? pJ.pdfs.length : 0,
      });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  return (
    <div className={styles.page}>
      <div className={`glass ${styles.headerCard}`}>
        <div className={styles.hTitle}>Dashboard</div>
        <div className={styles.hSub}>Resumen general de tu panel. Accesos rápidos para avanzar.</div>

        <div className={styles.actionsRow}>
          <div className="badge badgeOk">✅ Sesión activa</div>

          <button type="button" className="btn btnPrimary" onClick={refresh} disabled={loading}>
            {loading ? "Actualizando..." : "Actualizar"}
          </button>
        </div>

        <div className={styles.metrics} style={{ marginTop: 14 }}>
          <div className={`glass ${styles.metricCard}`}>
            <div className={styles.metricIcon}>🏢</div>
            <div>
              <div className={styles.metricTitle}>Empresas</div>
              <div className={styles.metricSub}>Clientes y contactos</div>
            </div>
            <div className={styles.metricBadge}>{counts.companies}</div>
          </div>

          <div className={`glass ${styles.metricCard}`}>
            <div className={styles.metricIcon}>📋</div>
            <div>
              <div className={styles.metricTitle}>Charlas</div>
              <div className={styles.metricSub}>Crear, QR, cierre</div>
            </div>
            <div className={styles.metricBadge}>{counts.sessions}</div>
          </div>

          <div className={`glass ${styles.metricCard}`}>
            <div className={styles.metricIcon}>🧾</div>
            <div>
              <div className={styles.metricTitle}>Asistencia</div>
              <div className={styles.metricSub}>Registro público por QR</div>
            </div>
            <div className={styles.metricBadge}>Pronto</div>
          </div>

          <div className={`glass ${styles.metricCard}`}>
            <div className={styles.metricIcon}>📄</div>
            <div>
              <div className={styles.metricTitle}>PDF Final</div>
              <div className={styles.metricSub}>Lista + firmas + logo</div>
            </div>
            <div className={styles.metricBadge}>Pronto</div>
          </div>
        </div>
      </div>

      <div className={`glass ${styles.quickCard}`}>
        <div className={styles.quickTitle}>Acciones rápidas</div>
        <div className={styles.quickSub}>Atajos para avanzar más rápido</div>

        <div className={styles.quickGrid}>
          <Link className={styles.quickBtn} href="/app/companies/new">
            ➕ Crear empresa
          </Link>

          <Link className={styles.quickBtn} href="/app/companies">
            🏢 Ver mis empresas
          </Link>

          <Link className={styles.quickBtn} href="/app/sessions">
            📋 Ir a mis charlas
          </Link>

          <Link className={styles.quickBtn} href="/app/pdfs">
            📄 Ver mis PDF
          </Link>
        </div>
      </div>

      <div className={styles.footer}>Creado por Claudio Lizama © 2026</div>
    </div>
  );
}