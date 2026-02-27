"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { cleanRut, isValidRut, formatRutChile, normalizeRutInput } from "@/lib/rut";
import { normalizePlanTier, planLabel, type PlanTier } from "@/lib/planTier";
import styles from "./page.module.css";

type UserMeta = {
  full_name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  rut?: string | null;
  address?: string | null;
  phone?: string | null;
  region?: string | null;
  comuna?: string | null;
  city?: string | null;
};

function toStr(v: unknown) {
  return typeof v === "string" ? v : "";
}

export default function ProfilePage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const [email, setEmail] = useState<string>("");

  // Suscripción
  const [planTier, setPlanTier] = useState<PlanTier>("bronce");
  const [subStatus, setSubStatus] = useState<string | null>(null);

  // Perfil (metadata)
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [rut, setRut] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [region, setRegion] = useState("");
  const [comuna, setComuna] = useState("");
  const [city, setCity] = useState("");

  // Seguridad (password)
  const [pw1, setPw1] = useState("");
  const [pw2, setPw2] = useState("");
  const [pwSaving, setPwSaving] = useState(false);
  const [pwOk, setPwOk] = useState<string | null>(null);
  const [pwErr, setPwErr] = useState<string | null>(null);

  const lastLoadedEmail = useRef<string>("");

  const fullName = useMemo(() => {
    const f = firstName.trim();
    const l = lastName.trim();
    return `${f} ${l}`.trim();
  }, [firstName, lastName]);

  const initials = useMemo(() => {
    const f = firstName.trim();
    const l = lastName.trim();
    const a = (f[0] || "").toUpperCase();
    const b = (l[0] || "").toUpperCase();
    return (a + b) || "U";
  }, [firstName, lastName]);

  const rutClean = useMemo(() => cleanRut(rut), [rut]);
  const rutLooksComplete = useMemo(() => rutClean.length >= 8, [rutClean]);
  const rutOk = useMemo(() => (rutClean ? isValidRut(rutClean) : false), [rutClean]);

  async function loadUser() {
    setLoading(true);
    setErr(null);
    setOk(null);

    const { data: sessionData } = await supabaseBrowser.auth.getSession();
    if (!sessionData.session) {
      router.replace("/login?e=" + encodeURIComponent("Sesión expirada. Vuelve a ingresar."));
      return;
    }

    const { data, error } = await supabaseBrowser.auth.getUser();
    if (error || !data.user) {
      router.replace("/login?e=" + encodeURIComponent("Sesión expirada. Vuelve a ingresar."));
      return;
    }

    const user = data.user;
    const md = (user.user_metadata ?? {}) as UserMeta;

    const userEmail = user.email ?? "";
    setEmail(userEmail);
    lastLoadedEmail.current = userEmail;

    const ownerEmails = (process.env.NEXT_PUBLIC_OWNER_EMAILS || "")
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
    const isOwner = ownerEmails.length ? ownerEmails.includes(userEmail.toLowerCase()) : userEmail.toLowerCase() === "lizamaclaudio@gmail.com";
    setPlanTier(isOwner ? "diamante" : normalizePlanTier((md as any).plan_tier || (md as any).plan || (md as any).tier));
    setSubStatus((md as any).subscription_status || null);

    setFirstName(toStr(md.first_name));
    setLastName(toStr(md.last_name));

    const r = toStr(md.rut);
    setRut(r ? formatRutChile(r) : "");

    setAddress(toStr(md.address));
    setPhone(toStr(md.phone));
    setRegion(toStr(md.region));
    setComuna(toStr(md.comuna));
    setCity(toStr(md.city));

    setLoading(false);
  }

  useEffect(() => {
    loadUser();

    const { data: sub } = supabaseBrowser.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        router.replace("/login?e=" + encodeURIComponent("Sesión expirada. Vuelve a ingresar."));
      }
    });

    return () => sub?.subscription?.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function validateProfile() {
    const f = firstName.trim();
    const l = lastName.trim();
    if (!f) return "Ingresa tus nombres.";
    if (!l) return "Ingresa tus apellidos.";

    const rInput = rut.trim();
    const rClean = cleanRut(rInput);
    if (!rInput) return "Ingresa tu RUT.";
    if (!isValidRut(rClean)) return "RUT inválido (dígito verificador incorrecto).";

    const addr = address.trim();
    if (!addr) return "Ingresa tu dirección.";

    const ph = phone.trim();
    if (!ph) return "Ingresa tu teléfono.";
    if (ph.replace(/\D/g, "").length < 8) return "Teléfono inválido (muy corto).";

    const reg = region.trim();
    const com = comuna.trim();
    const ciu = city.trim();
    if (!reg) return "Ingresa tu región.";
    if (!com) return "Ingresa tu comuna.";
    if (!ciu) return "Ingresa tu ciudad.";

    return null;
  }

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setOk(null);

    const v = validateProfile();
    if (v) {
      setErr(v);
      return;
    }

    setSaving(true);

    try {
      const rClean = cleanRut(rut.trim());
      const f = firstName.trim();
      const l = lastName.trim();
      const full_name = `${f} ${l}`.trim();

      const payload: UserMeta = {
        full_name,
        first_name: f,
        last_name: l,
        rut: rClean,
        address: address.trim(),
        phone: phone.trim(),
        region: region.trim(),
        comuna: comuna.trim(),
        city: city.trim(),
      };

      const { error } = await supabaseBrowser.auth.updateUser({ data: payload });
      if (error) throw new Error(error.message);

      setRut(formatRutChile(rClean));
      setOk("✅ Perfil actualizado.");
      window.setTimeout(() => setOk(null), 1600);
    } catch (e: any) {
      setErr(e?.message || "No se pudo actualizar el perfil");
    } finally {
      setSaving(false);
    }
  }

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    setPwErr(null);
    setPwOk(null);

    const a = pw1.trim();
    const b = pw2.trim();

    if (!a || a.length < 6) {
      setPwErr("La nueva contraseña debe tener al menos 6 caracteres.");
      return;
    }
    if (a !== b) {
      setPwErr("Las contraseñas no coinciden.");
      return;
    }

    setPwSaving(true);
    try {
      const { error } = await supabaseBrowser.auth.updateUser({ password: a });
      if (error) throw new Error(error.message);

      setPwOk("✅ Contraseña actualizada.");
      setPw1("");
      setPw2("");
      window.setTimeout(() => setPwOk(null), 1600);
    } catch (e: any) {
      setPwErr(e?.message || "No se pudo actualizar la contraseña");
    } finally {
      setPwSaving(false);
    }
  }

  if (loading) {
    return (
      <div className={styles.loadingShell}>
        <div className={styles.loadingCard}>
          <div className={styles.loadingTitle}>Cargando perfil…</div>
          <div className={styles.loadingSub}>Verificando tu sesión</div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.head}>
        <div>
          <div className={styles.kicker}>Perfil</div>
          <h1 className={styles.h1}>Mi cuenta</h1>
          <p className={styles.sub}>
            Estos datos se usan para trazabilidad, auditoría y respaldo en tus capacitaciones.
          </p>
        </div>

        <div className={styles.headActions}>
          <button className="btn btnGhost" type="button" onClick={() => router.push("/app")}
            title="Volver al dashboard">
            ← Dashboard
          </button>
          <button className="btn btnGhost" type="button" onClick={loadUser}>
            Recargar
          </button>
        </div>
      </div>

      {/* Plan */}
      <div className={styles.planCard}>
        <div>
          <div className={styles.planTitle}>Plan</div>
          <div className={styles.planSub}>
            {planLabel(planTier, planTier === "diamante")} {subStatus ? `· ${String(subStatus)}` : ""}
          </div>
        </div>
        <button className="btn btnGhost" type="button" onClick={() => router.push("/app/billing")}
          title="Ver planes y suscripción">
          Ver suscripción
        </button>
      </div>

      {err ? <div className={styles.errBox}>{err}</div> : null}
      {ok ? <div className={styles.okBox}>{ok}</div> : null}

      {/* Summary */}
      <section className={styles.summary}>
        <div className={styles.avatar}>{initials}</div>
        <div className={styles.summaryText}>
          <div className={styles.summaryName}>{fullName || "Usuario"}</div>
          <div className={styles.summaryEmail}>{email || lastLoadedEmail.current}</div>
        </div>

        <div className={styles.summaryPills}>
          <span className={`${styles.pill} ${rutClean && rutLooksComplete ? (rutOk ? styles.pillOk : styles.pillWarn) : styles.pillMuted}`}>
            {rutClean && rutLooksComplete ? (rutOk ? "DV OK" : "Revisar DV") : "RUT"}
          </span>
          <span className={`${styles.pill} ${styles.pillMuted}`}>Cuenta</span>
        </div>
      </section>

      <div className={styles.grid}>
        {/* Profile form */}
        <section className={styles.card}>
          <div className={styles.cardHead}>
            <div>
              <div className={styles.cardTitle}>Datos personales</div>
              <div className={styles.cardSub}>Actualiza tus datos (se guardan en tu usuario).</div>
            </div>
            <div className={styles.emailPill}>📩 {email || lastLoadedEmail.current}</div>
          </div>

          <form className={styles.form} onSubmit={saveProfile}>
            <div className={styles.row2}>
              <div className={styles.field}>
                <label className={styles.label}>Nombres</label>
                <input className="input" value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
              </div>

              <div className={styles.field}>
                <label className={styles.label}>Apellidos</label>
                <input className="input" value={lastName} onChange={(e) => setLastName(e.target.value)} required />
              </div>
            </div>

            <div className={styles.row2}>
              <div className={styles.field}>
                <div className={styles.labelRow}>
                  <label className={styles.label}>RUT</label>
                  <span
                    className={`${styles.rutPill} ${rutClean && rutLooksComplete ? (rutOk ? styles.rutOk : styles.rutBad) : styles.rutIdle}`}
                    title="Validación por dígito verificador (DV)"
                  >
                    {rutClean && rutLooksComplete ? (rutOk ? "DV OK" : "DV inválido") : "Chile"}
                  </span>
                </div>
                <input
                  className="input"
                  placeholder="12345678-5"
                  value={rut}
                  onChange={(e) => setRut(normalizeRutInput(e.target.value))}
                  onBlur={() => setRut(formatRutChile(rut))}
                  required
                />
                <div className={styles.hint}>Formato Chile: XXXXXXXX-X (sin puntos). Validamos DV.</div>
              </div>

              <div className={styles.field}>
                <label className={styles.label}>Teléfono</label>
                <input
                  className="input"
                  placeholder="+56 9 1234 5678"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  inputMode="tel"
                  required
                />
              </div>
            </div>

            <div className={styles.field}>
              <label className={styles.label}>Dirección</label>
              <input className="input" value={address} onChange={(e) => setAddress(e.target.value)} required />
            </div>

            <div className={styles.row3}>
              <div className={styles.field}>
                <label className={styles.label}>Región</label>
                <input className="input" value={region} onChange={(e) => setRegion(e.target.value)} required />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Comuna</label>
                <input className="input" value={comuna} onChange={(e) => setComuna(e.target.value)} required />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Ciudad</label>
                <input className="input" value={city} onChange={(e) => setCity(e.target.value)} required />
              </div>
            </div>

            <div className={styles.actions}>
              <div className={styles.namePreview}>
                Nombre completo: <span className={styles.previewStrong}>{fullName || "—"}</span>
              </div>

              <button className="btn btnCta" type="submit" disabled={saving}>
                {saving ? "Guardando…" : "Guardar cambios"}
              </button>
            </div>
          </form>
        </section>

        {/* Security */}
        <section className={styles.card}>
          <div className={styles.cardHead}>
            <div>
              <div className={styles.cardTitle}>Seguridad</div>
              <div className={styles.cardSub}>Cambiar contraseña (opcional).</div>
            </div>
          </div>

          {pwErr ? <div className={styles.errBox}>{pwErr}</div> : null}
          {pwOk ? <div className={styles.okBox}>{pwOk}</div> : null}

          <form className={styles.form} onSubmit={changePassword}>
            <div className={styles.field}>
              <label className={styles.label}>Nueva contraseña</label>
              <input
                className="input"
                type="password"
                value={pw1}
                onChange={(e) => setPw1(e.target.value)}
                autoComplete="new-password"
              />
            </div>

            <div className={styles.field}>
              <label className={styles.label}>Repite nueva contraseña</label>
              <input
                className="input"
                type="password"
                value={pw2}
                onChange={(e) => setPw2(e.target.value)}
                autoComplete="new-password"
              />
            </div>

            <div className={styles.actions}>
              <button className="btn btnPrimary" type="submit" disabled={pwSaving}>
                {pwSaving ? "Actualizando…" : "Actualizar contraseña"}
              </button>
            </div>
          </form>

          <div className={styles.note}>
            Consejo: usa una contraseña fuerte. Si la cambias, tu sesión actual sigue válida.
          </div>
        </section>
      </div>
    </div>
  );
}
