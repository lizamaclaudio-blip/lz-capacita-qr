"use client";

import { useEffect, useMemo, useRef } from "react";
import { QRCodeCanvas } from "qrcode.react";
import styles from "./QrModal.module.css";

type Props = {
  open: boolean;
  code: string | null;
  publicUrl: string | null;
  onClose: () => void;
};

export default function QrModal({ open, code, publicUrl, onClose }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const safeCode = useMemo(() => (code ?? "").toUpperCase().trim(), [code]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  async function copy(text: string, okMsg = "Copiado ✅") {
    try {
      await navigator.clipboard.writeText(text);
      // mini feedback rápido (sin depender de toasts globales)
      alert(okMsg);
    } catch {
      alert("No pude copiar 😕 (permiso del navegador)");
    }
  }

  function downloadPng() {
    const canvas = canvasRef.current;
    if (!canvas) return alert("No se encontró el canvas del QR");

    const dataUrl = canvas.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = `QR-${safeCode || "charla"}.png`;
    a.click();
  }

  if (!open || !safeCode || !publicUrl) return null;

  return (
    <div className={styles.backdrop} role="dialog" aria-modal="true" onMouseDown={onClose}>
      <div className={styles.modal} onMouseDown={(e) => e.stopPropagation()}>
        <div className={styles.top}>
          <div>
            <div className={styles.title}>QR de asistencia</div>
            <div className={styles.sub}>
              Código: <span className={styles.mono}>{safeCode}</span>
            </div>
          </div>

          <button className={styles.x} onClick={onClose} type="button" aria-label="Cerrar">
            ✕
          </button>
        </div>

        <div className={styles.qrWrap}>
          <QRCodeCanvas
            value={publicUrl}
            size={260}
            includeMargin
            ref={canvasRef}
          />
        </div>

        <div className={styles.link}>
          <div className={styles.linkLabel}>Link público</div>
          <div className={styles.linkValue}>{publicUrl}</div>
        </div>

        <div className={styles.actions}>
          <button className={styles.btnThin} type="button" onClick={() => copy(safeCode, "Código copiado ✅")}>
            Copiar código
          </button>

          <button className={styles.btnThin} type="button" onClick={() => copy(publicUrl, "Link copiado ✅")}>
            Copiar link
          </button>

          <button className={styles.btn} type="button" onClick={() => window.open(publicUrl, "_blank", "noopener,noreferrer")}>
            Abrir link
          </button>

          <button className={styles.btnPdf} type="button" onClick={downloadPng}>
            Descargar PNG
          </button>
        </div>

        <div className={styles.note}>
          Tip: imprime este QR o muéstralo en pantalla para que los asistentes ingresen rápido ✅
        </div>
      </div>
    </div>
  );
}