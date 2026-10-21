-- Additive migration: existing users, policies, calls and histories are preserved.
begin;
create schema if not exists maintenance_private;
revoke all on schema maintenance_private from public, anon, authenticated;
create table if not exists maintenance_private.accounts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  login text not null unique check (login ~ '^[a-z0-9._-]{3,40}$'),
  auth_email text not null,
  must_change_password boolean not null default true
);
alter table maintenance_private.accounts enable row level security;
create table if not exists maintenance_private.login_limits (
  key text primary key,
  started_at timestamptz not null default now(),
  attempts integer not null default 1
);
alter table maintenance_private.login_limits enable row level security;
alter table public.profiles add column if not exists login text;
create unique index if not exists profiles_login_unique on public.profiles(lower(login)) where login is not null;

create or replace function public.maintenance_access_ready()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles p
    where p.id=auth.uid() and p.active
      and not exists(select 1 from maintenance_private.accounts a
        where a.user_id=p.id and a.must_change_password)
  );
$$;
revoke all on function public.maintenance_access_ready() from public;
grant execute on function public.maintenance_access_ready() to authenticated, service_role;

-- A password change must be performed by Supabase Auth, not by changing a flag
-- or user_metadata. Existing email accounts remain unaffected.
create or replace function maintenance_private.password_changed()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.encrypted_password is distinct from old.encrypted_password
     and coalesce(new.encrypted_password,'') <> '' then
    update maintenance_private.accounts set must_change_password=false where user_id=new.id;
  end if;
  return new;
end;
$$;
drop trigger if exists maintenance_password_changed on auth.users;
create trigger maintenance_password_changed after update of encrypted_password on auth.users
for each row execute function maintenance_private.password_changed();

create or replace function public.maintenance_account_lookup(p_login text)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('user_id',user_id,'auth_email',auth_email,
    'must_change_password',must_change_password)
  from maintenance_private.accounts where login=p_login;
$$;
create or replace function public.maintenance_account_status(p_user_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((select must_change_password from maintenance_private.accounts where user_id=p_user_id),false);
$$;
create or replace function public.maintenance_account_create(
  p_user_id uuid,p_org uuid,p_name text,p_login text,p_email text,p_role text,p_sector uuid
) returns void language plpgsql security definer set search_path = '' as $$
begin
  if p_role not in ('admin','mechanic','sector') then raise exception 'Perfil inválido'; end if;
  if p_role='sector' and not exists(select 1 from public.sectors
    where id=p_sector and organization_id=p_org and active) then
    raise exception 'Setor inválido ou inativo';
  end if;
  insert into public.profiles(id,organization_id,full_name,role,sector_id,active,login)
    values(p_user_id,p_org,p_name,p_role,case when p_role='sector' then p_sector else null end,true,p_login);
  insert into maintenance_private.accounts(user_id,login,auth_email) values(p_user_id,p_login,p_email);
end;
$$;
-- Atomic persistent throttling, including unknown usernames. Keys are hashes,
-- never raw login names or IP addresses.
create or replace function public.maintenance_login_limit(p_key text,p_max integer)
returns boolean language plpgsql security definer set search_path = '' as $$
declare n integer;
begin
  if length(p_key)<>64 or p_max not between 1 and 100 then raise exception 'Invalid limit'; end if;
  insert into maintenance_private.login_limits(key) values(p_key)
    on conflict(key) do update set
      attempts=case when maintenance_private.login_limits.started_at<now()-interval '15 minutes' then 1 else maintenance_private.login_limits.attempts+1 end,
      started_at=case when maintenance_private.login_limits.started_at<now()-interval '15 minutes' then now() else maintenance_private.login_limits.started_at end
    returning attempts into n;
  delete from maintenance_private.login_limits where started_at<now()-interval '1 day';
  return n<=p_max;
end;
$$;
revoke all on function public.maintenance_account_lookup(text), public.maintenance_account_status(uuid),
  public.maintenance_account_create(uuid,uuid,text,text,text,text,uuid),
  public.maintenance_login_limit(text,integer) from public, anon, authenticated;
grant execute on function public.maintenance_account_lookup(text), public.maintenance_account_status(uuid),
  public.maintenance_account_create(uuid,uuid,text,text,text,text,uuid),
  public.maintenance_login_limit(text,integer) to service_role;

-- Restrictive policies supplement, rather than replace, existing role/tenant
-- policies. Even an old APK or a direct REST call cannot bypass first access.
do $$
declare t text;
begin
  foreach t in array array['organizations','profiles','sectors','equipment','work_orders',
    'work_order_events','maintenance_reports','part_requests','maintenance_photos',
    'preventive_plans','preventive_maintenance_records','native_push_devices','push_subscriptions']
  loop
    execute format('alter table public.%I enable row level security',t);
    execute format('drop policy if exists maintenance_access_gate on public.%I',t);
    execute format('create policy maintenance_access_gate on public.%I as restrictive for all to authenticated using (public.maintenance_access_ready()) with check (public.maintenance_access_ready())',t);
  end loop;
end $$;
drop policy if exists maintenance_admin_read_profiles on public.profiles;
create policy maintenance_admin_read_profiles on public.profiles for select to authenticated
  using (organization_id=public.current_user_org() and public.current_user_role()='admin');
drop policy if exists maintenance_active_call_targets on public.work_orders;
create policy maintenance_active_call_targets on public.work_orders as restrictive for insert to authenticated
  with check (
    exists(select 1 from public.sectors s where s.id=sector_id and s.organization_id=work_orders.organization_id and s.active)
    and (equipment_id is null or exists(select 1 from public.equipment e
      where e.id=equipment_id and e.organization_id=work_orders.organization_id and e.active))
  );
-- These existing history views must obey their underlying table policies.
alter view public.equipment_maintenance_history set (security_invoker=true);
alter view public.equipment_full_history set (security_invoker=true);

-- Self-removal and concurrent removal of the final administrator are blocked
-- in the database too. Auth deletion cascades cannot remove referenced history.
create or replace function maintenance_private.protect_admin()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if old.role='admin' and old.active and
    (tg_op='DELETE' or not new.active or new.role<>'admin') then
    perform pg_advisory_xact_lock(hashtextextended(old.organization_id::text,0));
    if (select count(*) from public.profiles where organization_id=old.organization_id and role='admin' and active)<=1 then
      raise exception 'Não é permitido remover ou desativar o último administrador';
    end if;
  end if;
  if tg_op='DELETE' then return old; end if;
  return new;
end;
$$;
drop trigger if exists maintenance_protect_admin on public.profiles;
create trigger maintenance_protect_admin before delete or update on public.profiles
for each row execute function maintenance_private.protect_admin();

-- One transaction, actor identity from the JWT, row locks and tenant checks.
-- SQLSTATE 23503/FK constraints are the authoritative history protection.
create or replace function public.maintenance_manage(p_entity text,p_id uuid,p_action text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare actor public.profiles; target public.profiles; org uuid; linked boolean;
begin
  select * into actor from public.profiles where id=auth.uid();
  if actor.id is null or actor.role<>'admin' or not public.maintenance_access_ready() then
    raise exception 'Acesso exclusivo do administrador' using errcode='42501';
  end if;
  if p_action not in ('delete','deactivate','reactivate') then raise exception 'Ação inválida'; end if;
  if p_entity='users' then
    select * into target from public.profiles where id=p_id for update;
    if target.id is null or target.organization_id<>actor.organization_id then raise exception 'Cadastro não encontrado'; end if;
    if p_id=actor.id and p_action<>'reactivate' then raise exception 'Não é permitido remover ou desativar sua própria conta'; end if;
    if p_action='delete' then
      -- No Auth deletion here: caller returns a removal permit to the Edge
      -- function, which uses the official Auth API. FK constraints also cover
      -- references created concurrently after this check.
      linked:=exists(select 1 from public.work_orders where requester_id=p_id or mechanic_id=p_id)
        or exists(select 1 from public.maintenance_reports where mechanic_id=p_id)
        or exists(select 1 from public.work_order_events where user_id=p_id)
        or exists(select 1 from public.part_requests where requested_by=p_id)
        or exists(select 1 from public.maintenance_photos where uploaded_by=p_id)
        or exists(select 1 from public.preventive_maintenance_records where performed_by=p_id);
      if linked then return jsonb_build_object('ok',false,'can_deactivate',true,'error','Usuário vinculado a registros. Desative para preservar o histórico.'); end if;
      return jsonb_build_object('ok',true,'auth_delete',true,'id',p_id);
    end if;
    if p_action='reactivate' and target.role='sector' and not exists(select 1 from public.sectors where id=target.sector_id and active) then
      raise exception 'Reative o setor antes de reativar o usuário';
    end if;
    update public.profiles set active=(p_action='reactivate') where id=p_id;
    if p_action='deactivate' then
      delete from public.native_push_devices where user_id=p_id;
      delete from public.push_subscriptions where user_id=p_id;
    end if;
  elsif p_entity in ('sectors','equipment') then
    if p_entity='sectors' then
      select organization_id into org from public.sectors where id=p_id for update;
    else
      select organization_id into org from public.equipment where id=p_id for update;
    end if;
    if org is null or org<>actor.organization_id then raise exception 'Cadastro não encontrado'; end if;
    begin
      if p_entity='sectors' then
        if p_action='delete' then delete from public.sectors where id=p_id;
        else update public.sectors set active=(p_action='reactivate') where id=p_id; end if;
      else
        if p_action='delete' then delete from public.equipment where id=p_id;
        else update public.equipment set active=(p_action='reactivate') where id=p_id; end if;
      end if;
    exception when foreign_key_violation then
      return jsonb_build_object('ok',false,'can_deactivate',true,'error','Cadastro vinculado a registros. Desative para preservar o histórico.');
    end;
  else raise exception 'Tipo de cadastro inválido';
  end if;
  return jsonb_build_object('ok',true,'entity',p_entity,'id',p_id,'action',p_action);
end;
$$;
revoke all on function public.maintenance_manage(text,uuid,text) from public, anon;
grant execute on function public.maintenance_manage(text,uuid,text) to authenticated;
commit;
