"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Props = {
  value: number;
  loading?: boolean;
  /**
   * Tiempo mínimo mostrando números aleatorios cuando loading=true.
   * (Si la carga termina antes, igual espera a completar este tiempo)
   */
  minLoadingMs?: number;
  /** cada cuánto cambia el número aleatorio */
  scrambleIntervalMs?: number;
  /** duración del conteo final hacia el valor real */
  settleMs?: number;
  /** máximo aleatorio durante scramble (si no, se calcula) */
  scrambleMax?: number;
  /** formato (ej: Intl.NumberFormat) */
  format?: (n: number) => string;
  className?: string;
};

function easeOutCubic(t: number) {
  return 1 - Math.pow(1 - t, 3);
}

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

export default function StatNumber({
  value,
  loading = false,
  minLoadingMs = 1000,
  scrambleIntervalMs = 55,
  settleMs = 450,
  scrambleMax,
  format,
  className,
}: Props) {
  const fmt = useMemo(() => format ?? ((n: number) => String(n)), [format]);

  const [display, setDisplay] = useState<number>(() => (Number.isFinite(value) ? Math.round(value) : 0));

  const displayRef = useRef(display);
  const intervalRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);
  const settleTimeoutRef = useRef<number | null>(null);
  const loadingStartRef = useRef<number | null>(null);
  const lastValueRef = useRef<number>(Math.round(value || 0));

  useEffect(() => {
    displayRef.current = display;
  }, [display]);

  function clearTimers() {
    if (intervalRef.current) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (rafRef.current) {
      window.cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (settleTimeoutRef.current) {
      window.clearTimeout(settleTimeoutRef.current);
      settleTimeoutRef.current = null;
    }
  }

  function randInt(max: number) {
    return Math.floor(Math.random() * (max + 1));
  }

  function animateTo(target: number) {
    if (!Number.isFinite(target)) target = 0;
    target = Math.round(target);

    const from = Math.round(displayRef.current || 0);
    const to = target;

    if (from === to) {
      setDisplay(to);
      return;
    }

    const start = performance.now();
    const dur = Math.max(160, settleMs);

    const tick = (now: number) => {
      const t = clamp((now - start) / dur, 0, 1);
      const eased = easeOutCubic(t);
      const next = Math.round(from + (to - from) * eased);
      setDisplay(next);

      if (t < 1) {
        rafRef.current = window.requestAnimationFrame(tick);
      } else {
        rafRef.current = null;
        setDisplay(to);
      }
    };

    rafRef.current = window.requestAnimationFrame(tick);
  }

  // Scramble while loading
  useEffect(() => {
    clearTimers();

    const safeValue = Number.isFinite(value) ? Math.round(value) : 0;

    if (loading) {
      loadingStartRef.current = Date.now();

      const max =
        typeof scrambleMax === "number"
          ? Math.max(10, Math.round(scrambleMax))
          : Math.max(18, Math.round(Math.max(safeValue * 2, safeValue + 12)));

      // Arranca con un random inmediato
      setDisplay(randInt(max));

      intervalRef.current = window.setInterval(() => {
        setDisplay(randInt(max));
      }, Math.max(30, scrambleIntervalMs));

      return () => clearTimers();
    }

    // loading = false -> asegurar mínimo 1s de scramble si veníamos cargando
    const startedAt = loadingStartRef.current;
    const elapsed = startedAt ? Date.now() - startedAt : minLoadingMs;
    const wait = Math.max(0, minLoadingMs - elapsed);

    settleTimeoutRef.current = window.setTimeout(() => {
      loadingStartRef.current = null;
      animateTo(safeValue);
      lastValueRef.current = safeValue;
    }, wait);

    return () => clearTimers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

  // Si cambia el value y NO está loading, animar hacia el nuevo value
  useEffect(() => {
    const safeValue = Number.isFinite(value) ? Math.round(value) : 0;
    if (loading) return;

    if (lastValueRef.current !== safeValue) {
      clearTimers();
      animateTo(safeValue);
      lastValueRef.current = safeValue;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return <span className={className}>{fmt(display)}</span>;
}