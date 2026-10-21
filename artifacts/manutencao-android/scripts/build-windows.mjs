import { spawnSync } from "node:child_process";
import { access, mkdtemp, symlink } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const buildEnvironment = { ...process.env };
if (process.platform === "linux" && spawnSync("wine", ["--version"]).status !== 0) {
  const wine64 = spawnSync("sh", ["-c", "command -v wine64"], { encoding: "utf8" }).stdout?.trim();
  if (wine64) {
    const temporaryBin = await mkdtemp(path.join(os.tmpdir(), "maintenance-wine-"));
    await symlink(wine64, path.join(temporaryBin, "wine"));
    buildEnvironment.PATH = `${temporaryBin}${path.delimiter}${process.env.PATH || ""}`;
  }
}
for (const relativePath of ["desktop/main.cjs", "desktop/preload.cjs", "desktop/assets/system-icon.ico"]) {
  await access(path.join(root, relativePath)).catch(() => {
    console.error(`Arquivo necessário para o instalador não encontrado: ${relativePath}`);
    process.exit(1);
  });
}

function run(command, args) {
  const executable = process.platform === "win32" && command === "pnpm" ? "pnpm.cmd" : command;
  const result = spawnSync(executable, args, { cwd: root, stdio: "inherit", env: buildEnvironment, shell: process.platform === "win32" });
  if (result.error || result.status !== 0) {
    console.error(`Falha ao executar ${command} ${args.join(" ")}.`);
    process.exit(result.status || 1);
  }
}

run("pnpm", ["exec", "node", "scripts/build-web.mjs", "--local"]);
run("pnpm", ["exec", "electron-builder", "--win", "nsis", "--x64"]);
console.log(`Instalador Windows gerado em ${path.join(root, "release")}`);
