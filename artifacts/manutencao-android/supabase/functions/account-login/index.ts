import { AccessError, clients, digest, failure, preflight, response } from "../_shared/access.ts";

Deno.serve(async req => {
  const early = preflight(req); if (early) return early;
  try {
    const body = await req.json();
    const login = String(body.login || "").trim().toLowerCase();
    const password = body.password;
    if (!login || login.length > 254 || typeof password !== "string" || password.length > 128)
      throw new AccessError("Login ou senha inválidos.", 401);
    const { admin, publicClient } = clients();
    const ip = (req.headers.get("x-forwarded-for") || "unknown").split(",")[0].trim();
    for (const [key, max] of [[await digest("ip:" + ip), 60], [await digest("login:" + login + ":" + ip), 8]] as const) {
      const { data, error } = await admin.rpc("maintenance_login_limit", { p_key: key, p_max: max });
      if (error) throw new Error("Login rate limit unavailable");
      if (!data) throw new AccessError("Muitas tentativas. Aguarde 15 minutos e tente novamente.", 429);
    }
    let email = login;
    if (!login.includes("@")) {
      const { data, error } = await admin.rpc("maintenance_account_lookup", { p_login: login });
      if (error) throw new Error("Login lookup unavailable");
      email = data?.auth_email || "unknown-account@login.sistemamanutencao.invalid";
    }
    const { data, error } = await publicClient.auth.signInWithPassword({ email, password });
    if (error || !data.user || !data.session) throw new AccessError("Login ou senha inválidos.", 401);
    const { data: profile, error: profileError } = await admin.from("profiles").select("active")
      .eq("id", data.user.id).maybeSingle();
    if (profileError) throw new Error("Profile lookup unavailable");
    if (!profile?.active) throw new AccessError("Login ou senha inválidos.", 401);
    return response({ ok: true, session: { access_token: data.session.access_token, refresh_token: data.session.refresh_token } });
  } catch (error) { return failure(error); }
});
