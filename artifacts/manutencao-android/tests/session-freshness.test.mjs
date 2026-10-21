import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "typescript";

const source = await readFile(new URL("../src/access-management.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
}).outputText;
const settle = () => new Promise(resolve => setImmediate(resolve));

function harness(invoke) {
  const listeners = {}, intervals = [];
  const elements = new Map();
  for (const id of ["app", "modal", "notifyPanel"]) {
    const classes = new Set();
    elements.set(id, { classList: {
      add: c => classes.add(c), remove: c => classes.delete(c), contains: c => classes.has(c),
    } });
  }
  const state = { locked: false, cached: "cached private ticket" };
  const win = {
    sb: { functions: { invoke } },
    __maintenanceContext: () => ({ session: { user: { id: "synthetic-user" } }, profile: { active: true } }),
    __maintenanceLock: async () => { state.locked = true; state.cached = ""; elements.get("app").classList.add("hidden"); },
    __maintenanceRefreshCatalogs: async () => {},
    setInterval: (fn, ms) => intervals.push({ fn, ms }),
    addEventListener: (type, fn) => { listeners[type] = fn; },
    dispatchEvent: () => {},
  };
  const doc = { visibilityState: "visible", getElementById: id => elements.get(id),
    addEventListener: (type, fn) => { listeners[type] = fn; } };
  new Function("window", "document", "require", "exports", compiled)(
    win, doc, name => name === "@capacitor/core" ? { Capacitor: { isNativePlatform: () => false } } : { App: {} }, {},
  );
  return { listeners, intervals, elements, state };
}

test("visible-session polling detects revocation and clears cached data without reload", async () => {
  const h = harness(async () => ({ error: { message: "Forbidden",
    context: new Response('{"error":"Revoked"}', { status: 403 }) } }));
  assert.equal(h.intervals[0].ms, 5000);
  h.intervals[0].fn();
  await settle(); await settle();
  assert.equal(h.state.locked, true);
  assert.equal(h.state.cached, "");
  assert.equal(h.elements.get("app").classList.contains("hidden"), true);
});

test("resume hides cached app, modal and notifications before the server replies", async () => {
  let release;
  const h = harness(() => new Promise(resolve => { release = resolve; }));
  h.listeners.focus();
  for (const id of ["app", "modal", "notifyPanel"])
    assert.equal(h.elements.get(id).classList.contains("hidden"), true);
  release({ data: { ok: true, must_change_password: false }, error: null });
  await settle();
  assert.equal(h.elements.get("app").classList.contains("hidden"), false);
  assert.equal(h.elements.get("modal").classList.contains("hidden"), false);
});

test("failed access verification blocks the UI instead of serving cached data", async () => {
  const h = harness(async () => ({ error: new Error("Network unavailable") }));
  h.listeners.focus();
  await settle(); await settle();
  assert.equal(h.state.locked, true);
  assert.equal(h.state.cached, "");
  assert.equal(h.elements.get("app").classList.contains("hidden"), true);
});
