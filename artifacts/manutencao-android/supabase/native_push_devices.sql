-- Android FCM device registrations. Run in the target Supabase project before
-- deploying send-push or installing an Android build.
create table if not exists public.native_push_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  fcm_token text not null unique,
  platform text not null default 'android' check (platform = 'android'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.native_push_devices enable row level security;

drop policy if exists native_push_devices_select_own on public.native_push_devices;
create policy native_push_devices_select_own
  on public.native_push_devices for select to authenticated
  using (user_id = auth.uid());

drop policy if exists native_push_devices_insert_own on public.native_push_devices;
create policy native_push_devices_insert_own
  on public.native_push_devices for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists native_push_devices_update_own on public.native_push_devices;
create policy native_push_devices_update_own
  on public.native_push_devices for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists native_push_devices_delete_own on public.native_push_devices;
create policy native_push_devices_delete_own
  on public.native_push_devices for delete to authenticated
  using (user_id = auth.uid());

create index if not exists native_push_devices_user_idx
  on public.native_push_devices(user_id);
