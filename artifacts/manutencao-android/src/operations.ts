// Real stock, purchasing and report screens, using the existing Supabase client.
type AnyWin = Window & Record<string, any>;
const w = window as unknown as AnyWin;
const $ = (id: string) => document.getElementById(id) as HTMLElement | null;
const input = (id: string) => $(id) as HTMLInputElement;
const esc = (s: unknown) => String(s ?? "").replace(/[&<>'"]/g, c => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;",
}[c]!));
const fmt = (s: string) => s ? new Date(s).toLocaleString("pt-BR") : "—";
const code = (s: string) => "#" + s.replace(/-/g, "").slice(0, 6).toUpperCase();
const context = () => w.__maintenanceContext?.() || {};
let epoch = 0;
window.addEventListener("maintenance-access-locked", () => { epoch++; });
const stamp = () => ({ epoch, user: context().session?.user?.id });
const current = (s: ReturnType<typeof stamp>) => s.epoch === epoch && s.user === context().session?.user?.id && !!context().profile;
function admin() {
  const c = context();
  if (!c.session || c.profile?.role !== "admin") throw new Error("Acesso exclusivo do administrador.");
  return c;
}
export function positiveNumber(value: string, allowZero = false) {
  const n = Number(value.replace(",", "."));
  if (!value.trim() || !Number.isFinite(n) || (allowZero ? n < 0 : n <= 0))
    throw new Error("Informe uma quantidade ou valor válido.");
  return n;
}
export function csvCell(value: unknown) {
  let v = String(value ?? "");
  if (/^[=+\-@\t\r]|^\s+[=+\-@]/.test(v)) v = "'" + v;
  return '"' + v.replace(/"/g, '""') + '"';
}
const statuses: Record<string, string> = { requested: "Solicitada", ordered: "Em compra", purchased: "Em compra", received: "Recebida", cancelled: "Cancelada" };
function result(r: any) { if (r.error) throw r.error; return r.data; }
function showError(error: any, label: string) {
  alert(`${label}: ${error?.message || "O servidor não confirmou a operação. Tente novamente."}`);
}
function message(el: HTMLElement, text: string, ok = false) {
  el.textContent = text; el.className = "notice " + (ok ? "ok" : "error");
}
function show(title: string, html: string) {
  admin();
  $("modalContent")!.innerHTML = `<h2>${esc(title)}</h2>${html}`;
  $("modal")!.classList.remove("hidden");
}
const table = (heads: string[], rows: string) => `<div class="sh-tablewrap"><table class="sh-table"><thead><tr>${heads.map(h => `<th>${h}</th>`).join("")}</tr></thead><tbody>${rows || `<tr><td colspan="${heads.length}"><div class="empty">Nenhum registro encontrado.</div></td></tr>`}</tbody></table></div>`;

async function openInventory() {
  try {
    const c = admin(), s = stamp();
    const items = result(await w.sb.from("inventory_items").select("id,name,code,unit,location,stock_quantity,min_quantity,active").eq("organization_id", c.profile.organization_id).order("name"));
    if (!current(s)) return;
    show("Estoque de peças", `<p class="small">Saldos reais. Entradas e saídas ficam registradas; o sistema não permite saldo negativo.</p>
      <div class="actions"><button class="btn primary" id="opNewItem" data-testid="button-new-stock-item">Nova peça</button><button class="btn secondary" id="opStockRefresh">Atualizar</button></div>
      <div class="field"><label for="opStockSearch">Buscar no estoque</label><input id="opStockSearch" placeholder="Nome, código ou localização"></div><div id="opStockRows"></div>`);
    const rows = $("opStockRows")!;
    const draw = () => {
      const q = input("opStockSearch").value.toLocaleLowerCase();
      rows.innerHTML = table(["Peça", "Código", "Saldo", "Mínimo", "Localização", "Situação", "Ações"], items.filter((i: any) => `${i.name} ${i.code || ""} ${i.location || ""}`.toLocaleLowerCase().includes(q)).map((i: any) =>
        `<tr data-testid="row-stock-${i.id}"><td>${esc(i.name)}</td><td>${esc(i.code || "—")}</td><td>${esc(i.stock_quantity)} ${esc(i.unit)}</td><td>${esc(i.min_quantity)}</td><td>${esc(i.location || "—")}</td><td>${!i.active ? "Inativa" : Number(i.stock_quantity) <= Number(i.min_quantity) ? "Estoque baixo" : "Disponível"}</td><td><div class="sh-acts">
        <button class="sh-btn" data-edit="${i.id}">Editar</button><button class="sh-btn" data-moves="${i.id}">Movimentações</button>${i.active ? `<button class="sh-btn pri" data-move="${i.id}">Entrada / saída</button>` : ""}</div></td></tr>`).join(""));
    };
    draw(); input("opStockSearch").oninput = draw;
    $("opNewItem")!.onclick = () => itemForm();
    $("opStockRefresh")!.onclick = () => void openInventory();
    rows.onclick = e => {
      const b = (e.target as HTMLElement).closest<HTMLElement>("[data-edit],[data-move],[data-moves]");
      if (!b) return;
      const item = items.find((i: any) => i.id === (b.dataset.edit || b.dataset.move || b.dataset.moves));
      if (b.dataset.edit) itemForm(item);
      else if (b.dataset.move) moveForm(item);
      else void movementHistory(item);
    };
  } catch (e: any) { showError(e, "Não foi possível abrir o estoque"); }
}

function itemForm(item: any = null) {
  show(item ? "Editar peça" : "Cadastrar peça", `<div class="formgrid">
    <label>Nome<input id="opItemName" value="${esc(item?.name || "")}" required data-testid="input-stock-name"></label>
    <label>Código<input id="opItemCode" value="${esc(item?.code || "")}"></label>
    <label>Unidade<input id="opItemUnit" value="${esc(item?.unit || "un")}"></label>
    <label>Localização<input id="opItemLocation" value="${esc(item?.location || "")}"></label>
    <label>Estoque mínimo<input id="opItemMin" type="number" min="0" step="any" value="${item?.min_quantity || 0}"></label>
    ${item ? `<label>Situação<select id="opItemActive"><option value="true" ${item.active ? "selected" : ""}>Ativa</option><option value="false" ${!item.active ? "selected" : ""}>Inativa</option></select></label>` : ""}</div>
    <p class="small">O saldo só muda por movimentação ou recebimento de compra, preservando o histórico.</p>
    <div class="notice hidden" id="opItemMsg"></div><div class="actions"><button class="btn primary" id="opItemSave" data-testid="button-save-stock-item">Salvar</button><button class="btn secondary" id="opItemCancel">Voltar</button></div>`);
  $("opItemCancel")!.onclick = () => void openInventory();
  $("opItemSave")!.onclick = async () => {
    const b = $("opItemSave") as HTMLButtonElement, msg = $("opItemMsg")!, s = stamp();
    b.disabled = true;
    try {
      const c = admin(), name = input("opItemName").value.trim(), unit = input("opItemUnit").value.trim();
      if (!name || !unit) throw new Error("Preencha nome e unidade.");
      const body: any = { name, unit, code: input("opItemCode").value.trim() || null,
        location: input("opItemLocation").value.trim() || null, min_quantity: positiveNumber(input("opItemMin").value, true) };
      if (item) { body.active = input("opItemActive").value === "true"; result(await w.sb.from("inventory_items").update(body).eq("id", item.id).select("id").single()); }
      else { body.organization_id = c.profile.organization_id; result(await w.sb.from("inventory_items").insert(body).select("id").single()); }
      if (current(s)) await openInventory();
    } catch (e: any) { if (current(s)) message(msg, e.message); } finally { b.disabled = false; }
  };
}
function moveForm(item: any) {
  show("Movimentar estoque", `<p>${esc(item.name)} · saldo atual: <b>${esc(item.stock_quantity)} ${esc(item.unit)}</b></p>
    <div class="field"><label>Tipo</label><select id="opMoveKind"><option value="in">Entrada</option><option value="out">Saída</option></select></div>
    <div class="field"><label>Quantidade</label><input id="opMoveQty" type="number" min="0.001" step="any" data-testid="input-stock-quantity"></div>
    <div class="field"><label>Motivo / chamado</label><input id="opMoveReason" placeholder="Ex.: utilização no chamado de teste" data-testid="input-stock-reason"></div>
    <div class="notice hidden" id="opMoveMsg"></div><div class="actions"><button class="btn primary" id="opMoveSave" data-testid="button-save-stock-movement">Registrar movimentação</button><button class="btn secondary" id="opMoveCancel">Voltar</button></div>`);
  $("opMoveCancel")!.onclick = () => void openInventory();
  $("opMoveSave")!.onclick = async () => {
    const b = $("opMoveSave") as HTMLButtonElement, msg = $("opMoveMsg")!, s = stamp();
    b.disabled = true;
    try {
      admin(); let qty = positiveNumber(input("opMoveQty").value);
      const reason = input("opMoveReason").value.trim();
      if (!reason) throw new Error("Informe o motivo da movimentação.");
      if (input("opMoveKind").value === "out") qty = -qty;
      result(await w.sb.rpc("maintenance_stock_move", { p_item: item.id, p_quantity: qty, p_reason: reason }));
      if (current(s)) await openInventory();
    } catch (e: any) { if (current(s)) message(msg, e.message); } finally { b.disabled = false; }
  };
}
async function movementHistory(item: any) {
  try {
    admin(); const s = stamp();
    const rows = result(await w.sb.from("inventory_movements").select("quantity,balance_after,reason,created_at").eq("inventory_item_id", item.id).order("created_at", { ascending: false }).limit(200));
    if (!current(s)) return;
    show("Movimentações — " + item.name, table(["Data", "Quantidade", "Saldo após", "Motivo"], rows.map((m: any) => `<tr><td>${fmt(m.created_at)}</td><td>${Number(m.quantity) > 0 ? "+" : ""}${esc(m.quantity)}</td><td>${esc(m.balance_after)}</td><td>${esc(m.reason)}</td></tr>`).join("")) + '<div class="actions"><button class="btn secondary" id="opBackStock">Voltar ao estoque</button></div>');
    $("opBackStock")!.onclick = () => void openInventory();
  } catch (e: any) { showError(e, "Não foi possível carregar movimentações"); }
}

async function openPurchases() {
  try {
    const c = admin(), s = stamp(), org = c.profile.organization_id;
    const [pr, parts, stock] = await Promise.all([
      w.sb.from("purchase_requests").select("id,part_name,quantity,status,supplier,unit_cost,expected_date,work_order_id,part_request_id,created_at,received_at").eq("organization_id", org).order("created_at", { ascending: false }).limit(200),
      w.sb.from("part_requests").select("id,part_name,quantity,status,work_order_id,requested_at").eq("organization_id", org).eq("status", "requested").order("requested_at", { ascending: false }),
      w.sb.from("inventory_items").select("id,name,unit").eq("organization_id", org).eq("active", true).order("name"),
    ]);
    const rows = result(pr), pending = result(parts), items = result(stock);
    if (!current(s)) return;
    const linked = new Set(rows.filter((x: any) => x.status !== "cancelled").map((x: any) => x.part_request_id));
    show("Solicitações de compra", `<div class="actions"><button class="btn primary" id="opNewPurchase" data-testid="button-new-purchase">Nova compra</button><button class="btn secondary" id="opRefreshPurchases">Atualizar</button></div>
      <div class="field"><label>Filtrar por situação</label><select id="opPurchaseFilter"><option value="">Todas</option>${Object.entries(statuses).filter(([k]) => k !== "purchased").map(([k, label]) => `<option value="${k}">${label}</option>`).join("")}</select></div><div id="opPurchaseRows"></div>
      <h3>Peças solicitadas aguardando compra</h3><div id="opPendingParts">${table(["Peça", "Qtd", "Chamado", "Ação"], pending.filter((p: any) => !linked.has(p.id)).map((p: any) => `<tr><td>${esc(p.part_name)}</td><td>${esc(p.quantity)}</td><td>${code(p.work_order_id)}</td><td><button class="sh-btn pri" data-buy-part="${p.id}">Criar compra</button></td></tr>`).join(""))}</div><p class="small">Confirmar compra não faz pagamentos. O recebimento registra uma entrada no estoque e atualiza a solicitação de peça.</p>`);
    const container = $("opPurchaseRows")!;
    const draw = () => { container.innerHTML = table(["Peça", "Qtd", "Fornecedor", "Valor total", "Previsão", "Situação", "Ações"], rows.filter((p: any) => !input("opPurchaseFilter").value || p.status === input("opPurchaseFilter").value).map((p: any) =>
      `<tr data-testid="row-purchase-${p.id}"><td>${esc(p.part_name)}</td><td>${esc(p.quantity)}</td><td>${esc(p.supplier || "—")}</td><td>${(Number(p.quantity) * Number(p.unit_cost)).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</td><td>${esc(p.expected_date ? p.expected_date.split("-").reverse().join("/") : "—")}</td><td>${statuses[p.status] || esc(p.status)}</td><td><div class="sh-acts">
      ${p.status === "requested" ? `<button class="sh-btn pri" data-order="${p.id}">Confirmar compra</button>` : ""}
      ${p.status === "ordered" ? `<button class="sh-btn pri" data-receive="${p.id}">Receber no estoque</button>` : ""}
      ${["requested", "ordered"].includes(p.status) ? `<button class="sh-btn" data-cancel="${p.id}">Cancelar</button>` : ""}
      ${p.work_order_id ? `<button class="sh-btn" data-call="${p.work_order_id}">Ver chamado</button>` : ""}</div></td></tr>`).join("")); };
    draw(); input("opPurchaseFilter").onchange = draw;
    $("opNewPurchase")!.onclick = () => purchaseForm(items);
    $("opRefreshPurchases")!.onclick = () => void openPurchases();
    $("opPendingParts")!.onclick = e => {
      const b = (e.target as HTMLElement).closest<HTMLElement>("[data-buy-part]");
      if (b) purchaseForm(items, pending.find((p: any) => p.id === b.dataset.buyPart));
    };
    container.onclick = async e => {
      const b = (e.target as HTMLElement).closest<HTMLButtonElement>("[data-order],[data-receive],[data-cancel],[data-call]");
      if (!b) return;
      if (b.dataset.call) return void w.details?.(b.dataset.call);
      if (!confirm(b.dataset.receive ? "Confirmar recebimento e entrada no estoque?" : b.dataset.cancel ? "Cancelar esta compra? O histórico será preservado." : "Confirmar que a compra foi encomendada?")) return;
      b.disabled = true;
      try {
        admin();
        if (b.dataset.receive) result(await w.sb.rpc("maintenance_purchase_receive", { p_purchase: b.dataset.receive }));
        else result(await w.sb.rpc("maintenance_purchase_status", { p_purchase: b.dataset.order || b.dataset.cancel, p_status: b.dataset.order ? "ordered" : "cancelled" }));
        if (current(s)) await openPurchases();
      } catch (e: any) { if (current(s)) showError(e, "Compra não atualizada"); } finally { b.disabled = false; }
    };
  } catch (e: any) { showError(e, "Não foi possível abrir as compras"); }
}
function purchaseForm(items: any[], part: any = null) {
  show("Cadastrar compra", `<div class="formgrid">
    <label>Peça<input id="opPurchaseName" value="${esc(part?.part_name || "")}" ${part ? "readonly" : ""} data-testid="input-purchase-name"></label>
    <label>Quantidade<input id="opPurchaseQty" type="number" min="0.001" step="any" value="${part?.quantity || 1}" ${part ? "readonly" : ""}></label>
    <label>Peça no estoque<select id="opPurchaseItem"><option value="">Criar peça ao receber</option>${items.map(i => `<option value="${i.id}">${esc(i.name)} (${esc(i.unit)})</option>`).join("")}</select></label>
    <label>Fornecedor<input id="opPurchaseSupplier"></label>
    <label>Valor unitário (R$)<input id="opPurchaseCost" type="number" min="0" step="0.01" value="0"></label>
    <label>Previsão de entrega<input id="opPurchaseExpected" type="date"></label>
    <label>Observações<input id="opPurchaseNotes"></label></div>
    <div class="notice hidden" id="opPurchaseMsg"></div><div class="actions"><button class="btn primary" id="opPurchaseSave" data-testid="button-save-purchase">Salvar solicitação</button><button class="btn secondary" id="opPurchaseBack">Voltar</button></div>`);
  $("opPurchaseBack")!.onclick = () => void openPurchases();
  $("opPurchaseSave")!.onclick = async () => {
    const b = $("opPurchaseSave") as HTMLButtonElement, msg = $("opPurchaseMsg")!, s = stamp(); b.disabled = true;
    try {
      admin(); const name = input("opPurchaseName").value.trim();
      if (!name) throw new Error("Informe o nome da peça.");
      result(await w.sb.rpc("maintenance_purchase_create", { p_name: name, p_quantity: positiveNumber(input("opPurchaseQty").value),
        p_item: input("opPurchaseItem").value || null, p_part: part?.id || null,
        p_supplier: input("opPurchaseSupplier").value.trim() || null, p_cost: positiveNumber(input("opPurchaseCost").value, true),
        p_expected: input("opPurchaseExpected").value || null, p_notes: input("opPurchaseNotes").value.trim() || null }));
      if (current(s)) await openPurchases();
    } catch (e: any) { if (current(s)) message(msg, e.message); } finally { b.disabled = false; }
  };
}
async function renderPurchaseRequests(workOrderId: string, container: HTMLElement) {
  const s = stamp();
  const rows = result(await w.sb.from("purchase_requests").select("id,part_name,quantity,status,expected_date").eq("work_order_id", workOrderId).order("created_at", { ascending: false }));
  if (!current(s) || !container.isConnected) return;
  container.innerHTML = table(["Nº", "Peça", "Qtd", "Situação", "Previsão"], rows.map((p: any) => `<tr><td>${code(p.id)}</td><td>${esc(p.part_name)}</td><td>${esc(p.quantity)}</td><td>${statuses[p.status] || esc(p.status)}</td><td>${esc(p.expected_date || "—")}</td></tr>`).join(""));
}

async function openReports() {
  try {
    const c = admin(), s = stamp();
    const eqs = result(await w.sb.from("equipment").select("id,name,code").eq("organization_id", c.profile.organization_id).order("name"));
    if (!current(s)) return;
    show("Relatórios de manutenção", `<div class="formgrid">
      <label>Máquina<select id="opReportEquipment"><option value="">Todas</option>${eqs.map((e: any) => `<option value="${e.id}">${esc(e.name)} ${esc(e.code || "")}</option>`).join("")}</select></label>
      <label>Data inicial<input id="opReportStart" type="date"></label><label>Data final<input id="opReportEnd" type="date"></label></div>
      <div class="actions"><button class="btn primary" id="opReportFilter">Aplicar filtros</button><button class="btn secondary" id="opReportExport" disabled>Exportar CSV</button></div>
      <div id="opReportSummary" class="notice hidden"></div><div id="opReportRows"></div>`);
    let loaded: any[] = [];
    const render = async () => {
      try {
        admin();
        let q = w.sb.from("maintenance_reports").select("id,work_order_id,equipment_id,diagnosis,work_performed,parts_used,created_at").eq("organization_id", c.profile.organization_id).order("created_at", { ascending: false }).limit(1000);
        const start = input("opReportStart").value, end = input("opReportEnd").value;
        if (start && end && start > end) throw new Error("A data final deve ser igual ou posterior à inicial.");
        if (input("opReportEquipment").value) q = q.eq("equipment_id", input("opReportEquipment").value);
        if (start) q = q.gte("created_at", new Date(start + "T00:00:00").toISOString());
        if (end) {
          const after = new Date(end + "T00:00:00");
          after.setDate(after.getDate() + 1);
          q = q.lt("created_at", after.toISOString());
        }
        const rows = result(await q); if (!current(s) || !$("opReportRows")) return;
        loaded = rows;
        message($("opReportSummary")!, `${rows.length} registro(s) exibido(s)${rows.length === 1000 ? " (limite de 1.000 por consulta; refine o período)" : ""}.`, true);
        $("opReportRows")!.innerHTML = table(["Data", "Máquina", "Diagnóstico", "Serviço", "Peças", "Chamado"], rows.map((r: any) =>
          `<tr><td>${fmt(r.created_at)}</td><td>${esc(eqs.find((e: any) => e.id === r.equipment_id)?.name || "—")}</td><td>${esc(r.diagnosis)}</td><td>${esc(r.work_performed)}</td><td>${esc(r.parts_used)}</td><td><button class="sh-btn" data-report-call="${r.work_order_id}">${code(r.work_order_id)}</button></td></tr>`).join(""));
        ($("opReportExport") as HTMLButtonElement).disabled = !rows.length;
      } catch (e: any) { if (current(s) && $("opReportSummary")) message($("opReportSummary")!, e.message); }
    };
    $("opReportFilter")!.onclick = () => void render();
    $("opReportRows")!.onclick = e => { const b = (e.target as HTMLElement).closest<HTMLElement>("[data-report-call]"); if (b) void w.details?.(b.dataset.reportCall); };
    $("opReportExport")!.onclick = () => {
      admin();
      const csv = [["Data", "Chamado", "Máquina", "Diagnóstico", "Serviço realizado", "Peças utilizadas"],
        ...loaded.map(r => [fmt(r.created_at), r.work_order_id, eqs.find((e: any) => e.id === r.equipment_id)?.name || "", r.diagnosis, r.work_performed, r.parts_used])].map(row => row.map(csvCell).join(";")).join("\r\n");
      const url = URL.createObjectURL(new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" }));
      const a = document.createElement("a"); a.href = url; a.download = "relatorio-manutencao.csv"; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    };
    await render();
  } catch (e: any) { showError(e, "Não foi possível abrir relatórios"); }
}
w.maintenanceOperations = { openInventory, openPurchases, openReports, renderPurchaseRequests };
window.dispatchEvent(new Event("maintenance-operations-ready"));
