create extension if not exists pgcrypto;

create table if not exists public.products (
  sku text primary key,
  name text not null,
  colour text not null,
  price_hkd integer not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

insert into public.products (sku, name, colour, price_hkd)
values
  ('BX-MUT-01', 'Utility Tee - Black', 'Tactical Black', 498),
  ('BX-MUT-02', 'Utility Tee - Navy', 'Field Navy', 498)
on conflict (sku) do update set
  name = excluded.name,
  colour = excluded.colour,
  price_hkd = excluded.price_hkd;

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
  items jsonb not null default '[]'::jsonb,
  checkout_url text,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists orders_status_idx on public.orders (status);
create index if not exists orders_created_at_idx on public.orders (created_at desc);

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

alter table public.products enable row level security;
alter table public.orders enable row level security;

drop policy if exists "Public products are readable" on public.products;
create policy "Public products are readable"
on public.products
for select
using (active = true);
