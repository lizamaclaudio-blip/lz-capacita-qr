"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/browser";
import styles from "./page.module.css";

type PdfRow = {
  id: string;
  code: string;
  topic: string | null;
  session_date: string | null;
  trainer_name: string | null;
  pdf_path: string;
  pdf_generated_at: string | null;
  companies?: { name: string; address: string | null } | null;
};

function fmtCL(iso?: string | null) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("es-CL");
  } catch {
    return "—";
  }
}

export default function PdfsPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<PdfRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [q, setQ] = useState("");

  async function getTokenOrRedirect() {
    const { data } = await supabaseBrowser.auth.getSession();
    const token = data.session?.access_token;
    if (!token) {
      router.replace("/login?e=" + encodeURIComponent("Sesión expirada. Vuelve a ingresar."));
      return null;
    }
    return token;
  }

  async function load() {
    setLoading(true);
    setError(null);

    const token = await getTokenOrRedirect();
    if (!token) return;

    const res = await fetch("/api/app/pdfs", {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });

    const json = await res.json().catch(() => null);
    if (!res.ok) {
      setItems([]);
      setError(json?.error || "No se pudieron cargar los PDF");
      setLoading(false);
      return;
    }

    setItems(json?.pdfs ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function signAndOpen(pdf_path: string) {
    const token = await getTokenOrRedirect();
    if (!token) return;

    setToast("Abriendo PDF…");
    try {
      const res = await fetch("/api/app/pdfs/sign", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ pdf_path }),
      });

      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error || "No se pudo abrir");

      window.open(json.signed_url, "_blank", "noopener,noreferrer");
      setToast("PDF abierto ✅");
      setTimeout(() => setToast(null), 1200);
    } catch (e: any) {
      setToast(e?.message || "Error PDF");
      setTimeout(() => setToast(null), 2200);
    }
  }

  async function copy(text: string, msg = "Copiado ✅") {
    try {
      await navigator.clipboard.writeText(text);
      setToast(msg);
      setTimeout(() => setToast(null), 1200);
    } catch {
      setToast("No se pudo copiar 😕");
      setTimeout(() => setToast(null), 1800);
    }
  }

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return items;

    return items.filter((x) => {
      const company = x.companies?.name ?? "";
      const topic = x.topic ?? "";
      const code = x.code ?? "";
      const trainer = x.trainer_name ?? "";
      return (
        company.toLowerCase().includes(term) ||
        topic.toLowerCase().includes(term) ||
        code.toLowerCase().includes(term) ||
        trainer.toLowerCase().includes(term)
      );
    });
  }, [items, q]);

  return (
    <div className={styles.page}>
      <div className={styles.head}>
        <div>
          <div className={styles.title}>Mis PDF</div>
          <div className={styles.sub}>Documentos generados y firmados.</div>
        </div>

        <div className={styles.actionsTop}>
          <button className={styles.secondary} onClick={() => router.push("/app/sessions")} type="button">
            📋 Mis charlas
          </button>
          <button className={styles.primary} onClick={load} disabled={loading} type="button">
            {loading ? "Cargando…" : "Actualizar"}
          </button>
        </div>
      </div>

      {error && <div className={styles.error}>{error}</div>}

      <div className={styles.toolbar}>
        <input
          className={styles.search}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar por empresa, tema, código o relator…"
        />
        {toast && <div className={styles.toast}>{toast}</div>}
      </div>

      <div className={styles.listCard}>
        {loading ? (
          <div className={styles.muted}>Cargando…</div>
        ) : !filtered.length ? (
          <div className={styles.muted}>Aún no hay PDFs generados.</div>
        ) : (
          <div className={styles.rows}>
            {filtered.map((p) => (
              <div key={p.id} className={styles.row}>
                <div className={styles.rowMain}>
                  <div className={styles.rowTopLine}>
                    <span className={styles.topic}>{p.topic || "(Sin tema)"}</span>
                    <span className={styles.badge}>PDF</span>
                  </div>

                  <div className={styles.meta}>
                    <span className={styles.mono}>{String(p.code ?? "").toUpperCase()}</span>
                    <span className={styles.dot}>•</span>
                    <span>{p.companies?.name ?? "—"}</span>
                    <span className={styles.dot}>•</span>
                    <span>{p.trainer_name ?? "—"}</span>
                    <span className={styles.dot}>•</span>
                    <span>Generado: {fmtCL(p.pdf_generated_at)}</span>
                  </div>
                </div>

                <div className={styles.rowActions}>
                  <button className={styles.btnPdf} onClick={() => signAndOpen(p.pdf_path)} type="button">
                    Abrir PDF
                  </button>

                  <button
                    className={styles.btnThin}
                    onClick={() => copy(p.pdf_path, "Ruta PDF copiada ✅")}
                    type="button"
                  >
                    Copiar ruta
                  </button>

                  <button
                    className={styles.btnDark}
                    onClick={() => router.push(`/admin/s/${encodeURIComponent(String(p.code).toUpperCase())}`)}
                    type="button"
                  >
                    Admin
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}