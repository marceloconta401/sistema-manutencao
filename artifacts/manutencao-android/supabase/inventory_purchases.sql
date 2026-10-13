-- Additive extension. Existing tables, records and policies are preserved.
begin;

create table if not exists public.inventory_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  name text not null check (length(trim(name)) > 0),
  code text,
  unit text not null default 'un',
  location text,
  stock_quantity numeric not null default 0 check (stock_quantity >= 0),
  min_quantity numeric not null default 0 check (min_quantity >= 0 and min_quantity::text not in ('NaN','Infinity','-Infinity')),
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create table if not exists public.purchase_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  inventory_item_id uuid references public.inventory_items(id),
  part_request_id uuid references public.part_requests(id),
  work_order_id uuid references public.work_orders(id),
  requested_by uuid not null references public.profiles(id),
  part_name text not null check (length(trim(part_name)) > 0),
  quantity numeric not null check (quantity > 0),
  status text not null default 'requested' check (status in ('requested','ordered','received','cancelled')),
  supplier text,
  unit_cost numeric not null default 0 check (unit_cost >= 0),
  expected_date date,
  notes text,
  created_at timestamptz not null default now(),
  received_at timestamptz
);
create unique index if not exists maintenance_one_active_purchase_per_part
  on public.purchase_requests(part_request_id) where part_request_id is not null and status <> 'cancelled';
create table if not exists public.inventory_movements (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  inventory_item_id uuid not null references public.inventory_items(id),
  created_by uuid not null references public.profiles(id),
  quantity numeric not null check (quantity <> 0),
  balance_after numeric not null check (balance_after >= 0),
  reason text not null check (length(trim(reason)) > 0),
  purchase_request_id uuid references public.purchase_requests(id),
  created_at timestamptz not null default now()
);
create index if not exists inventory_items_org_idx on public.inventory_items(organization_id);
create index if not exists purchases_org_date_idx on public.purchase_requests(organization_id,created_at desc);
create index if not exists movements_item_date_idx on public.inventory_movements(inventory_item_id,created_at desc);
create unique index if not exists maintenance_one_purchase_receipt on public.inventory_movements(purchase_request_id)
  where purchase_request_id is not null;

alter table public.inventory_items enable row level security;
alter table public.inventory_movements enable row level security;
alter table public.purchase_requests enable row level security;
drop policy if exists inventory_items_read on public.inventory_items;
drop policy if exists inventory_items_create on public.inventory_items;
drop policy if exists inventory_items_edit on public.inventory_items;
drop policy if exists inventory_movements_read on public.inventory_movements;
drop policy if exists purchase_requests_read on public.purchase_requests;
create policy inventory_items_read on public.inventory_items for select to authenticated
  using (public.maintenance_access_ready() and organization_id=public.current_user_org() and public.current_user_role()='admin');
create policy inventory_items_create on public.inventory_items for insert to authenticated
  with check (public.maintenance_access_ready() and organization_id=public.current_user_org() and public.current_user_role()='admin' and stock_quantity=0);
create policy inventory_items_edit on public.inventory_items for update to authenticated
  using (public.maintenance_access_ready() and organization_id=public.current_user_org() and public.current_user_role()='admin')
  with check (public.maintenance_access_ready() and organization_id=public.current_user_org() and public.current_user_role()='admin');
create policy inventory_movements_read on public.inventory_movements for select to authenticated
  using (public.maintenance_access_ready() and organization_id=public.current_user_org() and public.current_user_role()='admin');
create policy purchase_requests_read on public.purchase_requests for select to authenticated
  using (public.maintenance_access_ready() and organization_id=public.current_user_org() and
    (public.current_user_role()='admin' or exists (select 1 from public.work_orders wo where wo.id=work_order_id)));
revoke all on public.inventory_items,public.inventory_movements,public.purchase_requests from anon,authenticated;
grant select on public.inventory_items,public.inventory_movements,public.purchase_requests to authenticated;
grant insert (organization_id,name,code,unit,location,min_quantity) on public.inventory_items to authenticated;
grant update (name,code,unit,location,min_quantity,active) on public.inventory_items to authenticated;
grant all on public.inventory_items,public.inventory_movements,public.purchase_requests to service_role;

create or replace function public.maintenance_operations_admin() returns uuid
language plpgsql security definer set search_path=public,pg_temp as $$
declare org uuid;
begin
  if auth.uid() is null or not public.maintenance_access_ready() or public.current_user_role()<>'admin' then
    raise exception 'Acesso exclusivo de administrador ativo com primeiro acesso concluído.' using errcode='42501';
  end if;
  org := public.current_user_org();
  if org is null then raise exception 'Organização inválida.' using errcode='42501'; end if;
  return org;
end $$;

create or replace function public.maintenance_stock_move(p_item uuid,p_quantity numeric,p_reason text)
returns numeric language plpgsql security definer set search_path=public,pg_temp as $$
declare org uuid; item public.inventory_items; balance numeric;
begin
  org:=public.maintenance_operations_admin();
  if p_quantity is null or p_quantity=0 or p_quantity::text in ('NaN','Infinity','-Infinity') or nullif(trim(p_reason),'') is null then
    raise exception 'Informe quantidade válida e motivo da movimentação.';
  end if;
  select * into item from public.inventory_items where id=p_item and organization_id=org and active for update;
  if not found then raise exception 'Peça ativa não encontrada nesta organização.'; end if;
  balance:=item.stock_quantity+p_quantity;
  if balance<0 then raise exception 'Saldo insuficiente. Disponível: %',item.stock_quantity; end if;
  update public.inventory_items set stock_quantity=balance where id=item.id;
  insert into public.inventory_movements(organization_id,inventory_item_id,created_by,quantity,balance_after,reason)
    values(org,item.id,auth.uid(),p_quantity,balance,trim(p_reason));
  return balance;
end $$;

create or replace function public.maintenance_purchase_create(
  p_name text,p_quantity numeric,p_item uuid default null,p_part uuid default null,
  p_supplier text default null,p_cost numeric default 0,p_expected date default null,p_notes text default null)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare org uuid; part public.part_requests; call_id uuid; new_id uuid; name text:=trim(p_name);
begin
  org:=public.maintenance_operations_admin();
  if p_quantity is null or p_quantity<=0 or p_quantity::text in ('NaN','Infinity','-Infinity')
    or p_cost is null or p_cost<0 or p_cost::text in ('NaN','Infinity','-Infinity') then
    raise exception 'Quantidade ou valor inválido.';
  end if;
  if p_item is not null and not exists(select 1 from public.inventory_items where id=p_item and organization_id=org and active) then
    raise exception 'Peça não pertence ao estoque ativo desta organização.';
  end if;
  if p_part is not null then
    select * into part from public.part_requests where id=p_part and organization_id=org for update;
    if not found or part.status<>'requested' then raise exception 'Solicitação de peça não está disponível para compra.'; end if;
    if p_quantity<>part.quantity then raise exception 'A quantidade deve corresponder à solicitação de peça.'; end if;
    call_id:=part.work_order_id; name:=part.part_name;
  end if;
  if nullif(name,'') is null then raise exception 'Informe o nome da peça.'; end if;
  insert into public.purchase_requests(organization_id,inventory_item_id,part_request_id,work_order_id,requested_by,
    part_name,quantity,supplier,unit_cost,expected_date,notes)
    values(org,p_item,p_part,call_id,auth.uid(),name,p_quantity,nullif(trim(p_supplier),''),p_cost,p_expected,nullif(trim(p_notes),''))
    returning id into new_id;
  return new_id;
end $$;

create or replace function public.maintenance_purchase_status(p_purchase uuid,p_status text)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare org uuid; purchase public.purchase_requests;
begin
  org:=public.maintenance_operations_admin();
  select * into purchase from public.purchase_requests where id=p_purchase and organization_id=org for update;
  if not found then raise exception 'Compra não encontrada nesta organização.'; end if;
  if not ((purchase.status='requested' and p_status in ('ordered','cancelled'))
    or (purchase.status='ordered' and p_status='cancelled')) then raise exception 'Transição de compra inválida.'; end if;
  update public.purchase_requests set status=p_status where id=purchase.id;
  if purchase.part_request_id is not null then
    update public.part_requests set status=case when p_status='ordered' then 'purchased' else 'requested' end
      where id=purchase.part_request_id and organization_id=org;
  end if;
end $$;

create or replace function public.maintenance_purchase_receive(p_purchase uuid)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare org uuid; purchase public.purchase_requests; item public.inventory_items; item_id uuid; balance numeric;
begin
  org:=public.maintenance_operations_admin();
  select * into purchase from public.purchase_requests where id=p_purchase and organization_id=org for update;
  if not found then raise exception 'Compra não encontrada nesta organização.'; end if;
  if purchase.status<>'ordered' then raise exception 'Só uma compra confirmada pode ser recebida; recebimento duplicado é proibido.'; end if;
  item_id:=purchase.inventory_item_id;
  if item_id is null then
    insert into public.inventory_items(organization_id,name) values(org,purchase.part_name) returning id into item_id;
  end if;
  select * into item from public.inventory_items where id=item_id and organization_id=org and active for update;
  if not found then raise exception 'Peça de estoque indisponível nesta organização.'; end if;
  balance:=item.stock_quantity+purchase.quantity;
  update public.inventory_items set stock_quantity=balance where id=item_id;
  insert into public.inventory_movements(organization_id,inventory_item_id,created_by,quantity,balance_after,reason,purchase_request_id)
    values(org,item_id,auth.uid(),purchase.quantity,balance,'Recebimento de compra',purchase.id);
  update public.purchase_requests set status='received',received_at=now(),inventory_item_id=item_id where id=purchase.id;
  if purchase.part_request_id is not null then
    update public.part_requests set status='received' where id=purchase.part_request_id and organization_id=org;
  end if;
  return item_id;
end $$;
revoke all on function public.maintenance_operations_admin(),public.maintenance_stock_move(uuid,numeric,text),
  public.maintenance_purchase_create(text,numeric,uuid,uuid,text,numeric,date,text),
  public.maintenance_purchase_status(uuid,text),public.maintenance_purchase_receive(uuid) from public,anon;
grant execute on function public.maintenance_stock_move(uuid,numeric,text),
  public.maintenance_purchase_create(text,numeric,uuid,uuid,text,numeric,date,text),
  public.maintenance_purchase_status(uuid,text),public.maintenance_purchase_receive(uuid) to authenticated;
-- Preserve the existing rules and extend history protection to the new ledgers.
do $extend_history$
declare definition text; anchor text := 'or exists(select 1 from public.preventive_maintenance_records where performed_by=p_id)';
begin
  definition := pg_get_functiondef('public.maintenance_manage(text,uuid,text)'::regprocedure);
  if position('public.inventory_movements where created_by=p_id' in definition)=0 then
    if position(anchor in definition)=0 then
      raise exception 'Proteção de histórico existente não localizada. Nenhuma regra será substituída.';
    end if;
    definition := replace(definition, anchor, anchor ||
      ' or exists(select 1 from public.inventory_movements where created_by=p_id)' ||
      ' or exists(select 1 from public.purchase_requests where requested_by=p_id)');
    execute definition;
  end if;
end
$extend_history$;
commit;
