"use client";

import styles from "./Topbar.module.css";

type Props = {
  title?: string;
  subtitle?: string;
  activePath?: string;
  email?: string | null;
  onLogout?: (() => void) | (() => Promise<void>);
  right?: React.ReactNode;
};

export default function Topbar({
  title = "Panel",
  subtitle,
  activePath,
  email,
  onLogout,
  right,
}: Props) {
  return (
    <div className={styles.topbar}>
      <div className={styles.left}>
        {activePath ? <div className={styles.breadcrumb}>{activePath}</div> : null}
        <div className={styles.title}>{title}</div>
        {subtitle ? <div className={styles.subtitle}>{subtitle}</div> : null}
      </div>

      <div className={styles.right}>
        {right ? (
          right
        ) : (
          <>
            {email ? <div className={styles.email}>{email}</div> : null}
            {onLogout ? (
              <button className={styles.logoutBtn} onClick={onLogout} type="button">
                Salir
              </button>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}