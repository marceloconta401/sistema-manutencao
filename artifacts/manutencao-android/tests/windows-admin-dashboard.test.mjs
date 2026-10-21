import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("Windows dashboard is gated to authenticated Windows administrators", async () => {
  const html = await read("../index.html");
  const css = await read("../src/windows-admin-dashboard.css");
  const preload = await read("../desktop/preload.cjs");

  assert.match(preload, /platform:\s*process\.platform/);
  assert.match(preload, /showNotification\s*\(/);
  assert.match(html, /window\.maintenanceDesktop\?\.platform==="win32"/);
  assert.match(html, /function isWindowsDesktopAdmin\(\)\{return Boolean\(session&&window\.maintenanceDesktop\?\.platform==='win32'&&profile\?\.role==='admin'\)\}/);
  assert.match(html, /setWindowsAdminMode\(isWindowsDesktopAdmin\(\)\)/);
  assert.match(html, /localStorage\.getItem\('maint_theme'\)/);
  assert.match(html, /localStorage\.setItem\('maint_theme'/);
  assert.match(css, /html\.windows-admin/);
  assert.doesNotMatch(css, /(^|\n)\s*(?!html\.windows-admin)[.#][\w-]+\s*\{/);
});

test("Windows dashboard uses real organization-scoped records and does not invent machine state", async () => {
  const html = await read("../index.html");
  const dashboard = html.slice(
    html.indexOf('<section id="windowsAdminDashboard"'),
    html.indexOf('<div class="kpis">'),
  );

  assert.match(html, /query=query\.eq\('organization_id',profile\.organization_id\)/);
  assert.match(html, /sb\.from\('equipment'\).*?\.eq\('organization_id',org\)/s);
  assert.match(html, /sb\.from\('profiles'\).*?\.eq\('role','mechanic'\)/s);
  assert.match(html, /sb\.from\('sectors'\)\.select\('id,name'\)\.eq\('organization_id',org\)/);
  assert.match(html, /sb\.from\('work_order_events'\)\.select\('work_order_id,event_type,description,created_at'\)/);
  assert.match(html, /scheduled_for&&row\.scheduled_for>=todayString/);
  assert.match(html, /row\.started_at&&row\.completed_at/);
  assert.match(html, /sb\.from\('equipment'\).*?\.eq\('active',false\)/s);
  assert.match(dashboard, /Status dos equipamentos/);
  assert.match(dashboard, /Situação cadastral; não indica funcionamento/);
  assert.doesNotMatch(dashboard, /operacionais|online|Mecânicos online/);
  assert.match(dashboard, /windowsCallSearch/);
  assert.match(dashboard, /windowsCallStatusFilter/);
  assert.match(dashboard, /windowsMetricUrgent/);
  assert.match(html, /windowsAdminDashboardState\.searchText/);
  assert.match(html, /data-windows-detail=/);
  assert.match(html, /id="usersRoleFilter" class="hidden"/);
  assert.match(html, /\$\('usersRoleFilter'\)\?\.classList\.toggle\('hidden',!active\)/);
  assert.match(html, /openUsersPanel\('mechanic'\)/);
  assert.match(html, /if\(f==='all'\) rows=allRows/);
  assert.match(html, /applyTicketFilter\('all'\)/);
});

test("existing maintenance, account, history, and push flows remain present", async () => {
  const html = await read("../index.html");
  const requiredFunctions = [
    "showApp",
    "loadTickets",
    "updateStatus",
    "details",
    "openSectorsPanel",
    "openEquipmentPanel",
    "openPartsPanel",
    "openPreventivePanel",
    "openHistoryPanel",
    "openUsersPanel",
    "triggerPush",
    "registerPushOnDevice",
  ];
  for (const name of requiredFunctions) {
    assert.ok(html.includes(name), `existing flow ${name} should remain`);
  }
  assert.match(html, /src\/native-push\.ts/);
  assert.match(html, /data-windows-nav="notifications"/);
  assert.match(html, /data-windows-nav="logout"/);
});

