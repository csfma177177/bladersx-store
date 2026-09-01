create extension if not exists pgcrypto;

create table if not exists public.products (
  sku text primary key,
  name text not null,
  colour text not null,
  price_hkd integer not null,
  original_price_hkd integer not null default 498,
  member_price_hkd integer not null default 498,
  sale_price_hkd integer,
  pricing_mode text not null default 'member',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  stripe_session_id text unique not null,
  client_reference_id text unique not null,
  status text not null default 'checkout_created'
    check (status in ('checkout_created', 'paid', 'cancelled', 'refunded')),
  currency text not null default 'hkd',
  amount_total integer,
  customer_email text,
  customer_name text,
  customer_phone text,
  fulfillment_status text not null default 'pending',
  admin_notes text,
  items jsonb not null default '[]'::jsonb,
  checkout_url text,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.product_variants (
  sku text not null references public.products (sku) on delete cascade,
  size text not null check (size in ('S', 'M', 'L', 'XL', '2XL')),
  stock_quantity integer not null default 0 check (stock_quantity >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (sku, size)
);

alter table public.products
  add column if not exists active boolean not null default true;

alter table public.products
  add column if not exists created_at timestamptz not null default now();

alter table public.products
  add column if not exists updated_at timestamptz not null default now();

alter table public.products
  add column if not exists original_price_hkd integer not null default 498;

alter table public.products
  add column if not exists member_price_hkd integer not null default 498;

alter table public.products
  add column if not exists sale_price_hkd integer;

alter table public.products
  add column if not exists pricing_mode text not null default 'member';

alter table public.orders
  add column if not exists currency text not null default 'hkd';

alter table public.orders
  add column if not exists amount_total integer;

alter table public.orders
  add column if not exists customer_email text;

alter table public.orders
  add column if not exists customer_name text;

alter table public.orders
  add column if not exists customer_phone text;

alter table public.orders
  add column if not exists fulfillment_status text not null default 'pending';

alter table public.orders
  add column if not exists admin_notes text;

alter table public.orders
  add column if not exists items jsonb not null default '[]'::jsonb;

alter table public.orders
  add column if not exists checkout_url text;

alter table public.orders
  add column if not exists paid_at timestamptz;

alter table public.orders
  add column if not exists created_at timestamptz not null default now();

alter table public.orders
  add column if not exists updated_at timestamptz not null default now();

alter table public.product_variants
  add column if not exists active boolean not null default true;

alter table public.product_variants
  add column if not exists created_at timestamptz not null default now();

alter table public.product_variants
  add column if not exists updated_at timestamptz not null default now();

insert into public.products (sku, name, colour, price_hkd, original_price_hkd, member_price_hkd, sale_price_hkd, pricing_mode)
values
  ('BX-MUT-01', 'Utility Tee - Charcoal Grey', 'Charcoal Grey', 498, 498, 498, null, 'member'),
  ('BX-MUT-02', 'Utility Tee - Navy', 'Field Navy', 498, 498, 498, null, 'member')
on conflict (sku) do update set
  name = excluded.name,
  colour = excluded.colour,
  price_hkd = excluded.price_hkd,
  original_price_hkd = excluded.original_price_hkd,
  member_price_hkd = excluded.member_price_hkd,
  sale_price_hkd = excluded.sale_price_hkd,
  pricing_mode = excluded.pricing_mode;

insert into public.product_variants (sku, size, stock_quantity, active)
select products.sku, sizes.size, 0, true
from public.products as products
cross join (values ('S'), ('M'), ('L'), ('XL'), ('2XL')) as sizes(size)
on conflict (sku, size) do nothing;

create index if not exists orders_status_idx on public.orders (status);
create index if not exists orders_created_at_idx on public.orders (created_at desc);
create index if not exists product_variants_sku_idx on public.product_variants (sku);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_orders_updated_at on public.orders;
create trigger set_orders_updated_at
before update on public.orders
for each row
execute function public.set_updated_at();

drop trigger if exists set_products_updated_at on public.products;
create trigger set_products_updated_at
before update on public.products
for each row
execute function public.set_updated_at();

drop trigger if exists set_product_variants_updated_at on public.product_variants;
create trigger set_product_variants_updated_at
before update on public.product_variants
for each row
execute function public.set_updated_at();

alter table public.products enable row level security;
alter table public.product_variants enable row level security;
alter table public.orders enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'products_pricing_mode_check'
  ) then
    alter table public.products
      add constraint products_pricing_mode_check
      check (pricing_mode in ('member', 'sale'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'orders_fulfillment_status_check'
  ) then
    alter table public.orders
      add constraint orders_fulfillment_status_check
      check (fulfillment_status in ('pending', 'processing', 'shipped', 'completed'));
  end if;
end
$$;

update public.products
set
  original_price_hkd = coalesce(original_price_hkd, price_hkd),
  member_price_hkd = coalesce(member_price_hkd, price_hkd)
where true;

drop policy if exists "Public products are readable" on public.products;
create policy "Public products are readable"
on public.products
for select
using (active = true);
