import Image from "next/image";
import Link from "next/link";
import styles from "./page.module.css";

export default function HomePage() {
  return (
    <main className={styles.bg}>
      <div className={styles.wrap}>
        <section className={styles.card}>
          <div className={styles.hero}>
            <div className={styles.left}>
              <div className={styles.brand}>
                <div className={styles.logoBox}>
                  <Image
                    src="/brand/lz-capacita-qr.png"
                    alt="LZ Capacita QR"
                    fill
                    priority
                    sizes="200px"
                    className={styles.logoImg}
                  />
                </div>

                <div>
                  <div className={styles.brandTitle}>LZ Capacita QR</div>
                  <div className={styles.brandSub}>Registro de asistencia · Firma · PDF</div>
                </div>
              </div>

              <h1 className={styles.title}>Controla tus capacitaciones y charlas</h1>

              <p className={styles.subtitle}>
                Asistencia por QR desde el celular, cierre con firma del relator y{" "}
                <b>PDF final consolidado</b> listo para respaldo y auditoría.
              </p>

              <div className={styles.chips}>
                <span className={styles.chip}>📊 Control de gestión</span>
                <span className={styles.chip}>🧾 Trazabilidad completa</span>
                <span className={styles.chip}>📄 PDF firmado</span>
              </div>

              <div className={styles.cta}>
                <Link href="/login" className={styles.primaryBtn}>
                  Ingresar
                </Link>
                <Link href="/signup" className={styles.secondaryBtn}>
                  Crear cuenta
                </Link>
              </div>

              <div className={styles.note}>
                ✅ Desde el QR: nombre + RUT + cargo + firma. <br />
                ✅ El relator cierra y genera PDF.
              </div>
            </div>

            <div className={styles.right}>
              <div className={styles.mock}>
                <div className={styles.mockTop}>
                  <div>
                    <div className={styles.mockHello}>Hola, bienvenido 👋</div>
                    <div className={styles.mockMini}>Dashboard</div>
                  </div>
                  <div className={styles.mockPill}>Sesión activa</div>
                </div>

                <div className={styles.mockGrid}>
                  <div className={styles.kpi}>
                    <div className={styles.kpiLabel}>Empresas</div>
                    <div className={styles.kpiValue}>12</div>
                  </div>
                  <div className={styles.kpi}>
                    <div className={styles.kpiLabel}>Charlas</div>
                    <div className={styles.kpiValue}>8</div>
                  </div>
                  <div className={styles.kpi}>
                    <div className={styles.kpiLabel}>PDF</div>
                    <div className={styles.kpiValue}>8</div>
                  </div>
                </div>

                <div className={styles.mockCard}>
                  <div className={styles.mockCardTitle}>Flujo v1</div>
                  <div className={styles.mockLine}>1) Crear charla → QR</div>
                  <div className={styles.mockLine}>2) Asistentes firman</div>
                  <div className={styles.mockLine}>3) Relator cierra → PDF</div>

                  <div className={styles.mockBtns}>
                    <div className={styles.mockBtn}>QR</div>
                    <div className={styles.mockBtnDark}>Admin</div>
                    <div className={styles.mockBtnGreen}>PDF</div>
                  </div>
                </div>

                <div className={styles.footer}>
                  Creado por Claudio Lizama © 2026
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}