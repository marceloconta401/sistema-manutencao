import webpush from "npm:web-push@3.6.7";
import { createClient } from "npm:@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const vapidPublic = Deno.env.get("VAPID_PUBLIC_KEY")!;
const vapidPrivate = Deno.env.get("VAPID_PRIVATE_KEY")!;
const vapidSubject = Deno.env.get("VAPID_SUBJECT") || "mailto:admin@example.com";

webpush.setVapidDetails(vapidSubject, vapidPublic, vapidPrivate);
const admin = createClient(supabaseUrl, serviceKey);

Deno.serve(async (req) => {
  try {
    if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
    const { work_order_id } = await req.json();
    if (!work_order_id) return new Response("work_order_id is required", { status: 400 });

    const { data: wo, error: woError } = await admin
      .from("work_orders")
      .select("id,title,description,priority,status,organization_id,sector_id")
      .eq("id", work_order_id)
      .single();
    if (woError) throw woError;

    if (wo.status !== "open") return Response.json({ ok: true, sent: 0 });

    const { data: mechanics, error: mechError } = await admin
      .from("profiles")
      .select("id")
      .eq("organization_id", wo.organization_id)
      .eq("role", "mechanic")
      .eq("active", true);
    if (mechError) throw mechError;

    const ids = (mechanics || []).map((m) => m.id);
    if (!ids.length) return Response.json({ ok: true, sent: 0 });

    const { data: subs, error: subError } = await admin
      .from("push_subscriptions")
      .select("id,user_id,endpoint,p256dh,auth")
      .in("user_id", ids);
    if (subError) throw subError;

    let sent = 0;
    for (const sub of subs || []) {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify({
            title: wo.priority === "urgent" ? "🔴 Novo chamado urgente" : "🆕 Novo chamado",
            body: (wo.title || "Chamado") + " · " + (wo.priority || "normal"),
            callId: wo.id,
            url: "./?call=" + encodeURIComponent(wo.id),
            tag: "work-order-" + wo.id
          })
        );
        sent++;
      } catch (e) {
        const status = e?.statusCode;
        if (status === 404 || status === 410) {
          await admin.from("push_subscriptions").delete().eq("id", sub.id);
        }
      }
    }
    return Response.json({ ok: true, sent });
  } catch (e) {
    return Response.json({ ok: false, error: e?.message || String(e) }, { status: 500 });
  }
});
