"use client";

import { useEffect, useMemo, useState } from "react";
import styles from "./DailyTipBanner.module.css";
import { DAILY_TIPS_365, tipIndexForToday, todayKey } from "@/lib/dailyTips";

function msUntilTomorrow() {
  const now = new Date();
  // +5s para evitar edge cases de cambio de hora/redondeos
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 5);
  return Math.max(1_000, next.getTime() - now.getTime());
}

export default function DailyTipBanner() {
  // key = YYYY-MM-DD (solo cambia al día siguiente)
  const [key, setKey] = useState(() => todayKey(new Date()));

  // Actualiza automáticamente cuando cambia el día (si dejas la app abierta).
  useEffect(() => {
    const t = window.setTimeout(() => setKey(todayKey(new Date())), msUntilTomorrow());
    return () => window.clearTimeout(t);
  }, [key]);

  const idx = useMemo(() => tipIndexForToday(new Date()), [key]);

  const tip = useMemo(() => {
    return DAILY_TIPS_365[idx] ?? "La prevención efectiva parte por identificar el peligro y controlar el riesgo.";
  }, [idx]);

  return (
    <div className={styles.bar} role="note" aria-label="Tip diario de prevención">
      <div className={styles.left}>
        <span className={styles.idea} aria-hidden="true">
          💡
        </span>

        <div className={styles.textBlock}>
          <div className={styles.kicker}>Tip diario</div>
          <div className={styles.tip} title={tip}>
            <span className={styles.lead}>¿Sabías que?</span> {tip}
          </div>
        </div>
      </div>

      <div className={styles.right} aria-hidden="true">
        <span className={styles.face}>🙂</span>
        <span className={styles.q}>❓</span>
      </div>
    </div>
  );
}