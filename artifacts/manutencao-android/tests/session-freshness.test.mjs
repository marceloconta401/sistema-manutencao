import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "typescript";
import { performance } from "node:perf_hooks";

const source = await readFile(new URL("../src/access-management.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
}).outputText;
const settle = () => new Promise(resolve => setImmediate(resolve));

function harness(invoke, { native = false, realTimer = false } = {}) {
  const listeners = {}, intervals = [];
  const nativeListeners = {};
  const elements = new Map();
  for (const id of ["app", "modal", "notifyPanel"]) {
    const classes = new Set();
    elements.set(id, { classList: {
      add: c => classes.add(c), remove: c => classes.delete(c), contains: c => classes.has(c),
    } });
  }
  const state = { locked: false, cached: "cached private ticket", lockCalls: [] };
  let context = { session: { user: { id: "synthetic-user" } }, profile: { active: true } };
  let timer;
  const win = {
    sb: { functions: { invoke } },
    __maintenanceContext: () => context,
    __maintenanceLock: async (message, revoked) => {
      state.locked = true;
      state.cached = "";
      state.lockCalls.push({ message, revoked });
      context = { session: null, profile: null };
      for (const element of elements.values()) element.classList.add("hidden");
      listeners["maintenance-access-locked"]?.();
    },
    __maintenanceRefreshCatalogs: async () => {},
    setInterval: (fn, ms) => {
      intervals.push({ fn, ms });
      if (realTimer) timer = setInterval(fn, ms);
    },
    addEventListener: (type, fn) => { listeners[type] = fn; },
    dispatchEvent: () => {},
  };
  const doc = { visibilityState: "visible", getElementById: id => elements.get(id),
    addEventListener: (type, fn) => { listeners[type] = fn; } };
  new Function("window", "document", "require", "exports", compiled)(
    win, doc, name => name === "@capacitor/core"
      ? { Capacitor: { isNativePlatform: () => native } }
      : { App: { addListener: async (type, fn) => { nativeListeners[type] = fn; } } }, {},
  );
  return { listeners, nativeListeners, intervals, elements, state, doc,
    dispose: () => clearInterval(timer) };
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

test("real five-second timer locks a visible session without focus or reload (synthetic transport)", { timeout: 12000 }, async (t) => {
  let finish;
  const invoked = new Promise(resolve => { finish = resolve; });
  let calls = 0;
  const started = performance.now();
  const h = harness(async () => {
    calls++;
    // A controlled transport delay, not a measurement of Supabase latency.
    await new Promise(resolve => setTimeout(resolve, 100));
    finish(performance.now() - started);
    return { error: { message: "Forbidden",
      context: new Response('{"error":"Revoked"}', { status: 403 }) } };
  }, { realTimer: true });
  t.after(h.dispose);
  const elapsed = await invoked;
  await settle(); await settle();
  assert.ok(elapsed >= 5000, `Timer fired prematurely: ${elapsed} ms`);
  assert.ok(elapsed < 10000, `Timer exceeded test budget: ${elapsed} ms`);
  assert.equal(calls, 1);
  assert.equal(h.state.locked, true);
  assert.equal(h.state.cached, "");
  assert.equal(h.state.lockCalls[0].revoked, true);
  t.diagnostic(`Synthetic timer + 100 ms transport: ${Math.round(elapsed)} ms; not a native-device measurement`);
});

test("Android lifecycle hides data before pending resume validation and stays locked on revocation", async () => {
  let release;
  const h = harness(() => new Promise(resolve => { release = resolve; }), { native: true });
  h.nativeListeners.appStateChange({ isActive: false });
  for (const id of ["app", "modal", "notifyPanel"])
    assert.equal(h.elements.get(id).classList.contains("hidden"), true);
  h.doc.visibilityState = "hidden";
  h.nativeListeners.appStateChange({ isActive: true });
  assert.equal(typeof release, "function", "native resume must validate even before visibility updates");
  assert.equal(h.state.locked, false);
  for (const id of ["app", "modal", "notifyPanel"])
    assert.equal(h.elements.get(id).classList.contains("hidden"), true);
  release({ error: { context: new Response('{"error":"Revoked"}', { status: 403 }) } });
  await settle(); await settle();
  assert.equal(h.state.locked, true);
  assert.equal(h.state.cached, "");
});

test("Android resume with unavailable network clears synthetic cache instead of restoring it", async () => {
  const h = harness(async () => { throw new TypeError("Failed to fetch"); }, { native: true });
  h.nativeListeners.appStateChange({ isActive: false });
  h.nativeListeners.appStateChange({ isActive: true });
  await settle(); await settle();
  assert.equal(h.state.locked, true);
  assert.equal(h.state.cached, "");
  assert.equal(h.state.lockCalls[0].revoked, false);
  for (const id of ["app", "modal", "notifyPanel"])
    assert.equal(h.elements.get(id).classList.contains("hidden"), true);
});

test("foreground polling fails closed on a network error without a resume event", async () => {
  const h = harness(async () => ({ error: new Error("Network unavailable") }));
  h.intervals[0].fn();
  await settle(); await settle();
  assert.equal(h.state.locked, true);
  assert.equal(h.state.cached, "");
  assert.equal(h.state.lockCalls[0].revoked, false);
});

test("later timer, focus, visibility and native resume cannot reopen a locked session", async () => {
  let calls = 0;
  const h = harness(async () => {
    calls++;
    return { error: { context: new Response('{"error":"Revoked"}', { status: 403 }) } };
  }, { native: true });
  h.intervals[0].fn();
  await settle(); await settle();
  h.intervals[0].fn();
  h.listeners.focus();
  h.listeners.visibilitychange();
  h.nativeListeners.appStateChange({ isActive: true });
  await settle();
  assert.equal(calls, 1);
  assert.equal(h.state.cached, "");
  for (const id of ["app", "modal", "notifyPanel"])
    assert.equal(h.elements.get(id).classList.contains("hidden"), true);
});
