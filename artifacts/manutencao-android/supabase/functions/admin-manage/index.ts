import { AccessError, actor, failure, preflight, response } from "../_shared/access.ts";

Deno.serve(async req => {
  const early = preflight(req); if (early) return early;
  try {
    const ctx = await actor(req, true);
    const { entity, id, action } = await req.json();
    if (!["users", "sectors", "equipment"].includes(entity) ||
        !["delete", "deactivate", "reactivate"].includes(action) ||
        typeof id !== "string" || !/^[0-9a-f-]{36}$/i.test(id))
      throw new AccessError("Cadastro ou ação inválidos.", 400);
    const { data, error } = await ctx.caller.rpc("maintenance_manage", { p_entity: entity, p_id: id, p_action: action });
    if (error) throw new AccessError(error.message || "Operação não permitida.", 403);
    if (!data?.ok) return response(data, 409);
    if (data.auth_delete) {
      const { error: removeError } = await ctx.admin.auth.admin.deleteUser(id);
      if (removeError) return response({ ok: false, can_deactivate: true,
        error: "Não foi possível excluir o usuário. Ele pode ter vínculos; desative para preservar os registros." }, 409);
    }
    return response({ ok: true, entity, id, action });
  } catch (error) { return failure(error); }
});
