import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const require = createRequire(import.meta.url);
const { asciiUserAgent } = require("../desktop/user-agent.cjs");

test("Windows User-Agent transliterates the accented product name to ASCII", () => {
  const original = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) SistemadeManutenção/1.0.0 Chrome/152.0 Electron/44.7.0 Safari/537.36";
  const normalized = asciiUserAgent(original);
  assert.equal(normalized, original.replace("Manutenção", "Manutencao"));
  assert.match(normalized, /^[\x20-\x7E]+$/);
  assert.equal(asciiUserAgent(normalized), normalized);
  assert.equal(asciiUserAgent("Browser/1.0\r\nX-Test: value"), "Browser/1.0X-Test: value");
  assert.throws(() => asciiUserAgent(""), TypeError);
});

test("Electron applies ASCII User-Agent before loading the application", async () => {
  const source = await readFile(new URL("../desktop/main.cjs", import.meta.url), "utf8");
  assert.match(source, /asciiUserAgent\(mainWindow\.webContents\.getUserAgent\(\)\)/);
  assert.ok(source.indexOf("setUserAgent(") < source.indexOf("mainWindow.loadFile("));
  assert.match(source, /app\.setName\("Sistema de Manutenção"\)/);
});

test("Parts queries use requested_at while preserving the UI date alias", async () => {
  for (const name of ["index.html", "app.html"]) {
    const html = await readFile(new URL(`../${name}`, import.meta.url), "utf8");
    const queries = [...html.matchAll(/sb\.from\('part_requests'\)\s*\.select\('([^']+)'\)[\s\S]*?\.order\('([^']+)'/g)];
    assert.equal(queries.length, 3, `${name}: check each ordered parts query`);
    for (const [, selection, order] of queries) {
      assert.equal(order, "requested_at");
      assert.ok(!selection.split(",").includes("created_at"));
    }
    assert.equal(queries.filter(([, selection]) => selection.includes("created_at:requested_at")).length, 2);
  }
});
