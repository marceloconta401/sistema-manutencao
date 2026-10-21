// Access gate for the maintenance system: compulsory first-password change,
// admin entity management helpers and low-cost session freshness checks.
// Relies on the global `sb` client and on the inline context bridge
// (window.__maintenanceContext / __maintenanceSuspend / __maintenanceLock).

import { App } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";

type AnyWin = Window & Record<string, any>;
const w = window as unknown as AnyWin;
const client = () => w.sb;

export const MIN_PASSWORD_LENGTH = 6;

export type FunctionFailure = { status: number | null; body: any; message: string };

export async function readFunctionError(error: any, fallback = "Falha na operação."): Promise<FunctionFailure> {
  let status: number | null = null;
  let body: any = null;
  const ctx = error?.context;
  if (ctx) {
    status = typeof ctx.status === "number" ? ctx.status : null;
    try {
      const source = typeof ctx.clone === "function" ? ctx.clone() : ctx;
      if (typeof source.json === "function") body = await source.json();
    } catch {
      body = null;
    }
  }
  const message = (body && (body.error || body.message)) || error?.message || fallback;
  return { status, body, message: String(message) };
}

async function invoke(name: string, body: Record<string, unknown>) {
  const { data, error } = await client().functions.invoke(name, { body });
  if (error) {
    const failure = await readFunctionError(error);
    const err: any = new Error(failure.message);
    err.status = failure.status;
    err.body = failure.body;
    throw err;
  }
  if (data && data.ok === false) {
    const err: any = new Error(data.error || "O servidor recusou a operação.");
    err.body = data;
    throw err;
  }
  return data;
}

export async function getAccessStatus(): Promise<{ must_change_password: boolean }> {
  const data = await invoke("account-access", { action: "status" });
  if (!data || data.ok !== true || typeof data.must_change_password !== "boolean") {
    throw new Error("Resposta de acesso inválida.");
  }
  return { must_change_password: data.must_change_password };
}

export async function changePassword(password: string): Promise<void> {
  const data = await invoke("account-access", { action: "change_password", password });
  if (!data || data.ok !== true) throw new Error("O servidor não confirmou a nova senha.");
}

export async function manageEntity(entity: "users" | "sectors" | "equipment", id: string, action: "delete" | "deactivate" | "reactivate") {
  return invoke("admin-manage", { entity, id, action });
}

// ---------- Forced password dialog ----------
let forcedDialog: HTMLDialogElement | null = null;

export function closeForcedDialog(): void {
  if (!forcedDialog) return;
  try { forcedDialog.close(); } catch { /* noop */ }
  forcedDialog.remove();
  forcedDialog = null;
}

function authLinkPending(): boolean {
  const t = w.__maintenanceAuthLinkType;
  return Boolean(w.__maintenanceAuthLinkActive) || t === "invite" || t === "recovery";
}

const dialogCss = "max-width:440px;width:calc(100% - 32px);border:1px solid var(--line);border-radius:18px;background:var(--panel);color:var(--text);padding:22px;box-shadow:var(--shadow)";
const inputCss = "width:100%;box-sizing:border-box;margin:7px 0 14px;padding:13px;background:var(--panel2);color:var(--text);border:1px solid var(--line);border-radius:12px";

function showForcedDialog(): void {
  if (forcedDialog || authLinkPending()) return;
  const dialog = document.createElement("dialog");
  dialog.setAttribute("data-testid", "dialog-force-password");
  dialog.style.cssText = dialogCss;
  dialog.innerHTML = `<form>
    <h2 style="margin-top:0">Troque sua senha</h2>
    <p class="small">Este é seu primeiro acesso com uma senha temporária. Defina uma senha pessoal com pelo menos ${MIN_PASSWORD_LENGTH} caracteres para continuar.</p>
    <label style="font-weight:750">Nova senha<input type="password" name="password" minlength="${MIN_PASSWORD_LENGTH}" maxlength="128" required autocomplete="new-password" data-testid="input-new-password" style="${inputCss}"></label>
    <label style="font-weight:750">Confirmar nova senha<input type="password" name="confirm" minlength="${MIN_PASSWORD_LENGTH}" maxlength="128" required autocomplete="new-password" data-testid="input-confirm-password" style="${inputCss}"></label>
    <div role="alert" class="notice error hidden" data-msg></div>
    <button type="submit" class="btn primary full" data-testid="button-save-password">Salvar nova senha</button>
    <button type="button" class="btn secondary full" data-logout data-testid="button-force-logout" style="margin-top:8px">Sair</button>
  </form>`;
  dialog.addEventListener("cancel", (e) => e.preventDefault());
  document.body.append(dialog);
  forcedDialog = dialog;
  dialog.showModal();
  const form = dialog.querySelector("form")!;
  const msg = dialog.querySelector<HTMLElement>("[data-msg]")!;
  const show = (t: string) => { msg.textContent = t; msg.classList.remove("hidden"); };
  dialog.querySelector<HTMLButtonElement>("[data-logout]")!.onclick = () => {
    closeForcedDialog();
    const btn = document.getElementById("logoutBtn") as HTMLButtonElement | null;
    if (btn) btn.click();
    else void client()?.auth.signOut().then(() => location.reload());
  };
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const fd = new FormData(form);
    const password = String(fd.get("password") || "");
    const confirmation = String(fd.get("confirm") || "");
    if (password.length < MIN_PASSWORD_LENGTH) return show(`A senha deve ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres.`);
    if (password !== confirmation) return show("As senhas não conferem.");
    const button = form.querySelector<HTMLButtonElement>("button[type=submit]")!;
    button.disabled = true;
    button.textContent = "Salvando...";
    msg.classList.add("hidden");
    try {
      await changePassword(password);
      form.reset();
      closeForcedDialog();
      if (typeof w.showApp === "function") await w.showApp();
    } catch (e: any) {
      show("Não foi possível salvar a senha: " + (e?.message || "tente novamente."));
    } finally {
      button.disabled = false;
      button.textContent = "Salvar nova senha";
    }
  });
}

function suspendApp(): void {
  if (typeof w.__maintenanceSuspend === "function") w.__maintenanceSuspend();
  else document.getElementById("app")?.classList.add("hidden");
}

/** Gate before profile/data loads. Returns true only if the app may open. */
export async function ensureReady(): Promise<boolean> {
  if (authLinkPending()) { suspendApp(); return false; }
  let status;
  try {
    status = await getAccessStatus();
  } catch {
    suspendApp();
    if (typeof w.__maintenanceLock === "function") {
      w.__maintenanceLock("Não foi possível verificar seu acesso. Verifique a conexão e entre novamente.", false);
    }
    return false;
  }
  if (status.must_change_password) {
    suspendApp();
    document.getElementById("login")?.classList.add("hidden");
    showForcedDialog();
    return false;
  }
  closeForcedDialog();
  return true;
}

// ---------- Freshness: deactivated users / pending password ----------
let checking = false;
let lastCatalogRefresh = 0;
let pausedUi: { app: boolean; modal: boolean } | null = null;
function pauseVisibleData(): void {
  const ctx = w.__maintenanceContext?.();
  if (!ctx?.session || !ctx?.profile || forcedDialog) return;
  const app = document.getElementById("app");
  const modal = document.getElementById("modal");
  if (!pausedUi) pausedUi = {
    app: !!app && !app.classList.contains("hidden"),
    modal: !!modal && !modal.classList.contains("hidden"),
  };
  app?.classList.add("hidden");
  modal?.classList.add("hidden");
  document.getElementById("notifyPanel")?.classList.add("hidden");
}
async function freshnessCheck(force = false): Promise<void> {
  const ctx = typeof w.__maintenanceContext === "function" ? w.__maintenanceContext() : null;
  if (!ctx?.session || !ctx?.profile || checking || forcedDialog) return;
  if (!force && document.visibilityState !== "visible") return;
  checking = true;
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    // The server validates the JWT and active profile; RLS remains the
    // authority for data. A resume never exposes cached data before this check.
    const status = await Promise.race([
      getAccessStatus(),
      new Promise<never>((_, reject) => {
        timeout = setTimeout(() => reject(new Error("A verificação de acesso demorou demais.")), 15000);
      }),
    ]);
    if (w.__maintenanceContext?.()?.session?.user?.id !== ctx.session.user.id) return;
    if (status.must_change_password) {
      pausedUi = null;
      await ensureReady();
    } else {
      if (pausedUi?.app) document.getElementById("app")?.classList.remove("hidden");
      if (pausedUi?.modal) document.getElementById("modal")?.classList.remove("hidden");
      pausedUi = null;
      if (force || Date.now() - lastCatalogRefresh >= 60000) {
        lastCatalogRefresh = Date.now();
        await w.__maintenanceRefreshCatalogs?.();
      }
    }
  } catch (e: any) {
    if (w.__maintenanceContext?.()?.session?.user?.id !== ctx.session.user.id) return;
    pausedUi = null;
    const revoked = e?.status === 401 || e?.status === 403;
    await w.__maintenanceLock?.(revoked
      ? "Seu acesso foi revogado ou a sessão expirou. Procure o administrador."
      : "Não foi possível verificar seu acesso. Confira a conexão e entre novamente.", revoked);
  } finally {
    if (timeout) clearTimeout(timeout);
    checking = false;
  }
}
function resumeAccess(): void { pauseVisibleData(); void freshnessCheck(true); }
window.addEventListener("maintenance-access-locked", () => { pausedUi = null; });
window.setInterval(() => { void freshnessCheck(); }, 5000);
window.addEventListener("focus", resumeAccess);
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") resumeAccess();
  else pauseVisibleData();
});
if (Capacitor.isNativePlatform()) {
  void App.addListener("appStateChange", ({ isActive }) => {
    if (isActive) resumeAccess();
    else pauseVisibleData();
  });
}

w.maintenanceAccess = { ensureReady, manageEntity, readFunctionError, changePassword, closeForcedDialog, MIN_PASSWORD_LENGTH };
window.dispatchEvent(new Event("maintenance-access-ready"));
