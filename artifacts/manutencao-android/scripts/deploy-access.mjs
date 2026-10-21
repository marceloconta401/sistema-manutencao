// Explicit maintenance command, never run automatically by the app/build.
// Uses the documented Supabase single-source deployment API.
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const ref = process.argv[process.argv.indexOf("--project-ref") + 1];
const token = process.env.SUPABASE_ACCESS_TOKEN;
if (!process.argv.includes("--project-ref") || !/^[a-z]{20}$/.test(ref || "") || !token)
  throw new Error("Informe --project-ref e configure SUPABASE_ACCESS_TOKEN no processo de publicação.");
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../supabase/functions");
const base = `https://api.supabase.com/v1/projects/${ref}/functions`;
const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
const current = await fetch(base, { headers });
if (!current.ok) throw new Error(`Não foi possível consultar funções: HTTP ${current.status}`);
const existing = new Set((await current.json()).map(f => f.slug));
const shared = await fs.readFile(path.join(root, "_shared/access.ts"), "utf8");
const bodies = new Map();
for (const slug of ["account-login", "account-access", "admin-manage", "admin-create-user", "send-push"]) {
  const source = await fs.readFile(path.join(root, slug, "index.ts"), "utf8");
  const body = slug === "send-push" ? source : shared + "\n" +
    (source.includes("actor as authorizedActor") ? "const authorizedActor = actor;\n" : "") +
    source.replace(/^import[^\n]+from "\.\.\/_shared\/access\.ts";\n/, "");
  const { outputText } = ts.transpileModule(body, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  });
  new Function("require", "exports", outputText); // Syntax check only; does not execute.
  bodies.set(slug, body);
}
for (const [slug, body] of bodies) {
  const update = existing.has(slug);
  const r = await fetch(update ? `${base}/${slug}` : base, {
    method: update ? "PATCH" : "POST", headers,
    body: JSON.stringify({ ...(update ? {} : { slug }), name: slug, body, verify_jwt: false }),
  });
  if (!r.ok) throw new Error(`Publicação de ${slug} recusada: HTTP ${r.status}`);
  const deployed = await r.json();
  console.log(`${slug}: ${deployed.status}, versão ${deployed.version}`);
}
