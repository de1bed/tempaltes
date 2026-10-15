-- Salas, segunda etapa:
-- - Permiso "salas_admin": administradores de salas (mueven/cancelan cualquier reservación, ven el historial,
--   manejan los códigos para externos). Distinto del administrador de la plataforma.
-- - Reservaciones a nombre de alguien (responsable), notas, origen (cuenta o externo) y enlace de gestión para externos.
-- - Historial de cada reservación, solicitudes de horario entre personas y acceso para externos con código.
-- Todo se escribe desde la Edge Function "salas"; el navegador solo lee reservaciones y salas.

alter table public.perfiles drop constraint perfiles_secciones_check;
alter table public.perfiles add constraint perfiles_secciones_check
  check (secciones <@ array['cotizacion', 'contrato', 'corrida', 'salas', 'salas_admin', 'felicitaciones']::text[]);

alter table public.reservaciones
  add column responsable_nombre text check (length(responsable_nombre) <= 120),
  add column responsable_email text check (length(responsable_email) <= 200),
  add column notas text not null default '' check (length(notas) <= 1000),
  add column origen text not null default 'cuenta' check (origen in ('cuenta', 'externo')),
  add column empresa text check (length(empresa) <= 120);

-- Quien tiene Salas o Administrar salas ve las salas y las reservaciones.
alter policy "ver salas con permiso" on public.salas
  using (exists (
    select 1 from public.perfiles p
    where p.id = (select auth.uid()) and p.activo and (p.es_admin or p.secciones && array['salas', 'salas_admin'])
  ));

alter policy "ver reservaciones con permiso" on public.reservaciones
  using (exists (
    select 1 from public.perfiles p
    where p.id = (select auth.uid()) and p.activo and (p.es_admin or p.secciones && array['salas', 'salas_admin'])
  ));

-- Enlace secreto con el que un externo (sin cuenta) cancela su reservación. No se lee desde el navegador.
create table public.reservaciones_gestion (
  reservacion_id uuid primary key references public.reservaciones (id) on delete cascade,
  token uuid not null unique default gen_random_uuid()
);

create table public.salas_historial (
  id bigint generated always as identity primary key,
  reservacion_id uuid not null references public.reservaciones (id) on delete cascade,
  accion text not null check (length(accion) <= 40),
  quien_email text not null,
  quien_nombre text not null default '',
  externo boolean not null default false,
  detalle jsonb,
  creado timestamptz not null default now()
);
create index salas_historial_reservacion_idx on public.salas_historial (reservacion_id, creado);
create index salas_historial_creado_idx on public.salas_historial (creado desc);

create table public.solicitudes_sala (
  id uuid primary key default gen_random_uuid(),
  reservacion_id uuid not null references public.reservaciones (id) on delete cascade,
  solicitante_id uuid references auth.users (id) on delete set null,
  solicitante_email text not null,
  solicitante_nombre text not null default '',
  -- Datos de la reunión que se reservaría si se acepta: motivo, personas, invitados, notas, responsable.
  datos jsonb not null,
  mensaje text not null default '' check (length(mensaje) <= 500),
  estado text not null default 'pendiente' check (estado in ('pendiente', 'aceptada', 'rechazada', 'cancelada', 'vencida')),
  respuesta text check (length(respuesta) <= 500),
  respondido_por text,
  creado timestamptz not null default now(),
  respondido timestamptz
);
create index solicitudes_sala_reservacion_idx on public.solicitudes_sala (reservacion_id) where estado = 'pendiente';
create unique index solicitudes_sala_una_pendiente on public.solicitudes_sala (reservacion_id, solicitante_email) where estado = 'pendiente';

create table public.salas_acceso (
  sala_id text primary key references public.salas (id) on delete cascade,
  codigo text not null check (codigo ~ '^[A-Z0-9]{8}$'),
  activo boolean not null default true,
  actualizado timestamptz not null default now()
);
-- Códigos iniciales (8 caracteres sin letras confusas); se pueden cambiar desde la app.
insert into public.salas_acceso (sala_id, codigo)
select id, string_agg(substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 1 + (get_byte(extensions.gen_random_bytes(8), i) % 32), 1), '' order by i)
from public.salas, generate_series(0, 7) as i
group by id;

-- Intentos fallidos de código (para frenar a quien quiera adivinarlo).
create table public.salas_intentos (
  id bigint generated always as identity primary key,
  clave text not null,
  creado timestamptz not null default now()
);
create index salas_intentos_clave_idx on public.salas_intentos (clave, creado desc);

alter table public.reservaciones_gestion enable row level security;
alter table public.salas_historial enable row level security;
alter table public.solicitudes_sala enable row level security;
alter table public.salas_acceso enable row level security;
alter table public.salas_intentos enable row level security;
revoke all on public.reservaciones_gestion, public.salas_historial, public.solicitudes_sala, public.salas_acceso, public.salas_intentos from anon, authenticated;
