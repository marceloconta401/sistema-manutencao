// Isolated synthetic fixtures and rollback-only database assertions.
// Credentials stay in .local (ignored by Git) and are never printed.
import { readFile, writeFile, mkdir } from "node:fs/promises";
import crypto from "node:crypto";
const root = new URL("../../../", import.meta.url);
const fixtureUrl = new URL(".local/native-verification/layout-fixtures.json", root);
const quote = v => "'" + String(v).replaceAll("'", "''") + "'";
const endpoint = "https://api.supabase.com/v1/projects/aijkbluzpmffmnflhjyv/database/query";
async function sql(query) {
  const r = await fetch(endpoint, { method: "POST", headers: {
    Authorization: `Bearer ${process.env.SUPABASE_MIGRATION_ACCESS_TOKEN || process.env.SUPABASE_ACCESS_TOKEN}`,
    "Content-Type": "application/json",
  }, body: JSON.stringify({ query }) });
  const body = await r.text();
  if (!r.ok) throw new Error(`Database verification HTTP ${r.status}: ${body}`);
  return JSON.parse(body);
}
if (process.argv.includes("--setup")) {
  const suffix = crypto.randomBytes(5).toString("hex");
  const f = { org: crypto.randomUUID(), sector: crypto.randomUUID(), equipment: crypto.randomUUID(), users: {} };
  let query = `begin;
    insert into public.organizations(id,name) values(${quote(f.org)},${quote("TESTE Layout " + suffix)});
    insert into public.sectors(id,organization_id,name) values(${quote(f.sector)},${quote(f.org)},'TESTE Produção');
    insert into public.equipment(id,organization_id,sector_id,name,code,active) values(${quote(f.equipment)},${quote(f.org)},${quote(f.sector)},'TESTE Prensa','TESTE-EQ',true);`;
  for (const role of ["admin", "mechanic", "sector"]) {
    const u = { id: crypto.randomUUID(), login: `layout.${role}.${suffix}`, email: `layout.${role}.${suffix}@example.invalid`,
      password: crypto.randomBytes(18).toString("base64url"), newPassword: crypto.randomBytes(18).toString("base64url") };
    f.users[role] = u;
    query += `
      insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,
        raw_app_meta_data,raw_user_meta_data,created_at,updated_at,confirmation_token,recovery_token,email_change_token_new,email_change)
      values(${quote(u.id)},'00000000-0000-0000-0000-000000000000','authenticated','authenticated',${quote(u.email)},
        extensions.crypt(${quote(u.password)},extensions.gen_salt('bf')),now(),'{"provider":"email","providers":["email"]}','{}',now(),now(),'','','','');
      insert into auth.identities(id,user_id,identity_data,provider,provider_id,last_sign_in_at,created_at,updated_at)
      values(gen_random_uuid(),${quote(u.id)},jsonb_build_object('sub',${quote(u.id)},'email',${quote(u.email)}),'email',${quote(u.id)},now(),now(),now());
      select public.maintenance_account_create(${quote(u.id)},${quote(f.org)},${quote("TESTE " + role)},${quote(u.login)},${quote(u.email)},${quote(role)},${quote(f.sector)});
      ${role === "admin" ? `update maintenance_private.accounts set must_change_password=false where user_id=${quote(u.id)};` : ""}`;
  }
  query += "commit;";
  await sql(query);
  await mkdir(new URL(".local/native-verification/", root), { recursive: true });
  await writeFile(fixtureUrl, JSON.stringify(f, null, 2), { mode: 0o600 });
  console.log("Synthetic isolated organization and three test accounts created; credentials in ignored fixture file.");
} else if (process.argv.includes("--cleanup")) {
  const f = JSON.parse(await readFile(fixtureUrl, "utf8"));
  const ids = `select id from public.profiles where organization_id=${quote(f.org)}`;
  await sql(`begin;
    update public.profiles set active=false where organization_id=${quote(f.org)} and role<>'admin';
    update maintenance_private.accounts set must_change_password=true where user_id in (${ids});
    update auth.users set banned_until=now()+interval '100 years' where id in (${ids});
    delete from auth.sessions where user_id in (${ids});
    delete from auth.refresh_tokens where user_id in (select id::text from public.profiles where organization_id=${quote(f.org)});
    delete from public.native_push_devices where user_id in (${ids});
    delete from public.push_subscriptions where user_id in (${ids});
    commit;`);
  // Preserve only non-credential fixture identifiers for checking test history.
  await writeFile(fixtureUrl, JSON.stringify({ org: f.org, sector: f.sector, equipment: f.equipment,
    users: Object.fromEntries(Object.entries(f.users).map(([role, u]) => [role, { id: u.id }])) }, null, 2), { mode: 0o600 });
  console.log("Synthetic access gated, non-admin accounts disabled and all synthetic accounts banned/session-revoked; last-admin protection and histories preserved; credentials removed.");
} else {
  const f = JSON.parse(await readFile(fixtureUrl, "utf8"));
  const a = quote(f.users.admin.id), mech = quote(f.users.mechanic.id), org = quote(f.org);
  const backup = quote(crypto.randomUUID());
  const data = await sql(`begin;
    insert into auth.users(id,instance_id,aud,role,email,created_at,updated_at)
      values(${backup},'00000000-0000-0000-0000-000000000000','authenticated','authenticated','rollback.backup.${crypto.randomBytes(6).toString("hex")}@example.invalid',now(),now());
    insert into public.profiles(id,organization_id,full_name,role,active) values(${backup},${org},'TESTE Backup transacional','admin',true);
    update maintenance_private.accounts set must_change_password=false where user_id in (${a},${mech});
    select set_config('request.jwt.claims',jsonb_build_object('sub',${a},'role','authenticated')::text,true);
    set local role authenticated;
    do $test$
    declare item uuid; purchase uuid; total numeric; blocked boolean;
    begin
      insert into public.inventory_items(organization_id,name,min_quantity) values(${org},'TESTE Transação',1) returning id into item;
      perform public.maintenance_stock_move(item,5,'TESTE Entrada');
      select stock_quantity into total from public.inventory_items where id=item;
      if total<>5 then raise exception 'Entry balance assertion'; end if;
      blocked:=false;
      begin perform public.maintenance_stock_move(item,-6,'TESTE Saída inválida');
      exception when others then blocked:=true; end;
      if not blocked then raise exception 'Negative stock accepted'; end if;
      select stock_quantity into total from public.inventory_items where id=item;
      if total<>5 then raise exception 'Failed movement changed stock'; end if;
      purchase:=public.maintenance_purchase_create('TESTE Compra',2,item,null,'TESTE Fornecedor',10,current_date,'TESTE');
      perform public.maintenance_purchase_status(purchase,'ordered');
      perform public.maintenance_purchase_receive(purchase);
      select stock_quantity into total from public.inventory_items where id=item;
      if total<>7 then raise exception 'Purchase receipt balance assertion'; end if;
      blocked:=false;
      begin perform public.maintenance_purchase_receive(purchase); exception when others then blocked:=true; end;
      if not blocked then raise exception 'Duplicate receipt accepted'; end if;
      select count(*) into total from public.inventory_movements where purchase_request_id=purchase;
      if total<>1 then raise exception 'Duplicate receipt ledger'; end if;
      blocked:=false;
      begin update public.inventory_items set stock_quantity=100 where id=item; exception when insufficient_privilege then blocked:=true; end;
      if not blocked then raise exception 'Direct unaudited balance update accepted'; end if;
      blocked:=false;
      begin perform public.maintenance_stock_move(gen_random_uuid(),1,'TESTE Cross-tenant/unknown'); exception when others then blocked:=true; end;
      if not blocked then raise exception 'Unknown tenant item accepted'; end if;
    end $test$;
    reset role;
    select set_config('request.jwt.claims',jsonb_build_object('sub',${mech},'role','authenticated')::text,true);
    set local role authenticated;
    do $test$ declare blocked boolean:=false; n int; begin
      begin perform public.maintenance_purchase_create('TESTE Mecânico',1); exception when insufficient_privilege then blocked:=true; end;
      if not blocked then raise exception 'Mechanic administered purchases'; end if;
      select count(*) into n from public.inventory_items;
      if n<>0 then raise exception 'Mechanic accessed admin stock'; end if;
    end $test$;
    reset role;
    update public.profiles set active=false where id=${a};
    select set_config('request.jwt.claims',jsonb_build_object('sub',${a},'role','authenticated')::text,true);
    set local role authenticated;
    do $test$ declare blocked boolean:=false; n int; begin
      begin perform public.maintenance_purchase_create('TESTE Inativo',1); exception when insufficient_privilege then blocked:=true; end;
      if not blocked then raise exception 'Inactive account administered purchases'; end if;
      select count(*) into n from public.purchase_requests;
      if n<>0 then raise exception 'Inactive account read purchases'; end if;
    end $test$;
    reset role;
    rollback;
    select 'Stock entry, negative balance rejection, receipt, duplicate receipt rejection, immutable balances, invalid item, mechanic restriction and inactive-account gate: passed; assertions rolled back.' as result;`);
  console.log(data);
}
