import { createClient } from "npm:@supabase/supabase-js@2";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, x-client-info, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
export function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}
export function preflight(req: Request) {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return response({ ok: false, error: "Método não permitido." }, 405);
}
export function clients(authorization = "") {
  const url = Deno.env.get("SUPABASE_URL")!;
  const key = Deno.env.get("SUPABASE_ANON_KEY")!;
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  if (!url || !key || !service) throw new Error("Configuração Supabase incompleta.");
  const options = { auth: { persistSession: false, autoRefreshToken: false } };
  return {
    admin: createClient(url, service, options),
    caller: createClient(url, key, { ...options, global: { headers: { Authorization: authorization } } }),
    publicClient: createClient(url, key, options),
  };
}
export async function actor(req: Request, requireAdmin = false, allowFirstAccess = false) {
  const authorization = req.headers.get("authorization") || "";
  const token = authorization.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) throw new AccessError("Entre no sistema.", 401);
  const ctx = clients(authorization);
  const { data, error } = await ctx.caller.auth.getUser(token);
  if (error || !data.user) throw new AccessError("Sessão inválida ou expirada.", 401);
  const { data: profile, error: profileError } = await ctx.admin.from("profiles")
    .select("id,organization_id,role,active,sector_id").eq("id", data.user.id).maybeSingle();
  if (profileError) throw new Error("Não foi possível verificar o perfil.");
  if (!profile?.active) throw new AccessError("Usuário inativo ou sem perfil autorizado.", 403);
  if (requireAdmin && profile.role !== "admin") throw new AccessError("Acesso exclusivo do administrador.", 403);
  const { data: mustChange, error: statusError } = await ctx.admin.rpc("maintenance_account_status", { p_user_id: data.user.id });
  if (statusError) throw new Error("Não foi possível verificar o primeiro acesso.");
  if (mustChange && !allowFirstAccess) throw new AccessError("Troque a senha antes de continuar.", 403);
  return { ...ctx, user: data.user, profile, mustChange: Boolean(mustChange) };
}
export class AccessError extends Error {
  constructor(message: string, public status: number) { super(message); }
}
export function failure(error: unknown) {
  if (error instanceof AccessError) return response({ ok: false, error: error.message }, error.status);
  // Do not log request bodies, passwords, tokens, Auth user records or SQL.
  console.error("Maintenance access operation failed.");
  return response({ ok: false, error: "Não foi possível concluir a operação. Tente novamente." }, 500);
}
export function normalizedLogin(value: unknown) {
  const login = String(value || "").trim().toLowerCase();
  if (!/^[a-z0-9._-]{3,40}$/.test(login)) throw new AccessError("Use um login de 3 a 40 caracteres: letras, números, ponto, hífen ou sublinhado.", 400);
  return login;
}
export function checkedPassword(value: unknown) {
  if (typeof value !== "string" || value.length < 6 || value.length > 128)
    throw new AccessError("A senha deve ter entre 6 e 128 caracteres.", 400);
  return value;
}
export async function digest(value: string) {
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(hash), x => x.toString(16).padStart(2, "0")).join("");
}
