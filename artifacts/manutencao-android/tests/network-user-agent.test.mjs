import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { test } from "node:test";

const require = createRequire(import.meta.url);
const { toAsciiUserAgent } = require("../desktop/network-user-agent.cjs");
const browser = "Mozilla/5.0 (Windows NT 10.0; Win64; x64)";
const original = `${browser} SistemadeManutenção/1.0.0 Chrome/152 Electron/44 Safari/537.36`;

test("removes accents from the technical identity without losing browser/version information", () => {
  const safe = toAsciiUserAgent(original);
  assert.equal(safe, original.replace("Manutenção", "Manutencao"));
  assert.match(safe, /^[\x20-\x7E]+$/);
  assert.equal(toAsciiUserAgent(safe), safe);
});

test("also handles decomposed accents and rejects missing User-Agent values", () => {
  assert.equal(toAsciiUserAgent("Manutenc\u0327a\u0303o"), "Manutencao");
  assert.throws(() => toAsciiUserAgent(undefined), TypeError);
  assert.throws(() => toAsciiUserAgent(""), TypeError);
});

test("actual HTTP headers reproduce the invalid UTF-8 bytes and the corrected header avoids them", async (t) => {
  const server = createServer((req, res) => {
    // HTTP/1 headers are decoded as Latin-1 by Node. Recover their wire bytes
    // to check the same UTF-8 requirement that rejects Supabase session data.
    const bytes = Buffer.from(req.headers["user-agent"], "latin1");
    try {
      new TextDecoder("utf-8", { fatal: true }).decode(bytes);
      res.writeHead(200).end("valid UTF-8");
    } catch {
      res.writeHead(422).end("invalid UTF-8");
    }
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise((resolve) => {
    server.close(resolve);
    server.closeAllConnections();
  }));
  const url = `http://127.0.0.1:${server.address().port}/`;
  const broken = await fetch(url, { headers: { "User-Agent": original } });
  assert.equal(broken.status, 422);
  await broken.text();
  const fixed = await fetch(url, { headers: { "User-Agent": toAsciiUserAgent(original) } });
  assert.equal(fixed.status, 200);
  assert.equal(await fixed.text(), "valid UTF-8");
});

test("every desktop window sanitizes its User-Agent before loading while preserving the official name", async () => {
  const main = await readFile(new URL("../desktop/main.cjs", import.meta.url), "utf8");
  assert.ok(main.indexOf("webContents.setUserAgent(") < main.indexOf("mainWindow.loadFile("));
  assert.match(main, /toAsciiUserAgent\(mainWindow\.webContents\.getUserAgent\(\)\)/);
  assert.match(main, /app\.setName\("Sistema de Manutenção"\)/);
  assert.match(main, /title: "Sistema de Manutenção"/);
});
