// Complete Supabase invitation and password-recovery links without replacing
// the existing login screen or exposing administrative credentials.
// Shares the forced-password gate so only one password dialog is ever shown.
import { MIN_PASSWORD_LENGTH, changePassword, closeForcedDialog } from "./access-management";

const w = window as any;
const client = w.sb;
let linkType = w.__maintenanceAuthLinkType;
let passwordDialog: HTMLDialogElement | null = null;

function showPasswordSetup(): void {
  if (passwordDialog) return;
  closeForcedDialog();
  w.__maintenanceAuthLinkActive = true;
  w.__maintenanceSuspend?.();
  document.getElementById("login")?.classList.add("hidden");
  const dialog = document.createElement("dialog");
  dialog.setAttribute("data-testid", "dialog-link-password");
  dialog.style.cssText = "max-width:420px;width:calc(100% - 32px);border:1px solid var(--line,#334155);border-radius:18px;background:var(--panel,#101827);color:var(--text,#f8fafc);padding:24px";
  const inputCss = "width:100%;box-sizing:border-box;margin:8px 0 16px;padding:12px;background:var(--panel2);color:var(--text);border:1px solid var(--line);border-radius:12px";
  dialog.innerHTML = `<form id="maintenance-password-form">
    <h2 style="margin-top:0">Definir senha de acesso</h2>
    <p>Escolha uma senha de pelo menos ${MIN_PASSWORD_LENGTH} caracteres para entrar no Sistema de Manutenção.</p>
    <label>Nova senha<input type="password" name="password" minlength="${MIN_PASSWORD_LENGTH}" maxlength="128" required autocomplete="new-password" style="${inputCss}"></label>
    <label>Confirmar senha<input type="password" name="confirm" minlength="${MIN_PASSWORD_LENGTH}" maxlength="128" required autocomplete="new-password" style="${inputCss}"></label>
    <p role="alert" id="maintenance-password-error" style="color:#fca5a5"></p>
    <button type="submit" class="btn primary full">Salvar senha</button>
  </form>`;
  dialog.addEventListener("cancel", (event) => event.preventDefault());
  document.body.append(dialog);
  passwordDialog = dialog;
  dialog.showModal();
  const form = dialog.querySelector("form")!;
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = new FormData(form);
    const password = String(data.get("password") || "");
    const confirmation = String(data.get("confirm") || "");
    const errorElement = dialog.querySelector<HTMLElement>("#maintenance-password-error")!;
    if (password.length < MIN_PASSWORD_LENGTH || password !== confirmation) {
      errorElement.textContent = `As senhas devem ser iguais e ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres.`;
      return;
    }
    const button = form.querySelector("button")!;
    button.disabled = true;
    errorElement.textContent = "";
    try {
      // Server-side change also clears any pending must_change_password flag.
      await changePassword(password);
      form.reset();
      linkType = null;
      w.__maintenanceAuthLinkType = null;
      w.__maintenanceAuthLinkActive = false;
      dialog.close();
      dialog.remove();
      passwordDialog = null;
      if (typeof w.showApp === "function") await w.showApp();
    } catch (error) {
      errorElement.textContent = error instanceof Error ? error.message : String(error);
    } finally {
      button.disabled = false;
    }
  });
}

if (client?.auth) {
  client.auth.onAuthStateChange((event: string, session: any) => {
    if (event === "PASSWORD_RECOVERY" || (session && (linkType === "invite" || linkType === "recovery"))) {
      if (event === "PASSWORD_RECOVERY") w.__maintenanceAuthLinkActive = true;
      window.setTimeout(showPasswordSetup, 0);
    }
  });
  void client.auth.getSession().then(({ data }: any) => {
    if (data.session && (linkType === "invite" || linkType === "recovery")) showPasswordSetup();
  }).catch((error: unknown) => console.error("Não foi possível carregar o link de acesso:", error));
}
