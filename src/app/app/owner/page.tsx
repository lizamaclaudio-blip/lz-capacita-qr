"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/browser";
import styles from "./page.module.css";

type LookupResult = {
  user: {
    id: string;
    email: string;
    created_at: string;
    last_sign_in_at: string | null;
    banned_until: string | null;
    user_metadata: Record<string, any>;
  };
  stats: { companies: number; sessions: number; attendees: number };
};

type AuditRow = {
  id: string;
  created_at: string;
  action: string;
  target_email: string | null;
  target_user_id: string | null;
  status: number | null;
  request_ip: string | null;
};

async function getToken() {
  const { data } = await supabaseBrowser.auth.getSession();
  return data.session?.access_token ?? null;
}

export default function OwnerPage() {
  const router = useRouter();

  const [meEmail, setMeEmail] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const [targetEmail, setTargetEmail] = useState("");
  const [result, setResult] = useState<LookupResult | null>(null);

  const [newPassword, setNewPassword] = useState("");
  const [banHours, setBanHours] = useState<number>(24 * 365 * 10);

  // delete confirm
  const [confirmWord, setConfirmWord] = useState("");
  const [confirmCode, setConfirmCode] = useState("");
  const [codeInfo, setCodeInfo] = useState<string | null>(null);

  const canDelete = useMemo(() => confirmWord.trim().toUpperCase() === "DELETE", [confirmWord]);
  const canExecuteDelete = useMemo(() => canDelete && confirmCode.trim().length >= 4, [canDelete, confirmCode]);

  const [audit, setAudit] = useState<AuditRow[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabaseBrowser.auth.getUser();
      setMeEmail(data.user?.email ?? null);
    })();
  }, []);

  async function apiPost<T>(url: string, body: any): Promise<T> {
    const token = await getToken();
    if (!token) {
      router.replace("/login?e=" + encodeURIComponent("Sesión expirada. Vuelve a ingresar."));
      throw new Error("No session");
    }

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
      cache: "no-store",
    });

    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error((json as any)?.error || `HTTP ${res.status}`);
    return json as T;
  }

  async function apiGet<T>(url: string): Promise<T> {
    const token = await getToken();
    if (!token) {
      router.replace("/login?e=" + encodeURIComponent("Sesión expirada. Vuelve a ingresar."));
      throw new Error("No session");
    }

    const res = await fetch(url, {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });

    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error((json as any)?.error || `HTTP ${res.status}`);
    return json as T;
  }

  async function lookup() {
    setErr(null);
    setOk(null);
    setResult(null);
    setCodeInfo(null);
    setConfirmWord("");
    setConfirmCode("");

    try {
      const data = await apiPost<LookupResult>("/api/owner/user/lookup", { email: targetEmail.trim() });
      setResult(data);
      setOk("Usuario cargado ✅");
      setTimeout(() => setOk(null), 1400);
      await loadAudit();
    } catch (e: any) {
      setErr(e?.message || "Error");
    }
  }

  async function ban() {
    if (!result?.user?.id) return;
    setErr(null);
    setOk(null);

    try {
      await apiPost("/api/owner/user/ban", { user_id: result.user.id, hours: banHours });
      setOk("Usuario baneado ✅");
      await lookup();
    } catch (e: any) {
      setErr(e?.message || "Error");
    }
  }

  async function unban() {
    if (!result?.user?.id) return;
    setErr(null);
    setOk(null);

    try {
      await apiPost("/api/owner/user/unban", { user_id: result.user.id });
      setOk("Usuario desbaneado ✅");
      await lookup();
    } catch (e: any) {
      setErr(e?.message || "Error");
    }
  }

  async function setPassword() {
    if (!result?.user?.id) return;
    setErr(null);
    setOk(null);

    if (!newPassword || newPassword.length < 6) {
      setErr("Password debe tener mínimo 6 caracteres.");
      return;
    }

    try {
      await apiPost("/api/owner/user/password", { user_id: result.user.id, password: newPassword });
      setNewPassword("");
      setOk("Password actualizado ✅");
      await loadAudit();
    } catch (e: any) {
      setErr(e?.message || "Error");
    }
  }

  async function impersonate() {
    setErr(null);
    setOk(null);

    try {
      const r = await apiPost<{ ok: boolean; action_link: string | null }>(
        "/api/owner/user/impersonate",
        { email: targetEmail.trim() }
      );

      if (!r.action_link) {
        setErr("No recibí link de impersonate.");
        return;
      }

      window.open(r.action_link, "_blank", "noopener,noreferrer");
      setOk("Magic link generado (se abrió en otra pestaña) ✅");
      await loadAudit();
    } catch (e: any) {
      setErr(e?.message || "Error");
    }
  }

  async function dryRunDelete() {
    if (!result?.user?.id) return;
    setErr(null);
    setOk(null);

    try {
      const r = await apiPost<any>("/api/owner/user/delete", { user_id: result.user.id, mode: "dry_run" });
      setOk(`Dry-run OK ✅ (companies:${r.summary.companies}, sessions:${r.summary.sessions}, attendees:${r.summary.attendees})`);
      await loadAudit();
    } catch (e: any) {
      setErr(e?.message || "Error");
    }
  }

  async function requestDeleteCode() {
    if (!result?.user?.id) return;
    setErr(null);
    setOk(null);
    setCodeInfo(null);
    setConfirmCode("");

    try {
      const r = await apiPost<{ ok: boolean; emailed: boolean; expires_at: string; code: string | null }>(
        "/api/owner/user/delete-request",
        { user_id: result.user.id, target_email: result.user.email }
      );

      if (r.emailed) {
        setCodeInfo(`📩 Código enviado a tu email. Expira: ${new Date(r.expires_at).toLocaleString("es-CL")}`);
      } else {
        setCodeInfo(`⚠️ Email no configurado. Código (fallback): ${r.code} · expira: ${new Date(r.expires_at).toLocaleString("es-CL")}`);
      }

      setOk("Código generado ✅");
      await loadAudit();
    } catch (e: any) {
      setErr(e?.message || "Error");
    }
  }

  async function deleteUserAndData() {
    if (!result?.user?.id) return;

    if (!canDelete) {
      setErr('Escribe "DELETE" para habilitar borrado.');
      return;
    }
    if (!confirmCode.trim()) {
      setErr("Falta confirmation code.");
      return;
    }

    setErr(null);
    setOk(null);

    try {
      const r = await apiPost<any>("/api/owner/user/delete", {
        user_id: result.user.id,
        mode: "delete",
        confirmation_code: confirmCode.trim(),
      });

      setOk(`Eliminado ✅ (companies:${r.summary.companies}, sessions:${r.summary.sessions}, attendees:${r.summary.attendees})`);
      setResult(null);
      setTargetEmail("");
      setConfirmWord("");
      setConfirmCode("");
      setCodeInfo(null);
      await loadAudit();
    } catch (e: any) {
      setErr(e?.message || "Error");
    }
  }

  async function loadAudit() {
    setAuditLoading(true);
    try {
      const r = await apiGet<{ ok: boolean; logs: AuditRow[] }>("/api/owner/audit/recent");
      setAudit(Array.isArray(r.logs) ? r.logs : []);
    } catch {
      // no bloquee UI
    } finally {
      setAuditLoading(false);
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.head}>
        <div>
          <div className={styles.kicker}>Owner</div>
          <h1 className={styles.h1}>Owner Console</h1>
          <p className={styles.sub}>
            Solo para {meEmail || "owner"}. Todo queda auditado y el borrado requiere código.
          </p>
        </div>

        <div className={styles.headActions}>
          <button className="btn btnGhost" type="button" onClick={() => router.push("/app")}>
            ← Volver al Dashboard
          </button>
        </div>
      </div>

      {err ? <div className={styles.errBox}>{err}</div> : null}
      {ok ? <div className={styles.okBox}>{ok}</div> : null}

      <div className={styles.grid}>
        <section className={styles.card}>
          <div className={styles.cardTitle}>Buscar usuario</div>
          <div className={styles.row}>
            <input
              className="input"
              placeholder="email del usuario (ej: usuario@correo.com)"
              value={targetEmail}
              onChange={(e) => setTargetEmail(e.target.value)}
            />
            <button className="btn btnPrimary" type="button" onClick={lookup}>
              Buscar
            </button>
          </div>

          {result ? (
            <div className={styles.userBox}>
              <div className={styles.userLine}><b>ID:</b> {result.user.id}</div>
              <div className={styles.userLine}><b>Email:</b> {result.user.email}</div>
              <div className={styles.userLine}><b>Creado:</b> {result.user.created_at}</div>
              <div className={styles.userLine}><b>Último login:</b> {result.user.last_sign_in_at || "—"}</div>
              <div className={styles.userLine}><b>Banned until:</b> {result.user.banned_until || "—"}</div>

              <div className={styles.stats}>
                <div className={styles.stat}><div className={styles.statLabel}>Companies</div><div className={styles.statVal}>{result.stats.companies}</div></div>
                <div className={styles.stat}><div className={styles.statLabel}>Sessions</div><div className={styles.statVal}>{result.stats.sessions}</div></div>
                <div className={styles.stat}><div className={styles.statLabel}>Attendees</div><div className={styles.statVal}>{result.stats.attendees}</div></div>
              </div>
            </div>
          ) : (
            <div className={styles.hint}>Ingresa un email y presiona “Buscar”.</div>
          )}
        </section>

        <section className={styles.card}>
          <div className={styles.cardTitle}>Acciones</div>

          <div className={styles.actions}>
            <button className="btn btnGhost" type="button" onClick={impersonate} disabled={!targetEmail.trim()}>
              🔑 Impersonate (magic link)
            </button>
          </div>

          <div className={styles.sep} />

          <div className={styles.row2}>
            <div className={styles.field}>
              <div className={styles.label}>Ban hours</div>
              <input
                className="input"
                type="number"
                value={banHours}
                onChange={(e) => setBanHours(Number(e.target.value))}
                min={1}
              />
            </div>

            <div className={styles.actionsInline}>
              <button className="btn btnGhost" type="button" onClick={ban} disabled={!result?.user?.id}>
                ⛔ Ban
              </button>
              <button className="btn btnGhost" type="button" onClick={unban} disabled={!result?.user?.id}>
                ✅ Unban
              </button>
            </div>
          </div>

          <div className={styles.sep} />

          <div className={styles.row2}>
            <div className={styles.field}>
              <div className={styles.label}>Set password</div>
              <input
                className="input"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="mínimo 6 caracteres"
              />
            </div>
            <div className={styles.actionsInline}>
              <button className="btn btnPrimary" type="button" onClick={setPassword} disabled={!result?.user?.id}>
                Guardar
              </button>
            </div>
          </div>

          <div className={styles.sep} />

          <div className={styles.danger}>
            <div className={styles.dangerTitle}>Danger zone (con confirmación)</div>
            <div className={styles.dangerText}>
              Flujo recomendado: <b>Dry-run → Request code → escribir DELETE + código → borrar</b>.
            </div>

            <div className={styles.actions}>
              <button className="btn btnGhost" type="button" onClick={dryRunDelete} disabled={!result?.user?.id}>
                🧪 Dry-run
              </button>

              <button className="btn btnGhost" type="button" onClick={requestDeleteCode} disabled={!result?.user?.id}>
                🔐 Request code
              </button>
            </div>

            {codeInfo ? <div className={styles.hint}>{codeInfo}</div> : null}

            <div className={styles.row}>
              <input
                className="input"
                placeholder='Escribe DELETE'
                value={confirmWord}
                onChange={(e) => setConfirmWord(e.target.value)}
              />
              <input
                className="input"
                placeholder="Código (6 dígitos)"
                value={confirmCode}
                onChange={(e) => setConfirmCode(e.target.value)}
              />
            </div>

            <div className={styles.actions}>
              <button
                className="btn btnCta"
                type="button"
                onClick={deleteUserAndData}
                disabled={!result?.user?.id || !canExecuteDelete}
              >
                🧨 Borrar usuario y datos
              </button>
            </div>
          </div>
        </section>
      </div>

      <section className={styles.card}>
        <div className={styles.cardTitle}>Auditoría reciente</div>
        <div className={styles.hint}>
          {auditLoading ? "Cargando…" : "Últimas 30 acciones (owner)."}
        </div>

        <div className={styles.auditList}>
          {(audit || []).map((a) => (
            <div key={a.id} className={styles.auditRow}>
              <div className={styles.auditMain}>
                <div className={styles.auditAction}>{a.action}</div>
                <div className={styles.auditMeta}>
                  {new Date(a.created_at).toLocaleString("es-CL")} · {a.target_email || a.target_user_id || "—"} · {a.request_ip || "—"}
                </div>
              </div>
              <div className={styles.auditStatus}>{a.status ?? "—"}</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}