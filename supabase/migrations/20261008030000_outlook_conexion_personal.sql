-- Outlook personal (outlook.live.com): las salas son calendarios dentro de una cuenta,
-- conectada una vez por el administrador (OAuth). Se guarda el refresh token de esa cuenta.
-- (La columna salas.buzon de la versión anterior ya no se usa.)
alter table public.salas add column if not exists calendario_id text;
alter table public.salas add column if not exists calendario_nombre text;

-- Solo la Edge Function (llave secreta) lee y escribe estas tablas: RLS sin políticas y sin permisos.
create table if not exists public.outlook_conexion (
  id int primary key default 1 check (id = 1),
  cuenta text not null,
  refresh_token text not null,
  actualizado timestamptz not null default now()
);

create table if not exists public.outlook_oauth_estados (
  estado text primary key,
  volver text not null,
  creado timestamptz not null default now()
);

alter table public.outlook_conexion enable row level security;
alter table public.outlook_oauth_estados enable row level security;
revoke all on public.outlook_conexion, public.outlook_oauth_estados from anon, authenticated;
