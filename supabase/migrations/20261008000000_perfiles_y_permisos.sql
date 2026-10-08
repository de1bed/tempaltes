-- Perfiles de acceso: una fila por persona dada de alta por el administrador.
-- Solo la Edge Function admin-usuarios (con la llave secreta) escribe aquí.
create table public.perfiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null unique,
  nombre text not null default '',
  es_admin boolean not null default false,
  activo boolean not null default true,
  secciones text[] not null default '{}'
    check (secciones <@ array['cotizacion', 'contrato', 'corrida']::text[]),
  creado timestamptz not null default now()
);

-- Un solo administrador.
create unique index perfiles_un_admin on public.perfiles (es_admin) where es_admin;

alter table public.perfiles enable row level security;

-- Cada quien solo puede leer su propio perfil; nadie escribe desde el navegador.
revoke all on public.perfiles from anon, authenticated;
grant select on public.perfiles to authenticated;

create policy "leer mi perfil" on public.perfiles
  for select to authenticated
  using ((select auth.uid()) = id);
