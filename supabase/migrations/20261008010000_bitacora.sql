-- Bitácora: qué genera cada persona (PDF, Excel, etc.) y qué hace el administrador.
-- Cada quien solo puede agregar filas a su nombre; nadie puede editarlas ni borrarlas.
-- Solo el administrador las lee, a través de la Edge Function admin-usuarios.
create table public.bitacora (
  id bigint generated always as identity primary key,
  usuario_id uuid default auth.uid() references auth.users (id) on delete set null,
  email text not null default (auth.jwt() ->> 'email'),
  accion text not null check (length(accion) between 1 and 40),
  plantilla text check (length(plantilla) <= 40),
  documento text check (length(documento) <= 300),
  detalle jsonb check (pg_column_size(detalle) <= 262144),
  creado timestamptz not null default now()
);

create index bitacora_creado_idx on public.bitacora (creado desc, id desc);
create index bitacora_usuario_idx on public.bitacora (usuario_id, creado desc);

alter table public.bitacora enable row level security;

-- Desde el navegador solo se puede insertar, y solo estas columnas: usuario, correo y fecha
-- los pone la base de datos, así que nadie puede registrar algo a nombre de otra persona.
revoke all on public.bitacora from anon, authenticated;
grant insert (accion, plantilla, documento, detalle) on public.bitacora to authenticated;

create policy "registrar a mi nombre" on public.bitacora
  for insert to authenticated
  with check (usuario_id = (select auth.uid()));
