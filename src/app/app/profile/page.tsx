"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { cleanRut, isValidRut } from "@/lib/rut";
import styles from "./page.module.css";

export default function ProfilePage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);

  const [email, setEmail] = useState<string>("");
  const [userId, setUserId] = useState<string>("");

  const [firstName, setFirstName] = useState<string>("");
  const [lastName, setLastName] = useState<string>("");
  const [rut, setRut] = useState<string>("");
  const [address, setAddress] = useState<string>("");
  const [phone, setPhone] = useState<string>("");
  const [region, setRegion] = useState<string>("");
  const [comuna, setComuna] = useState<string>("");
  const [city, setCity] = useState<string>("");

  const [savingName, setSavingName] = useState(false);

  const [newPassword, setNewPassword] = useState("");
  const [savingPass, setSavingPass] = useState(false);
  const [showPass, setShowPass] = useState(false);

  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const fullName = useMemo(() => `${firstName.trim()} ${lastName.trim()}`.trim(), [firstName, lastName]);
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
      const initialFull =
        (typeof md.full_name === "string" && md.full_name) ||
        (typeof md.name === "string" && md.name) ||
        (typeof md.display_name === "string" && md.display_name) ||
        "";

      setFirstName((typeof md.first_name === "string" && md.first_name) || initialFull.split(" ").slice(0, -1).join(" ") || "");
      setLastName((typeof md.last_name === "string" && md.last_name) || initialFull.split(" ").slice(-1).join(" ") || "");
      setRut((typeof md.rut === "string" && md.rut) || "");
      setAddress((typeof md.address === "string" && md.address) || "");
      setPhone((typeof md.phone === "string" && md.phone) || "");
      setRegion((typeof md.region === "string" && md.region) || "");
      setComuna((typeof md.comuna === "string" && md.comuna) || "");
      setCity((typeof md.city === "string" && md.city) || "");
      setLoading(false);
    })();

    return () => {
      alive = false;
    };
  }, [router]);

  async function saveProfile() {
    setErr(null);
    setMsg(null);

    if (!firstName.trim()) {
      setErr("Ingresa tus nombres.");
      return;
    }
    if (!lastName.trim()) {
      setErr("Ingresa tus apellidos.");
      return;
    }

    const rutRaw = rut.trim();
    if (!rutRaw) {
      setErr("RUT es obligatorio.");
      return;
    }
    const rutCleaned = cleanRut(rutRaw);
    if (!isValidRut(rutCleaned)) {
      setErr("RUT inválido.");
      return;
    }

    setSavingName(true);

    const { error } = await supabaseBrowser.auth.updateUser({
      data: {
        full_name: nameNormalized,
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        rut: rutCleaned,
        address: address.trim() || null,
        phone: phone.trim() || null,
        region: region.trim() || null,
        comuna: comuna.trim() || null,
        city: city.trim() || null,
      },
    });

    setSavingName(false);

    if (error) {
      setErr(error.message);
      return;
    }

    setMsg("✅ Perfil actualizado.");
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
                <label className={styles.label}>Datos personales</label>

                <div className={styles.grid2}>
                  <div className={styles.field}>
                    <label className={styles.label}>Nombres *</label>
                    <input
                      className={styles.input}
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      placeholder="Ej: Claudio Andrés"
                    />
                  </div>

                  <div className={styles.field}>
                    <label className={styles.label}>Apellidos *</label>
                    <input
                      className={styles.input}
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      placeholder="Ej: Lizama"
                    />
                  </div>

                  <div className={styles.field}>
                    <label className={styles.label}>RUT *</label>
                    <input
                      className={styles.input}
                      value={rut}
                      onChange={(e) => setRut(e.target.value)}
                      placeholder="Ej: 12.345.678-9"
                    />
                  </div>

                  <div className={styles.field}>
                    <label className={styles.label}>Teléfono</label>
                    <input
                      className={styles.input}
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="Ej: +56 9 1234 5678"
                    />
                  </div>

                  <div className={styles.fieldWide}>
                    <label className={styles.label}>Dirección</label>
                    <input
                      className={styles.input}
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      placeholder="Ej: Calle / N°"
                    />
                  </div>

                  <div className={styles.field}>
                    <label className={styles.label}>Región</label>
                    <input
                      className={styles.input}
                      value={region}
                      onChange={(e) => setRegion(e.target.value)}
                      placeholder="Ej: Los Lagos"
                    />
                  </div>

                  <div className={styles.field}>
                    <label className={styles.label}>Comuna</label>
                    <input
                      className={styles.input}
                      value={comuna}
                      onChange={(e) => setComuna(e.target.value)}
                      placeholder="Ej: Puerto Montt"
                    />
                  </div>

                  <div className={styles.field}>
                    <label className={styles.label}>Ciudad</label>
                    <input
                      className={styles.input}
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      placeholder="Ej: Puerto Montt"
                    />
                  </div>
                </div>

                <div className={styles.actionsRow}>
                  <button
                    type="button"
                    className={styles.primaryBtn}
                    onClick={saveProfile}
                    disabled={savingName}
                  >
                    {savingName ? "Guardando…" : "Guardar perfil"}
                  </button>

                  <div className={styles.hint}>
                    Se refleja en el saludo del panel.
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