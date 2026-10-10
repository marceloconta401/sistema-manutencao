import { spawnSync } from "node:child_process";
import { copyFile, mkdir, access } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const android = path.join(root, "android");
const apkPath = path.join(android, "app", "build", "outputs", "apk", "debug", "app-debug.apk");
const output = path.join(root, "release", "Sistema-de-Manutencao-debug.apk");

function fail(message) {
  console.error(`\nAndroid APK não gerado: ${message}\n`);
  process.exit(1);
}

if (!process.env.ANDROID_HOME && !process.env.ANDROID_SDK_ROOT) {
  fail("defina ANDROID_HOME ou ANDROID_SDK_ROOT apontando para o Android SDK.");
}
const javaCheck = spawnSync("java", ["-version"], { stdio: "ignore" });
if (javaCheck.error || javaCheck.status !== 0) {
  fail("instale um JDK compatível e configure JAVA_HOME.");
}
try {
  await access(path.join(android, "app", "google-services.json"));
} catch {
  fail("adicione android/app/google-services.json do projeto Firebase com applicationId com.sistemamanutencao.app.");
}

const run = (command, args, options = {}) => {
  const executable = process.platform === "win32" && command === "pnpm" ? "pnpm.cmd" : command;
  const result = spawnSync(executable, args, { cwd: root, stdio: "inherit", shell: process.platform === "win32", ...options });
  if (result.error || result.status !== 0) {
    fail(`${command} ${args.join(" ")} terminou com erro${result.status == null ? "" : ` (${result.status})`}.`);
  }
};

run("pnpm", ["exec", "node", "scripts/build-web.mjs", "--local"]);
run("pnpm", ["exec", "cap", "sync", "android"]);
run(path.join(android, process.platform === "win32" ? "gradlew.bat" : "gradlew"), ["assembleDebug"], { cwd: android });
await access(apkPath).catch(() => fail("Gradle terminou sem produzir o APK de depuração esperado."));
await mkdir(path.dirname(output), { recursive: true });
await copyFile(apkPath, output);
console.log(`\nAPK de depuração pronto: ${output}`);
console.log("Este APK não é assinado para publicação na Play Store.");
