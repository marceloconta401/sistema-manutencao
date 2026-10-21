import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "typescript";

for (const name of ["_shared/access", "account-login/index", "account-access/index",
  "admin-create-user/index", "admin-manage/index", "send-push/index"]) {
  test(`Edge Function ${name}: transpiled JavaScript parses`, async () => {
    const source = await readFile(new URL(`../supabase/functions/${name}.ts`, import.meta.url), "utf8");
    const { outputText } = ts.transpileModule(source, {
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
    });
    assert.doesNotThrow(() => new Function("require", "exports", outputText));
  });
}
