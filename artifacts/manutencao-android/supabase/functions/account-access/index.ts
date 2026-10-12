import { AccessError, actor, checkedPassword, failure, preflight, response } from "../_shared/access.ts";

Deno.serve(async req => {
  const early = preflight(req); if (early) return early;
  try {
    const ctx = await actor(req, false, true);
    const body = await req.json();
    if (body.action === "status") return response({ ok: true, must_change_password: ctx.mustChange });
    if (body.action !== "change_password") throw new AccessError("Ação inválida.", 400);
    const password = checkedPassword(body.password);
    // GoTrue enforces password hashing, reuse protection and session ownership.
    // The database trigger clears the flag only after the hash actually changes.
    const changed = await fetch(`${Deno.env.get("SUPABASE_URL")}/auth/v1/user`, {
      method: "PUT",
      headers: { apikey: Deno.env.get("SUPABASE_ANON_KEY")!,
        Authorization: req.headers.get("authorization")!, "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    const result = await changed.json();
    if (!changed.ok) throw new AccessError(result.code === "same_password"
      ? "Escolha uma senha diferente da senha atual." : "Não foi possível alterar a senha. Escolha outra senha ou entre novamente.", 400);
    const { data: required, error: statusError } = await ctx.admin.rpc("maintenance_account_status", { p_user_id: ctx.user.id });
    if (statusError || required) throw new Error("Password change did not complete");
    return response({ ok: true, must_change_password: false });
  } catch (error) { return failure(error); }
});
