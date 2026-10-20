import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const read = (name) => readFile(new URL(`../${name}`, import.meta.url), "utf8");

test("Windows admin dashboard is gated to an authenticated Windows administrator", async () => {
  const [html, preload] = await Promise.all([read("index.html"), read("desktop/preload.cjs")]);
  assert.match(preload, /platform:\s*process\.platform/);
  assert.match(html, /function isWindowsDesktopAdmin\(\)\s*\{\s*return Boolean\(session&&window\.maintenanceDesktop\?\.platform==='win32'&&profile\?\.role==='admin'\)/);
  assert.match(html, /setWindowsAdminMode\(isWindowsDesktopAdmin\(\)\)/);
});

test("dashboard data comes from organization-scoped Supabase records", async () => {
  const html = await read("index.html");
  assert.match(html, /sb\.from\('work_orders'\)/);
  assert.match(html, /if\(windowsAdmin\)query=query\.eq\('organization_id',profile\.organization_id\)/);
  assert.match(html, /sb\.from\('equipment'\)[\s\S]*?\.eq\('organization_id',org\)/);
  assert.match(html, /sb\.from\('profiles'\)[\s\S]*?\.eq\('organization_id',org\)[\s\S]*?\.eq\('role','mechanic'\)/);
  assert.match(html, /sb\.from\('work_order_events'\)/);
  assert.match(html, /row\.started_at[\s\S]*?row\.completed_at/);
  assert.doesNotMatch(html, /(?:fake|mock|sample)[-_ ](?:orders|tickets|equipment|users)/i);
});

test("dashboard navigation preserves existing application modules and theme preference", async () => {
  const html = await read("index.html");
  for (const modulePath of [
    "src/native-push.ts",
    "src/access-management.ts",
    "src/auth-links.ts",
    "src/shell.ts",
    "src/operations.ts",
  ]) assert.ok(html.includes(modulePath), `${modulePath} remains loaded`);
  for (const existingFlow of [
    "function openEquipmentPanel",
    "function openSectorsPanel",
    "function openPartsPanel",
    "function openPreventivePanel",
    "function openHistoryPanel",
    "function openUsersPanel",
  ]) assert.ok(html.includes(existingFlow), `${existingFlow} remains available`);
  assert.match(html, /localStorage\.setItem\('maint_theme'/);
  assert.match(html, /data-windows-nav="inventory"/);
  assert.match(html, /data-windows-nav="purchases"/);
  assert.match(html, /data-windows-nav="reports"/);
});

test("dashboard visual rules are isolated from Web and Android", async () => {
  const css = await read("src/windows-admin-dashboard.css");
  assert.match(css, /html\.windows-admin/);
  assert.doesNotMatch(css, /(^|\})\s*(body|\.top|\.layout)\s*\{/);
});
