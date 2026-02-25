"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import styles from "./page.module.css";

type Billing = "monthly" | "annual";
type PlanKey = "starter" | "pro" | "business";

type LandingStats = {
  companies: number;
  sessions: number;
  attendees: number;
  pdfs: number;
};

function clp(n: number) {
  try {
    return new Intl.NumberFormat("es-CL", {
      style: "currency",
      currency: "CLP",
      maximumFractionDigits: 0,
    }).format(n);
  } catch {
    return `$${Math.round(n)}`;
  }
}

function fmtInt(n: number) {
  try {
    return new Intl.NumberFormat("es-CL").format(n);
  } catch {
    return String(n);
  }
}

function useCountUp(target: number, durationMs = 900) {
  const [val, setVal] = useState(0);

  useEffect(() => {
    let raf = 0;
    const start = performance.now();
    const from = 0;
    const to = Math.max(0, Math.floor(target || 0));

    function tick(t: number) {
      const p = Math.min((t - start) / durationMs, 1);
      const eased = 1 - Math.pow(1 - p, 3); // easeOutCubic
      setVal(Math.round(from + (to - from) * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
    }

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, durationMs]);

  return val;
}

export default function HomePage() {
  const [billing, setBilling] = useState<Billing>("monthly");

  // ✅ métricas reales (API pública)
  const [stats, setStats] = useState<LandingStats | null>(null);
  const [statsUpdatedAt, setStatsUpdatedAt] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        const res = await fetch("/api/public/landing-stats", { cache: "no-store" });
        const json = await res.json().catch(() => null);
        if (!alive) return;
        if (!res.ok) return;

        setStats(json?.stats ?? null);
        setStatsUpdatedAt(json?.updated_at ?? null);
      } catch {
        // no romper landing
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  // ✅ Count up animado
  const cCompanies = useCountUp(stats?.companies ?? 0, 900);
  const cSessions = useCountUp(stats?.sessions ?? 0, 1000);
  const cAttendees = useCountUp(stats?.attendees ?? 0, 1100);
  const cPdfs = useCountUp(stats?.pdfs ?? 0, 900);

  // ✅ Reveal on scroll (sin framer-motion)
  useEffect(() => {
    const els = Array.from(document.querySelectorAll<HTMLElement>("[data-reveal]"));
    if (!els.length) return;

    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            (e.target as HTMLElement).classList.add(styles.revealed);
            io.unobserve(e.target);
          }
        }
      },
      { threshold: 0.18 }
    );

    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  const pricing = useMemo(() => {
    const monthly = { starter: 0, pro: 19900, business: 49900 };
    const annualMultiplier = 10; // ~2 meses gratis
    const pick = (m: number) => (billing === "monthly" ? m : m * annualMultiplier);

    return {
      label: billing === "monthly" ? "/ mes" : "/ año",
      badge: billing === "monthly" ? "Mensual" : "Anual (2 meses gratis)",
      starter: pick(monthly.starter),
      pro: pick(monthly.pro),
      business: pick(monthly.business),
    };
  }, [billing]);

  const planLimits = useMemo(() => {
    return {
      starter: {
        empresas: "1",
        sucursales: "—",
        charlas: billing === "monthly" ? "10 / mes" : "120 / año",
        asistentes: billing === "monthly" ? "500 / mes" : "6.000 / año",
        pdf: "Incluye",
        soporte: "Básico",
        roles: "1 admin",
      },
      pro: {
        empresas: "Ilimitadas",
        sucursales: "Hasta 10",
        charlas: "Ilimitadas",
        asistentes: billing === "monthly" ? "5.000 / mes" : "60.000 / año",
        pdf: "Incluye (logos)",
        soporte: "Prioritario",
        roles: "Hasta 3 admins",
      },
      business: {
        empresas: "Ilimitadas",
        sucursales: "Ilimitadas",
        charlas: "Ilimitadas",
        asistentes: billing === "monthly" ? "25.000 / mes" : "300.000 / año",
        pdf: "Incluye + branding",
        soporte: "SLA / dedicado",
        roles: "Roles y permisos",
      },
    } as Record<PlanKey, any>;
  }, [billing]);

  const compare = useMemo(() => {
    type Row = { label: string; starter: string; pro: string; business: string; hint?: string };
    const rows: Row[] = [
      { label: "Empresas", starter: planLimits.starter.empresas, pro: planLimits.pro.empresas, business: planLimits.business.empresas },
      { label: "Sucursales", starter: planLimits.starter.sucursales, pro: planLimits.pro.sucursales, business: planLimits.business.sucursales },
      { label: "Charlas", starter: planLimits.starter.charlas, pro: planLimits.pro.charlas, business: planLimits.business.charlas },
      { label: "Asistentes", starter: planLimits.starter.asistentes, pro: planLimits.pro.asistentes, business: planLimits.business.asistentes, hint: "Límite por periodo de facturación" },
      { label: "Validación RUT + DV", starter: "✓", pro: "✓", business: "✓" },
      { label: "Firma asistentes", starter: "✓", pro: "✓", business: "✓" },
      { label: "Firma relator (cierre)", starter: "✓", pro: "✓", business: "✓" },
      { label: "PDF final consolidado", starter: "✓", pro: "✓ (logos)", business: "✓ (branding)" },
      { label: "Gestión de trabajadores", starter: "✓", pro: "✓", business: "✓" },
      { label: "Panel admin por charla", starter: "✓", pro: "✓", business: "✓" },
      { label: "Roles / permisos", starter: planLimits.starter.roles, pro: planLimits.pro.roles, business: planLimits.business.roles },
      { label: "Soporte", starter: planLimits.starter.soporte, pro: planLimits.pro.soporte, business: planLimits.business.soporte },
    ];
    return rows;
  }, [planLimits]);

  const fmtCell = (v: string) => {
    const low = (v || "").toLowerCase().trim();
    if (low === "✓") return <span className={styles.yes}>✓</span>;
    if (low === "—" || low === "x") return <span className={styles.no}>—</span>;
    return <span className={styles.cap}>{v}</span>;
  };

  return (
    <main className={styles.root}>
      {/* NAV */}
      <header className={styles.header}>
        <div className={styles.nav}>
          <Link href="/" className={styles.brand}>
            <span className={styles.logoBox}>
              <Image
                src="/brand/lz-capacita-qr.png"
                alt="LZ Capacita QR"
                fill
                priority
                sizes="46px"
                className={styles.logoImg}
              />
            </span>
            <span className={styles.brandText}>
              <span className={styles.brandTitle}>LZ Capacita QR</span>
              <span className={styles.brandSub}>QR · Firma · PDF Final</span>
            </span>
          </Link>

          <nav className={styles.menu} aria-label="Navegación">
            <a className={styles.menuLink} href="#producto">Producto</a>
            <a className={styles.menuLink} href="#numeros">En números</a>
            <a className={styles.menuLink} href="#como-funciona">Cómo funciona</a>
            <a className={styles.menuLink} href="#pricing">Precios</a>
            <a className={styles.menuLink} href="#faq">FAQ</a>
          </nav>

          <div className={styles.actions}>
            <Link href="/login" className={`btn btnGhost ${styles.btnSm}`}>Ingresar</Link>
            <Link href="/signup" className={`btn btnCta ${styles.btnSm}`}>Probar demo</Link>
          </div>
        </div>
      </header>

      {/* HERO */}
      <section className={styles.hero}>
        <div className={styles.heroLeft}>
          <div className={`${styles.kicker} ${styles.reveal}`} data-reveal style={{ ["--d" as any]: "0ms" }}>
            <span className={styles.dot} />
            Trazabilidad real · sin planillas · listo para auditoría
          </div>

          <h1 className={`${styles.h1} ${styles.reveal}`} data-reveal style={{ ["--d" as any]: "70ms" }}>
            Registra asistencia con QR,
            <br />
            firma y genera <span className={styles.h1Strong}>PDF final</span>.
          </h1>

          <p className={`${styles.p} ${styles.reveal}`} data-reveal style={{ ["--d" as any]: "120ms" }}>
            Crea una charla, comparte el QR, valida RUT + DV, captura firma en el celular y cierra con firma del relator.
            Resultado: <b>PDF consolidado</b> con logos y respaldo.
          </p>

          <div className={`${styles.ctaRow} ${styles.reveal}`} data-reveal style={{ ["--d" as any]: "170ms" }}>
            <Link href="/signup" className={`btn btnPrimary ${styles.btnLg}`}>
              Solicitar demo <span className={styles.arrow}>→</span>
            </Link>
            <a href="#como-funciona" className={`btn btnGhost ${styles.btnLg}`}>
              Ver cómo funciona
            </a>
          </div>

          <div className={`${styles.trustRow} ${styles.reveal}`} data-reveal style={{ ["--d" as any]: "220ms" }}>
            <div className={styles.trustPill}>✅ RUT + DV</div>
            <div className={styles.trustPill}>✅ Firma digital</div>
            <div className={styles.trustPill}>✅ PDF con logo</div>
            <div className={styles.trustPill}>✅ Antiduplicados</div>
          </div>

          <div className={`${styles.micro} ${styles.reveal}`} data-reveal style={{ ["--d" as any]: "260ms" }}>
            Diseñado para prevención, RR.HH. y operación en terreno.
          </div>
        </div>

        <div className={`${styles.heroRight} ${styles.reveal}`} data-reveal style={{ ["--d" as any]: "120ms" }} aria-hidden="true">
          <div className={styles.bento}>
            <div className={styles.tileBig}>
              <div className={styles.tileTop}>
                <div>
                  <div className={styles.tileTitle}>Panel de charla</div>
                  <div className={styles.tileSub}>Asistentes · firma · PDF final</div>
                </div>
                <div className={styles.badge}>PDF listo</div>
              </div>

              <div className={styles.kpiGrid}>
                <div className={styles.kpi}>
                  <div className={styles.kpiLabel}>Asistentes</div>
                  <div className={styles.kpiValue}>124</div>
                </div>
                <div className={styles.kpi}>
                  <div className={styles.kpiLabel}>Firmas</div>
                  <div className={styles.kpiValue}>124</div>
                </div>
                <div className={styles.kpi}>
                  <div className={styles.kpiLabel}>PDF</div>
                  <div className={styles.kpiValue}>1</div>
                </div>
              </div>

              <div className={styles.flow}>
                <div className={styles.flowTitle}>Flujo</div>
                <div className={styles.flowLine}>1) Crear charla → QR</div>
                <div className={styles.flowLine}>2) Registro + firma</div>
                <div className={styles.flowLine}>3) Cierre relator → PDF</div>
              </div>
            </div>

            <div className={styles.tile}>
              <div className={styles.miniTitle}>Registro QR</div>
              <div className={styles.miniRow}><span>RUT</span><b>12.345.678-9</b></div>
              <div className={styles.miniRow}><span>Firma</span><b>✍️</b></div>
              <div className={styles.miniBtn}>Finalizar</div>
            </div>

            <div className={styles.tile}>
              <div className={styles.miniTitle}>Cumplimiento</div>
              <div className={styles.miniPill}>Trazabilidad</div>
              <div className={styles.miniPill}>Respaldo</div>
              <div className={styles.miniPill}>Auditoría</div>
            </div>

            <div className={styles.glow} />
          </div>
        </div>
      </section>

      {/* EN NÚMEROS */}
      <section id="numeros" className={`${styles.section} ${styles.statsSection}`}>
        <div className={styles.pricingHead}>
          <div>
            <h2 className={`${styles.h2} ${styles.reveal}`} data-reveal style={{ ["--d" as any]: "0ms" }}>En números</h2>
            <p className={`${styles.lead} ${styles.reveal}`} data-reveal style={{ ["--d" as any]: "60ms" }}>
              Métricas en vivo desde la plataforma (se actualizan automáticamente).
            </p>
          </div>

          <div className={`${styles.statsNote} ${styles.reveal}`} data-reveal style={{ ["--d" as any]: "90ms" }}>
            {statsUpdatedAt ? `Actualizado: ${new Date(statsUpdatedAt).toLocaleString("es-CL")}` : "Actualización automática"}
          </div>
        </div>

        <div className={styles.statsGrid}>
          <div className={`${styles.statCard} ${styles.reveal}`} data-reveal style={{ ["--d" as any]: "0ms" }}>
            <div className={styles.statLabel}>Empresas creadas</div>
            <div className={styles.statValue}>{fmtInt(cCompanies)}</div>
            <div className={styles.statSub}>Registradas en la plataforma</div>
          </div>

          <div className={`${styles.statCard} ${styles.reveal}`} data-reveal style={{ ["--d" as any]: "60ms" }}>
            <div className={styles.statLabel}>Charlas creadas</div>
            <div className={styles.statValue}>{fmtInt(cSessions)}</div>
            <div className={styles.statSub}>Incluye abiertas y cerradas</div>
          </div>

          <div className={`${styles.statCard} ${styles.reveal}`} data-reveal style={{ ["--d" as any]: "120ms" }}>
            <div className={styles.statLabel}>Asistencias registradas</div>
            <div className={styles.statValue}>{fmtInt(cAttendees)}</div>
            <div className={styles.statSub}>Con RUT validado + firma</div>
          </div>

          <div className={`${styles.statCard} ${styles.reveal}`} data-reveal style={{ ["--d" as any]: "180ms" }}>
            <div className={styles.statLabel}>PDFs generados</div>
            <div className={styles.statValue}>{fmtInt(cPdfs)}</div>
            <div className={styles.statSub}>Con firmas y logos</div>
          </div>
        </div>
      </section>

      {/* PRODUCT */}
      <section id="producto" className={styles.section}>
        <div className={styles.sectionHead}>
          <h2 className={`${styles.h2} ${styles.reveal}`} data-reveal style={{ ["--d" as any]: "0ms" }}>Producto</h2>
          <p className={`${styles.lead} ${styles.reveal}`} data-reveal style={{ ["--d" as any]: "60ms" }}>
            Una plataforma simple para transformar asistencia + firma en evidencia formal (PDF).
          </p>
        </div>

        <div className={styles.bentoGrid}>
          <div className={`${styles.bentoCard} ${styles.reveal}`} data-reveal style={{ ["--d" as any]: "0ms" }}>
            <div className={styles.icon}>📷</div>
            <div className={styles.bTitle}>QR público</div>
            <div className={styles.bText}>Ingreso desde cualquier celular. Sin app obligatoria.</div>
          </div>

          <div className={`${styles.bentoCard} ${styles.reveal}`} data-reveal style={{ ["--d" as any]: "60ms" }}>
            <div className={styles.icon}>🪪</div>
            <div className={styles.bTitle}>RUT + DV</div>
            <div className={styles.bText}>Validación para evitar errores y duplicados.</div>
          </div>

          <div className={`${styles.bentoCard} ${styles.reveal}`} data-reveal style={{ ["--d" as any]: "120ms" }}>
            <div className={styles.icon}>✍️</div>
            <div className={styles.bTitle}>Firma digital</div>
            <div className={styles.bText}>Firma de asistentes y firma final del relator.</div>
          </div>

          <div className={`${styles.bentoCardWide} ${styles.reveal}`} data-reveal style={{ ["--d" as any]: "180ms" }}>
            <div className={styles.wTop}>
              <div>
                <div className={styles.wTitle}>PDF final con logos</div>
                <div className={styles.wText}>
                  Generación automática del PDF consolidado con empresa + LZ, firmas y lista completa.
                </div>
              </div>
              <div className={styles.wStamp}>PDF</div>
            </div>

            <div className={styles.wLines}>
              <div className={styles.line} />
              <div className={styles.line} />
              <div className={styles.lineSm} />
              <div className={styles.line} />
            </div>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="como-funciona" className={`${styles.section} ${styles.sectionAlt}`}>
        <div className={styles.split}>
          <div className={styles.splitLeft}>
            <h2 className={`${styles.h2} ${styles.reveal}`} data-reveal style={{ ["--d" as any]: "0ms" }}>Cómo funciona</h2>
            <p className={`${styles.lead} ${styles.reveal}`} data-reveal style={{ ["--d" as any]: "60ms" }}>
              El flujo es directo, pensado para terreno y para respaldo.
            </p>

            <div className={`${styles.steps} ${styles.reveal}`} data-reveal style={{ ["--d" as any]: "120ms" }}>
              <div className={styles.step}>
                <div className={styles.stepNum}>1</div>
                <div>
                  <div className={styles.stepTitle}>Crea la charla</div>
                  <div className={styles.stepText}>El sistema genera el código y el QR público.</div>
                </div>
              </div>

              <div className={styles.step}>
                <div className={styles.stepNum}>2</div>
                <div>
                  <div className={styles.stepTitle}>Registro + firma</div>
                  <div className={styles.stepText}>Nombre, RUT, cargo y firma desde el celular.</div>
                </div>
              </div>

              <div className={styles.step}>
                <div className={styles.stepNum}>3</div>
                <div>
                  <div className={styles.stepTitle}>Cierre relator</div>
                  <div className={styles.stepText}>Firma final + generación de PDF consolidado.</div>
                </div>
              </div>
            </div>

            <div className={`${styles.inlineCtas} ${styles.reveal}`} data-reveal style={{ ["--d" as any]: "160ms" }}>
              <Link href="/signup" className="btn btnCta">Probar demo</Link>
              <Link href="/login" className="btn btnGhost">Ingresar</Link>
            </div>
          </div>

          <div className={`${styles.splitRight} ${styles.reveal}`} data-reveal style={{ ["--d" as any]: "120ms" }}>
            <div className={styles.bigMock}>
              <div className={styles.bigMockTop}>
                <div className={styles.bigMockTitle}>Reporte PDF</div>
                <div className={styles.bigMockSub}>Firmado y respaldable</div>
              </div>

              <div className={styles.bigMockBody}>
                <div className={styles.mLine} />
                <div className={styles.mLine} />
                <div className={styles.mLineSm} />
                <div className={styles.stamp}>
                  <div className={styles.stampLabel}>Firmado electrónicamente</div>
                  <div className={styles.stampRow}>RUT: 12.345.678-9</div>
                  <div className={styles.stampRow}>Fecha: {new Date().toLocaleDateString("es-CL")}</div>
                </div>
                <div className={styles.sigBar}>
                  <span>Firma relator</span>
                  <span className={styles.sigInk}>✍️</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* PRICING + COMPARISON */}
      <section id="pricing" className={styles.section}>
        <div className={styles.pricingHead}>
          <div>
            <h2 className={`${styles.h2} ${styles.reveal}`} data-reveal style={{ ["--d" as any]: "0ms" }}>Precios</h2>
            <p className={`${styles.lead} ${styles.reveal}`} data-reveal style={{ ["--d" as any]: "60ms" }}>
              Precios en CLP. Límites por plan y periodo de facturación.
            </p>
          </div>

          <div className={`${styles.toggleWrap} ${styles.reveal}`} data-reveal style={{ ["--d" as any]: "80ms" }}>
            <div className={styles.toggleLabel}>{pricing.badge}</div>
            <div className={styles.toggle}>
              <button
                type="button"
                className={`${styles.tBtn} ${billing === "monthly" ? styles.tActive : ""}`}
                onClick={() => setBilling("monthly")}
              >
                Mensual
              </button>
              <button
                type="button"
                className={`${styles.tBtn} ${billing === "annual" ? styles.tActive : ""}`}
                onClick={() => setBilling("annual")}
              >
                Anual
              </button>
            </div>
          </div>
        </div>

        <div className={styles.pricingGrid}>
          <div className={`${styles.plan} ${styles.reveal}`} data-reveal style={{ ["--d" as any]: "0ms" }}>
            <div className={styles.planTop}>
              <div className={styles.planName}>Starter</div>
              <div className={styles.planPrice}>
                {clp(pricing.starter)} <span className={styles.planUnit}>{pricing.label}</span>
              </div>
            </div>
            <div className={styles.planDesc}>Para probar el flujo completo.</div>
            <ul className={styles.ul}>
              <li>Empresas: {planLimits.starter.empresas}</li>
              <li>Charlas: {planLimits.starter.charlas}</li>
              <li>Asistentes: {planLimits.starter.asistentes}</li>
              <li>PDF final: {planLimits.starter.pdf}</li>
            </ul>
            <Link href="/signup" className="btn btnGhost">Probar demo</Link>
          </div>

          <div className={`${styles.plan} ${styles.planHot} ${styles.reveal}`} data-reveal style={{ ["--d" as any]: "60ms" }}>
            <div className={styles.hotBadge}>Recomendado</div>
            <div className={styles.planTop}>
              <div className={styles.planName}>Pro</div>
              <div className={styles.planPrice}>
                {clp(pricing.pro)} <span className={styles.planUnit}>{pricing.label}</span>
              </div>
            </div>
            <div className={styles.planDesc}>Para equipos activos (prevención/RRHH).</div>
            <ul className={styles.ul}>
              <li>Empresas: {planLimits.pro.empresas}</li>
              <li>Sucursales: {planLimits.pro.sucursales}</li>
              <li>Asistentes: {planLimits.pro.asistentes}</li>
              <li>Roles: {planLimits.pro.roles}</li>
            </ul>
            <Link href="/signup" className="btn btnCta">Empezar Pro</Link>
          </div>

          <div className={`${styles.plan} ${styles.reveal}`} data-reveal style={{ ["--d" as any]: "120ms" }}>
            <div className={styles.planTop}>
              <div className={styles.planName}>Business</div>
              <div className={styles.planPrice}>
                {clp(pricing.business)} <span className={styles.planUnit}>{pricing.label}</span>
              </div>
            </div>
            <div className={styles.planDesc}>Para multi-sede y operación intensiva.</div>
            <ul className={styles.ul}>
              <li>Sucursales: {planLimits.business.sucursales}</li>
              <li>Asistentes: {planLimits.business.asistentes}</li>
              <li>Roles: {planLimits.business.roles}</li>
              <li>Soporte: {planLimits.business.soporte}</li>
            </ul>
            <Link href="/signup" className="btn btnPrimary">Hablar con ventas</Link>
          </div>
        </div>

        <div className={`${styles.compareWrap} ${styles.reveal}`} data-reveal style={{ ["--d" as any]: "120ms" }}>
          <div className={styles.compareHead}>
            <div className={styles.compareTitle}>Comparación de planes</div>
            <div className={styles.compareSub}>Si necesitas más volumen, se puede ajustar por empresa/contrato.</div>
          </div>

          <div className={styles.tableScroll}>
            <table className={styles.compareTable}>
              <thead>
                <tr>
                  <th className={styles.thFeature}>Característica</th>
                  <th className={styles.th}>Starter</th>
                  <th className={styles.thHot}>Pro</th>
                  <th className={styles.th}>Business</th>
                </tr>
              </thead>
              <tbody>
                {compare.map((r, i) => (
                  <tr key={i} className={styles.tr}>
                    <td className={styles.tdFeature}>
                      <div className={styles.featureName}>{r.label}</div>
                      {r.hint ? <div className={styles.featureHint}>{r.hint}</div> : null}
                    </td>
                    <td className={styles.td}>{fmtCell(r.starter)}</td>
                    <td className={styles.tdHot}>{fmtCell(r.pro)}</td>
                    <td className={styles.td}>{fmtCell(r.business)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className={styles.pricingFoot}>
            * Valores referenciales. Después lo conectamos con Stripe/Flow/MercadoPago si quieres.
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className={`${styles.section} ${styles.sectionAlt}`}>
        <div className={styles.sectionHead}>
          <h2 className={`${styles.h2} ${styles.reveal}`} data-reveal style={{ ["--d" as any]: "0ms" }}>FAQ</h2>
          <p className={`${styles.lead} ${styles.reveal}`} data-reveal style={{ ["--d" as any]: "60ms" }}>
            Respuestas rápidas a lo típico.
          </p>
        </div>

        <div className={styles.faq}>
          <details className={`${styles.faqItem} ${styles.reveal}`} data-reveal style={{ ["--d" as any]: "0ms" }}>
            <summary>¿Necesito que los asistentes instalen una app?</summary>
            <p>No. Abren el link del QR en el navegador y registran firma directamente.</p>
          </details>

          <details className={`${styles.faqItem} ${styles.reveal}`} data-reveal style={{ ["--d" as any]: "60ms" }}>
            <summary>¿El RUT se valida con dígito verificador?</summary>
            <p>Sí. El formulario valida DV para minimizar errores y duplicados.</p>
          </details>

          <details className={`${styles.faqItem} ${styles.reveal}`} data-reveal style={{ ["--d" as any]: "120ms" }}>
            <summary>¿El PDF queda con firma del relator?</summary>
            <p>Sí. El relator firma el cierre y el PDF se genera con firmas y logos.</p>
          </details>

          <details className={`${styles.faqItem} ${styles.reveal}`} data-reveal style={{ ["--d" as any]: "180ms" }}>
            <summary>¿Puedo usarlo con varias empresas/sucursales?</summary>
            <p>Sí. Pro/Business soportan multi-empresa. Sucursales se asocian a casa matriz.</p>
          </details>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className={`${styles.ctaBand} ${styles.reveal}`} data-reveal style={{ ["--d" as any]: "0ms" }}>
        <div className={styles.ctaInner}>
          <div>
            <h2 className={styles.ctaTitle}>Capacita. Firma. Respalda.</h2>
            <p className={styles.ctaText}>Cambia “lista en papel” por evidencia formal en minutos.</p>
          </div>
          <div className={styles.ctaBtns}>
            <Link href="/signup" className="btn btnCta">Probar demo</Link>
            <Link href="/login" className="btn btnGhost">Ingresar</Link>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className={styles.footer}>
        <div className={styles.footerLeft}>
          <div className={styles.footerTitle}>LZ Capacita QR</div>
          <div className={styles.footerSub}>© {new Date().getFullYear()} · Puerto Montt, Chile</div>
        </div>

        <div className={styles.footerRight}>
          <a className={styles.footerLink} href="#producto">Producto</a>
          <a className={styles.footerLink} href="#numeros">En números</a>
          <a className={styles.footerLink} href="#como-funciona">Cómo funciona</a>
          <a className={styles.footerLink} href="#pricing">Precios</a>
          <a className={styles.footerLink} href="#faq">FAQ</a>
        </div>
      </footer>
    </main>
  );
}