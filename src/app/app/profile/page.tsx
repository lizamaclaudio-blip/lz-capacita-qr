"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/browser";
import styles from "./page.module.css";

export default function ProfilePage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);

  const [email, setEmail] = useState<string>("");
  const [userId, setUserId] = useState<string>("");

  const [fullName, setFullName] = useState<string>("");
  const [savingName, setSavingName] = useState(false);

  const [newPassword, setNewPassword] = useState("");
  const [savingPass, setSavingPass] = useState(false);
  const [showPass, setShowPass] = useState(false);

  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const nameNormalized = useMemo(() => fullName.trim(), [fullName]);

  useEffect(() => {
    let alive = true;

    (async () => {
      setLoading(true);
      setErr(null);
      setMsg(null);

      const { data, error } = await supabaseBrowser.auth.getUser();
      if (!alive) return;

      if (error) {
        setErr(error.message);
        setLoading(false);
        return;
      }

      const u = data.user;
      if (!u) {
        router.replace("/login");
        return;
      }

      setUserId(u.id);
      setEmail(u.email ?? "");

      const md = (u.user_metadata ?? {}) as Record<string, any>;
      const initialName =
        (typeof md.full_name === "string" && md.full_name) ||
        (typeof md.name === "string" && md.name) ||
        (typeof md.display_name === "string" && md.display_name) ||
        "";

      setFullName(initialName);
      setLoading(false);
    })();

    return () => {
      alive = false;
    };
  }, [router]);

  async function saveProfile() {
    setErr(null);
    setMsg(null);

    if (!nameNormalized) {
      setErr("Ingresa tu nombre para guardarlo.");
      return;
    }

    setSavingName(true);

    const { error } = await supabaseBrowser.auth.updateUser({
      data: { full_name: nameNormalized },
    });

    setSavingName(false);

    if (error) {
      setErr(error.message);
      return;
    }

    setMsg("✅ Nombre actualizado. (Se verá en el saludo del panel)");
  }

  async function changePassword() {
    setErr(null);
    setMsg(null);

    if (!newPassword || newPassword.length < 6) {
      setErr("La contraseña debe tener al menos 6 caracteres.");
      return;
    }

    setSavingPass(true);

    const { error } = await supabaseBrowser.auth.updateUser({
      password: newPassword,
    });

    setSavingPass(false);

    if (error) {
      setErr(error.message);
      return;
    }

    setNewPassword("");
    setMsg("✅ Contraseña actualizada.");
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <div className={styles.title}>Mi perfil</div>
          <div className={styles.sub}>
            Ajusta tus datos básicos. (Email es solo lectura)
          </div>
        </div>

        <button className={styles.backBtn} onClick={() => router.push("/app")} type="button">
          ← Volver
        </button>
      </div>

      {loading ? (
        <div className={styles.card}>
          <div className={styles.loading}>Cargando…</div>
        </div>
      ) : (
        <>
          {(err || msg) && (
            <div className={`${styles.alert} ${err ? styles.alertErr : styles.alertOk}`}>
              {err ? err : msg}
            </div>
          )}

          <div className={styles.card}>
            <div className={styles.cardTitle}>Datos de cuenta</div>

            <div className={styles.grid2}>
              <div className={styles.field}>
                <label className={styles.label}>Email</label>
                <input className={styles.inputDisabled} value={email} disabled />
              </div>

              <div className={styles.field}>
                <label className={styles.label}>ID usuario</label>
                <input className={styles.inputDisabled} value={userId} disabled />
              </div>

              <div className={styles.fieldWide}>
                <label className={styles.label}>Nombre (se muestra en el panel)</label>
                <input
                  className={styles.input}
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Ej: Claudio Lizama"
                />

                <div className={styles.actionsRow}>
                  <button
                    type="button"
                    className={styles.primaryBtn}
                    onClick={saveProfile}
                    disabled={savingName}
                  >
                    {savingName ? "Guardando…" : "Guardar nombre"}
                  </button>

                  <div className={styles.hint}>
                    Guardamos en <span className={styles.mono}>user_metadata.full_name</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className={styles.card}>
            <div className={styles.cardTitle}>Seguridad</div>

            <div className={styles.grid2}>
              <div className={styles.fieldWide}>
                <label className={styles.label}>Nueva contraseña</label>

                <div className={styles.passRow}>
                  <input
                    className={styles.input}
                    type={showPass ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Mínimo 6 caracteres"
                  />
                  <button
                    type="button"
                    className={styles.secondaryBtn}
                    onClick={() => setShowPass((v) => !v)}
                  >
                    {showPass ? "Ocultar" : "Ver"}
                  </button>
                </div>

                <div className={styles.actionsRow}>
                  <button
                    type="button"
                    className={styles.dangerBtn}
                    onClick={changePassword}
                    disabled={savingPass}
                  >
                    {savingPass ? "Actualizando…" : "Actualizar contraseña"}
                  </button>

                  <div className={styles.hint}>
                    Esto cambia tu contraseña en Supabase Auth.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}