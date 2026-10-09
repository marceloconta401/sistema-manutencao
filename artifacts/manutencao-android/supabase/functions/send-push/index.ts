import webpush from "npm:web-push@3.6.7";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, x-client-info, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const statusTitles: Record<string, string> = {
  accepted: "🔧 Chamado aceito",
  in_progress: "🛠️ Atendimento iniciado",
  waiting_parts: "📦 Aguardando peça",
  completed: "🟢 Chamado concluído",
  cancelled: "⚪ Chamado cancelado",
};

const statusLabels: Record<string, string> = {
  open: "Aberto",
  accepted: "Aceito",
  in_progress: "Em atendimento",
  waiting_parts: "Aguardando peça",
  completed: "Concluído",
  cancelled: "Cancelado",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ ok: false, error: "Method not allowed" }, 405);

  try {
    const authHeader = req.headers.get("authorization") || "";
    const bearerMatch = authHeader.match(/^Bearer\s+(.+)$/i);
    if (!bearerMatch) return jsonResponse({ ok: false, error: "Authentication required" }, 401);

    const payload = await req.json().catch(() => null) as {
      work_order_id?: unknown;
      event_type?: unknown;
    } | null;
    const workOrderId = typeof payload?.work_order_id === "string" ? payload.work_order_id : "";
    const eventType = payload?.event_type || "created";
    if (!workOrderId) return jsonResponse({ ok: false, error: "work_order_id is required" }, 400);
    if (eventType !== "created" && eventType !== "updated") {
      return jsonResponse({ ok: false, error: "event_type must be created or updated" }, 400);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const vapidPublic = Deno.env.get("VAPID_PUBLIC_KEY");
    const vapidPrivate = Deno.env.get("VAPID_PRIVATE_KEY");
    const vapidSubject = Deno.env.get("VAPID_SUBJECT") || "mailto:admin@example.com";
    if (!supabaseUrl || !anonKey || !serviceKey) {
      return jsonResponse({ ok: false, error: "Supabase function environment is incomplete" }, 500);
    }
    if (!vapidPublic || !vapidPrivate) {
      return jsonResponse({ ok: false, error: "VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY must be configured" }, 500);
    }

    webpush.setVapidDetails(vapidSubject, vapidPublic, vapidPrivate);
    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const caller = createClient(supabaseUrl, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: authHeader } },
    });
    const { data: authData, error: authError } = await caller.auth.getUser(bearerMatch[1]);
    if (authError || !authData.user) {
      return jsonResponse({ ok: false, error: "Invalid or expired session" }, 401);
    }

    const { data: actor, error: actorError } = await admin
      .from("profiles")
      .select("id,role,active,organization_id,sector_id")
      .eq("id", authData.user.id)
      .maybeSingle();
    if (actorError) throw actorError;
    if (!actor?.active) return jsonResponse({ ok: false, error: "Active user profile required" }, 403);

    // Confirm that this user can read the work order under the app's RLS policies.
    const { data: visibleWorkOrder, error: accessError } = await caller
      .from("work_orders")
      .select("id")
      .eq("id", workOrderId)
      .maybeSingle();
    if (accessError || !visibleWorkOrder) {
      return jsonResponse({ ok: false, error: "Not authorized to notify about this work order" }, 403);
    }

    const { data: wo, error: woError } = await admin
      .from("work_orders")
      .select("id,title,priority,status,organization_id,sector_id,requester_id,mechanic_id")
      .eq("id", workOrderId)
      .maybeSingle();
    if (woError) throw woError;
    if (!wo) return jsonResponse({ ok: false, error: "Work order not found" }, 404);
    if (actor.organization_id !== wo.organization_id) {
      return jsonResponse({ ok: false, error: "Work order belongs to another organization" }, 403);
    }

    if (eventType === "created") {
      // Keep old clients that send only work_order_id working, while preventing
      // notifications for calls the authenticated user did not create.
      if (wo.status !== "open" || wo.requester_id !== authData.user.id ||
          (actor.role !== "sector" && actor.role !== "admin")) {
        return jsonResponse({ ok: false, error: "Not authorized to send a new-work-order notification" }, 403);
      }
    } else if (actor.role !== "mechanic" || wo.mechanic_id !== authData.user.id) {
      return jsonResponse({ ok: false, error: "Only the assigned mechanic can send a status update" }, 403);
    }

    const { data: profiles, error: profilesError } = await admin
      .from("profiles")
      .select("id,role,sector_id")
      .eq("organization_id", wo.organization_id)
      .eq("active", true);
    if (profilesError) throw profilesError;

    const recipientIds = (profiles || [])
      .filter((profile) => {
        if (eventType === "created") return profile.role === "mechanic";
        if (profile.id === authData.user.id) return false;
        return profile.role === "admin" ||
          (profile.role === "sector" && profile.sector_id === wo.sector_id) ||
          (profile.role === "mechanic" && profile.id === wo.mechanic_id);
      })
      .map((profile) => profile.id);
    if (!recipientIds.length) {
      return jsonResponse({ ok: true, event_type: eventType, target_users: 0, sent: 0, failed: 0 });
    }

    const { data: subs, error: subError } = await admin
      .from("push_subscriptions")
      .select("id,user_id,endpoint,p256dh,auth")
      .in("user_id", recipientIds);
    if (subError) throw subError;
    if (!subs?.length) {
      return jsonResponse({
        ok: true,
        event_type: eventType,
        target_users: recipientIds.length,
        subscriptions: 0,
        sent: 0,
        failed: 0,
      });
    }

    let sent = 0;
    let failed = 0;
    for (const sub of subs || []) {
      try {
        const isNewWorkOrder = eventType === "created";
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify({
            title: isNewWorkOrder
              ? (wo.priority === "urgent" ? "🔴 Novo chamado urgente" : "🆕 Novo chamado")
              : (statusTitles[wo.status] || "🔔 Chamado atualizado"),
            body: isNewWorkOrder
              ? (wo.title || "Chamado") + " · " + (wo.priority || "normal")
              : (wo.title || "Chamado") + " · " + (statusLabels[wo.status] || wo.status),
            callId: wo.id,
            url: "./?call=" + encodeURIComponent(wo.id),
            tag: "work-order-" + wo.id,
            renotify: true,
          })
        );
        sent++;
      } catch (error) {
        const status = typeof error === "object" && error !== null && "statusCode" in error
          ? (error as { statusCode?: number }).statusCode
          : undefined;
        if (status === 404 || status === 410) {
          await admin.from("push_subscriptions").delete().eq("id", sub.id);
        } else {
          failed++;
          console.warn("Push delivery failed", status || "unknown error");
        }
      }
    }
    return jsonResponse({
      ok: failed === 0,
      event_type: eventType,
      target_users: recipientIds.length,
      subscriptions: subs.length,
      sent,
      failed,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("send-push failed", message);
    return jsonResponse({ ok: false, error: message }, 500);
  }
});
