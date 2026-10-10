-- Push notifications para o Sistema de Manutenção
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  organization_id uuid,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.push_subscriptions enable row level security;

drop policy if exists "push_select_own" on public.push_subscriptions;
create policy "push_select_own" on public.push_subscriptions
for select to authenticated using (user_id = auth.uid());

drop policy if exists "push_insert_own" on public.push_subscriptions;
create policy "push_insert_own" on public.push_subscriptions
for insert to authenticated with check (user_id = auth.uid());

drop policy if exists "push_update_own" on public.push_subscriptions;
create policy "push_update_own" on public.push_subscriptions
for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "push_delete_own" on public.push_subscriptions;
create policy "push_delete_own" on public.push_subscriptions
for delete to authenticated using (user_id = auth.uid());

create or replace function public.set_push_subscription_org()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  select organization_id into new.organization_id
  from public.profiles
  where id = new.user_id;
  return new;
end;
$$;

drop trigger if exists trg_push_subscription_org on public.push_subscriptions;
create trigger trg_push_subscription_org
before insert or update of user_id on public.push_subscriptions
for each row execute function public.set_push_subscription_org();

create index if not exists push_subscriptions_user_idx on public.push_subscriptions(user_id);
create index if not exists push_subscriptions_org_idx on public.push_subscriptions(organization_id);
