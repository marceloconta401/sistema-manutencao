import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const read = name => readFile(new URL(`../${name}`, import.meta.url), "utf8");

test("new accounts use Supabase Auth with confirmed internal identifiers, without sending mail", async () => {
  const source = await read("supabase/functions/admin-create-user/index.ts");
  const local = source.slice(source.indexOf("if (localAccess)"), source.indexOf("const { data: invitation"));
  assert.match(local, /auth\.admin\.createUser/);
  assert.match(local, /email_confirm: true/);
  assert.match(local, /normalizedLogin/);
  assert.match(local, /checkedPassword/);
  assert.match(local, /maintenance_account_create/);
  assert.doesNotMatch(local, /inviteUserByEmail|console\.log|console\.error.*password/);
});

test("first access is guarded in RLS, not mutable user metadata", async () => {
  const sql = await read("supabase/access_management.sql");
  assert.match(sql, /as restrictive for all to authenticated/);
  assert.match(sql, /a\.must_change_password/);
  assert.match(sql, /after update of encrypted_password on auth\.users/);
  assert.match(sql, /new\.encrypted_password is distinct from old\.encrypted_password/);
  assert.match(sql, /revoke all on schema maintenance_private from public, anon, authenticated/);
  assert.doesNotMatch(sql, /raw_user_meta_data|disable row level security|truncate /i);
});

test("deletion is tenant-scoped, confirmed in UI and protects historical foreign keys", async () => {
  const [sql, html] = await Promise.all([read("supabase/access_management.sql"), read("index.html")]);
  assert.match(sql, /target\.organization_id<>actor\.organization_id/);
  assert.match(sql, /p_id=actor\.id/);
  assert.match(sql, /foreign_key_violation/);
  assert.match(sql, /public\.maintenance_reports where mechanic_id=p_id/);
  assert.match(sql, /último administrador/);
  assert.match(html, /can_deactivate/);
  assert.match(html, /confirm\(/);
});

test("login credentials use a generic error, persistent limits and noncached responses", async () => {
  const [login, shared] = await Promise.all([
    read("supabase/functions/account-login/index.ts"), read("supabase/functions/_shared/access.ts"),
  ]);
  assert.match(login, /maintenance_login_limit/);
  assert.match(login, /Login ou senha inválidos/);
  assert.match(login, /signInWithPassword/);
  assert.match(shared, /"Cache-Control": "no-store"/);
  assert.doesNotMatch(login, /console\.(log|error)/);
});

test("history views obey underlying RLS and push requires completed first access", async () => {
  const [sql, push] = await Promise.all([
    read("supabase/access_management.sql"), read("supabase/functions/send-push/index.ts"),
  ]);
  assert.match(sql, /equipment_full_history set \(security_invoker=true\)/);
  assert.match(push, /maintenance_account_status/);
  assert.match(push, /if \(passwordRequired\)/);
});
