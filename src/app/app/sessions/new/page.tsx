"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { cleanRut, isValidRut, formatRutChile, normalizeRutInput } from "@/lib/rut";
import styles from "./page.module.css";

type Company = {
  id: string;
  name: string | null;
  rut?: string | null;
  legal_name?: string | null;
  company_type?: string | null;
};

function toIsoLocal(dt: string) {
  try {
    // "YYYY-MM-DDTHH:mm" (datetime-local) is parsed as local time in browsers.
    return new Date(dt).toISOString();
  } catch {
    return null;
  }
}

async function sleep(ms: number) {
  await new Promise((r) => setTimeout(r, ms));
}

async function getTokenRobust() {
  // Mitiga casos donde la sesión tarda en “hidratar” al navegar entre rutas.
  for (let i = 0; i < 6; i++) {
    const { data } = await supabaseBrowser.auth.getSession();
    const token = data.session?.access_token ?? null;
    if (token) return token;

    try {
      await supabaseBrowser.auth.refreshSession();
    } catch {
      // ignore
    }

    await sleep(180);
  }
  return null;
}

function pillStatusForRut(raw: string) {
  const clean = cleanRut(raw || "");
  if (!clean) return { label: "Chile", kind: "idle" as const };
  if (clean.length < 8) return { label: "Chile", kind: "idle" as const };
  return isValidRut(clean) ? { label: "DV OK", kind: "ok" as const } : { label: "DV inválido", kind: "bad" as const };
}

function NewSessionSkeleton() {
  return (
    <div className={styles.page}>
      <div className={styles.headCard}>
        <div>
          <div className={styles.kicker}>Charlas</div>
          <h1 className={styles.h1}>Crear charla</h1>
          <p className={styles.sub}>Cargando…</p>
        </div>
      </div>

      <div className={styles.grid}>
        <div className={styles.formCard}>
          <div style={{ padding: 18, opacity: 0.8 }}>Preparando formulario…</div>
        </div>
      </div>
    </div>
  );
}

function NewSessionInner() {
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

  const rutPill = useMemo(() => pillStatusForRut(passcodeRut), [passcodeRut]);

  const selectedCompany = useMemo(() => companies.find((c) => c.id === companyId) || null, [companies, companyId]);

  const canSave = useMemo(() => {
    return !!companyId && !!topic.trim() && !!trainerName.trim() && !!sessionDate.trim();
  }, [companyId, topic, trainerName, sessionDate]);

  useEffect(() => {
    let alive = true;

    (async () => {
      setLoading(true);
      setErr(null);

      const token = await getTokenRobust();
      if (!token) {
        router.replace("/login?redirect=" + encodeURIComponent("/app/sessions/new"));
        return;
      }

      try {
        // Prefill relator (desde perfil)
        const { data: u } = await supabaseBrowser.auth.getUser();
        if (alive && u.user) {
          const md = (u.user.user_metadata ?? {}) as Record<string, any>;
          const f = typeof md.first_name === "string" ? md.first_name.trim() : "";
          const l = typeof md.last_name === "string" ? md.last_name.trim() : "";
          const full = (typeof md.full_name === "string" && md.full_name.trim()) || `${f} ${l}`.trim();
          if (!trainerName && full) setTrainerName(full);

          const r = typeof md.rut === "string" ? md.rut.trim() : "";
          if (!passcodeRut && r) setPasscodeRut(formatRutChile(r));
        }

        // Load companies
        const res = await fetch("/api/app/companies", {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        });

        const json = await res.json().catch(() => null);
        if (!res.ok) throw new Error(json?.error || "No se pudieron cargar empresas");

        const list: Company[] = Array.isArray(json?.companies) ? json.companies : [];
        if (!alive) return;

        setCompanies(list);

        // Preselect company from query param if exists
        if (prefCompanyId && !companyId) {
          const exists = list.some((c) => c.id === prefCompanyId);
          if (exists) setCompanyId(prefCompanyId);
        }
      } catch (e: any) {
        if (!alive) return;
        setErr(e?.message || "Error al cargar");
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

    const token = await getTokenRobust();
    if (!token) {
      router.replace("/login?redirect=" + encodeURIComponent("/app/sessions/new"));
      return;
    }

    const passRaw = passcodeRut.trim();
    const passClean = cleanRut(passRaw);
    if (passRaw && !isValidRut(passClean)) {
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
        trainer_rut: passRaw ? passClean : null, // lo espera el endpoint
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

      // abrir admin de la charla
      router.push(`/admin/s/${code}`);
    } catch (e: any) {
      setErr(e?.message || "Error al crear charla");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.headCard}>
        <div>
          <div className={styles.kicker}>Charlas</div>
          <h1 className={styles.h1}>Crear charla</h1>
          <p className={styles.sub}>Crea → abre admin → registro por QR → cierre relator → PDF final.</p>
        </div>

        <div className={styles.headActions}>
          <Link className="btn btnGhost" href="/app/sessions">
            ← Volver
          </Link>
          <Link className="btn btnPrimary" href="/app/companies/new">
            + Nueva empresa
          </Link>
        </div>
      </div>

      {err ? <div className={`${styles.alert} ${styles.alertErr}`}>{err}</div> : null}

      <div className={styles.grid}>
        {/* Left: Flow / Preview */}
        <aside className={styles.aside}>
          <div className={styles.asideTop}>
            <div className={styles.asideTitle}>Vista ejecutiva</div>
            <div className={styles.asideSub}>Qué ocurre después de crear</div>
          </div>

          <div className={styles.flow}>
            <div className={styles.flowItem}>
              <span className={styles.flowDot} />
              <div>
                <div className={styles.flowTitle}>1) Se genera código + QR</div>
                <div className={styles.flowText}>Código de 6 caracteres para el registro público.</div>
              </div>
            </div>

            <div className={styles.flowItem}>
              <span className={styles.flowDot} />
              <div>
                <div className={styles.flowTitle}>2) Registro desde celular</div>
                <div className={styles.flowText}>Nombre, RUT + DV, cargo (si aplica) y firma.</div>
              </div>
            </div>

            <div className={styles.flowItem}>
              <span className={styles.flowDot} />
              <div>
                <div className={styles.flowTitle}>3) Cierre del relator</div>
                <div className={styles.flowText}>Firma de cierre para bloquear el listado.</div>
              </div>
            </div>

            <div className={styles.flowItem}>
              <span className={styles.flowDot} />
              <div>
                <div className={styles.flowTitle}>4) PDF final</div>
                <div className={styles.flowText}>Lista + firmas + logos (respaldo para auditoría).</div>
              </div>
            </div>
          </div>

          <div className={styles.previewCard}>
            <div className={styles.previewTitle}>Resumen</div>

            <div className={styles.previewRow}>
              <span className={styles.previewLabel}>Empresa</span>
              <span className={styles.previewValue}>{selectedCompany ? selectedCompany.name || "Empresa" : "—"}</span>
            </div>

            <div className={styles.previewRow}>
              <span className={styles.previewLabel}>Tema</span>
              <span className={styles.previewValue}>{topic.trim() || "—"}</span>
            </div>

            <div className={styles.previewRow}>
              <span className={styles.previewLabel}>Relator</span>
              <span className={styles.previewValue}>{trainerName.trim() || "—"}</span>
            </div>

            <div className={styles.previewRow}>
              <span className={styles.previewLabel}>Fecha/Hora</span>
              <span className={styles.previewValue}>{sessionDate ? sessionDate.replace("T", " ") : "—"}</span>
            </div>

            <div className={styles.previewHint}>Al crear, abriremos el admin de la charla automáticamente.</div>
          </div>
        </aside>

        {/* Right: Form */}
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

                {companies.length === 0 && !loading ? (
                  <div className={styles.emptyCompanies}>
                    No tienes empresas aún.{" "}
                    <Link className={styles.inlineLink} href="/app/companies/new">
                      Crear empresa →
                    </Link>
                  </div>
                ) : null}
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
                  <label className={styles.label}>Lugar (opcional)</label>
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
                  <div className={styles.hint}>Se guarda como fecha/hora de la charla.</div>
                </div>
              </div>
            </div>

            <div className={styles.section}>
              <div className={styles.sectionTitle}>Passcode admin (opcional)</div>

              <div className={styles.field}>
                <div className={styles.labelRow}>
                  <label className={styles.label}>RUT relator (passcode)</label>
                  <span
                    className={`${styles.rutPill} ${
                      rutPill.kind === "ok" ? styles.rutOk : rutPill.kind === "bad" ? styles.rutBad : styles.rutIdle
                    }`}
                    title="Validación por DV"
                  >
                    {rutPill.label}
                  </span>
                </div>

                <input
                  className="input"
                  placeholder="12345678-5"
                  value={passcodeRut}
                  onChange={(e) => setPasscodeRut(normalizeRutInput(e.target.value))}
                  onBlur={() => setPasscodeRut(formatRutChile(passcodeRut))}
                />
                <div className={styles.hint}>Recomendado: deja el admin listo para cierre + PDF (se valida DV).</div>
              </div>
            </div>

            <div className={styles.actions}>
              <Link className="btn btnGhost" href="/app/sessions">
                Cancelar
              </Link>

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

export default function NewSessionPage() {
  // ✅ FIX Next 16: useSearchParams debe estar dentro de Suspense en una page
  return (
    <Suspense fallback={<NewSessionSkeleton />}>
      <NewSessionInner />
    </Suspense>
  );
}