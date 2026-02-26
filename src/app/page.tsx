"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import styles from "./page.module.css";

type LandingStats = {
  companies: number;
  sessions: number;
  attendees: number;
  pdfs: number;
};

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
  const [stats, setStats] = useState<LandingStats | null>(null);
  const [statsUpdatedAt, setStatsUpdatedAt] = useState<string | null>(null);

  // Fetch stats (no rompe la landing si falla)
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
        // noop
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  // Reveal on scroll (sin librerías)
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

  const cCompanies = useCountUp(stats?.companies ?? 0, 900);
  const cSessions = useCountUp(stats?.sessions ?? 0, 1000);
  const cAttendees = useCountUp(stats?.attendees ?? 0, 1100);
  const cPdfs = useCountUp(stats?.pdfs ?? 0, 900);

  return (
    <main className={styles.root}>
      {/* NAV */}
      <header className={styles.header}>
        <div className={styles.nav}>
          <Link href="/" className={styles.brand}>
            <span className={styles.logoBox}>
              <Image
                src="/brand/lzq-mark.svg"
                alt="LZ Capacita QR"
                fill
                priority
                sizes="46px"
                className={styles.logoImg}
              />
            </span>

            <span className={styles.brandText}>
              <span className={styles.brandTitle}>LZ Capacita QR</span>
              <span className={styles.brandSub}>QR · Firma · PDF final</span>
            </span>
          </Link>

          <nav className={styles.menu} aria-label="Navegación">
            <a className={styles.menuLink} href="#producto">
              Producto
            </a>
            <a className={styles.menuLink} href="#numeros">
              En números
            </a>
            <a className={styles.menuLink} href="#como-funciona">
              Cómo funciona
            </a>
            <a className={styles.menuLink} href="#faq">
              FAQ
            </a>
          </nav>

          <div className={styles.actions}>
            <Link href="/login" className={`btn btnGhost ${styles.btnSm}`}>
              Iniciar sesión
            </Link>
            <Link href="/signup" className={`btn btnCta ${styles.btnSm}`}>
              Prueba gratis
            </Link>
          </div>
        </div>
      </header>

      {/* HERO */}
      <section className={styles.hero}>
        <div className={styles.heroLeft}>
          <div
            className={`${styles.kicker} ${styles.reveal}`}
            data-reveal
            style={{ ["--d" as any]: "0ms" }}
          >
            <span className={styles.dot} />
            Trazabilidad · evidencia · auditoría
          </div>

          <h1
            className={`${styles.h1} ${styles.reveal}`}
            data-reveal
            style={{ ["--d" as any]: "70ms" }}
          >
            Registra asistencia con QR,
            <br />
            firma y genera <span className={styles.h1Strong}>PDF final</span>.
          </h1>

          <p
            className={`${styles.p} ${styles.reveal}`}
            data-reveal
            style={{ ["--d" as any]: "120ms" }}
          >
            Crea una charla, comparte el QR, valida RUT + DV, captura firma en el celular y cierra con firma del relator.
            El resultado queda en un PDF consolidado con respaldo.
          </p>

          <div
            className={`${styles.ctaRow} ${styles.reveal}`}
            data-reveal
            style={{ ["--d" as any]: "170ms" }}
          >
            <Link href="/signup" className={`btn btnPrimary ${styles.btnLg}`}>
              Solicitar demo <span className={styles.arrow}>→</span>
            </Link>
            <a href="#como-funciona" className={`btn btnGhost ${styles.btnLg}`}>
              Ver cómo funciona
            </a>
          </div>

          <div
            className={`${styles.trustRow} ${styles.reveal}`}
            data-reveal
            style={{ ["--d" as any]: "220ms" }}
          >
            <div className={styles.trustPill}>RUT + DV</div>
            <div className={styles.trustPill}>Firma digital</div>
            <div className={styles.trustPill}>PDF final</div>
            <div className={styles.trustPill}>Sin planillas</div>
          </div>

          <div
            className={`${styles.micro} ${styles.reveal}`}
            data-reveal
            style={{ ["--d" as any]: "260ms" }}
          >
            Diseñado para prevención, RR.HH. y equipos en terreno.
          </div>
        </div>

        {/* Mock visual (dashboard + móvil) */}
        <div
          className={`${styles.heroRight} ${styles.reveal}`}
          data-reveal
          style={{ ["--d" as any]: "120ms" }}
          aria-hidden="true"
        >
          <div className={styles.bento}>
            <div className={styles.tileBig}>
              <div className={styles.tileTop}>
                <div>
                  <div className={styles.tileTitle}>Dashboard de charla</div>
                  <div className={styles.tileSub}>Asistentes · firmas · PDF</div>
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
              <div className={styles.miniRow}>
                <span>RUT</span>
                <span className={styles.miniStrong}>12.345.678-9</span>
              </div>
              <div className={styles.miniRow}>
                <span>Firma</span>
                <span className={styles.miniStrong}>✍️</span>
              </div>
              <div className={styles.miniBtn}>Finalizar</div>
            </div>

            <div className={styles.tile}>
              <div className={styles.miniTitle}>Control</div>
              <div className={styles.miniPill}>Trazabilidad</div>
              <div className={styles.miniPill}>Respaldo</div>
              <div className={styles.miniPill}>Auditoría</div>
            </div>

            <div className={styles.glow} />
          </div>
        </div>
      </section>

      {/* EN NÚMEROS */}
      <section id="numeros" className={styles.section}>
        <div className={styles.sectionHeadRow}>
          <div>
            <h2
              className={`${styles.h2} ${styles.reveal}`}
              data-reveal
              style={{ ["--d" as any]: "0ms" }}
            >
              En números
            </h2>
            <p
              className={`${styles.lead} ${styles.reveal}`}
              data-reveal
              style={{ ["--d" as any]: "60ms" }}
            >
              Métricas en vivo desde la plataforma.
            </p>
          </div>

          <div
            className={`${styles.statsNote} ${styles.reveal}`}
            data-reveal
            style={{ ["--d" as any]: "90ms" }}
          >
            {statsUpdatedAt
              ? `Actualizado: ${new Date(statsUpdatedAt).toLocaleString("es-CL")}`
              : "Actualización automática"}
          </div>
        </div>

        <div className={styles.statsGrid}>
          <div
            className={`${styles.statCard} ${styles.reveal}`}
            data-reveal
            style={{ ["--d" as any]: "0ms" }}
          >
            <div className={styles.statLabel}>Empresas</div>
            <div className={styles.statValue}>{fmtInt(cCompanies)}</div>
            <div className={styles.statSub}>Creadas en la plataforma</div>
          </div>

          <div
            className={`${styles.statCard} ${styles.reveal}`}
            data-reveal
            style={{ ["--d" as any]: "60ms" }}
          >
            <div className={styles.statLabel}>Charlas</div>
            <div className={styles.statValue}>{fmtInt(cSessions)}</div>
            <div className={styles.statSub}>Abiertas y cerradas</div>
          </div>

          <div
            className={`${styles.statCard} ${styles.reveal}`}
            data-reveal
            style={{ ["--d" as any]: "120ms" }}
          >
            <div className={styles.statLabel}>Asistencias</div>
            <div className={styles.statValue}>{fmtInt(cAttendees)}</div>
            <div className={styles.statSub}>Con RUT + firma</div>
          </div>

          <div
            className={`${styles.statCard} ${styles.reveal}`}
            data-reveal
            style={{ ["--d" as any]: "180ms" }}
          >
            <div className={styles.statLabel}>PDFs</div>
            <div className={styles.statValue}>{fmtInt(cPdfs)}</div>
            <div className={styles.statSub}>Consolidado final</div>
          </div>
        </div>
      </section>

      {/* PRODUCTO */}
      <section id="producto" className={styles.section}>
        <div className={styles.sectionHead}>
          <h2
            className={`${styles.h2} ${styles.reveal}`}
            data-reveal
            style={{ ["--d" as any]: "0ms" }}
          >
            Producto
          </h2>
          <p
            className={`${styles.lead} ${styles.reveal}`}
            data-reveal
            style={{ ["--d" as any]: "60ms" }}
          >
            El flujo completo: QR → registro → firma → cierre → PDF.
          </p>
        </div>

        <div className={styles.bentoGrid}>
          <div
            className={`${styles.bentoCard} ${styles.reveal}`}
            data-reveal
            style={{ ["--d" as any]: "0ms" }}
          >
            <div className={styles.icon}>📷</div>
            <div className={styles.bTitle}>QR público</div>
            <div className={styles.bText}>
              Asistencia desde cualquier celular, sin instalar apps.
            </div>
          </div>

          <div
            className={`${styles.bentoCard} ${styles.reveal}`}
            data-reveal
            style={{ ["--d" as any]: "60ms" }}
          >
            <div className={styles.icon}>🪪</div>
            <div className={styles.bTitle}>RUT + DV</div>
            <div className={styles.bText}>
              Validación para reducir errores y duplicados.
            </div>
          </div>

          <div
            className={`${styles.bentoCard} ${styles.reveal}`}
            data-reveal
            style={{ ["--d" as any]: "120ms" }}
          >
            <div className={styles.icon}>✍️</div>
            <div className={styles.bTitle}>Firma digital</div>
            <div className={styles.bText}>
              Firma del asistente + firma final del relator.
            </div>
          </div>

          <div
            className={`${styles.bentoCardWide} ${styles.reveal}`}
            data-reveal
            style={{ ["--d" as any]: "180ms" }}
          >
            <div className={styles.wTop}>
              <div>
                <div className={styles.wTitle}>PDF final con logos</div>
                <div className={styles.wText}>
                  Documento consolidado con lista, firmas y logos. Ideal para respaldo y auditoría.
                </div>
              </div>
              <div className={styles.wStamp}>PDF</div>
            </div>

            <div className={styles.wLines}>
              <div className={styles.wLine} />
              <div className={styles.wLine} />
              <div className={styles.wLine} />
              <div className={styles.wLineShort} />
            </div>
          </div>
        </div>
      </section>

      {/* CÓMO FUNCIONA */}
      <section id="como-funciona" className={styles.section}>
        <div className={styles.sectionHead}>
          <h2
            className={`${styles.h2} ${styles.reveal}`}
            data-reveal
            style={{ ["--d" as any]: "0ms" }}
          >
            Cómo funciona
          </h2>
          <p
            className={`${styles.lead} ${styles.reveal}`}
            data-reveal
            style={{ ["--d" as any]: "60ms" }}
          >
            Un proceso simple, rápido y controlado.
          </p>
        </div>

        <div className={styles.steps}>
          <div
            className={`${styles.step} ${styles.reveal}`}
            data-reveal
            style={{ ["--d" as any]: "0ms" }}
          >
            <div className={styles.stepNum}>1</div>
            <div className={styles.stepTitle}>Crea la charla</div>
            <div className={styles.stepText}>
              Define empresa, relator y tema. Se genera un código y QR.
            </div>
          </div>

          <div
            className={`${styles.step} ${styles.reveal}`}
            data-reveal
            style={{ ["--d" as any]: "70ms" }}
          >
            <div className={styles.stepNum}>2</div>
            <div className={styles.stepTitle}>Registro + firma</div>
            <div className={styles.stepText}>
              Cada asistente ingresa su nombre, RUT y firma desde el móvil.
            </div>
          </div>

          <div
            className={`${styles.step} ${styles.reveal}`}
            data-reveal
            style={{ ["--d" as any]: "140ms" }}
          >
            <div className={styles.stepNum}>3</div>
            <div className={styles.stepTitle}>Cierre del relator</div>
            <div className={styles.stepText}>
              El relator firma el cierre. Se bloquea la charla para evitar cambios.
            </div>
          </div>

          <div
            className={`${styles.step} ${styles.reveal}`}
            data-reveal
            style={{ ["--d" as any]: "210ms" }}
          >
            <div className={styles.stepNum}>4</div>
            <div className={styles.stepTitle}>PDF final</div>
            <div className={styles.stepText}>
              Se genera el PDF consolidado con las firmas y logos.
            </div>
          </div>
        </div>

        <div
          className={`${styles.centerCta} ${styles.reveal}`}
          data-reveal
          style={{ ["--d" as any]: "250ms" }}
        >
          <Link href="/signup" className={`btn btnPrimary ${styles.btnLg}`}>
            Probar ahora <span className={styles.arrow}>→</span>
          </Link>
          <Link href="/app" className={`btn btnGhost ${styles.btnLg}`}>
            Ver plataforma
          </Link>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className={styles.section}>
        <div className={styles.sectionHead}>
          <h2
            className={`${styles.h2} ${styles.reveal}`}
            data-reveal
            style={{ ["--d" as any]: "0ms" }}
          >
            Preguntas frecuentes
          </h2>
          <p
            className={`${styles.lead} ${styles.reveal}`}
            data-reveal
            style={{ ["--d" as any]: "60ms" }}
          >
            Respuestas rápidas para implementar sin fricción.
          </p>
        </div>

        <div className={styles.faqGrid}>
          <details className={`${styles.faq} ${styles.reveal}`} data-reveal style={{ ["--d" as any]: "0ms" }}>
            <summary>¿Necesito que la gente instale una app?</summary>
            <div className={styles.faqBody}>
              No. El registro funciona con el QR en navegador del celular.
            </div>
          </details>

          <details className={`${styles.faq} ${styles.reveal}`} data-reveal style={{ ["--d" as any]: "60ms" }}>
            <summary>¿Qué pasa si alguien se equivoca en el RUT?</summary>
            <div className={styles.faqBody}>
              Se valida RUT + DV para reducir errores y asegurar trazabilidad.
            </div>
          </details>

          <details className={`${styles.faq} ${styles.reveal}`} data-reveal style={{ ["--d" as any]: "120ms" }}>
            <summary>¿Se puede cerrar la charla para que no entren más registros?</summary>
            <div className={styles.faqBody}>
              Sí. Con la firma del relator se cierra y queda lista para PDF.
            </div>
          </details>

          <details className={`${styles.faq} ${styles.reveal}`} data-reveal style={{ ["--d" as any]: "180ms" }}>
            <summary>¿El PDF queda con firmas?</summary>
            <div className={styles.faqBody}>
              Sí. Incluye firmas de asistentes y firma del relator, más los logos configurados.
            </div>
          </details>
        </div>
      </section>

      {/* FOOTER */}
      <footer className={styles.footer}>
        <div className={styles.footerInner}>
          <div className={styles.footerBrand}>
            <div className={styles.footerTitle}>LZ Capacita QR</div>
            <div className={styles.footerSub}>Trazabilidad ejecutiva para capacitaciones.</div>
          </div>

          <div className={styles.footerLinks}>
            <a href="#producto">Producto</a>
            <a href="#como-funciona">Cómo funciona</a>
            <Link href="/login">Login</Link>
            <Link href="/signup">Prueba gratis</Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
