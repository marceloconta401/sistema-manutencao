import { spawnSync } from "node:child_process";
import { access } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
for (const relativePath of ["desktop/main.cjs", "desktop/preload.cjs", "desktop/assets/system-icon.ico"]) {
  await access(path.join(root, relativePath)).catch(() => {
    console.error(`Arquivo necessário para o instalador não encontrado: ${relativePath}`);
    process.exit(1);
  });
}

function run(command, args) {
  const result = spawnSync(command, args, { cwd: root, stdio: "inherit" });
  if (result.error || result.status !== 0) {
    console.error(`Falha ao executar ${command} ${args.join(" ")}.`);
    process.exit(result.status || 1);
  }
}

run("pnpm", ["run", "build"]);
run("pnpm", ["exec", "electron-builder", "--win", "nsis", "--x64"]);
console.log(`Instalador Windows gerado em ${path.join(root, "release")}`);
