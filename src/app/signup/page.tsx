"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/browser";

export default function SignupPage() {
  const router = useRouter();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setMsg(null);

    if (!fullName.trim()) return setErr("Ingresa tu nombre.");
    if (!email.trim()) return setErr("Ingresa tu email.");
    if (password.length < 6) return setErr("La contraseña debe tener al menos 6 caracteres.");

    setLoading(true);

    const { data, error } = await supabaseBrowser.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: { full_name: fullName.trim() }, // ✅ guardado en user_metadata
      },
    });

    setLoading(false);

    if (error) {
      setErr(error.message);
      return;
    }

    // Si tu proyecto exige confirmación por correo, no habrá session.
    if (!data.session) {
      setMsg("✅ Cuenta creada. Revisa tu correo para confirmar el registro.");
      return;
    }

    setMsg("✅ Cuenta creada. Entrando al panel…");
    router.replace("/app");
  }

  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 18, background: "#f6fafc" }}>
      <div style={{ width: "min(460px, 100%)", background: "#fff", border: "1px solid rgba(0,0,0,.10)", borderRadius: 16, padding: 18 }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 900 }}>Crear cuenta</h1>
        <p style={{ marginTop: 6, opacity: 0.75 }}>Regístrate para administrar tus empresas y charlas.</p>

        {err && <div style={{ marginTop: 10, padding: 10, borderRadius: 12, background: "#fff1f1", border: "1px solid #ffd0d0", color: "#9b1c1c", fontWeight: 800 }}>{err}</div>}
        {msg && <div style={{ marginTop: 10, padding: 10, borderRadius: 12, background: "rgba(29,191,115,.12)", border: "1px solid rgba(29,191,115,.25)", fontWeight: 800 }}>{msg}</div>}

        <form onSubmit={submit} style={{ marginTop: 12, display: "grid", gap: 10 }}>
          <div style={{ display: "grid", gap: 6 }}>
            <label style={{ fontSize: 12, fontWeight: 900, opacity: 0.8 }}>Nombre completo</label>
            <input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Ej: Claudio Lizama"
              style={{ border: "1px solid rgba(0,0,0,.15)", borderRadius: 12, padding: "10px 12px" }}
            />
          </div>

          <div style={{ display: "grid", gap: 6 }}>
            <label style={{ fontSize: 12, fontWeight: 900, opacity: 0.8 }}>Email</label>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="correo@empresa.cl"
              style={{ border: "1px solid rgba(0,0,0,.15)", borderRadius: 12, padding: "10px 12px" }}
            />
          </div>

          <div style={{ display: "grid", gap: 6 }}>
            <label style={{ fontSize: 12, fontWeight: 900, opacity: 0.8 }}>Contraseña</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="mínimo 6 caracteres"
              style={{ border: "1px solid rgba(0,0,0,.15)", borderRadius: 12, padding: "10px 12px" }}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              marginTop: 6,
              border: "none",
              borderRadius: 12,
              padding: "12px 14px",
              fontWeight: 950,
              cursor: "pointer",
              background: "linear-gradient(180deg, #34d399, #10b981)",
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? "Creando…" : "Crear cuenta"}
          </button>

          <button
            type="button"
            onClick={() => router.push("/login")}
            style={{ border: "1px solid rgba(0,0,0,.12)", borderRadius: 12, padding: "10px 12px", background: "#fff", fontWeight: 900, cursor: "pointer" }}
          >
            Ya tengo cuenta → Ingresar
          </button>
        </form>
      </div>
    </div>
  );
}