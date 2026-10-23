-- Historial simple de quién hizo cada cotización. Solo se crea esta tabla:
-- no se altera ni se borra historial, bitácora ni ninguna otra.
create table public.cotizaciones (
  id uuid primary key default gen_random_uuid(),
  creado_por uuid default auth.uid() references auth.users (id) on delete set null,
  plantilla text default 'feedbak',
  cliente text,
  folio text,
  total numeric,
  creado timestamptz not null default now()
);

create index cotizaciones_creado_por_idx on public.cotizaciones (creado_por, creado desc);

alter table public.cotizaciones enable row level security;

revoke all on public.cotizaciones from anon, authenticated;
grant select on public.cotizaciones to authenticated;
grant insert (plantilla, cliente, folio, total) on public.cotizaciones to authenticated;

create policy "registrar mi cotizacion" on public.cotizaciones
  for insert to authenticated
  with check (creado_por = (select auth.uid()));

create policy "leer mis cotizaciones" on public.cotizaciones
  for select to authenticated
  using (creado_por = (select auth.uid()));
