-- Calendario de Outlook sin Azure:
-- - token: enlace secreto del calendario .ics de cada sala (se suscribe en Outlook y muestra las reservaciones).
-- - publicado: enlace ICS que Outlook.com publica del calendario de la sala (para ver lo agendado directo en Outlook).
-- Solo la Edge Function "salas" (llave secreta) los lee y cambia: RLS sin políticas y sin permisos.
create table public.salas_ics (
  sala_id text primary key references public.salas (id) on delete cascade,
  token uuid not null unique default gen_random_uuid(),
  publicado text check (publicado is null or (publicado ~ '^https://' and length(publicado) <= 2000)),
  actualizado timestamptz not null default now()
);

insert into public.salas_ics (sala_id) select id from public.salas on conflict do nothing;

alter table public.salas_ics enable row level security;
revoke all on public.salas_ics from anon, authenticated;
