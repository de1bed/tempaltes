-- Corridas enviadas a cotizaciones: quien hace corridas las manda ("Mandar a cotizaciones");
-- quien hace cotizaciones las ve en su bandeja y las convierte en una cotización de nómina.
create table if not exists public.envios_corrida (
  id uuid primary key default gen_random_uuid(),
  creado timestamptz not null default now(),
  enviado_por uuid default auth.uid(),
  enviado_por_email text not null default (auth.jwt() ->> 'email'),
  enviado_por_nombre text not null default '' check (length(enviado_por_nombre) <= 120),
  corrida text not null check (corrida in ('kofile', 'general', 'hilos33')),
  empresa text not null default '' check (length(empresa) <= 200),
  puesto text not null default '' check (length(puesto) <= 200),
  nota text not null default '' check (length(nota) <= 1000),
  -- Montos semanales para la cotización de nómina y datos de la corrida tal cual (para revisarla).
  resumen jsonb not null check (pg_column_size(resumen) <= 8192),
  datos jsonb not null check (pg_column_size(datos) <= 65536),
  estado text not null default 'pendiente' check (estado in ('pendiente', 'convertida', 'descartada')),
  atendido_por uuid,
  atendido_por_nombre text check (length(atendido_por_nombre) <= 120),
  atendido_en timestamptz
);

alter table public.envios_corrida enable row level security;
revoke all on public.envios_corrida from anon, authenticated;
grant select on public.envios_corrida to authenticated;
-- Solo estas columnas se escriben desde la app: quién envía y la fecha las pone la base de datos.
grant insert (enviado_por_nombre, corrida, empresa, puesto, nota, resumen, datos) on public.envios_corrida to authenticated;
grant update (estado, atendido_por, atendido_por_nombre, atendido_en) on public.envios_corrida to authenticated;

create policy "ver envios" on public.envios_corrida for select to authenticated
  using (exists (select 1 from public.perfiles p where p.id = (select auth.uid()) and p.activo
    and (p.es_admin or p.secciones && array['corrida', 'cotizacion'])));

create policy "enviar corridas" on public.envios_corrida for insert to authenticated
  with check (enviado_por = (select auth.uid()) and estado = 'pendiente' and atendido_por is null and exists (select 1 from public.perfiles p
    where p.id = (select auth.uid()) and p.activo and (p.es_admin or 'corrida' = any (p.secciones))));

create policy "atender envios" on public.envios_corrida for update to authenticated
  using (exists (select 1 from public.perfiles p where p.id = (select auth.uid()) and p.activo
    and (p.es_admin or 'cotizacion' = any (p.secciones))))
  with check (atendido_por = (select auth.uid()) and exists (select 1 from public.perfiles p
    where p.id = (select auth.uid()) and p.activo and (p.es_admin or 'cotizacion' = any (p.secciones))));
