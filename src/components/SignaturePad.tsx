"use client";

import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";

export type SignaturePadRef = {
  clear: () => void;
  isEmpty: () => boolean;
  toPngDataUrl: () => string | null; // PNG con fondo blanco
};

type Props = {
  height?: number; // px (alto visible)
  className?: string;
};

function exportCanvasToWhitePngDataUrl(canvas: HTMLCanvasElement): string {
  const out = document.createElement("canvas");
  out.width = canvas.width;
  out.height = canvas.height;

  const ctx = out.getContext("2d");
  if (!ctx) return canvas.toDataURL("image/png");

  // Fondo blanco para que en PDF no quede transparente/negro
  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(0, 0, out.width, out.height);
  ctx.drawImage(canvas, 0, 0);

  return out.toDataURL("image/png");
}

export const SignaturePad = forwardRef<SignaturePadRef, Props>(
  function SignaturePad({ height = 180, className }, ref) {
    const wrapRef = useRef<HTMLDivElement | null>(null);
    const canvasRef = useRef<HTMLCanvasElement | null>(null);

    const drawing = useRef(false);
    const last = useRef<{ x: number; y: number } | null>(null);
    const [hasInk, setHasInk] = useState(false);

    const setupCanvas = () => {
      const wrap = wrapRef.current;
      const canvas = canvasRef.current;
      if (!wrap || !canvas) return;

      const dpr = window.devicePixelRatio || 1;
      const w = Math.max(280, Math.floor(wrap.clientWidth));
      const h = height;

      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      // Dibujar en coordenadas CSS (no en px reales)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.strokeStyle = "#111";
      ctx.lineWidth = 2.2;
    };

    useEffect(() => {
      setupCanvas();
      const wrap = wrapRef.current;
      if (!wrap) return;

      const ro = new ResizeObserver(() => setupCanvas());
      ro.observe(wrap);
      return () => ro.disconnect();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [height]);

    const getPos = (e: PointerEvent) => {
      const canvas = canvasRef.current!;
      const rect = canvas.getBoundingClientRect();
      return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };

    const drawLine = (from: { x: number; y: number }, to: { x: number; y: number }) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      ctx.beginPath();
      ctx.moveTo(from.x, from.y);
      ctx.lineTo(to.x, to.y);
      ctx.stroke();
    };

    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const onDown = (e: PointerEvent) => {
        drawing.current = true;
        canvas.setPointerCapture(e.pointerId);
        last.current = getPos(e);
      };

      const onMove = (e: PointerEvent) => {
        if (!drawing.current) return;
        const p = getPos(e);
        if (last.current) drawLine(last.current, p);
        last.current = p;
        if (!hasInk) setHasInk(true);
      };

      const onUp = () => {
        drawing.current = false;
        last.current = null;
      };

      canvas.addEventListener("pointerdown", onDown);
      canvas.addEventListener("pointermove", onMove);
      canvas.addEventListener("pointerup", onUp);
      canvas.addEventListener("pointercancel", onUp);

      return () => {
        canvas.removeEventListener("pointerdown", onDown);
        canvas.removeEventListener("pointermove", onMove);
        canvas.removeEventListener("pointerup", onUp);
        canvas.removeEventListener("pointercancel", onUp);
      };
    }, [hasInk]);

    useImperativeHandle(ref, () => ({
      clear: () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        setHasInk(false);
      },
      isEmpty: () => !hasInk,
      toPngDataUrl: () => {
        const canvas = canvasRef.current;
        if (!canvas) return null;
        if (!hasInk) return null;
        return exportCanvasToWhitePngDataUrl(canvas);
      },
    }));

    return (
      <div ref={wrapRef} className={className}>
        <canvas
          ref={canvasRef}
          style={{
            width: "100%",
            height,
            borderRadius: 12,
            border: "1px solid #d4d4d8",
            background: "#fff",
            touchAction: "none",
            display: "block",
          }}
        />
      </div>
    );
  }
);