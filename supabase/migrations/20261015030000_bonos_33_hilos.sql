-- Bonos de 33 Hilos: plantilla de empleados (se actualiza con el listado de nómina o la base Salary)
-- y corridas de bonos guardadas. Quien tiene el permiso "corrida" (o el administrador) las ve y edita.

create table public.hilos33_empleados (
  num text primary key check (num ~ '^\d{1,10}$'),
  nombre text not null check (length(nombre) between 1 and 200),
  puesto text not null default '' check (length(puesto) <= 200),
  ingreso date,
  salario_diario numeric(12, 2) not null check (salario_diario >= 0),
  sodexo numeric(10, 2) not null default 200 check (sodexo >= 0),
  activo boolean not null default true,
  fuente text not null default '' check (length(fuente) <= 200),
  actualizado timestamptz not null default now()
);

create table public.hilos33_bonos (
  id uuid primary key default gen_random_uuid(),
  titulo text not null check (length(titulo) between 1 and 200),
  fecha_pago date,
  tipo_cambio numeric(12, 4),
  -- Opciones y renglones de la tabla del correo (tal como se capturaron).
  datos jsonb not null,
  -- Totales al guardar (para la lista).
  resumen jsonb not null default '{}'::jsonb,
  creado_por uuid default auth.uid() references auth.users (id) on delete set null,
  creado_por_email text not null default '',
  creado timestamptz not null default now(),
  actualizado timestamptz not null default now()
);

alter table public.hilos33_empleados enable row level security;
alter table public.hilos33_bonos enable row level security;

revoke all on public.hilos33_empleados, public.hilos33_bonos from anon, authenticated;
grant select, insert, update, delete on public.hilos33_empleados to authenticated;
grant select, insert, update, delete on public.hilos33_bonos to authenticated;

create function public.puede_corridas() returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.perfiles p
    where p.id = (select auth.uid()) and p.activo and (p.es_admin or 'corrida' = any (p.secciones))
  )
$$;
revoke all on function public.puede_corridas() from public, anon;
grant execute on function public.puede_corridas() to authenticated;

create policy "corridas: plantilla 33 Hilos" on public.hilos33_empleados
  for all to authenticated using ((select public.puede_corridas())) with check ((select public.puede_corridas()));

create policy "corridas: bonos 33 Hilos" on public.hilos33_bonos
  for all to authenticated using ((select public.puede_corridas())) with check ((select public.puede_corridas()));
