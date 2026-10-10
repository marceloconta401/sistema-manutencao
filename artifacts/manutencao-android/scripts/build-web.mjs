import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "vite";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
process.env.PORT ||= "5000";
process.env.BASE_PATH = process.argv.includes("--local") ? "./" : (process.env.BASE_PATH || "/");
process.env.NODE_ENV = "production";
await build({ root, configFile: path.join(root, "vite.config.ts") });
