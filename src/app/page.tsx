import Image from "next/image";
import Link from "next/link";
import styles from "./page.module.css";

export default function HomePage() {
  return (
    <main className={styles.bg}>
      <div className={styles.wrap}>
        <section className={styles.card}>
          <div className={styles.heroGrid}>
            {/* LEFT: Copy + features */}
            <div className={styles.left}>
              <div className={styles.header}>
                <div className={styles.logoRow}>
                  <div className={styles.logoBox}>
                    <Image
                      src="/brand/lz-capacita-qr.png"
                      alt="LZ Capacita QR"
                      fill
                      priority
                      sizes="420px"
                      className={styles.logoImg}
                    />
                  </div>
                </div>

                <div className={styles.brandLine}>LZ Capacita QR</div>

                <h1 className={styles.title}>Controla tus capacitaciones y charlas</h1>

                <p className={styles.subtitle}>
                  Asistencia por QR, cierre con firma del relator y{" "}
                  <b>PDF final consolidado</b> listo para respaldo y auditoría.
                </p>

                <div className={styles.chips}>
                  <span className={styles.chip}>📊 Control de gestión</span>
                  <span className={styles.chip}>🧾 Trazabilidad completa</span>
                  <span className={styles.chip}>📄 PDF firmado</span>
                </div>
              </div>

              <div className={styles.features}>
                <div className={styles.featureCard}>
                  <div className={styles.featureIcon}>📱</div>
                  <div className={styles.featureTitle}>Asistencia por QR</div>
                  <div className={styles.featureText}>
                    Los participantes registran <b>nombre, RUT, cargo y firma</b> desde el celular.
                  </div>
                </div>

                <div className={styles.featureCard}>
                  <div className={styles.featureIcon}>✍️</div>
                  <div className={styles.featureTitle}>Cierre con firma relator</div>
                  <div className={styles.featureText}>
                    Administra la charla y ciérrala con la <b>firma oficial</b> del relator.
                  </div>
                </div>

                <div className={styles.featureCard}>
                  <div className={styles.featureIcon}>✅</div>
                  <div className={styles.featureTitle}>PDF final + respaldo</div>
                  <div className={styles.featureText}>
                    Documento consolidado con logo, firmas y listado. <b>Listo para enviar o guardar</b>.
                  </div>
                </div>
              </div>

              <div className={styles.how}>
                <div className={styles.howTitle}>Cómo funciona</div>
                <div className={styles.steps}>
                  <div className={styles.step}>
                    <div className={styles.stepNum}>1</div>
                    <div className={styles.stepBody}>
                      <div className={styles.stepName}>Crea empresa y charla</div>
                      <div className={styles.stepDesc}>Define relator, lugar y fecha.</div>
                    </div>
                  </div>

                  <div className={styles.step}>
                    <div className={styles.stepNum}>2</div>
                    <div className={styles.stepBody}>
                      <div className={styles.stepName}>Comparte el QR</div>
                      <div className={styles.stepDesc}>Registro rápido en terreno.</div>
                    </div>
                  </div>

                  <div className={styles.step}>
                    <div className={styles.stepNum}>3</div>
                    <div className={styles.stepBody}>
                      <div className={styles.stepName}>Cierra y genera el PDF</div>
                      <div className={styles.stepDesc}>
                        PDF final firmado y listo para enviar{" "}
                        <b>(próximo: envío directo al correo)</b>.
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className={styles.cta}>
                <Link href="/login" className={styles.primaryBtn}>
                  Ingresar
                </Link>

                {/* Si tu ruta real es /register, cambia /signup por /register */}
                <Link href="/signup" className={styles.secondaryBtn}>
                  Crear cuenta
                </Link>
              </div>

              <div className={styles.footer}>
                <span>Creado por Claudio Lizama © 2026</span>
                <span className={styles.dot}>•</span>
                <span>Registro QR · Firma · PDF</span>
              </div>
            </div>

            {/* RIGHT: Mockup */}
            <div className={styles.right}>
              <div className={styles.mockWrap}>
                <div className={styles.mockTopbar}>
                  <div className={styles.mockHello}>Hola, bienvenido 👋</div>
                  <div className={styles.mockTopRight}>
                    <div className={styles.mockEmail}>usuario@empresa.cl</div>
                    <div className={styles.mockBtn}>Salir</div>
                  </div>
                </div>

                <div className={styles.mockBody}>
                  <aside className={styles.mockSidebar}>
                    <div className={styles.mockBrand}>
                      <div className={styles.mockBadge}>LZ</div>
                      <div className={styles.mockBrandText}>
                        <div className={styles.mockBrandTitle}>LZ Capacita QR</div>
                        <div className={styles.mockBrandSub}>Panel</div>
                      </div>
                    </div>

                    <div className={styles.mockNav}>
                      <div className={`${styles.mockNavItem} ${styles.mockNavActive}`}>
                        <span className={styles.mockNavIcon}>🏠</span>
                        Dashboard
                      </div>
                      <div className={styles.mockNavItem}>
                        <span className={styles.mockNavIcon}>👤</span>
                        Mi perfil
                      </div>
                      <div className={styles.mockNavItem}>
                        <span className={styles.mockNavIcon}>➕</span>
                        Crear empresa
                      </div>
                      <div className={styles.mockNavItem}>
                        <span className={styles.mockNavIcon}>🏢</span>
                        Mis empresas
                      </div>
                      <div className={styles.mockNavItem}>
                        <span className={styles.mockNavIcon}>📋</span>
                        Mis charlas
                      </div>
                      <div className={styles.mockNavItem}>
                        <span className={styles.mockNavIcon}>📄</span>
                        Mis PDF
                      </div>
                    </div>
                  </aside>

                  <section className={styles.mockMain}>
                    <div className={styles.mockKpis}>
                      <div className={styles.mockKpi}>
                        <div className={styles.mockKpiTitle}>Empresas</div>
                        <div className={styles.mockKpiValue}>12</div>
                      </div>
                      <div className={styles.mockKpi}>
                        <div className={styles.mockKpiTitle}>Charlas</div>
                        <div className={styles.mockKpiValue}>8</div>
                      </div>
                      <div className={styles.mockKpi}>
                        <div className={styles.mockKpiTitle}>PDF</div>
                        <div className={styles.mockKpiValue}>8</div>
                      </div>
                    </div>

                    <div className={styles.mockCard}>
                      <div className={styles.mockCardTitle}>Crear charla</div>
                      <div className={styles.mockCardSub}>
                        Genera un código, comparte QR y registra firmas.
                      </div>

                      <div className={styles.mockForm}>
                        <div className={styles.mockInput} />
                        <div className={styles.mockInput} />
                        <div className={styles.mockInput} />
                        <div className={styles.mockPrimary} />
                      </div>
                    </div>

                    <div className={styles.mockCardSmall}>
                      <div className={styles.mockRow}>
                        <div className={styles.mockPill}>QR público</div>
                        <div className={styles.mockPill}>Admin</div>
                        <div className={styles.mockPill}>PDF final</div>
                      </div>
                      <div className={styles.mockLine} />
                      <div className={styles.mockLine} />
                      <div className={styles.mockLineShort} />
                    </div>

                    <div className={styles.mockHint}>
                      *Vista referencial del panel (QR + firma + PDF).*
                    </div>
                  </section>
                </div>
              </div>

              <div className={styles.mockNote}>
                💡 <b>Tip:</b> el PDF final incluye lista + firmas + logo, listo para enviar al cliente.
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}