-- Módulo Felicitaciones: directorio de colaboradores (foto, puesto, fechas) para generar
-- cumpleaños, aniversarios, bienvenidas y despedidas con las plantillas de Treve.

-- Nuevo permiso "felicitaciones".
alter table public.perfiles drop constraint perfiles_secciones_check;
alter table public.perfiles add constraint perfiles_secciones_check
  check (secciones <@ array['cotizacion', 'contrato', 'corrida', 'salas', 'felicitaciones']::text[]);

create table public.colaboradores (
  id uuid primary key default gen_random_uuid(),
  nombre text not null check (length(trim(nombre)) between 1 and 120),
  puesto text not null default '' check (length(puesto) <= 120),
  -- Unidad o equipo: TREVÉ Corporativo, HAATS, Feedbak, Finanzas…
  area text not null default '' check (length(area) <= 80),
  -- Foto ya recortada y reducida en el navegador (data:image/jpeg;base64,…).
  foto text check (foto is null or (foto like 'data:image/%' and length(foto) <= 400000)),
  nacimiento date,
  ingreso date,
  activo boolean not null default true,
  creado_por uuid default auth.uid() references auth.users (id) on delete set null,
  creado timestamptz not null default now(),
  actualizado timestamptz not null default now()
);

create index colaboradores_nombre_idx on public.colaboradores (lower(nombre));

create function public.colaboradores_actualizado() returns trigger
  language plpgsql set search_path = '' as $$
begin
  new.actualizado := now();
  return new;
end;
$$;

create trigger colaboradores_actualizado before update on public.colaboradores
  for each row execute function public.colaboradores_actualizado();

alter table public.colaboradores enable row level security;

-- Quien tiene el permiso "felicitaciones" (o el administrador) ve y mantiene el directorio.
revoke all on public.colaboradores from anon, authenticated;
grant select, delete on public.colaboradores to authenticated;
grant insert (nombre, puesto, area, foto, nacimiento, ingreso, activo) on public.colaboradores to authenticated;
grant update (nombre, puesto, area, foto, nacimiento, ingreso, activo) on public.colaboradores to authenticated;

create policy "ver colaboradores con permiso" on public.colaboradores
  for select to authenticated
  using (exists (
    select 1 from public.perfiles p
    where p.id = (select auth.uid()) and p.activo and (p.es_admin or 'felicitaciones' = any (p.secciones))
  ));

create policy "agregar colaboradores con permiso" on public.colaboradores
  for insert to authenticated
  with check (exists (
    select 1 from public.perfiles p
    where p.id = (select auth.uid()) and p.activo and (p.es_admin or 'felicitaciones' = any (p.secciones))
  ));

create policy "editar colaboradores con permiso" on public.colaboradores
  for update to authenticated
  using (exists (
    select 1 from public.perfiles p
    where p.id = (select auth.uid()) and p.activo and (p.es_admin or 'felicitaciones' = any (p.secciones))
  ))
  with check (exists (
    select 1 from public.perfiles p
    where p.id = (select auth.uid()) and p.activo and (p.es_admin or 'felicitaciones' = any (p.secciones))
  ));

create policy "borrar colaboradores con permiso" on public.colaboradores
  for delete to authenticated
  using (exists (
    select 1 from public.perfiles p
    where p.id = (select auth.uid()) and p.activo and (p.es_admin or 'felicitaciones' = any (p.secciones))
  ));
