"use client";

import React, { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import styles from "./RouteTransition.module.css";

export default function RouteTransition({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const key = `${pathname}?${searchParams.toString()}`;

  // Opcional: al cambiar de pantalla, subir al inicio (se siente más “app”)
  useEffect(() => {
    // Si no lo quieres, borra este useEffect completo.
    // En modo workspace, scrolleamos el contenedor interno (no la ventana).
    const el = document.querySelector<HTMLElement>("[data-app-scroll]");
    if (el) el.scrollTo({ top: 0, behavior: "smooth" });
  }, [pathname]);

  return (
    <div key={key} className={styles.wrap}>
      {children}
    </div>
  );
}