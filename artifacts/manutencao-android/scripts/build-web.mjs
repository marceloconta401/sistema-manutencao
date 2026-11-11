import path from "node:path";
import { copyFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { build } from "vite";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
process.env.PORT ||= "5000";
process.env.BASE_PATH = process.argv.includes("--local") ? "./" : (process.env.BASE_PATH || "/");
process.env.NODE_ENV = "production";
await build({ root, configFile: path.join(root, "vite.config.ts") });
const output = path.join(root, "dist", "public");
await mkdir(output, { recursive: true });
await copyFile(
  path.join(root, "node_modules", "@supabase", "supabase-js", "dist", "umd", "supabase.js"),
  path.join(output, "supabase-client.js"),
);
await copyFile(
  path.join(root, "SUPABASE-JS-LICENSE.txt"),
  path.join(output, "SUPABASE-JS-LICENSE.txt"),
);
