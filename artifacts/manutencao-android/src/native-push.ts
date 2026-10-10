import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";
import { PushNotifications } from "@capacitor/push-notifications";

const CHANNEL_ID = "maintenance_calls_v1";
const TOKEN_STORAGE_KEY = "maintenance.nativePushToken";
const isAndroid =
  Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android";

type PushApi = {
  isAvailable: () => boolean;
  register: () => Promise<void>;
  unregisterCurrentDevice: () => Promise<void>;
};

const tokenWaiters = new Set<(token: string) => void>();
let nativeSetup: Promise<void> | null = null;

function getClient(): any {
  return (window as any).sb;
}

async function saveToken(token: string, expectedUserId?: string): Promise<void> {
  const client = getClient();
  if (!client) throw new Error("A sessão do Supabase ainda não foi inicializada.");

  const { data, error: sessionError } = await client.auth.getSession();
  if (sessionError) throw sessionError;
  const userId = expectedUserId || data.session?.user?.id;
  if (!userId) return;

  const previousToken = localStorage.getItem(TOKEN_STORAGE_KEY);
  if (previousToken && previousToken !== token) {
    const { error } = await client
      .from("native_push_devices")
      .delete()
      .eq("user_id", userId)
      .eq("fcm_token", previousToken);
    if (error) throw error;
  }

  const { error } = await client.from("native_push_devices").upsert(
    {
      user_id: userId,
      fcm_token: token,
      platform: "android",
      updated_at: new Date().toISOString(),
    },
    { onConflict: "fcm_token" },
  );
  if (error) throw error;
  localStorage.setItem(TOKEN_STORAGE_KEY, token);
}

async function saveTokenForCurrentUser(token: string): Promise<void> {
  try {
    await saveToken(token);
  } catch (error) {
    console.warn(
      "Não foi possível atualizar o token nativo no Supabase:",
      error instanceof Error ? error.message : error,
    );
  }
}

function callIdFrom(value: unknown): string | null {
  if (!value || typeof value !== "object") return null;
  const data = value as Record<string, unknown>;
  const callId = data.callId || data.work_order_id;
  return typeof callId === "string" && callId.length > 0 ? callId : null;
}

function openWorkOrder(callId: string | null): void {
  if (!callId) return;
  const target = new URL(window.location.href);
  target.searchParams.set("call", callId);
  window.location.replace(target.href);
}

async function ensureAndroidSetup(): Promise<void> {
  if (!isAndroid) return;
  if (nativeSetup) return nativeSetup;

  nativeSetup = (async () => {
    await PushNotifications.createChannel({
      id: CHANNEL_ID,
      name: "Chamados e atualizações",
      description: "Novos chamados, solicitações de peças e mudanças de status.",
      importance: 5,
      visibility: 1,
      sound: "maintenance_notification.wav",
      vibration: true,
    });

    await PushNotifications.addListener("registration", ({ value }) => {
      if (!value) return;
      localStorage.setItem(TOKEN_STORAGE_KEY, value);
      tokenWaiters.forEach((resolve) => resolve(value));
      void saveTokenForCurrentUser(value);
    });

    await PushNotifications.addListener("registrationError", ({ error }) => {
      console.error("Falha ao registrar o dispositivo no FCM:", error);
    });

    await PushNotifications.addListener(
      "pushNotificationReceived",
      async (notification) => {
        const callId = callIdFrom(notification.data);
        try {
          await LocalNotifications.schedule({
            notifications: [
              {
                id: Math.floor(Math.random() * 2_000_000_000) + 1,
                title: notification.title || "Sistema de Manutenção",
                body: notification.body || "Há uma atualização em um chamado.",
                channelId: CHANNEL_ID,
                smallIcon: "ic_stat_maintenance",
                largeIcon: "ic_notification_large",
                iconColor: "#1473E6",
                extra: { callId },
              },
            ],
          });
        } catch (error) {
          console.warn(
            "Não foi possível exibir a notificação nativa em primeiro plano:",
            error instanceof Error ? error.message : error,
          );
        }
      },
    );

    await PushNotifications.addListener(
      "pushNotificationActionPerformed",
      (action) => openWorkOrder(callIdFrom(action.notification.data)),
    );

    await LocalNotifications.addListener(
      "localNotificationActionPerformed",
      (action) => openWorkOrder(callIdFrom(action.notification.extra)),
    );

    const client = getClient();
    if (client?.auth?.onAuthStateChange) {
      client.auth.onAuthStateChange((_event: string, session: any) => {
        const token = localStorage.getItem(TOKEN_STORAGE_KEY);
        if (session?.user?.id && token) {
          void saveToken(token, session.user.id).catch((error: unknown) =>
            console.warn(
              "Não foi possível associar o dispositivo à conta:",
              error instanceof Error ? error.message : error,
            ),
          );
        }
      });
    }

    const savedToken = localStorage.getItem(TOKEN_STORAGE_KEY);
    if (savedToken) await saveTokenForCurrentUser(savedToken);
  })().catch((error) => {
    nativeSetup = null;
    throw error;
  });

  return nativeSetup;
}

async function registerAndroidDevice(): Promise<void> {
  if (!isAndroid) throw new Error("O registro FCM só está disponível no Android.");
  const client = getClient();
  if (!client) throw new Error("A sessão do Supabase ainda não foi inicializada.");
  const { data, error } = await client.auth.getSession();
  if (error) throw error;
  const userId = data.session?.user?.id;
  if (!userId) throw new Error("Entre no sistema antes de ativar as notificações.");

  await ensureAndroidSetup();
  const permission = await PushNotifications.requestPermissions();
  if (permission.receive !== "granted") {
    throw new Error("A permissão de notificações do Android não foi concedida.");
  }

  let cancelTokenWait: (error: Error) => void = () => {};
  const tokenPromise = new Promise<string>((resolve, reject) => {
    let settled = false;
    const finish = (callback: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      tokenWaiters.delete(onToken);
      callback();
    };
    const onToken = (token: string) => finish(() => resolve(token));
    cancelTokenWait = (error) => finish(() => reject(error));
    const timeout = window.setTimeout(
      () => finish(() => reject(new Error("O Firebase não retornou o token do aparelho."))),
      30_000,
    );
    tokenWaiters.add(onToken);
  });

  try {
    await PushNotifications.register();
    const token = await tokenPromise;
    await saveToken(token, userId);
  } catch (error) {
    cancelTokenWait(error instanceof Error ? error : new Error(String(error)));
    void tokenPromise.catch(() => {});
    throw error;
  }
}

async function unregisterAndroidDevice(): Promise<void> {
  if (!isAndroid) return;
  const token = localStorage.getItem(TOKEN_STORAGE_KEY);
  if (!token) return;

  const client = getClient();
  if (!client) throw new Error("Não foi possível confirmar a sessão do aparelho.");
  const { data, error: sessionError } = await client.auth.getSession();
  if (sessionError) throw sessionError;
  const userId = data.session?.user?.id;
  if (!userId) throw new Error("Entre no sistema antes de remover este aparelho.");

  const { error } = await client
    .from("native_push_devices")
    .delete()
    .eq("user_id", userId)
    .eq("fcm_token", token);
  if (error) throw error;
  localStorage.removeItem(TOKEN_STORAGE_KEY);
}

const nativePushApi: PushApi = {
  isAvailable: () => isAndroid,
  register: registerAndroidDevice,
  unregisterCurrentDevice: unregisterAndroidDevice,
};

(window as any).nativePushManager = nativePushApi;
if (isAndroid) {
  void ensureAndroidSetup().catch((error) =>
    console.error(
      "Falha ao preparar notificações Android:",
      error instanceof Error ? error.message : error,
    ),
  );
}
