"use client";

import { useEffect, useMemo, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/browser";
import styles from "./EditSessionModal.module.css";

export type SessionRow = {
  id: string;
  company_id: string;
  code: string;
  topic: string | null;
  location: string | null;
  session_date: string | null;
  trainer_name: string | null;
  status: string | null;
  closed_at: string | null;
  created_at: string | null;
};

type Props = {
  open: boolean;
  session: SessionRow | null;
  onClose: () => void;
  onSaved: () => void;
};

function toLocalInputValue(iso: string | null) {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(
      d.getMinutes()
    )}`;
  } catch {
    return "";
  }
}

export default function EditSessionModal({ open, session, onClose, onSaved }: Props) {
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [topic, setTopic] = useState("");
  const [trainer, setTrainer] = useState("");
  const [location, setLocation] = useState("");
  const [dtLocal, setDtLocal] = useState("");

  useEffect(() => {
    if (!open || !session) return;
    setErr(null);
    setTopic(session.topic ?? "");
    setTrainer(session.trainer_name ?? "");
    setLocation(session.location ?? "");
    setDtLocal(toLocalInputValue(session.session_date));
  }, [open, session]);

  const isClosed = useMemo(() => {
    const st = (session?.status ?? "").toLowerCase();
    return st === "closed" || !!session?.closed_at;
  }, [session]);

  async function getTokenOrThrow() {
    const { data } = await supabaseBrowser.auth.getSession();
    const token = data.session?.access_token;
    if (!token) throw new Error("Sesión expirada. Vuelve a ingresar.");
    return token;
  }

  async function save() {
    if (!session) return;
    setErr(null);

    if (!topic.trim()) return setErr("Tema es obligatorio.");
    if (!trainer.trim()) return setErr("Relator es obligatorio.");

    setSaving(true);
    try {
      const token = await getTokenOrThrow();
      const res = await fetch(`/api/app/sessions/${session.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          topic: topic.trim(),
          trainer_name: trainer.trim(),
          location: location.trim() ? location.trim() : null,
          session_date: dtLocal ? new Date(dtLocal).toISOString() : null,
        }),
      });

      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error || "No se pudo guardar");

      onSaved();
      onClose();
    } catch (e: any) {
      setErr(e?.message || "Error");
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!session) return;
    setErr(null);

    const ok = window.confirm(
      `¿Eliminar charla ${session.code}? \n\nSolo se permite si NO tiene asistentes.`
    );
    if (!ok) return;

    setDeleting(true);
    try {
      const token = await getTokenOrThrow();
      const res = await fetch(`/api/app/sessions/${session.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error || "No se pudo eliminar");

      onSaved();
      onClose();
    } catch (e: any) {
      setErr(e?.message || "Error");
    } finally {
      setDeleting(false);
    }
  }

  if (!open || !session) return null;

  return (
    <div className={styles.backdrop} role="dialog" aria-modal="true">
      <div className={styles.modal}>
        <div className={styles.top}>
          <div>
            <div className={styles.title}>Editar charla · {session.code}</div>
            <div className={styles.sub}>
              {isClosed ? "⚠️ Cerrada (puedes editar datos, pero cuidado con auditoría)." : "Abierta"}
            </div>
          </div>

          <button className={styles.x} onClick={onClose} type="button" aria-label="Cerrar">
            ✕
          </button>
        </div>

        {err && <div className={styles.error}>{err}</div>}

        <div className={styles.grid}>
          <div className={styles.field}>
            <label className={styles.label}>Tema *</label>
            <input className={styles.input} value={topic} onChange={(e) => setTopic(e.target.value)} />
          </div>

          <div className={styles.field}>
            <label className={styles.label}>Relator *</label>
            <input className={styles.input} value={trainer} onChange={(e) => setTrainer(e.target.value)} />
          </div>

          <div className={styles.field}>
            <label className={styles.label}>Lugar</label>
            <input className={styles.input} value={location} onChange={(e) => setLocation(e.target.value)} />
          </div>

          <div className={styles.field}>
            <label className={styles.label}>Fecha y hora</label>
            <input
              className={styles.input}
              type="datetime-local"
              value={dtLocal}
              onChange={(e) => setDtLocal(e.target.value)}
            />
          </div>
        </div>

        <div className={styles.actions}>
          <button className={styles.secondary} onClick={onClose} type="button">
            Cancelar
          </button>

          <button className={styles.primary} onClick={save} disabled={saving} type="button">
            {saving ? "Guardando…" : "Guardar cambios"}
          </button>
        </div>

        <div className={styles.danger}>
          <div className={styles.dangerTitle}>Eliminar charla</div>
          <div className={styles.dangerSub}>Solo se permite si no tiene asistentes.</div>

          <button className={styles.dangerBtn} onClick={remove} disabled={deleting} type="button">
            {deleting ? "Eliminando…" : "Eliminar charla"}
          </button>
        </div>
      </div>
    </div>
  );
}