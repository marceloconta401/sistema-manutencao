// Complete Supabase invitation and password-recovery links without replacing
// the existing login screen or exposing administrative credentials.
const client = (window as any).sb;
let linkType = (window as any).__maintenanceAuthLinkType;
let passwordDialog: HTMLDialogElement | null = null;

function showPasswordSetup(): void {
  if (passwordDialog) return;
  const dialog = document.createElement("dialog");
  dialog.style.cssText = "max-width:420px;width:calc(100% - 32px);border:1px solid #334155;border-radius:18px;background:#101827;color:#f8fafc;padding:24px";
  dialog.innerHTML = `<form id="maintenance-password-form">
    <h2 style="margin-top:0">Definir senha de acesso</h2>
    <p>Escolha uma senha de pelo menos 8 caracteres para entrar no Sistema de Manutenção.</p>
    <label>Nova senha<input type="password" name="password" minlength="8" required autocomplete="new-password" style="width:100%;box-sizing:border-box;margin:8px 0 16px;padding:12px"></label>
    <label>Confirmar senha<input type="password" name="confirm" minlength="8" required autocomplete="new-password" style="width:100%;box-sizing:border-box;margin:8px 0 16px;padding:12px"></label>
    <p role="alert" id="maintenance-password-error" style="color:#fca5a5"></p>
    <button type="submit" style="width:100%;padding:13px;border:0;border-radius:10px;background:#2563eb;color:white;font-weight:bold">Salvar senha</button>
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
    if (password.length < 8 || password !== confirmation) {
      errorElement.textContent = "As senhas devem ser iguais e ter pelo menos 8 caracteres.";
      return;
    }
    const button = form.querySelector("button")!;
    button.disabled = true;
    errorElement.textContent = "";
    try {
      const { error } = await client.auth.updateUser({ password });
      if (error) throw error;
      linkType = null;
      (window as any).__maintenanceAuthLinkType = null;
      dialog.close();
      dialog.remove();
      passwordDialog = null;
      if (typeof (window as any).showApp === "function") await (window as any).showApp();
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
      window.setTimeout(showPasswordSetup, 0);
    }
  });
  void client.auth.getSession().then(({ data }: any) => {
    if (data.session && (linkType === "invite" || linkType === "recovery")) showPasswordSetup();
  }).catch((error: unknown) => console.error("Não foi possível carregar o link de acesso:", error));
}
