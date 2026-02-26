"use client";

import { useMemo, useState } from "react";
import styles from "./DailyTipBanner.module.css";
import { DAILY_TIPS_365, tipIndexForToday } from "@/lib/dailyTips";

export default function DailyTipBanner() {
  const [idx, setIdx] = useState(() => tipIndexForToday(new Date()));

  const tip = useMemo(() => {
    return DAILY_TIPS_365[idx] ?? "Usa ejemplos del puesto real y cierra con una acción concreta.";
  }, [idx]);

  function nextTip() {
    // Elegimos uno distinto al actual.
    if (DAILY_TIPS_365.length < 2) return;
    let n = idx;
    for (let i = 0; i < 10; i++) {
      const candidate = Math.floor(Math.random() * DAILY_TIPS_365.length);
      if (candidate !== idx) {
        n = candidate;
        break;
      }
    }
    setIdx(n);
  }

  return (
    <div className={styles.bar}>
      <div className={styles.left}>
        <span className={styles.kicker}>Tip del día</span>
        <span className={styles.tip} title={tip}>
          {tip}
        </span>
      </div>
      <div className={styles.right}>
        <button type="button" className={styles.btn} onClick={nextTip}>
          Otro tip
        </button>
      </div>
    </div>
  );
}
