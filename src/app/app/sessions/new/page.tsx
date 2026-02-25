"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { cleanRut, isValidRut } from "@/lib/rut";
import styles from "./page.module.css";

type Company = {
  id: string;
  name: string | null;
  rut?: string | null;
};

function toIsoLocal(dt: string) {
  try {
    return new Date(dt).toISOString();
  } catch {
    return null;
  }
}

async function getToken() {
  const { data } = await supabaseBrowser.auth.getSession();
  return data.session?.access_token ?? null;
}

export default function NewSessionPage() {
  const router = useRouter();
  const sp = useSearchParams();

  const prefCompanyId = useMemo(() => {
    const v = sp.get("companyId");
    return v ? v.trim() : "";
  }, [sp]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [companies, setCompanies] = useState<Company[]>([]);
  const [companyId, setCompanyId] = useState("");

  const [topic, setTopic] = useState("");
  const [location, setLocation] = useState("");
  const [trainerName, setTrainerName] = useState("");
  const [sessionDate, setSessionDate] = useState("");
  const [passcodeRut, setPasscodeRut] = useState("");

  const canSave = useMemo(() => {
    return !!companyId && !!topic.trim() && !!trainerName.trim() && !!sessionDate.trim();
  }, [companyId, topic, trainerName, sessionDate]);

  useEffect(() => {
    let alive = true;

    (async () => {
      setLoading(true);
      setErr(null);

      const token = await getToken();
      if (!token) {
        router.replace("/login");
        return;
      }

      try {
        const res = await fetch("/api/app/companies", {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        });

        const json = await res.json().catch(() => null);
        if (!res.ok) throw new Error(json?.error || "No se pudieron cargar empresas");

        const list: Company[] = Array.isArray(json?.companies) ? json.companies : [];
        if (!alive) return;

        setCompanies(list);

        if (prefCompanyId && !companyId) {
          const exists = list.some((c) => c.id === prefCompanyId);
          if (exists) setCompanyId(prefCompanyId);
        }
      } catch (e: any) {
        if (!alive) return;
        setErr(e?.message || "Error al cargar empresas");
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router, prefCompanyId]);

  async function createSession(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);

    if (!canSave) {
      setErr("Completa empresa, tema, relator y fecha/hora.");
      return;
    }

    const token = await getToken();
    if (!token) {
      router.replace("/login");
      return;
    }

    const rutClean = cleanRut(passcodeRut.trim());
    if (passcodeRut.trim() && !isValidRut(rutClean)) {
      setErr("RUT relator (passcode) inválido.");
      return;
    }

    const iso = toIsoLocal(sessionDate);
    if (!iso) {
      setErr("Fecha/hora inválida.");
      return;
    }

    setSaving(true);

    try {
      const payload: any = {
        topic: topic.trim(),
        location: location.trim() ? location.trim() : null,
        trainer_name: trainerName.trim(),
        session_date: iso,
        trainer_rut: passcodeRut.trim() ? rutClean : null, // ✅ lo que espera tu endpoint
      };

      const res = await fetch(`/api/app/companies/${companyId}/sessions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });

      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error || "No se pudo crear la charla");

      const code = (json?.session?.code ?? json?.code ?? "").toString().toUpperCase();
      if (!code) {
        router.push("/app/sessions");
        return;
      }

      router.push(`/admin/s/${code}`);
    } catch (e: any) {
      setErr(e?.message || "Error al crear charla");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.headCard}>
        <div>
          <div className={styles.kicker}>Charlas</div>
          <h1 className={styles.h1}>Crear charla</h1>
          <p className={styles.sub}>Crea la charla, abre admin, cierra con firma y genera PDF final.</p>
        </div>

        <div className={styles.headActions}>
          <button type="button" className="btn btnGhost" onClick={() => router.push("/app/sessions")}>
            ← Volver
          </button>
        </div>
      </div>

      {err ? <div className={`${styles.alert} ${styles.alertErr}`}>{err}</div> : null}

      <div className={styles.grid}>
        <aside className={styles.aside}>
          <div className={styles.asideTitle}>Checklist</div>
          <div className={styles.asideItem}>✅ Empresa</div>
          <div className={styles.asideItem}>✅ Tema</div>
          <div className={styles.asideItem}>✅ Relator</div>
          <div className={styles.asideItem}>✅ Fecha/hora</div>
          <div className={styles.asideItem}>✅ Passcode opcional (RUT relator)</div>

          <div className={styles.asideNote}>
            Tip: si defines el <b>passcode</b> aquí, el admin queda listo para cierre + PDF.
          </div>
        </aside>

        <div className={styles.formCard}>
          <form onSubmit={createSession} className={styles.form}>
            <div className={styles.section}>
              <div className={styles.sectionTitle}>Datos base</div>

              <div className={styles.field}>
                <label className={styles.label}>Empresa</label>
                <select
                  className={`input ${styles.select}`}
                  value={companyId}
                  onChange={(e) => setCompanyId(e.target.value)}
                  disabled={loading}
                  required
                >
                  <option value="">{loading ? "Cargando empresas..." : "Selecciona empresa"}</option>
                  {companies.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name || "Empresa"} {c.rut ? `(${c.rut})` : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div className={styles.row2}>
                <div className={styles.field}>
                  <label className={styles.label}>Tema / Charla</label>
                  <input
                    className="input"
                    placeholder="Ej: Uso de extintores"
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    required
                  />
                </div>

                <div className={styles.field}>
                  <label className={styles.label}>Lugar</label>
                  <input
                    className="input"
                    placeholder="Ej: Puerto Montt"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                  />
                </div>
              </div>

              <div className={styles.row2}>
                <div className={styles.field}>
                  <label className={styles.label}>Relator</label>
                  <input
                    className="input"
                    placeholder="Ej: Claudio Lizama"
                    value={trainerName}
                    onChange={(e) => setTrainerName(e.target.value)}
                    required
                  />
                </div>

                <div className={styles.field}>
                  <label className={styles.label}>Fecha / hora</label>
                  <input
                    className="input"
                    type="datetime-local"
                    value={sessionDate}
                    onChange={(e) => setSessionDate(e.target.value)}
                    required
                  />
                </div>
              </div>
            </div>

            <div className={styles.section}>
              <div className={styles.sectionTitle}>Passcode admin (opcional)</div>

              <div className={styles.field}>
                <label className={styles.label}>RUT relator (passcode)</label>
                <input
                  className="input"
                  placeholder="Ej: 12.345.678-9"
                  value={passcodeRut}
                  onChange={(e) => setPasscodeRut(e.target.value)}
                />
                <div className={styles.hint}>Se recomienda para cierre + PDF en admin.</div>
              </div>
            </div>

            <div className={styles.actions}>
              <button type="button" className="btn btnGhost" onClick={() => router.push("/app/sessions")}>
                Cancelar
              </button>

              <button type="submit" className="btn btnCta" disabled={saving || !canSave}>
                {saving ? "Creando..." : "Crear y abrir admin →"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}