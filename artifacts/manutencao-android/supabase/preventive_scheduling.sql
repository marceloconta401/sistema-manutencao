-- Additive change: keep existing orders, policies, histories and RLS.
begin;
alter table public.work_orders add column if not exists scheduled_for date;
comment on column public.work_orders.scheduled_for is 'Data programada da manutenção preventiva; não substitui a data de abertura.';

drop policy if exists maintenance_admin_preventive_insert on public.work_orders;
create policy maintenance_admin_preventive_insert
on public.work_orders as permissive for insert to authenticated
with check (
  public.maintenance_access_ready()
  and requester_id = auth.uid()
  and status = 'open'
  and mechanic_id is null
  and equipment_id is not null
  and scheduled_for is not null
  and title like 'Manutenção preventiva · %'
  and exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.active and p.role = 'admin'
      and p.organization_id = work_orders.organization_id
  )
);
-- Existing restrictive policies still enforce active equipment/sector,
-- organization boundaries and first-access completion.
notify pgrst, 'reload schema';
commit;
