"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import styles from "./page.module.css";

type LandingStats = {
  companies: number;
  sessions: number;
  attendees: number;
  pdfs: number;
};

type Plan = {
  tier: "bronce" | "plata" | "oro";
  title: string;
  price: string;
  subtitle: string;
  features: string[];
  cta: string;
  highlight?: boolean;
};

function clampInt(n: any, fallback = 0) {
  const x = Number(n);
  if (!Number.isFinite(x)) return fallback;
  return Math.max(0, Math.floor(x));
}

function formatIntCL(n: number) {
  try {
    return new Intl.NumberFormat("es-CL").format(n);
  } catch {
    return String(n);
  }
}

function useCountUp(target: number, durationMs = 900) {
  const [value, setValue] = useState(0);

  useEffect(() => {
    let raf = 0;
    const start = performance.now();
    const from = value;
    const to = clampInt(target, 0);

    function tick(now: number) {
      const t = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - t, 3);
      const next = Math.round(from + (to - from) * eased);
      setValue(next);
      if (t < 1) raf = requestAnimationFrame(tick);
    }

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target]);

  return value;
}

export default function HomePage() {
  const [stats, setStats] = useState<LandingStats>({
    companies: 0,
    sessions: 0,
    attendees: 0,
    pdfs: 0,
  });
  const [statsUpdatedAt, setStatsUpdatedAt] = useState<string | null>(null);

  const plans: Plan[] = useMemo(
    () => [
      {
        tier: "bronce",
        title: "Bronce",
        price: "Desde $2.990 / mes",
        subtitle: "Ideal para empezar con 1 empresa.",
        features: [
          "1 empresa",
          "8 charlas/mes",
          "30 asistentes por charla",
          "8 PDFs/mes",
          "Dashboard y control de asistencia",
        ],
        cta: "Elegir Bronce",
      },
      {
        tier: "plata",
        title: "Plata",
        price: "Desde $7.990 / mes",
        subtitle: "Para equipos con más rotación.",
        features: [
          "3 empresas",
          "25 charlas/mes",
          "80 asistentes por charla",
          "25 PDFs/mes",
          "Soporte prioritario",
        ],
        cta: "Elegir Plata",
        highlight: true,
      },
      {
        tier: "oro",
        title: "Oro",
        price: "Desde $12.990 / mes",
        subtitle: "Para operación intensiva.",
        features: [
          "10 empresas",
          "100 charlas/mes",
          "250 asistentes por charla",
          "100 PDFs/mes",
          "Mejoras premium",
        ],
        cta: "Elegir Oro",
      },
    ],
    []
  );

  useEffect(() => {
    let cancelled = false;

    async function loadStats() {
      try {
        // Si tienes endpoint real, cámbialo aquí.
        // Por ahora dejamos estadísticas "demo" para la landing.
        const demo: LandingStats = {
          companies: 128,
          sessions: 942,
          attendees: 13824,
          pdfs: 812,
        };

        if (cancelled) return;
        setStats(demo);
        setStatsUpdatedAt(new Date().toISOString());
      } catch {
        // fallback silencioso
      }
    }

    loadStats();
    return () => {
      cancelled = true;
    };
  }, []);

  const companiesCount = useCountUp(stats.companies, 900);
  const sessionsCount = useCountUp(stats.sessions, 900);
  const attendeesCount = useCountUp(stats.attendees, 900);
  const pdfsCount = useCountUp(stats.pdfs, 900);

  return (
    <main className={styles.page}>
      {/* HERO */}
      <section className={styles.hero}>
        <div className={styles.heroInner}>
          <div className={styles.heroLeft}>
            <div className={styles.badge}>LZ Capacita QR</div>

            <h1 className={styles.h1}>
              Capacita, registra asistencia y genera tu PDF final en minutos.
            </h1>

            <p className={styles.lead}>
              Un sistema simple y profesional para gestionar charlas de
              capacitación: QR público, firma en el celular, panel admin y
              cierre con PDF.
            </p>

            <div className={styles.heroCtas}>
              <Link href="/signup" className={styles.ctaPrimary}>
                Crear cuenta
              </Link>

              <Link href="/login" className={styles.ctaSecondary}>
                Ingresar
              </Link>

              <a href="#planes" className={styles.ctaGhost}>
                Ver planes
              </a>
            </div>

            <div className={styles.miniTrust}>
              <div className={styles.miniTrustItem}>
                <span className={styles.miniDot} /> QR público por charla
              </div>
              <div className={styles.miniTrustItem}>
                <span className={styles.miniDot} /> Firmas y cierre relator
              </div>
              <div className={styles.miniTrustItem}>
                <span className={styles.miniDot} /> PDF final automatizado
              </div>
            </div>
          </div>

          <div className={styles.heroRight}>
            <div className={styles.heroCard}>
              <div className={styles.heroCardHeader}>
                <div className={styles.heroLogoWrap}>
                  <Image
                    src="/lz-capacita-qr.png"
                    alt="LZ Capacita QR"
                    width={46}
                    height={46}
                    className={styles.heroLogo}
                  />
                </div>
                <div className={styles.heroCardTitle}>
                  <div className={styles.heroCardTitleTop}>Dashboard</div>
                  <div className={styles.heroCardTitleBottom}>
                    resumen mensual
                  </div>
                </div>
              </div>

              <div className={styles.statsGrid}>
                <div className={styles.statItem}>
                  <div className={styles.statLabel}>Empresas</div>
                  <div className={styles.statValue}>
                    {formatIntCL(companiesCount)}
                  </div>
                </div>

                <div className={styles.statItem}>
                  <div className={styles.statLabel}>Charlas</div>
                  <div className={styles.statValue}>
                    {formatIntCL(sessionsCount)}
                  </div>
                </div>

                <div className={styles.statItem}>
                  <div className={styles.statLabel}>Asistentes</div>
                  <div className={styles.statValue}>
                    {formatIntCL(attendeesCount)}
                  </div>
                </div>

                <div className={styles.statItem}>
                  <div className={styles.statLabel}>PDFs</div>
                  <div className={styles.statValue}>
                    {formatIntCL(pdfsCount)}
                  </div>
                </div>
              </div>

              <div className={styles.heroCardFooter}>
                <div className={styles.heroCardHint}>
                  {statsUpdatedAt ? "Actualizado recientemente" : "Cargando..."}
                </div>
                <Link href="/app" className={styles.heroCardLink}>
                  Ir al panel →
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section className={styles.section}>
        <div className={styles.sectionInner}>
          <h2 className={styles.h2}>¿Qué resuelve?</h2>
          <p className={styles.p}>
            Pensado para que cualquier relator o encargado pueda gestionar una
            capacitación sin planillas, sin caos y con respaldo.
          </p>

          <div className={styles.featureGrid}>
            <div className={styles.featureCard}>
              <div className={styles.featureTitle}>QR público</div>
              <div className={styles.featureText}>
                Un código por charla. Los asistentes entran desde su celular y
                registran su asistencia al instante.
              </div>
            </div>

            <div className={styles.featureCard}>
              <div className={styles.featureTitle}>Firma en el celular</div>
              <div className={styles.featureText}>
                Firma digital del asistente (PNG) con validaciones de RUT DV,
                datos y control por sesión.
              </div>
            </div>

            <div className={styles.featureCard}>
              <div className={styles.featureTitle}>Panel de administración</div>
              <div className={styles.featureText}>
                Crea empresas, crea charlas, revisa asistentes, cierra con firma
                del relator y genera PDF final.
              </div>
            </div>

            <div className={styles.featureCard}>
              <div className={styles.featureTitle}>PDF final automático</div>
              <div className={styles.featureText}>
                Genera un PDF con logos, firmas y datos. Queda listo para enviar
                o respaldar auditorías.
              </div>
            </div>
          </div>

          <div className={styles.sectionCtaRow}>
            <Link href="/signup" className={styles.ctaPrimary}>
              Empezar ahora
            </Link>
            <a href="#planes" className={styles.ctaSecondary}>
              Ver planes
            </a>
          </div>
        </div>
      </section>

      {/* PRICING */}
      <section id="planes" className={styles.sectionAlt}>
        <div className={styles.sectionInner}>
          <h2 className={styles.h2}>Planes</h2>
          <p className={styles.p}>
            Elige el plan según la cantidad de empresas y volumen de charlas.
          </p>

          <div className={styles.pricingGrid}>
            {plans.map((p) => (
              <div
                key={p.tier}
                className={[
                  styles.planCard,
                  p.highlight ? styles.planCardHighlight : "",
                  styles[`plan_${p.tier}`],
                ].join(" ")}
              >
                <div className={styles.planTop}>
                  <div className={styles.planTitle}>{p.title}</div>
                  <div className={styles.planPrice}>{p.price}</div>
                  <div className={styles.planSubtitle}>{p.subtitle}</div>
                </div>

                <ul className={styles.planList}>
                  {p.features.map((f) => (
                    <li key={f} className={styles.planListItem}>
                      <span className={styles.check} /> {f}
                    </li>
                  ))}
                </ul>

                <div className={styles.planBottom}>
                  <Link
                    href={`/signup?plan=${p.tier}`}
                    className={styles.planCta}
                  >
                    {p.cta}
                  </Link>

                  <div className={styles.planFootnote}>
                    Puedes cambiar de plan cuando quieras.
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className={styles.pricingNote}>
            ¿Eres empresa grande y necesitas límites especiales?{" "}
            <Link href="/signup" className={styles.inlineLink}>
              Escríbenos desde tu cuenta
            </Link>
            .
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className={styles.section}>
        <div className={styles.sectionInner}>
          <h2 className={styles.h2}>Preguntas frecuentes</h2>

          <div className={styles.faqGrid}>
            <div className={styles.faqCard}>
              <div className={styles.faqQ}>¿Necesito instalar algo?</div>
              <div className={styles.faqA}>
                No. Es una app web. Puedes usarla desde PC o celular.
              </div>
            </div>

            <div className={styles.faqCard}>
              <div className={styles.faqQ}>¿Los asistentes necesitan cuenta?</div>
              <div className={styles.faqA}>
                No. Registran asistencia con el QR público de la charla.
              </div>
            </div>

            <div className={styles.faqCard}>
              <div className={styles.faqQ}>¿Puedo agregar el logo de mi empresa?</div>
              <div className={styles.faqA}>
                Sí. En “Mis Empresas” puedes subir tu logo y se reflejará en el
                PDF final.
              </div>
            </div>

            <div className={styles.faqCard}>
              <div className={styles.faqQ}>¿Cómo se genera el PDF?</div>
              <div className={styles.faqA}>
                Al cerrar la charla con firma del relator, se genera un PDF con
                el resumen, asistentes y firmas.
              </div>
            </div>
          </div>

          <div className={styles.sectionCtaRow}>
            <Link href="/signup" className={styles.ctaPrimary}>
              Crear cuenta
            </Link>
            <Link href="/login" className={styles.ctaSecondary}>
              Ya tengo cuenta
            </Link>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className={styles.footer}>
        <div className={styles.footerInner}>
          <div className={styles.footerBrand}>
            <Image
              src="/lz-capacita-qr.png"
              alt="LZ Capacita QR"
              width={34}
              height={34}
              className={styles.footerLogo}
            />
            <div className={styles.footerBrandText}>
              <div className={styles.footerName}>LZ Capacita QR</div>
              <div className={styles.footerSub}>
                Capacitación • Asistencia • PDF
              </div>
            </div>
          </div>

          <div className={styles.footerLinks}>
            <a href="#planes" className={styles.footerLink}>
              Planes
            </a>
            <Link href="/login" className={styles.footerLink}>
              Ingresar
            </Link>
            <Link href="/signup" className={styles.footerLink}>
              Crear cuenta
            </Link>
          </div>

          <div className={styles.footerCopy}>
            © {new Date().getFullYear()} LZ Capacita QR. Todos los derechos
            reservados.
          </div>
        </div>
      </footer>
    </main>
  );
}