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

const nativeChannelId = "maintenance_calls_v1";
let cachedFcmAccessToken = "";
let cachedFcmAccessTokenExpiresAt = 0;

function base64UrlEncode(value: string | Uint8Array): string {
  const bytes = typeof value === "string" ? new TextEncoder().encode(value) : value;
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function privateKeyBytes(pem: string): ArrayBuffer {
  const normalized = pem.replace(/\\n/g, "\n");
  const base64 = normalized
    .replace(/-----BEGIN PRIVATE KEY-----/g, "")
    .replace(/-----END PRIVATE KEY-----/g, "")
    .replace(/\s/g, "");
  const bytes = Uint8Array.from(atob(base64), (character) => character.charCodeAt(0));
  return bytes.buffer;
}

async function getFcmAccessToken(
  clientEmail: string,
  privateKeyPem: string,
): Promise<string> {
  if (cachedFcmAccessToken && Date.now() < cachedFcmAccessTokenExpiresAt - 60_000) {
    return cachedFcmAccessToken;
  }

  const issuedAt = Math.floor(Date.now() / 1000);
  const header = base64UrlEncode(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = base64UrlEncode(JSON.stringify({
    iss: clientEmail,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: "https://oauth2.googleapis.com/token",
    iat: issuedAt,
    exp: issuedAt + 3600,
  }));
  const unsignedJwt = `${header}.${claims}`;
  const signingKey = await crypto.subtle.importKey(
    "pkcs8",
    privateKeyBytes(privateKeyPem),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    signingKey,
    new TextEncoder().encode(unsignedJwt),
  );
  const assertion = `${unsignedJwt}.${base64UrlEncode(new Uint8Array(signature))}`;
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });
  const tokenResponse = await response.json().catch(() => ({}));
  if (!response.ok || typeof tokenResponse.access_token !== "string") {
    throw new Error(`FCM OAuth token request failed (${response.status})`);
  }

  cachedFcmAccessToken = tokenResponse.access_token;
  cachedFcmAccessTokenExpiresAt =
    Date.now() + Number(tokenResponse.expires_in || 3600) * 1000;
  return cachedFcmAccessToken;
}

async function sendFcmNotification(
  projectId: string,
  accessToken: string,
  fcmToken: string,
  title: string,
  body: string,
  callId: string,
  eventType: string,
): Promise<Response> {
  return await fetch(
    `https://fcm.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/messages:send`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: {
          token: fcmToken,
          notification: { title, body },
          data: {
            callId,
            work_order_id: callId,
            eventType,
          },
          android: {
            priority: "HIGH",
            notification: {
              channel_id: nativeChannelId,
              sound: "maintenance_notification",
              default_vibrate_timings: true,
              visibility: "PUBLIC",
              icon: "ic_stat_maintenance",
              tag: `maintenance-${crypto.randomUUID()}`,
            },
          },
        },
      }),
    },
  );
}

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
      part_request_id?: unknown;
    } | null;
    const workOrderId = typeof payload?.work_order_id === "string" ? payload.work_order_id : "";
    const eventType = typeof payload?.event_type === "string" ? payload.event_type : "created";
    const partRequestId = typeof payload?.part_request_id === "string" ? payload.part_request_id : "";
    if (!workOrderId) return jsonResponse({ ok: false, error: "work_order_id is required" }, 400);
    if (eventType !== "created" && eventType !== "updated" && eventType !== "part_requested") {
      return jsonResponse({ ok: false, error: "event_type must be created, updated, or part_requested" }, 400);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const vapidPublic = Deno.env.get("VAPID_PUBLIC_KEY");
    const vapidPrivate = Deno.env.get("VAPID_PRIVATE_KEY");
    const vapidSubject = Deno.env.get("VAPID_SUBJECT") || "mailto:admin@example.com";
    const fcmProjectId = Deno.env.get("FCM_PROJECT_ID") || "";
    const fcmClientEmail = Deno.env.get("FCM_CLIENT_EMAIL") || "";
    const fcmPrivateKey = Deno.env.get("FCM_PRIVATE_KEY") || "";
    if (!supabaseUrl || !anonKey || !serviceKey) {
      return jsonResponse({ ok: false, error: "Supabase function environment is incomplete" }, 500);
    }
    if (Boolean(vapidPublic) !== Boolean(vapidPrivate)) {
      return jsonResponse({ ok: false, error: "Both VAPID keys must be configured together" }, 500);
    }
    if (vapidPublic && vapidPrivate) {
      webpush.setVapidDetails(vapidSubject, vapidPublic, vapidPrivate);
    }
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

    let partRequest: { part_name: string; quantity: number } | null = null;
    if (eventType === "created") {
      // Keep old clients that send only work_order_id working, while preventing
      // notifications for calls the authenticated user did not create.
      if (wo.status !== "open" || wo.requester_id !== authData.user.id ||
          (actor.role !== "sector" && actor.role !== "admin")) {
        return jsonResponse({ ok: false, error: "Not authorized to send a new-work-order notification" }, 403);
      }
    } else if (eventType === "updated") {
      if (actor.role !== "mechanic" || wo.mechanic_id !== authData.user.id) {
        return jsonResponse({ ok: false, error: "Only the assigned mechanic can send a status update" }, 403);
      }
    } else {
      if (actor.role !== "mechanic" || wo.mechanic_id !== authData.user.id || !partRequestId) {
        return jsonResponse({ ok: false, error: "Only the assigned mechanic can send a part request notification" }, 403);
      }
      const { data, error } = await admin
        .from("part_requests")
        .select("id,work_order_id,requested_by,part_name,quantity,status")
        .eq("id", partRequestId)
        .maybeSingle();
      if (error) throw error;
      if (!data || data.work_order_id !== wo.id || data.requested_by !== authData.user.id || data.status !== "requested") {
        return jsonResponse({ ok: false, error: "Part request not found or not authorized" }, 403);
      }
      partRequest = { part_name: data.part_name, quantity: data.quantity };
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
          profile.id === wo.requester_id ||
          (eventType === "updated" && profile.role === "mechanic" && profile.id === wo.mechanic_id);
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
    const { data: nativeDevices, error: nativeDeviceError } = await admin
      .from("native_push_devices")
      .select("id,user_id,fcm_token")
      .in("user_id", recipientIds);
    if (nativeDeviceError) throw nativeDeviceError;

    let sent = 0;
    let failed = 0;
    let webSent = 0;
    let nativeSent = 0;
    const isNewWorkOrder = eventType === "created";
    const notificationTitle = isNewWorkOrder
      ? (wo.priority === "urgent" ? "🔴 Novo chamado urgente" : "🆕 Novo chamado")
      : eventType === "part_requested"
      ? "📦 Solicitação de peça"
      : (statusTitles[wo.status] || "🔔 Chamado atualizado");
    const notificationBody = isNewWorkOrder
      ? (wo.title || "Chamado") + " · " + (wo.priority || "normal")
      : eventType === "part_requested" && partRequest
      ? `${partRequest.part_name} · quantidade ${partRequest.quantity} · ${wo.title || "Chamado"}`
      : (wo.title || "Chamado") + " · " + (statusLabels[wo.status] || wo.status);

    for (const sub of subs || []) {
      try {
        if (!vapidPublic || !vapidPrivate) {
          throw new Error("Web Push VAPID keys are not configured");
        }
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify({
            title: notificationTitle,
            body: notificationBody,
            callId: wo.id,
            url: "./?call=" + encodeURIComponent(wo.id),
            tag: `maintenance-${crypto.randomUUID()}`,
            renotify: true,
          }),
        );
        sent++;
        webSent++;
      } catch (error) {
        const status = typeof error === "object" && error !== null && "statusCode" in error
          ? (error as { statusCode?: number }).statusCode
          : undefined;
        if (status === 404 || status === 410) {
          await admin.from("push_subscriptions").delete().eq("id", sub.id);
        } else {
          failed++;
          console.warn("Web Push delivery failed", status || "unknown error");
        }
      }
    }

    if (nativeDevices?.length) {
      const fcmConfigured = Boolean(fcmProjectId && fcmClientEmail && fcmPrivateKey);
      let accessToken = "";
      if (fcmConfigured) {
        try {
          accessToken = await getFcmAccessToken(fcmClientEmail, fcmPrivateKey);
        } catch (error) {
          failed += nativeDevices.length;
          console.warn(
            "FCM authorization failed",
            error instanceof Error ? error.message : "unknown error",
          );
        }
      } else {
        failed += nativeDevices.length;
        console.warn("FCM service account is not configured");
      }

      if (accessToken) {
        for (const device of nativeDevices) {
          try {
            const response = await sendFcmNotification(
              fcmProjectId,
              accessToken,
              device.fcm_token,
              notificationTitle,
              notificationBody,
              wo.id,
              String(eventType),
            );
            if (response.ok) {
              sent++;
              nativeSent++;
              continue;
            }

            const errorBody = await response.json().catch(() => ({}));
            const errorStatus = errorBody?.error?.status;
            const details = errorBody?.error?.details;
            const isUnregistered =
              response.status === 404 ||
              errorStatus === "NOT_FOUND" ||
              (Array.isArray(details) && details.some((item) => item?.errorCode === "UNREGISTERED"));
            if (isUnregistered) {
              await admin.from("native_push_devices").delete().eq("id", device.id);
            } else {
              failed++;
              console.warn("FCM delivery failed", response.status, errorStatus || "unknown error");
            }
          } catch (error) {
            failed++;
            console.warn(
              "FCM delivery failed",
              error instanceof Error ? error.message : "unknown error",
            );
          }
        }
      }
    }

    return jsonResponse({
      ok: failed === 0,
      event_type: eventType,
      target_users: recipientIds.length,
      subscriptions: subs.length,
      native_devices: nativeDevices.length,
      web_sent: webSent,
      native_sent: nativeSent,
      sent,
      failed,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("send-push failed", message);
    return jsonResponse({ ok: false, error: message }, 500);
  }
});
