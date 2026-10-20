import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import ts from "typescript";

const source = await readFile(new URL("../src/operations.ts", import.meta.url), "utf8");
const script = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
const window = { addEventListener() {}, dispatchEvent() {} };
const context = vm.createContext({ window, exports: {}, Event, document: { getElementById() { return null; } }, console });
vm.runInContext(script, context);
const { positiveNumber, csvCell } = context.exports;

test("stock and purchase inputs accept decimal comma and reject invalid quantities", () => {
  assert.equal(positiveNumber("2,5"), 2.5);
  assert.equal(positiveNumber("0", true), 0);
  for (const value of ["", " ", "0", "-1", "Infinity", "NaN", "abc"]) assert.throws(() => positiveNumber(value));
  assert.throws(() => positiveNumber("-1", true));
});
test("report CSV escapes quotes and neutralizes spreadsheet formulas", () => {
  assert.equal(csvCell('a"b'), '"a""b"');
  for (const v of ["=SUM(1;2)", "+1", "-1", "@a", "\t=1", "  =1"]) assert.ok(csvCell(v).startsWith('"\''));
  assert.equal(csvCell("Peça normal"), '"Peça normal"');
});
test("stock, purchases, call purchase detail and reports expose functional integration hooks", () => {
  for (const method of ["openInventory", "openPurchases", "openReports", "renderPurchaseRequests"])
    assert.equal(typeof window.maintenanceOperations[method], "function");
});
test("Windows dashboard stays isolated from the shared Web and Android entry point", async () => {
  const index = await readFile(new URL("../index.html", import.meta.url), "utf8");
  const webAndAndroid = await readFile(new URL("../app.html", import.meta.url), "utf8");
  assert.match(index, /function isWindowsDesktopAdmin\(\)\s*\{\s*return Boolean\(session&&window\.maintenanceDesktop\?\.platform==='win32'&&profile\?\.role==='admin'\)/);
  assert.match(index, /id="windowsAdminDashboard"/);
  assert.doesNotMatch(webAndAndroid, /id="windowsAdminDashboard"/);
  for (const modulePath of ["src/shell.ts", "src/operations.ts", "src/access-management.ts"]) {
    assert.ok(index.includes(modulePath), `Windows entry still loads ${modulePath}`);
    assert.ok(webAndAndroid.includes(modulePath), `Web/Android entry still loads ${modulePath}`);
  }
});
test("additive operations schema protects audit history, tenant boundaries and revoked accounts", async () => {
  const sql = await readFile(new URL("../supabase/inventory_purchases.sql", import.meta.url), "utf8");
  assert.doesNotMatch(sql, /drop\s+table|truncate\s|alter\s+table\s+public\.(work_orders|profiles|sectors|equipment)\s/i);
  assert.match(sql, /maintenance_access_ready\(\)/);
  assert.match(sql, /current_user_org\(\)/);
  assert.match(sql, /quantity <> 0/);
  assert.match(sql, /Saldo insuficiente/);
  assert.match(sql, /for update/);
  assert.match(sql, /unique index.*purchase.*receipt/i);
  assert.match(sql, /revoke all on function public\.maintenance_operations_admin/);
});
test("logout clears private drafts and role-specific panels and invalidates pending responses", async () => {
  const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
  const fields = [{ tagName: "INPUT", value: "previous-admin-password", defaultValue: "" },
    { tagName: "SELECT", selectedIndex: 2 }];
  const elements = new Map(["app", "usersPanel", "newUserPanel", "historyPanel", "adminPanel", "newCard",
    "equipment", "historyEquipment", "newUserSector", "password", "saveNewUserBtn"].map(id => [id, {
      hidden: false, value: "private", disabled: false, children: ["prior-tenant"],
      classList: { add() { elements.get(id).hidden = true; } },
      querySelectorAll() { return fields; }, removeAttribute() { this.roleRemoved = true; },
      replaceChildren() { this.children = []; },
    }]));
  const c = vm.createContext({ $: id => elements.get(id), session: { user: { id: "old-admin" } },
    profile: { id: "old-admin" } });
  const reset = html.slice(html.indexOf("let privateViewEpoch="), html.indexOf("window.__maintenanceContext="));
  vm.runInContext(reset + ";var pending=privateViewStamp();resetPrivateViews();", c);
  assert.equal(vm.runInContext("privateViewCurrent(pending)", c), false);
  for (const id of ["usersPanel", "newUserPanel", "historyPanel", "adminPanel", "newCard"]) assert.equal(elements.get(id).hidden, true);
  assert.equal(fields[0].value, "");
  assert.equal(fields[1].selectedIndex, 0);
  assert.equal(elements.get("saveNewUserBtn").disabled, true);
  assert.equal(elements.get("password").value, "");
  assert.equal(elements.get("app").roleRemoved, true);
  for (const id of ["equipment", "historyEquipment", "newUserSector"]) assert.equal(elements.get(id).children.length, 0);
});
test("cancel new call closes its real form and discards the draft without writing data", async () => {
  const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
  assert.match(html, /data-testid="button-cancel-new-call"/);
  const fields = [{ value: "unsaved title" }, { value: "unsaved description" }];
  const nodes = new Map(["newCard", "priority", "equipment", "photoName", "saveMsg"].map(id => [id, {
    value: "old", textContent: "old", hidden: false,
    classList: { add() { nodes.get(id).hidden = true; } },
    querySelectorAll() { return fields; },
  }]));
  const source = html.slice(html.indexOf("function cancelNewCall()"), html.indexOf("$('saveBtn').insertAdjacentHTML"));
  const c = vm.createContext({ $: id => nodes.get(id) });
  vm.runInContext(source + ";cancelNewCall();", c);
  assert.equal(nodes.get("newCard").hidden, true);
  assert.equal(nodes.get("priority").value, "normal");
  assert.equal(fields[0].value, "");
  assert.equal(fields[1].value, "");
  assert.equal(nodes.get("equipment").value, "");
});
