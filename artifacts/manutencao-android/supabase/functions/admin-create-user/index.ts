import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, x-client-info, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return response({ ok: false, error: "Method not allowed" }, 405);

  try {
    const authorization = req.headers.get("authorization") || "";
    const token = authorization.match(/^Bearer\s+(.+)$/i)?.[1];
    if (!token) return response({ ok: false, error: "Authentication required" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
      return response({ ok: false, error: "Supabase function environment is incomplete" }, 500);
    }

    const caller = createClient(supabaseUrl, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: authorization } },
    });
    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: auth, error: authError } = await caller.auth.getUser(token);
    if (authError || !auth.user) return response({ ok: false, error: "Invalid or expired session" }, 401);

    const { data: actor, error: actorError } = await admin
      .from("profiles")
      .select("id,role,active,organization_id")
      .eq("id", auth.user.id)
      .maybeSingle();
    if (actorError) throw actorError;
    if (!actor?.active || actor.role !== "admin" || !actor.organization_id) {
      return response({ ok: false, error: "An active organization administrator is required" }, 403);
    }

    const body = await req.json().catch(() => null) as Record<string, unknown> | null;
    const fullName = typeof body?.full_name === "string" ? body.full_name.trim() : "";
    const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
    const role = typeof body?.role === "string" ? body.role : "";
    const sectorId = typeof body?.sector_id === "string" ? body.sector_id : null;
    if (!fullName || fullName.length > 120 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return response({ ok: false, error: "A valid name and email are required" }, 400);
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
        .maybeSingle();
      if (error) throw error;
      if (!sector) return response({ ok: false, error: "The selected sector is not in your organization" }, 400);
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
    const message = error instanceof Error ? error.message : String(error);
    console.error("admin-create-user failed", message);
    return response({ ok: false, error: message }, 500);
  }
});
