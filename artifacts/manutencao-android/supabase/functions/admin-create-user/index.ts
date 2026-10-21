import { actor as authorizedActor, checkedPassword, digest, failure, normalizedLogin, preflight, response } from "../_shared/access.ts";

Deno.serve(async (req) => {
  const early = preflight(req); if (early) return early;

  try {
    const { admin, profile: actor } = await authorizedActor(req, true);

    const body = await req.json().catch(() => null) as Record<string, unknown> | null;
    const fullName = typeof body?.full_name === "string" ? body.full_name.trim() : "";
    const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
    const role = typeof body?.role === "string" ? body.role : "";
    const sectorId = typeof body?.sector_id === "string" ? body.sector_id : null;
    const localAccess = Boolean(body?.login) || body?.mode === "local";
    if (!fullName || fullName.length > 120) {
      return response({ ok: false, error: "Informe um nome de até 120 caracteres." }, 400);
    }
    if (!localAccess && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return response({ ok: false, error: "Informe o e-mail para o convite opcional." }, 400);
    }
    if (!["admin", "mechanic", "sector"].includes(role)) {
      return response({ ok: false, error: "Unsupported user role" }, 400);
    }
    if (role === "sector" && !sectorId) {
      return response({ ok: false, error: "A sector is required for sector users" }, 400);
    }
    if (role !== "sector" && sectorId) {
      return response({ ok: false, error: "Only sector users may be linked to a sector" }, 400);
    }
    if (sectorId) {
      const { data: sector, error } = await admin
        .from("sectors")
        .select("id")
        .eq("id", sectorId)
        .eq("organization_id", actor.organization_id)
        .eq("active", true)
        .maybeSingle();
      if (error) throw error;
      if (!sector) return response({ ok: false, error: "The selected sector is not in your organization" }, 400);
    }

    if (localAccess) {
      const login = normalizedLogin(body?.login);
      const password = checkedPassword(body?.password);
      // Internal Auth identifier only. No mailbox, SMTP or confirmation is
      // required; the human-facing identifier is always the login.
      const authEmail = `${await digest(login)}@login.sistemamanutencao.invalid`;
      const { data: created, error: createError } = await admin.auth.admin.createUser({
        email: authEmail, password, email_confirm: true, user_metadata: { full_name: fullName },
      });
      if (createError || !created.user) return response({ ok: false,
        error: "Não foi possível cadastrar. O login pode já estar em uso ou a senha não foi aceita." }, 409);
      const { error: setupError } = await admin.rpc("maintenance_account_create", {
        p_user_id: created.user.id, p_org: actor.organization_id, p_name: fullName,
        p_login: login, p_email: authEmail, p_role: role, p_sector: sectorId,
      });
      if (setupError) {
        const { error: rollbackError } = await admin.auth.admin.deleteUser(created.user.id);
        if (rollbackError) console.error("Account creation rollback needs attention.");
        return response({ ok: false, error: "Não foi possível cadastrar. Confira o login e o setor." }, 409);
      }
      return response({ ok: true, user_id: created.user.id, login, must_change_password: true });
    }

    const { data: invitation, error: invitationError } = await admin.auth.admin
      .inviteUserByEmail(email, { data: { full_name: fullName } });
    if (invitationError) throw invitationError;
    const invitedUserId = invitation.user?.id;
    if (!invitedUserId) throw new Error("Supabase did not return the invited user ID.");

    const { error: profileError } = await admin.from("profiles").insert({
      id: invitedUserId,
      full_name: fullName,
      role,
      active: true,
      organization_id: actor.organization_id,
      sector_id: role === "sector" ? sectorId : null,
    });
    if (profileError) {
      const { error: rollbackError } = await admin.auth.admin.deleteUser(invitedUserId);
      if (rollbackError) console.error("Could not remove the invited auth user after profile creation failed.");
      throw profileError;
    }

    return response({ ok: true, user_id: invitedUserId, email });
  } catch (error) {
    return failure(error);
  }
});
