// Reference layout shell: sidebar navigation, dashboard (open calls table with
// filters, recent activity, completed history), call detail view, settings
// (alerts/sounds, sectors, access profiles). Uses only the global `sb` client
// and the legacy inline globals; never changes data paths or permissions.
import "./shell.css";

type AnyWin = Window & Record<string, any>;
const w = window as unknown as AnyWin;
const $ = (id: string) => document.getElementById(id) as HTMLElement | null;
const ctx = () => (typeof w.__maintenanceContext === "function" ? w.__maintenanceContext() : {}) || {};
const esc = (s: unknown = "") => String(s ?? "").replace(/[&<>'"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[c] as string));
const fmt = (d?: string | null) => (d ? new Date(d).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "");
const num = (id: string) => "#" + String(id || "").replace(/-/g, "").slice(0, 6).toUpperCase();

const STATUS: Record<string, [string, string]> = {
  open: ["Aberto", "#64748b"], accepted: ["Aceito", "#2563eb"], in_progress: ["Em atendimento", "#2563eb"],
  waiting_parts: ["Aguardando peça", "#7c3aed"], completed: ["Concluído", "#16a34a"], cancelled: ["Cancelado", "#475569"],
};
const PRIO: Record<string, [string, string]> = {
  urgent: ["Urgente", "#dc2626"], high: ["Alta", "#ea580c"], normal: ["Média", "#ca8a04"], low: ["Baixa", "#64748b"],
};
const PART: Record<string, string> = { requested: "Solicitada", purchased: "Comprada", received: "Recebida", cancelled: "Cancelada" };
const badge = (map: Record<string, [string, string]>, k: string) => `<span class="sh-badge" style="--c:${(map[k] || [k, "#475569"])[1]}">${esc((map[k] || [k])[0])}</span>`;

const P = (d: string) => `<svg class="sh-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const I = {
  grid: P('<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>'),
  list: P('<path d="M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01"/>'),
  gear: P('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>'),
  machine: P('<rect x="2" y="7" width="20" height="12" rx="2"/><path d="M6 7V4h12v3M7 13h4M15 13h2"/>'),
  box: P('<path d="M21 8l-9-5-9 5 9 5 9-5zM3 8v8l9 5 9-5V8M12 13v8"/>'),
  cart: P('<circle cx="9" cy="20" r="1.5"/><circle cx="18" cy="20" r="1.5"/><path d="M2 3h3l2.7 12.4a2 2 0 0 0 2 1.6h7.7a2 2 0 0 0 2-1.6L21 7H6"/>'),
  clock: P('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'),
  chart: P('<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>'),
  users: P('<circle cx="9" cy="8" r="3.5"/><path d="M2 20c0-3.5 3-6 7-6s7 2.5 7 6M16 4.5a3.5 3.5 0 0 1 0 7M22 20c0-3-2-5-4.5-5.7"/>'),
  cal: P('<rect x="3" y="4" width="18" height="17" rx="2"/><path d="M3 9h18M8 2v4M16 2v4"/>'),
  wrench: P('<path d="M14.7 6.3a4 4 0 0 0 5 5L22 14l-8 8-2.3-2.3a4 4 0 0 0-5-5L3 11l8-8z"/>'),
  plus: P('<path d="M12 5v14M5 12h14"/>'),
  check: P('<path d="M20 6L9 17l-5-5"/>'),
  alert: P('<path d="M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0zM12 9v4M12 17h.01"/>'),
};

// ---------------- Alert / sound preferences ----------------
const PREF_KEY = "maint_alert_prefs";
type Prefs = { newCall: boolean; urgent: boolean; part: boolean; status: boolean; volume: number; toneNew: string; toneUrgent: string };
const DEFAULT_PREFS: Prefs = { newCall: true, urgent: true, part: true, status: true, volume: 70, toneNew: "campainha", toneUrgent: "alerta" };
function prefs(): Prefs { try { return { ...DEFAULT_PREFS, ...JSON.parse(localStorage.getItem(PREF_KEY) || "{}") }; } catch { return { ...DEFAULT_PREFS }; } }
function savePrefs(p: Prefs) { localStorage.setItem(PREF_KEY, JSON.stringify(p)); }
const TONES: Record<string, [string, number[]]> = {
  campainha: ["Campainha", [880, 660, 880]],
  suave: ["Suave", [523, 659]],
  alerta: ["Alerta", [988, 740, 988, 740, 988]],
  sirene: ["Sirene", [660, 990, 660, 990]],
};
let audioCtx: AudioContext | null = null;
async function playTone(tone: string, volume: number) {
  try {
    const C = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!C) return;
    audioCtx = audioCtx || new C();
    if (audioCtx!.state === "suspended") await audioCtx!.resume();
    const ctxA = audioCtx!, now = ctxA.currentTime, peak = Math.max(0.0002, (volume / 100) * 0.25);
    (TONES[tone] || TONES.campainha)[1].forEach((f, i) => {
      const o = ctxA.createOscillator(), g = ctxA.createGain(), t = now + i * 0.18;
      o.type = "sine"; o.frequency.setValueAtTime(f, t);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.15);
      o.connect(g); g.connect(ctxA.destination); o.start(t); o.stop(t + 0.16);
    });
  } catch (e) { console.warn("Aviso sonoro:", e); }
}
let lastNotifyTitle = "";
function classify(title: string): keyof Prefs {
  const t = title.toLowerCase();
  if (t.includes("urgent")) return "urgent";
  if (t.includes("peça") || t.includes("peca")) return "part";
  if (t.includes("novo")) return "newCall";
  return "status";
}
// Wrap legacy notification sound so settings really apply.
if (typeof w.notifyUser === "function") {
  const orig = w.notifyUser;
  w.notifyUser = function (title: string, body: string, tag: string) {
    lastNotifyTitle = String(title || "") + " " + String(body || "");
    const r = orig.apply(this, arguments as any);
    // Legacy desktop path returns before the sound; play the configured foreground tone in Electron.
    if (w.maintenanceDesktop?.showNotification && !w.nativePushManager?.isAvailable?.() && !w.__desktopPlaysOwnSound) void w.playNotificationSound();
    return r;
  };
  w.__shellPlaysDesktopSound = true;
}
w.playNotificationSound = async function () {
  const p = prefs(); const kind = classify(lastNotifyTitle);
  if (!p[kind]) return;
  await playTone(kind === "urgent" ? p.toneUrgent : p.toneNew, p.volume);
};

// ---------------- Shell DOM ----------------
const app = $("app")!;
let dashRows: any[] = [];
let capped = false;
let sectorsMap: Record<string, string> = {};
let peopleMap: Record<string, string> = {};

function role(): string { return ctx().profile?.role || ""; }
function ops(): any { return w.maintenanceOperations || {}; }

const NAV: { id: string; label: string; icon: string; admin?: boolean; run: () => void; avail?: () => boolean }[] = [
  { id: "dash", label: "Painel", icon: I.grid, run: () => setView("dash") },
  { id: "calls", label: "Chamados", icon: I.list, run: () => setView("calls") },
  { id: "machines", label: "Máquinas", icon: I.machine, admin: true, run: () => w.openEquipmentPanel?.() },
  { id: "stock", label: "Estoque", icon: I.box, admin: true, run: () => (ops().openInventory ? ops().openInventory() : w.openPartsPanel?.()) },
  { id: "purchases", label: "Compras", icon: I.cart, admin: true, run: () => ops().openPurchases?.(), avail: () => !!ops().openPurchases },
  { id: "preventive", label: "Preventiva", icon: I.cal, admin: true, run: () => w.openPreventivePanel?.() },
  { id: "history", label: "Histórico", icon: I.clock, admin: true, run: () => { setView("calls"); w.openHistoryPanel?.(); } },
  { id: "reports", label: "Relatórios", icon: I.chart, admin: true, run: () => ops().openReports?.(), avail: () => !!ops().openReports },
  { id: "users", label: "Usuários e Setores", icon: I.users, admin: true, run: () => { setView("calls"); w.openUsersPanel?.(); } },
  { id: "settings", label: "Configurações", icon: I.gear, run: () => setView("settings") },
];

const side = document.createElement("aside");
side.className = "sh-side";
side.setAttribute("aria-label", "Navegação principal");
app.prepend(side);

function renderSide() {
  const admin = role() === "admin";
  const light = document.documentElement.classList.contains("light");
  side.innerHTML = `<div class="sh-brand"><span class="sh-mark">${I.wrench}</span><div><b>Manutenção</b><small>Sistema de Gestão</small></div></div>
  <nav class="sh-nav">${NAV.filter((n) => !n.admin || admin).map((n) => {
    const ok = !n.avail || n.avail();
    return `<button type="button" data-nav="${n.id}" data-testid="nav-${n.id}" class="${app.dataset.view === n.id ? "active" : ""}" ${ok ? "" : 'disabled title="Módulo indisponível nesta versão"'}>${n.icon}<span>${n.label}</span></button>`;
  }).join("")}</nav>
  <div class="sh-foot"><span>Tema ${light ? "claro" : "escuro"}</span><button type="button" class="sh-switch ${light ? "" : "on"}" data-testid="toggle-theme-side" aria-label="Alternar tema"></button></div>`;
}
side.addEventListener("click", (e) => {
  const t = e.target as HTMLElement;
  if (t.closest(".sh-switch")) { $("themeBtn")?.click(); renderSide(); return; }
  const b = t.closest<HTMLButtonElement>("[data-nav]");
  if (!b || b.disabled) return;
  NAV.find((n) => n.id === b.dataset.nav)?.run();
});

function setView(v: string) {
  app.dataset.view = v;
  renderSide();
  if (v === "settings") renderSettings();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

// Dashboard container inserted after KPIs
// Header: title, clock, signed-in profile and logout (all views)
const head = document.createElement("div");
head.className = "sh-head";
head.innerHTML = `<div><h1>Sala de Manutenção</h1><div class="sh-mut">Central de chamados e gerenciamento da manutenção</div></div>
  <div class="sh-clock mono" data-clock data-testid="text-clock"></div>
  <div class="sh-who" data-who data-testid="text-signed-user"></div>
  <button class="sh-btn" type="button" data-head-logout data-testid="button-logout-header">Sair</button>`;
side.after(head);
head.querySelector("[data-head-logout]")!.addEventListener("click", () => $("logoutBtn")?.click());
const ROLE_LABEL: Record<string, string> = { admin: "Administrador", mechanic: "Mecânico", sector: "Setor" };
function renderHead() {
  const p = ctx().profile; const who = head.querySelector<HTMLElement>("[data-who]")!;
  if (!p) { who.replaceChildren(); return; }
  const n = String(p.full_name || "Usuário");
  who.innerHTML = `<span class="sh-av">${esc(n.split(/\s+/).map((x) => x[0]).slice(0, 2).join("").toUpperCase())}</span><div><b>${esc(n)}</b><small>${esc(ROLE_LABEL[p.role] || p.role)}</small></div>`;
  quick.classList.toggle("hidden", p.role !== "sector");
}
const tick = () => { const el = head.querySelector<HTMLElement>("[data-clock]")!; el.textContent = new Date().toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }); };
tick(); setInterval(tick, 20000);

// KPI icons + KPI click -> visible dashboard filters
const KICON: Record<string, string> = { open: I.alert, urgent: I.alert, in_progress: I.wrench, waiting_parts: I.box, completed: I.check };
document.querySelectorAll<HTMLElement>("#app .kpis .kpi[data-status]").forEach((k) => {
  if (!k.querySelector(".sh-kico")) k.insertAdjacentHTML("afterbegin", `<i class="sh-kico">${KICON[k.dataset.status!] || I.list}</i>`);
  k.addEventListener("click", () => {
    const f = k.dataset.status!;
    ($("shPrio") as HTMLSelectElement).value = f === "urgent" ? "urgent" : "";
    ($("shStatus") as HTMLSelectElement).value = f === "urgent" ? "" : f;
    if (app.dataset.view !== "dash" && app.dataset.view !== "calls") setView("dash");
    renderRows();
  });
});

// Sector quick actions (Android-style large targets, real controls)
const quick = document.createElement("div");
quick.className = "sh-quick hidden";
quick.innerHTML = `<button type="button" class="q-b" data-q="new" data-testid="button-quick-new">${I.plus}<span>Novo chamado</span></button>
  <button type="button" class="q-g" data-q="mine" data-testid="button-quick-mine">${I.list}<span>Meus chamados</span></button>
  <button type="button" class="q-o" data-q="notify" data-testid="button-quick-notify">${P('<path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0"/>')}<span>Notificações</span><em data-qbadge class="hidden"></em></button>`;
head.after(quick);
quick.addEventListener("click", (e) => {
  const q = (e.target as HTMLElement).closest<HTMLElement>("[data-q]")?.dataset.q;
  if (q === "new") $("newBtn")?.click();
  else if (q === "mine") setView("calls");
  else if (q === "notify") { e.stopPropagation(); window.scrollTo({ top: 0, behavior: "smooth" }); $("notifyBtn")?.click(); }
});
const nb = $("notifyBadge");
if (nb) new MutationObserver(() => { const qb = quick.querySelector<HTMLElement>("[data-qbadge]")!; qb.textContent = nb.textContent || ""; qb.classList.toggle("hidden", nb.classList.contains("hidden")); }).observe(nb, { attributes: true, childList: true, characterData: true, subtree: true });

const dash = document.createElement("div");
dash.id = "shDash";
dash.innerHTML = `<div class="sh-dash">
  <div>
    <div class="card"><div class="sectionhead"><h2>Chamados em aberto</h2><span class="sh-mut" id="shCount"></span></div>
      <div class="sh-filters">
        <input id="shSearch" placeholder="Buscar por número, máquina, setor ou problema..." data-testid="input-search-calls">
        <select id="shSector" data-testid="select-filter-sector"><option value="">Todos os setores</option></select>
        <select id="shPrio" data-testid="select-filter-priority"><option value="">Todas as prioridades</option><option value="urgent">Urgente</option><option value="high">Alta</option><option value="normal">Média</option><option value="low">Baixa</option></select>
        <select id="shStatus" data-testid="select-filter-status"><option value="">Todos os status</option><option value="open">Aberto</option><option value="accepted">Aceito</option><option value="in_progress">Em atendimento</option><option value="waiting_parts">Aguardando peça</option><option value="completed">Concluído</option></select>
        <button class="sh-btn" type="button" id="shRefresh" data-testid="button-refresh-calls">Atualizar</button>
      </div>
      <div id="shCap" class="notice hidden">Lista limitada aos 500 chamados mais recentes. Os indicadores acima contam todos os chamados visíveis; use a busca e o Histórico para registros antigos.</div><div class="sh-tablewrap"><table class="sh-table"><thead><tr><th>Nº</th><th>Setor</th><th>Máquina / Equipamento</th><th>Problema</th><th>Prioridade</th><th>Status</th><th>Solicitante</th><th>Ações</th></tr></thead><tbody id="shRows"></tbody></table></div>
    </div>
    <div class="card"><div class="sectionhead"><h2>Últimos chamados concluídos</h2><button class="sh-btn" type="button" id="shAllHistory">Ver todos</button></div><div id="shDone" class="sh-done"></div></div>
  </div>
  <div class="card"><div class="sectionhead"><h2>Atividade recente</h2></div><div id="shActivity"></div></div>
</div>`;
document.querySelector("#app .kpis")?.after(dash);

const skel = (n: number) => Array.from({ length: n }, () => '<div class="sh-skel"></div>').join("");

function renderRows() {
  const body = $("shRows"); if (!body) return;
  const q = ($("shSearch") as HTMLInputElement).value.trim().toLowerCase();
  const sec = ($("shSector") as HTMLSelectElement).value, pr = ($("shPrio") as HTMLSelectElement).value, st = ($("shStatus") as HTMLSelectElement).value;
  const me = ctx().session?.user?.id, r = role();
  const base = st === "completed" ? dashRows.filter((x) => x.status === "completed") : dashRows.filter((x) => !["completed", "cancelled"].includes(x.status));
  const rows = base
    .filter((x) => (!sec || x.sector_id === sec) && (!pr || x.priority === pr) && (!st || x.status === st))
    .filter((x) => !q || [num(x.id), x.title, x.description, x.equipment?.name, x.equipment?.code, sectorsMap[x.sector_id]].join(" ").toLowerCase().includes(q));
  const c = $("shCount"); if (c) c.textContent = rows.length + " de " + base.length + (capped ? " (500 mais recentes)" : "");
  if (!rows.length) { body.innerHTML = `<tr><td colspan="8"><div class="empty">Nenhum chamado em aberto com esses filtros.</div></td></tr>`; return; }
  body.innerHTML = rows.map((x, i) => {
    let act = `<button class="sh-btn" type="button" data-see="${x.id}" data-testid="button-view-${x.id}">Ver</button>`;
    if (r === "mechanic" && x.status === "open") act += `<button class="sh-btn pri" type="button" data-accept="${x.id}" data-testid="button-accept-${x.id}">Assumir</button>`;
    else if (x.mechanic_id === me && x.status === "accepted") act += `<button class="sh-btn pri" type="button" data-start="${x.id}">Iniciar</button>`;
    return `<tr style="--pc:${(PRIO[x.priority] || ["", "transparent"])[1]};animation-delay:${Math.min(i, 12) * 18}ms" data-testid="row-call-${x.id}">
      <td class="mono">${num(x.id)}</td><td class="hm">${esc(sectorsMap[x.sector_id] || "—")}</td>
      <td class="trunc">${esc(x.equipment?.name || "Sem equipamento")}</td><td class="trunc" title="${esc(x.description || "")}">${esc(x.title || "Sem título")}</td>
      <td>${badge(PRIO, x.priority)}</td><td>${badge(STATUS, x.status)}</td><td class="hm">${esc(peopleMap[x.requester_id] || "—")}</td>
      <td><div class="sh-acts">${act}</div></td></tr>`;
  }).join("");
}
dash.addEventListener("click", (e) => {
  const t = (e.target as HTMLElement).closest<HTMLElement>("[data-see],[data-accept],[data-start],[data-open-call],#shRefresh,#shAllHistory");
  if (!t) return;
  if (t.dataset.see) w.details?.(t.dataset.see);
  else if (t.dataset.openCall) w.details?.(t.dataset.openCall);
  else if (t.dataset.accept) w.acceptTicket?.(t.dataset.accept);
  else if (t.dataset.start) w.startTicket?.(t.dataset.start);
  else if (t.id === "shRefresh") void w.loadTickets?.();
  else if (t.id === "shAllHistory") { if (role() === "admin") { setView("calls"); w.openHistoryPanel?.(); } else { setView("calls"); w.applyTicketFilter?.("completed"); } }
});
["shSearch", "shSector", "shPrio", "shStatus"].forEach((id) => $(id)?.addEventListener(id === "shSearch" ? "input" : "change", renderRows));

const EV_ICON: Record<string, [string, string]> = {
  created: [I.plus, "var(--accent-b)"], part_requested: [I.box, "var(--accent-p)"], completed: [I.check, "var(--accent-g)"],
  accepted: [I.wrench, "var(--accent-y)"], status_changed: [I.clock, "var(--accent-b)"],
};

let loadSeq = 0;
async function refreshDashboard() {
  const c = ctx(); if (!c.session || !c.profile || !w.sb) return;
  const seq = ++loadSeq;
  const sb = w.sb;
  if (!dashRows.length) { $("shRows")!.innerHTML = `<tr><td colspan="8">${skel(4)}</td></tr>`; $("shActivity")!.innerHTML = skel(5); }
  const [wo, se, pe, ev] = await Promise.all([
    sb.from("work_orders").select("id,title,description,priority,status,sector_id,requester_id,mechanic_id,created_at,opened_at,completed_at,equipment(name,code)").order("created_at", { ascending: false }).limit(500),
    sb.from("sectors").select("id,name,active").order("name"),
    sb.from("profiles").select("id,full_name"),
    sb.from("work_order_events").select("id,event_type,description,created_at,work_order_id").order("created_at", { ascending: false }).limit(10),
  ]);
  if (seq !== loadSeq || !ctx().profile) return;
  if (wo.error) { $("shRows")!.innerHTML = `<tr><td colspan="8"><div class="empty">Não foi possível carregar os chamados: ${esc(wo.error.message)} <button class="sh-btn" id="shRefresh" type="button">Tentar novamente</button></div></td></tr>`; return; }
  dashRows = wo.data || [];
  capped = dashRows.length >= 500;
  $("shCap")!.classList.toggle("hidden", !capped);
  sectorsMap = Object.fromEntries((se.data || []).map((s: any) => [s.id, s.name]));
  peopleMap = Object.fromEntries((pe.data || []).map((p: any) => [p.id, p.full_name]));
  const sel = $("shSector") as HTMLSelectElement, prev = sel.value;
  sel.innerHTML = '<option value="">Todos os setores</option>' + (se.data || []).map((s: any) => `<option value="${s.id}">${esc(s.name)}</option>`).join("");
  sel.value = prev;
  renderRows();
  const done = dashRows.filter((x) => x.status === "completed").sort((a, b) => String(b.completed_at || "").localeCompare(String(a.completed_at || ""))).slice(0, 4);
  $("shDone")!.innerHTML = done.length ? done.map((x) => `<button type="button" class="sh-donecard" data-open-call="${x.id}"><div style="display:flex;justify-content:space-between"><b class="mono">${num(x.id)}</b><small class="sh-mut">${esc(sectorsMap[x.sector_id] || "")}</small></div><div>${esc(x.equipment?.name || x.title || "")}</div><div style="display:flex;justify-content:space-between;margin-top:4px"><small class="sh-mut">${fmt(x.completed_at)}</small>${badge(STATUS, "completed")}</div></button>`).join("") : '<div class="empty">Nenhum chamado concluído ainda.</div>';
  const act = $("shActivity")!;
  if (ev.error) act.innerHTML = `<div class="empty">Atividade indisponível: ${esc(ev.error.message)}</div>`;
  else if (!(ev.data || []).length) act.innerHTML = '<div class="empty">Sem atividade registrada.</div>';
  else act.innerHTML = ev.data.map((e: any, i: number) => {
    const [ic, col] = EV_ICON[e.event_type] || [I.clock, "var(--accent-b)"];
    return `<div class="sh-act" data-open-call="${e.work_order_id}" style="--c:${col};animation-delay:${i * 25}ms"><i>${ic}</i><div><b>${esc(e.description || e.event_type || "Evento")}</b><small class="mono">${num(e.work_order_id)}</small></div><small>${new Date(e.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</small></div>`;
  }).join("");
}
$("shActivity")?.addEventListener("click", (e) => { const t = (e.target as HTMLElement).closest<HTMLElement>("[data-open-call]"); if (t?.dataset.openCall) w.details?.(t.dataset.openCall); });

// Wrap legacy loadTickets so every refresh path also updates the dashboard.
if (typeof w.loadTickets === "function") {
  const orig = w.loadTickets;
  w.loadTickets = async function () { const r = await orig.apply(this, arguments as any); void refreshDashboard(); return r; };
}

// ---------------- Call detail (reference layout) ----------------
let detailSeq = 0;
w.details = async function (id: string) {
  const c = ctx(); const sb = w.sb;
  if (!c.session || !c.profile) return;
  const mc = $("modalContent")!, modal = $("modal")!;
  const mySeq = ++detailSeq, uid = c.session.user.id;
  const stale = () => mySeq !== detailSeq || ctx().session?.user?.id !== uid || !ctx().profile;
  mc.innerHTML = skel(8); modal.classList.remove("hidden");
  try {
    const r = await sb.from("work_orders").select("id,title,description,priority,status,scheduled_for,opened_at,started_at,completed_at,created_at,photo_path,equipment_id,mechanic_id,requester_id,sector_id,equipment(name,code),mechanic:profiles!work_orders_mechanic_id_fkey(full_name)").eq("id", id).single();
    if (r.error) throw r.error; const x = r.data; if (!x) throw new Error("Chamado não encontrado.");
    const [rep, parts, photos, events, sec, req] = await Promise.all([
      sb.from("maintenance_reports").select("diagnosis,work_performed,parts_used,created_at").eq("work_order_id", id).order("created_at", { ascending: false }).limit(1),
      sb.from("part_requests").select("id,part_name,quantity,status,requested_at").eq("work_order_id", id).order("requested_at", { ascending: true }),
      sb.from("maintenance_photos").select("photo_path,photo_type,description,created_at").eq("work_order_id", id).order("created_at", { ascending: true }),
      sb.from("work_order_events").select("event_type,description,created_at").eq("work_order_id", id).order("created_at", { ascending: true }),
      x.sector_id ? sb.from("sectors").select("name").eq("id", x.sector_id).maybeSingle() : Promise.resolve({ data: null }),
      x.requester_id ? sb.from("profiles").select("full_name").eq("id", x.requester_id).maybeSingle() : Promise.resolve({ data: null }),
    ]);
    for (const q of [rep, parts, photos, events]) if (q.error) throw q.error;
    if (stale()) return;
    const mr = rep.data?.[0] || {};
    let dur = "Não iniciado";
    if (x.started_at) { const m = Math.max(0, Math.floor(((x.completed_at ? +new Date(x.completed_at) : Date.now()) - +new Date(x.started_at)) / 60000)); dur = `${Math.floor(m / 60)}h${String(m % 60).padStart(2, "0")}`; }
    const sign = async (p: string) => { const s = await sb.storage.from("maintenance-photos").createSignedUrl(p, 3600); return s.error ? "" : s.data?.signedUrl || ""; };
    let photoHtml = "";
    if (x.photo_path) { const u = await sign(x.photo_path); if (u) photoHtml += `<div class="sh-kv"><small>Foto do problema</small><img class="photo" src="${esc(u)}" alt="Foto do problema"></div>`; }
    for (const ph of photos.data || []) { const u = await sign(ph.photo_path); if (u) photoHtml += `<div class="sh-kv"><small>${esc(ph.photo_type || "Foto")} ${esc(ph.description || "")}</small><img class="photo" src="${esc(u)}" alt="Foto da manutenção"></div>`; }
    if (stale()) return;
    const me = c.session.user.id, rl = c.profile.role, mine = x.mechanic_id === me;
    const acts: string[] = [];
    if (rl === "mechanic" && x.status === "open") acts.push(`<button class="btn primary" data-do="acceptTicket" data-testid="button-detail-accept">Assumir chamado</button>`);
    if (mine && x.status === "accepted") acts.push(`<button class="btn primary" data-do="startTicket" data-testid="button-detail-start">Iniciar atendimento</button>`);
    if (mine && x.status === "in_progress") acts.push(`<button class="btn secondary" data-do="partTicket" data-testid="button-detail-part" title="Move o chamado para Aguardando peça">Solicitar peça (pausa em Aguardando peça)</button><button class="btn green" data-do="reportTicket" data-testid="button-detail-report">Registrar serviço e finalizar</button>`);
    if (mine && x.status === "waiting_parts") acts.push(`<button class="btn primary" data-do="resumeTicket" data-testid="button-detail-resume">Retomar atendimento</button>`);
    const partsRows = (parts.data || []).map((p: any) => `<tr><td>${esc(p.part_name)}</td><td class="mono">${esc(p.quantity)}</td><td>${fmt(p.requested_at)}</td><td>${esc(PART[p.status] || p.status)}</td></tr>`).join("");
    const timeline = (events.data || []).map((e: any) => `<div class="historyitem"><b class="mono">${fmt(e.created_at)}</b> ${esc(e.description || e.event_type || "Evento")}</div>`).join("");
    mc.innerHTML = `<div class="sh-dhead"><h2>Chamado <span class="mono">${num(x.id)}</span></h2>${badge(PRIO, x.priority)}${badge(STATUS, x.status)}</div>
      ${x.scheduled_for ? `<div class="notice">Data programada: ${esc(w.fmtPlannedDate ? w.fmtPlannedDate(x.scheduled_for) : x.scheduled_for)}</div>` : ""}
      <div class="sh-info"><div><small>Setor</small><b>${esc(sec.data?.name || "—")}</b></div><div><small>Máquina / Equipamento</small><b>${esc(x.equipment?.name || "Sem equipamento")}${x.equipment?.code ? " · " + esc(x.equipment.code) : ""}</b></div><div><small>Solicitante</small><b>${esc(req.data?.full_name || "—")}</b></div><div><small>Aberto em</small><b>${fmt(x.opened_at || x.created_at)}</b></div></div>
      <div class="sh-box"><h3>Problema</h3><b>${esc(x.title || "Sem título")}</b><div class="sh-mut" style="margin-top:4px">${esc(x.description || "Sem descrição")}</div></div>
      <div class="sh-dgrid"><div>
        <div class="sh-box"><h3>Atendimento</h3>
          <div class="sh-kv"><small>Mecânico responsável</small><b>${esc(x.mechanic?.full_name || "Não definido")}</b></div>
          <div class="sh-kv"><small>Início</small>${fmt(x.started_at) || "Não iniciado"}</div>
          <div class="sh-kv"><small>Conclusão</small>${fmt(x.completed_at) || "Não concluído"}</div>
          <div class="sh-kv"><small>Tempo de manutenção</small><span class="mono">${dur}</span></div>
          <div class="sh-kv"><small>Diagnóstico</small>${esc(mr.diagnosis || "Não registrado")}</div>
          <div class="sh-kv"><small>Serviço realizado</small>${esc(mr.work_performed || "Não registrado")}</div>
          <div class="sh-kv"><small>Peças utilizadas</small>${esc(mr.parts_used || "Nenhuma")}</div>
        </div>
        ${photoHtml ? `<div class="sh-box"><h3>Fotos</h3>${photoHtml}</div>` : ""}
      </div><div>
        <div class="sh-box"><h3>Peças solicitadas</h3>${partsRows ? `<div class="sh-tablewrap"><table class="sh-table" style="min-width:0"><thead><tr><th>Peça</th><th>Qtd</th><th>Solicitado em</th><th>Status</th></tr></thead><tbody>${partsRows}</tbody></table></div>` : '<div class="sh-mut">Nenhuma peça solicitada.</div>'}</div>
        <div class="sh-box" id="shPurchaseSlot" style="display:none"><h3>Solicitações de compra</h3><div id="shPurchaseBody"></div></div>
        ${timeline ? `<div class="sh-box"><h3>Histórico do chamado</h3><div class="history">${timeline}</div></div>` : ""}
      </div></div>
      ${acts.length ? `<div class="sh-dfoot">${acts.join("")}</div>` : ""}`;
    mc.querySelectorAll<HTMLButtonElement>("[data-do]").forEach((b) => b.addEventListener("click", async () => {
      const fn = w[b.dataset.do!]; if (typeof fn !== "function") return;
      if (b.dataset.do !== "reportTicket") { await fn(id); if (!stale() && !modal.classList.contains("hidden")) void w.details(id); }
      else await fn(id);
    }));
    // Optional integration: main agent's purchase module can render into the slot.
    if (typeof ops().renderPurchaseRequests === "function") {
      const slot = $("shPurchaseSlot")!; slot.style.display = "";
      try { if (!stale()) await ops().renderPurchaseRequests(id, $("shPurchaseBody")); } catch (e: any) { $("shPurchaseBody")!.innerHTML = `<div class="sh-mut">${esc(e?.message || "Indisponível")}</div>`; }
    }
  } catch (e: any) {
    if (stale()) return;
    mc.innerHTML = `<div class="notice error" role="alert" data-testid="status-detail-error">Não foi possível abrir os detalhes do chamado: ${esc(e?.message || e)}</div><div class="actions"><button class="btn secondary" type="button" id="shDetailRetry">Tentar novamente</button></div>`;
    $("shDetailRetry")?.addEventListener("click", () => w.details(id));
  }
};

// ---------------- Settings ----------------
const settings = document.createElement("section");
settings.className = "sh-settings";
app.append(settings);
let setTab = "alerts";

function renderSettings() {
  const admin = role() === "admin";
  const tabs: [string, string][] = [["general", "Geral"], ["alerts", "Avisos e sons"], ["sectors", "Setores"], ["profiles", "Perfis de acesso"]];
  const p = prefs();
  const toggle = (k: keyof Prefs, label: string) => `<div class="sh-row"><span>${label}</span><button type="button" class="sh-switch ${p[k] ? "on" : ""}" data-pref="${k}" data-testid="toggle-${k}" aria-pressed="${!!p[k]}" aria-label="${label}"></button></div>`;
  const toneSel = (k: "toneNew" | "toneUrgent") => `<select class="sh-input" data-tone="${k}" data-testid="select-${k}" style="width:auto">${Object.entries(TONES).map(([v, [l]]) => `<option value="${v}" ${p[k] === v ? "selected" : ""}>${l}</option>`).join("")}</select>`;
  let body = "";
  if (setTab === "general") {
    const light = document.documentElement.classList.contains("light");
    body = `<div class="sh-row"><span>Tema ${light ? "claro" : "escuro"}</span><button class="sh-switch ${light ? "" : "on"}" type="button" data-act="theme" aria-label="Alternar tema"></button></div>
      <div class="sh-row"><span>Atualizar aplicativo e limpar cache local</span><button class="sh-btn" type="button" data-act="refresh">Atualizar</button></div>
      <div class="sh-row"><span>Encerrar sessão neste aparelho</span><button class="sh-btn" type="button" data-act="logout">Sair</button></div>`;
  } else if (setTab === "alerts") {
    const nativeAndroid = !!w.nativePushManager?.isAvailable?.();
    body = `<div class="sh-dgrid"><div><div class="sh-box"><h3>Toques de aviso</h3>${toggle("newCall", "Novo chamado")}${toggle("urgent", "Chamado urgente")}${toggle("part", "Peça solicitada")}${toggle("status", "Mudança de status")}</div></div>
      <div><div class="sh-box"><h3>Volume do aviso</h3><div class="sh-row"><input type="range" min="5" max="100" class="sh-range" data-act="volume" value="${p.volume}" data-testid="range-volume"><b class="mono" id="shVol">${p.volume}%</b></div>
      <div class="sh-row"><span>Toque para novo chamado</span><span style="display:flex;gap:6px">${toneSel("toneNew")}<button class="sh-btn" type="button" data-test="toneNew">Testar</button></span></div>
      <div class="sh-row"><span>Toque para chamado urgente</span><span style="display:flex;gap:6px">${toneSel("toneUrgent")}<button class="sh-btn" type="button" data-test="toneUrgent">Testar</button></span></div></div>
      <div class="sh-box"><h3>Notificações do aparelho</h3><p class="sh-mut">${nativeAndroid ? "No Android o som segue o canal de notificação do sistema; os toques acima valem com o app aberto em Web/Windows." : "Permite avisos com o sistema em segundo plano."}</p><button class="btn primary" type="button" data-act="push" data-testid="button-settings-push">Ativar notificações no aparelho</button></div></div></div>`;
  } else if (setTab === "sectors") {
    body = `<div class="sectionhead"><h2>Setores</h2>${admin ? `<button class="btn primary" type="button" data-act="sectors" data-testid="button-manage-sectors">Novo setor / gerenciar</button>` : ""}</div><div id="shSectorList">${skel(4)}</div>
      <p class="sh-mut">O login e a senha pertencem ao usuário do perfil Setor; para criar o acesso de um setor, use Usuários e Setores.</p>${admin ? `<button class="btn secondary" type="button" data-act="users">Abrir usuários</button>` : ""}`;
    void loadSectorList();
  } else {
    body = `<div class="sh-prof"><span class="sh-mark">${I.users}</span><div><b>Administrador</b><div class="sh-mut">Acesso total da organização: usuários, setores, máquinas, peças, preventivas e histórico.</div></div></div>
      <div class="sh-prof"><span class="sh-mark">${I.wrench}</span><div><b>Mecânico</b><div class="sh-mut">Assume chamados abertos e conduz apenas os próprios atendimentos: início, peças e registro de serviço.</div></div></div>
      <div class="sh-prof"><span class="sh-mark">${I.list}</span><div><b>Setor / Solicitante</b><div class="sh-mut">Abre chamados do seu setor e acompanha o andamento. Não assume chamados.</div></div></div>
      <div class="sh-prof off"><span class="sh-mark">${I.alert}</span><div><b>Supervisor de manutenção</b><div class="sh-mut">Indisponível: este perfil não existe nas permissões do banco atual.</div></div></div>`;
  }
  settings.innerHTML = `<div class="card"><div class="sectionhead"><h2>Configurações</h2></div><div class="sh-setgrid"><div class="sh-tabs">${tabs.map(([k, l]) => `<button type="button" data-tab="${k}" class="${setTab === k ? "active" : ""}">${l}</button>`).join("")}</div><div>${body}</div></div></div>`;
}
async function loadSectorList() {
  const el = $("shSectorList"); if (!el || !w.sb) return;
  const [s, u] = await Promise.all([w.sb.from("sectors").select("id,name,active").order("name"), w.sb.from("profiles").select("id,sector_id,login")]);
  if (!$("shSectorList") || !ctx().profile) return;
  if (s.error) { el.innerHTML = `<div class="empty">${esc(s.error.message)}</div>`; return; }
  const cnt: Record<string, number> = {}, logins: Record<string, string[]> = {};
  (u.data || []).forEach((p: any) => { if (p.sector_id) { cnt[p.sector_id] = (cnt[p.sector_id] || 0) + 1; if (p.login) (logins[p.sector_id] ||= []).push(p.login); } });
  el.innerHTML = (s.data || []).length ? `<div class="sh-tablewrap"><table class="sh-table" style="min-width:0"><thead><tr><th>Setor</th><th>Usuários</th><th>Login</th><th>Situação</th></tr></thead><tbody>${s.data.map((x: any) => `<tr><td>${esc(x.name)}</td><td class="mono">${cnt[x.id] || 0}</td><td class="mono">${esc((logins[x.id] || []).join(", ") || "—")}</td><td>${x.active === false ? badge(STATUS, "cancelled").replace("Cancelado", "Inativo") : badge(STATUS, "completed").replace("Concluído", "Ativo")}</td></tr>`).join("")}</tbody></table></div>` : '<div class="empty">Nenhum setor cadastrado.</div>';
}
settings.addEventListener("click", async (e) => {
  const t = e.target as HTMLElement;
  const tab = t.closest<HTMLElement>("[data-tab]"); if (tab) { setTab = tab.dataset.tab!; renderSettings(); return; }
  const pf = t.closest<HTMLElement>("[data-pref]");
  if (pf) { const p: any = prefs(); p[pf.dataset.pref!] = !p[pf.dataset.pref!]; savePrefs(p); pf.classList.toggle("on", p[pf.dataset.pref!]); pf.setAttribute("aria-pressed", String(p[pf.dataset.pref!])); return; }
  const tst = t.closest<HTMLElement>("[data-test]"); if (tst) { const p: any = prefs(); void playTone(p[tst.dataset.test!], p.volume); return; }
  const a = t.closest<HTMLElement>("[data-act]")?.dataset.act;
  if (a === "theme") { $("themeBtn")?.click(); renderSettings(); renderSide(); }
  else if (a === "refresh") $("refreshBtn")?.click();
  else if (a === "logout") $("logoutBtn")?.click();
  else if (a === "push") $("enablePushBtn")?.click();
  else if (a === "sectors") w.openSectorsPanel?.();
  else if (a === "users") { setView("calls"); w.openUsersPanel?.(); }
});
settings.addEventListener("input", (e) => {
  const t = e.target as HTMLInputElement;
  if (t.dataset.act === "volume") { const p = prefs(); p.volume = Number(t.value); savePrefs(p); const v = $("shVol"); if (v) v.textContent = p.volume + "%"; }
});
settings.addEventListener("change", (e) => {
  const t = e.target as HTMLSelectElement;
  if (t.dataset.tone) { const p: any = prefs(); p[t.dataset.tone] = t.value; savePrefs(p); }
});

// ---------------- Lifecycle ----------------
$("newBtn")?.addEventListener("click", () => { if (app.dataset.view !== "calls") setView("calls"); }, true);
$("themeBtn")?.addEventListener("click", () => setTimeout(renderSide, 0));
window.addEventListener("maintenance-access-locked", () => {
  loadSeq++; dashRows = []; sectorsMap = {}; peopleMap = {};
  for (const id of ["shRows", "shActivity", "shDone", "shCount"]) $(id)?.replaceChildren();
  settings.replaceChildren(); detailSeq++; head.querySelector("[data-who]")!.replaceChildren(); quick.classList.add("hidden");
  app.dataset.view = "dash"; document.body.classList.remove("sh-on");
});
// Show shell only while #app is visible (suspend/resume hide #app; nothing leaks outside it).
const sync = () => {
  const on = !app.classList.contains("hidden");
  document.body.classList.toggle("sh-on", on);
  if (on) { renderSide(); renderHead(); if (!dashRows.length) void refreshDashboard(); }
};
new MutationObserver(sync).observe(app, { attributes: true, attributeFilter: ["class"] });
app.dataset.view = app.dataset.view || "dash";
sync();
window.addEventListener("maintenance-operations-ready", renderSide);
w.maintenanceShell = { setView, refreshDashboard, renderSide };
