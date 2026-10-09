import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import vm from "node:vm";

const artifactDir = new URL("../", import.meta.url);

async function readAppFile(fileName) {
  return readFile(new URL(fileName, artifactDir), "utf8");
}

function getInlineScripts(html) {
  return [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)]
    .filter(([, attributes]) => !/\bsrc\s*=/.test(attributes))
    .map(([, , script]) => script);
}

function getLoginScript(html, fileName) {
  const script = getInlineScripts(html).find((candidate) =>
    candidate.includes("window.__directLogin=async function"),
  );
  assert.ok(script, `${fileName} should define the Supabase login handler`);
  return script;
}

function makeLoginHarness({ authResult }) {
  const elements = {
    email: { value: "operator@example.com", addEventListener() {} },
    password: { value: "test-password", addEventListener() {} },
    loginMsg: { className: "notice hidden", textContent: "" },
    loginBtn: {
      disabled: false,
      textContent: "Entrar",
      addEventListener() {},
    },
  };
  let showAppCalls = 0;
  let signInArgs;

  const context = vm.createContext({
    document: {
      getElementById(id) {
        return elements[id] ?? null;
      },
    },
    window: {
      supabase: { createClient() {} },
    },
    sb: {
      auth: {
        async signInWithPassword(args) {
          signInArgs = args;
          return authResult;
        },
      },
    },
    showApp: async () => {
      showAppCalls += 1;
    },
  });

  return {
    context,
    elements,
    get showAppCalls() {
      return showAppCalls;
    },
    get signInArgs() {
      return signInArgs;
    },
  };
}

function makeInstallHarness({ android = true, standalone = false } = {}) {
  const windowListeners = {};
  const makeClassList = () => {
    const values = new Set(["hidden"]);
    return {
      add(value) {
        values.add(value);
      },
      remove(value) {
        values.delete(value);
      },
      contains(value) {
        return values.has(value);
      },
    };
  };
  const buttons = ["installHelp", "installLoginHelp"].map((helperId) => ({
    classList: makeClassList(),
    handlers: {},
    getAttribute(name) {
      return name === "aria-describedby" ? helperId : null;
    },
    addEventListener(name, handler) {
      this.handlers[name] = handler;
    },
  }));
  const helpers = {
    installHelp: { classList: makeClassList(), textContent: "" },
    installLoginHelp: { classList: makeClassList(), textContent: "" },
  };
  const context = vm.createContext({
    document: {
      querySelectorAll() {
        return buttons;
      },
      getElementById(id) {
        return helpers[id] ?? null;
      },
    },
    navigator: { userAgent: android ? "Android Chrome" : "Desktop Chrome" },
    window: {
      addEventListener(name, handler) {
        windowListeners[name] = handler;
      },
      matchMedia() {
        return { matches: standalone };
      },
    },
  });
  return { context, buttons, helpers, windowListeners };
}

for (const fileName of ["index.html", "app.html"]) {
  test(`${fileName}: all inline JavaScript parses`, async () => {
    const html = await readAppFile(fileName);
    for (const [index, script] of getInlineScripts(html).entries()) {
      assert.doesNotThrow(
        () => new vm.Script(script, { filename: `${fileName}#script-${index}` }),
        `${fileName} inline script ${index} should be valid JavaScript`,
      );
    }
  });

  test(`${fileName}: accepted Supabase session opens the app`, async () => {
    const html = await readAppFile(fileName);
    const harness = makeLoginHarness({
      authResult: {
        data: { session: { user: { id: "test-user" } } },
        error: null,
      },
    });
    vm.runInContext(getLoginScript(html, fileName), harness.context);

    await harness.context.window.__directLogin();

    assert.equal(harness.signInArgs.email, "operator@example.com");
    assert.equal(harness.signInArgs.password, "test-password");
    assert.equal(harness.showAppCalls, 1);
    assert.match(harness.elements.loginMsg.textContent, /Login realizado/i);
    assert.equal(harness.elements.loginMsg.className, "notice ok");
  });

  test(`${fileName}: rejected credentials keep the user on login`, async () => {
    const html = await readAppFile(fileName);
    const harness = makeLoginHarness({
      authResult: { data: null, error: new Error("Senha inválida") },
    });
    vm.runInContext(getLoginScript(html, fileName), harness.context);

    await harness.context.window.__directLogin();

    assert.equal(harness.showAppCalls, 0);
    assert.match(harness.elements.loginMsg.textContent, /Senha inválida/);
    assert.equal(harness.elements.loginBtn.disabled, false);
  });
}

test("Android install button provides Chrome instructions without a prompt", async () => {
  const html = await readAppFile("index.html");
  const installScript = getInlineScripts(html).find((script) =>
    script.includes("beforeinstallprompt"),
  );
  assert.ok(installScript, "index.html should handle Android installation");
  const harness = makeInstallHarness();
  vm.runInContext(installScript, harness.context);

  assert.equal(harness.buttons[1].classList.contains("hidden"), false);
  await harness.buttons[1].handlers.click();

  assert.match(harness.helpers.installLoginHelp.textContent, /menu do Chrome/i);
  assert.equal(harness.helpers.installLoginHelp.classList.contains("hidden"), false);
});

test("Android install button opens the native prompt and hides after install", async () => {
  const html = await readAppFile("index.html");
  const installScript = getInlineScripts(html).find((script) =>
    script.includes("beforeinstallprompt"),
  );
  assert.ok(installScript, "index.html should handle Android installation");
  const harness = makeInstallHarness();
  vm.runInContext(installScript, harness.context);
  let promptCalls = 0;
  let prevented = false;
  harness.windowListeners.beforeinstallprompt({
    preventDefault() {
      prevented = true;
    },
    async prompt() {
      promptCalls += 1;
    },
    userChoice: Promise.resolve({ outcome: "accepted" }),
  });

  await harness.buttons[1].handlers.click();
  harness.windowListeners.appinstalled();

  assert.equal(prevented, true);
  assert.equal(promptCalls, 1);
  assert.equal(harness.buttons[1].classList.contains("hidden"), true);
});

test("PWA manifest is installable as a standalone Android app", async () => {
  const manifest = JSON.parse(await readAppFile("manifest_v10.json"));

  assert.equal(manifest.display, "standalone");
  assert.equal(manifest.scope, "./");
  assert.equal(manifest.start_url, "./index.html?source=pwa");
  assert.ok(manifest.icons.some((icon) => icon.sizes === "192x192"));
  assert.ok(manifest.icons.some((icon) => icon.sizes === "512x512"));
});

test("service worker only caches same-origin app-shell resources", async () => {
  const serviceWorker = await readAppFile("sw_v16.js");

  assert.doesNotThrow(() => new vm.Script(serviceWorker));
  assert.match(serviceWorker, /requestUrl\.origin !== self\.location\.origin/);
  assert.match(serviceWorker, /const isAppShellAsset = APP_SHELL/);
  assert.match(serviceWorker, /sistema-manutencao-v16/);
});
