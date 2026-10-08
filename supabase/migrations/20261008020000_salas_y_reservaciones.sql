-- Módulo Salas: reservaciones guardadas aquí y copiadas al calendario Outlook de cada sala.
create extension if not exists btree_gist with schema extensions;

-- Nuevo permiso "salas".
alter table public.perfiles drop constraint perfiles_secciones_check;
alter table public.perfiles add constraint perfiles_secciones_check
  check (secciones <@ array['cotizacion', 'contrato', 'corrida', 'salas']::text[]);

create table public.salas (
  id text primary key check (id ~ '^[a-z0-9-]{1,30}$'),
  nombre text not null,
  -- Correo del buzón de la sala en Microsoft 365; sin él la sala funciona solo en la app.
  buzon text,
  capacidad int check (capacidad > 0),
  activa boolean not null default true,
  orden int not null default 0
);

insert into public.salas (id, nombre, orden) values
  ('principal', 'Sala principal', 1),
  ('salita-2', 'Salita 2', 2);

create table public.reservaciones (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique default ('SALA-' || upper(substr(md5(gen_random_uuid()::text), 1, 6))),
  sala_id text not null references public.salas (id),
  inicio timestamptz not null,
  fin timestamptz not null,
  motivo text not null check (length(motivo) between 1 and 200),
  personas int not null default 1 check (personas between 1 and 100),
  invitados text[] not null default '{}' check (cardinality(invitados) <= 30),
  creado_por uuid references auth.users (id) on delete set null,
  creado_por_email text not null,
  creado_por_nombre text not null default '',
  estado text not null default 'activa' check (estado in ('activa', 'cancelada')),
  outlook_event_id text,
  sync_error text,
  creado timestamptz not null default now(),
  actualizado timestamptz not null default now(),
  check (fin > inicio),
  -- Nunca dos reservaciones activas encimadas en la misma sala.
  constraint reservaciones_sin_choques exclude using gist (sala_id with =, tstzrange(inicio, fin) with &&)
    where (estado = 'activa')
);

create index reservaciones_sala_inicio_idx on public.reservaciones (sala_id, inicio) where estado = 'activa';
create index reservaciones_creado_por_idx on public.reservaciones (creado_por, inicio);

alter table public.salas enable row level security;
alter table public.reservaciones enable row level security;

-- Solo lectura desde el navegador, para quien tenga el permiso "salas" (o el administrador).
-- Reservar, mover y cancelar pasa por la Edge Function "salas", que valida y sincroniza con Outlook.
revoke all on public.salas, public.reservaciones from anon, authenticated;
grant select on public.salas, public.reservaciones to authenticated;

create policy "ver salas con permiso" on public.salas
  for select to authenticated
  using (exists (
    select 1 from public.perfiles p
    where p.id = (select auth.uid()) and p.activo and (p.es_admin or 'salas' = any (p.secciones))
  ));

create policy "ver reservaciones con permiso" on public.reservaciones
  for select to authenticated
  using (exists (
    select 1 from public.perfiles p
    where p.id = (select auth.uid()) and p.activo and (p.es_admin or 'salas' = any (p.secciones))
  ));
