"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { normalizePlanTier, planLabel, type PlanTier } from "@/lib/planTier";
import { PLAN_LIMITS, isUnlimited } from "@/lib/plans";
import styles from "./page.module.css";

const OWNER_EMAILS_DEFAULT = ["lizamaclaudio@gmail.com"];

function getOwnerEmails(): string[] {
  const env = (process.env.NEXT_PUBLIC_OWNER_EMAILS || "").trim();
  if (env) return env.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
  return OWNER_EMAILS_DEFAULT;
}

function fmtLimit(n: number) {
  return isUnlimited(n) ? "∞" : String(n);
}

function BillingInner() {
  const router = useRouter();
  const sp = useSearchParams();

  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState<string | null>(null);
  const [tier, setTier] = useState<PlanTier>("bronce");
  const [subStatus, setSubStatus] = useState<string | null>(null);
  const [mpId, setMpId] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const isOwner = useMemo(() => {
    const e = String(email || "").toLowerCase();
    return !!e && getOwnerEmails().includes(e);
  }, [email]);

  useEffect(() => {
    (async () => {
      const { data: s } = await supabaseBrowser.auth.getSession();
      if (!s.session) {
        router.replace("/login?e=" + encodeURIComponent("Sesión expirada. Vuelve a ingresar."));
        return;
      }

      const { data } = await supabaseBrowser.auth.getUser();
      const user = data.user;
      setEmail(user?.email ?? null);
      const md: any = user?.user_metadata || {};
      setSubStatus(md.subscription_status || null);
      setMpId(md.mp_preapproval_id || null);
      setTier(isOwner ? "diamante" : normalizePlanTier(md.plan_tier || md.plan || md.tier));
      setLoading(false);
    })();
  }, [router, isOwner]);

  useEffect(() => {
    const st = sp.get("status");
    if (st === "success") setMsg("✅ Suscripción actualizada. Puedes cerrar esta pantalla.");
    if (st === "cancel") setMsg("Operación cancelada.");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function startCheckout(t: "bronce" | "plata" | "oro") {
    setBusy(t);
    setMsg(null);

    try {
      const { data: s } = await supabaseBrowser.auth.getSession();
      const token = s.session?.access_token;
      if (!token) throw new Error("Sesión expirada");

      const res = await fetch("/api/billing/create-checkout-session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ tier: t }),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || "No se pudo iniciar el pago");
      if (!json?.url) throw new Error("Mercado Pago no devolvió URL");
      window.location.href = json.url;
    } catch (e: any) {
      setMsg(e?.message || "Error iniciando suscripción");
    } finally {
      setBusy(null);
    }
  }

  async function openPortal() {
    // Mercado Pago no tiene portal como Stripe.
    setMsg(
      "Mercado Pago no tiene un portal tipo Stripe. Para administrar tu suscripción, entra a tu cuenta de Mercado Pago y revisa pagos recurrentes. También puedes cancelar desde esta pantalla (si tu cuenta tiene una suscripción asociada)."
    );
  }

  async function cancelMp() {
    setBusy("cancel");
    setMsg(null);

    try {
      const { data: s } = await supabaseBrowser.auth.getSession();
      const token = s.session?.access_token;
      if (!token) throw new Error("Sesión expirada");

      const res = await fetch("/api/billing/cancel", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || "No se pudo cancelar");

      setMsg("✅ Suscripción cancelada. Recarga la página para ver el estado actualizado.");
      setSubStatus(json?.status || "canceled");
      setTier("bronce");
    } catch (e: any) {
      setMsg(e?.message || "Error cancelando suscripción");
    } finally {
      setBusy(null);
    }
  }

  const badge = useMemo(() => planLabel(tier, isOwner), [tier, isOwner]);

  if (loading) {
    return (
      <div className={styles.loadingShell}>
        <div className={styles.loadingCard}>
          <div className={styles.loadingTitle}>Cargando suscripción…</div>
          <div className={styles.loadingSub}>Verificando tu cuenta</div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.head}>
        <div>
          <div className={styles.kicker}>Suscripción</div>
          <h1 className={styles.h1}>Planes y límites</h1>
          <p className={styles.sub}>
            Tu plan actual: <span className={styles.badge}>{badge}</span>
            {subStatus ? <span className={styles.subStatus}> · Estado: {String(subStatus)}</span> : null}
          </p>
        </div>

        <div className={styles.headActions}>
          <Link className="btn btnGhost" href="/app">
            ← Dashboard
          </Link>
          <button className="btn btnGhost" type="button" onClick={() => window.location.reload()}>
            Recargar
          </button>
        </div>
      </div>

      {msg ? <div className={styles.msg}>{msg}</div> : null}

      <div className={styles.grid}>
        {(["bronce", "plata", "oro"] as const).map((t) => {
          const limits = PLAN_LIMITS[t];
          const active = tier === t;
          return (
            <div key={t} className={`${styles.card} ${styles[`tier_${t}`]}`} data-active={active ? "true" : "false"}>
              <div className={styles.cardTop}>
                <div>
                  <div className={styles.cardTitle}>{t.toUpperCase()}</div>
                  <div className={styles.cardSub}>Límites del plan</div>
                </div>
                {active ? <div className={styles.cardPill}>ACTUAL</div> : null}
              </div>

              <div className={styles.kpis}>
                <div className={styles.kpi}><div className={styles.kpiL}>Empresas</div><div className={styles.kpiV}>{fmtLimit(limits.maxCompanies)}</div></div>
                <div className={styles.kpi}><div className={styles.kpiL}>Charlas/mes</div><div className={styles.kpiV}>{fmtLimit(limits.maxSessionsPerMonth)}</div></div>
                <div className={styles.kpi}><div className={styles.kpiL}>PDFs/mes</div><div className={styles.kpiV}>{fmtLimit(limits.maxPdfsPerMonth)}</div></div>
                <div className={styles.kpi}><div className={styles.kpiL}>Asistentes/charla</div><div className={styles.kpiV}>{fmtLimit(limits.maxAttendeesPerSession)}</div></div>
              </div>

              <button
                className={`btn ${t === "plata" ? "btnPrimary" : "btnCta"} ${styles.btnFull}`}
                type="button"
                disabled={busy !== null || isOwner}
                onClick={() => startCheckout(t)}
              >
                {isOwner ? "Owner" : busy === t ? "Abriendo pago…" : active ? "Cambiar plan" : "Elegir"}
              </button>
            </div>
          );
        })}
      </div>

      <div className={styles.footer}>
        <div className={styles.footerText}>
          Mercado Pago gestiona el cobro recurrente. Si ya tienes una suscripción activa, puedes verla en tu cuenta de
          Mercado Pago (pagos recurrentes). Desde aquí también puedes cancelar.
        </div>
        <div className={styles.footerBtns}>
          <button className="btn btnGhost" type="button" onClick={openPortal} disabled={busy !== null || isOwner}>
            Guía Mercado Pago
          </button>
          <button
            className="btn btnGhost"
            type="button"
            onClick={cancelMp}
            disabled={busy !== null || isOwner || !mpId}
            title={!mpId ? "No se encontró mp_preapproval_id en tu cuenta" : ""}
          >
            {busy === "cancel" ? "Cancelando…" : "Cancelar suscripción"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function BillingPage() {
  // ✅ FIX Next 16: useSearchParams debe estar dentro de Suspense
  return (
    <Suspense
      fallback={
        <div className={styles.loadingShell}>
          <div className={styles.loadingCard}>
            <div className={styles.loadingTitle}>Cargando suscripción…</div>
            <div className={styles.loadingSub}>Preparando pantalla</div>
          </div>
        </div>
      }
    >
      <BillingInner />
    </Suspense>
  );
}
