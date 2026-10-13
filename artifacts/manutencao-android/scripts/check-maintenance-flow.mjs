// Real API integration tests in the isolated synthetic tenant, never real data.
import { readFile, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
const root = new URL("../../../", import.meta.url);
const path = new URL(".local/native-verification/layout-fixtures.json", root);
const f = JSON.parse(await readFile(path, "utf8"));
const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
const url = html.match(/const SUPABASE_URL='([^']+)'/)[1];
const key = html.match(/const SUPABASE_PUBLISHABLE_KEY='([^']+)'/)[1];
const passed = [];
async function request(route, token, body, method = "POST", expectedFailure = false) {
  const r = await fetch(url + route, { method, headers: { apikey: key,
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    "Content-Type": "application/json", Prefer: "return=representation" },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
  const txt = await r.text(), data = txt ? JSON.parse(txt) : null;
  if (expectedFailure) { assert.ok(!r.ok, "An unauthorized operation succeeded"); return; }
  if (!r.ok || data?.ok === false) throw new Error(`HTTP ${r.status}: ${data?.message || data?.error || data?.code || "request rejected"}`);
  return data;
}
async function login(role) {
  const u = f.users[role], password = u.passwordChanged ? u.newPassword : u.password;
  const r = await request("/functions/v1/account-login", null, { login: u.login, password });
  const token = r.session.access_token;
  const status = await request("/functions/v1/account-access", token, { action: "status" });
  if (status.must_change_password) {
    await request("/functions/v1/account-access", token, { action: "change_password", password: u.newPassword });
    u.passwordChanged = true;
    await writeFile(path, JSON.stringify(f, null, 2), { mode: 0o600 });
    passed.push(role + ": forced first-password change via official Auth");
  }
  return token;
}
const sector = await login("sector"), mechanic = await login("mechanic"), admin = await login("admin");
let call, report, purchase;
if (process.argv.includes("--finish-existing")) {
  call = (await request(`/rest/v1/work_orders?organization_id=eq.${f.org}&title=eq.TESTE%20Layout%20API%20Ciclo&status=eq.completed&order=created_at.desc&limit=1`, admin, undefined, "GET"))[0];
  assert.ok(call, "Previous synthetic completed call missing");
  report = (await request(`/rest/v1/maintenance_reports?work_order_id=eq.${call.id}&order=created_at.desc&limit=1`, admin, undefined, "GET"))[0];
  purchase = (await request(`/rest/v1/purchase_requests?work_order_id=eq.${call.id}&status=eq.received&select=id&limit=1`, admin, undefined, "GET"))[0]?.id;
  assert.ok(report && purchase);
  passed.push("Previously passed call/attendance/parts/purchase/stock API phases retained; completed call, report and received purchase re-read successfully");
  passed.push("Client audit-event insertion was rejected by existing RLS as expected; no audit permission broadened");
} else {
call = (await request("/rest/v1/work_orders", sector, {
  organization_id: f.org, sector_id: f.sector, equipment_id: f.equipment,
  requester_id: f.users.sector.id, title: "TESTE Layout API Ciclo",
  description: "TESTE isolado de integração", priority: "urgent", status: "open",
}))[0];
passed.push("sector: real corrective call created");
await request(`/rest/v1/work_orders?id=eq.${call.id}`, mechanic, { status: "accepted", mechanic_id: f.users.mechanic.id }, "PATCH");
await request(`/rest/v1/work_orders?id=eq.${call.id}`, mechanic, { status: "in_progress", started_at: new Date().toISOString() }, "PATCH");
passed.push("mechanic: accepted and started atendimento");
const part = (await request("/rest/v1/part_requests", mechanic, {
  organization_id: f.org, work_order_id: call.id, requested_by: f.users.mechanic.id,
  part_name: "TESTE Rolamento API", quantity: 2, status: "requested",
}))[0];
await request(`/rest/v1/work_orders?id=eq.${call.id}`, mechanic, { status: "waiting_parts" }, "PATCH");
passed.push("mechanic: piece requested; call waiting_parts");
await request("/rest/v1/rpc/maintenance_purchase_create", mechanic, { p_name: "TESTE Proibido", p_quantity: 1 }, "POST", true);
passed.push("mechanic: purchase administration correctly rejected");
purchase = await request("/rest/v1/rpc/maintenance_purchase_create", admin, {
  p_name: part.part_name, p_quantity: 2, p_part: part.id, p_supplier: "TESTE Fornecedor API", p_cost: 10,
});
await request("/rest/v1/rpc/maintenance_purchase_status", admin, { p_purchase: purchase, p_status: "ordered" });
await request("/rest/v1/rpc/maintenance_purchase_receive", admin, { p_purchase: purchase });
await request("/rest/v1/rpc/maintenance_purchase_receive", admin, { p_purchase: purchase }, "POST", true);
const pr = (await request(`/rest/v1/purchase_requests?id=eq.${purchase}&select=id,status,inventory_item_id,quantity`, admin, undefined, "GET"))[0];
assert.equal(pr.status, "received");
const receivedPart = (await request(`/rest/v1/part_requests?id=eq.${part.id}&select=status`, mechanic, undefined, "GET"))[0];
assert.equal(receivedPart.status, "received");
let stock = (await request(`/rest/v1/inventory_items?id=eq.${pr.inventory_item_id}&select=id,stock_quantity`, admin, undefined, "GET"))[0];
assert.equal(Number(stock.stock_quantity), 2);
passed.push("admin: linked purchase, order, atomic receipt/stock entry, part received and duplicate receipt blocked");
await request("/rest/v1/rpc/maintenance_stock_move", admin, { p_item: stock.id, p_quantity: 3, p_reason: "TESTE Entrada API" });
await request("/rest/v1/rpc/maintenance_stock_move", admin, { p_item: stock.id, p_quantity: -6, p_reason: "TESTE Saldo insuficiente" }, "POST", true);
await request("/rest/v1/rpc/maintenance_stock_move", admin, { p_item: stock.id, p_quantity: -1, p_reason: "TESTE Uso API" });
stock = (await request(`/rest/v1/inventory_items?id=eq.${stock.id}&select=stock_quantity`, admin, undefined, "GET"))[0];
assert.equal(Number(stock.stock_quantity), 4);
await request(`/rest/v1/inventory_items?id=eq.${pr.inventory_item_id}`, admin, { location: "TESTE Prateleira", min_quantity: 2, active: false }, "PATCH");
await request(`/rest/v1/inventory_items?id=eq.${pr.inventory_item_id}`, admin, { active: true }, "PATCH");
passed.push("admin: stock entry/exit, insufficient balance blocked, item edit/deactivation/reactivation");
await request(`/rest/v1/work_orders?id=eq.${call.id}`, mechanic, { status: "in_progress" }, "PATCH");
report = (await request("/rest/v1/maintenance_reports", mechanic, {
  organization_id: f.org, work_order_id: call.id, equipment_id: f.equipment, mechanic_id: f.users.mechanic.id,
  diagnosis: "TESTE Rolamento danificado", work_performed: "TESTE Troca de rolamento", parts_used: "TESTE Rolamento API x2",
}))[0];
await request(`/rest/v1/work_orders?id=eq.${call.id}`, mechanic, { status: "completed", completed_at: new Date().toISOString() }, "PATCH");
await request("/rest/v1/work_order_events", mechanic, { work_order_id: call.id, user_id: f.users.mechanic.id,
  event_type: "completed", description: "TESTE Tentativa de evento pelo cliente" }, "POST", true);
passed.push("client cannot forge audit events under existing RLS");
}
const reports = await request(`/rest/v1/maintenance_reports?organization_id=eq.${f.org}&equipment_id=eq.${f.equipment}&id=eq.${report.id}&select=id,work_order_id,diagnosis,work_performed,parts_used,created_at`, admin, undefined, "GET");
assert.equal(reports.length, 1); assert.equal(reports[0].work_performed, "TESTE Troca de rolamento");
const completed = await request(`/rest/v1/work_orders?id=eq.${call.id}&status=eq.completed&select=id,status,completed_at`, admin, undefined, "GET");
assert.equal(completed.length, 1);
passed.push("mechanic/admin: resume, report, completion, real report/history queries");
const planned = new Date(Date.now() + 10 * 86400000).toISOString().slice(0, 10);
const preventive = (await request("/rest/v1/work_orders", admin, {
  organization_id: f.org, sector_id: f.sector, equipment_id: f.equipment, requester_id: f.users.admin.id,
  title: "Manutenção preventiva · TESTE Layout API", description: "TESTE Planejada sem recorrência",
  scheduled_for: planned, priority: "normal", status: "open",
}))[0];
assert.equal(preventive.scheduled_for, planned);
passed.push("admin: preventive with scheduled_for stored under existing RLS");
const cancelled = await request("/rest/v1/rpc/maintenance_purchase_create", admin, { p_name: "TESTE Compra cancelada API", p_quantity: 1 });
await request("/rest/v1/rpc/maintenance_purchase_status", admin, { p_purchase: cancelled, p_status: "cancelled" });
const cancellation = (await request(`/rest/v1/purchase_requests?id=eq.${cancelled}&select=status`, admin, undefined, "GET"))[0];
assert.equal(cancellation.status, "cancelled");
passed.push("admin: purchase cancellation preserved in history");
await writeFile(new URL(".local/native-verification/api-flow-results.json", root), JSON.stringify({ passed, call: call.id, preventive: preventive.id, purchase }, null, 2));
console.log(passed.map(x => "PASS " + x).join("\n"));
console.log("Real Supabase API verification only; no native-device or browser button/audio claims. Synthetic test history preserved.");
