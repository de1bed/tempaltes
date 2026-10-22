-- Historial: cada documento que se genera (PDF o Excel) con quién lo hizo, cuándo y sus datos,
-- para volver a abrirlo. Cada quien ve lo de sus secciones; quien hace cotizaciones también ve las corridas.
create table if not exists public.historial (
  id bigint generated always as identity primary key,
  creado timestamptz not null default now(),
  creado_por uuid default auth.uid(),
  creado_por_email text not null default (auth.jwt() ->> 'email'),
  creado_por_nombre text not null default '' check (length(creado_por_nombre) <= 120),
  tipo text not null check (tipo in ('cotizacion', 'contrato', 'corrida')),
  plantilla text not null check (length(plantilla) <= 40),
  formato text not null default 'pdf' check (formato in ('pdf', 'excel')),
  documento text not null default '' check (length(documento) <= 300),
  empresa text not null default '' check (length(empresa) <= 200),
  datos jsonb not null check (pg_column_size(datos) <= 262144)
);

alter table public.historial enable row level security;
revoke all on public.historial from anon, authenticated;
grant select on public.historial to authenticated;
-- Quién y cuándo los pone la base de datos.
grant insert (creado_por_nombre, tipo, plantilla, formato, documento, empresa, datos) on public.historial to authenticated;

create policy "ver historial" on public.historial for select to authenticated
  using (exists (select 1 from public.perfiles p where p.id = (select auth.uid()) and p.activo
    and (p.es_admin or tipo = any (p.secciones) or (tipo = 'corrida' and 'cotizacion' = any (p.secciones)))));

create policy "guardar en historial" on public.historial for insert to authenticated
  with check (creado_por = (select auth.uid()) and exists (select 1 from public.perfiles p where p.id = (select auth.uid()) and p.activo
    and (p.es_admin or tipo = any (p.secciones))));

-- Documentos generados antes de que existiera el historial (estaban en la bitácora).
insert into public.historial (creado, creado_por, creado_por_email, creado_por_nombre, tipo, plantilla, formato, documento, empresa, datos)
select b.creado, b.usuario_id, b.email, coalesce(p.nombre, ''),
  case when b.plantilla in ('licencia', 'nda') then 'contrato' when b.plantilla in ('kofile', 'general', 'hilos33') then 'corrida' else 'cotizacion' end,
  b.plantilla, b.accion, coalesce(b.documento, ''), coalesce(b.detalle ->> 'empresa', ''), b.detalle
from public.bitacora b left join public.perfiles p on p.id = b.usuario_id
where b.accion in ('pdf', 'excel') and jsonb_typeof(b.detalle) = 'object'
  and b.plantilla in ('feedbak','servicios','payroll','gmm','bonos','estudios','reclutamiento','haatsMensual','haatsHoras','licencia','nda','kofile','general','hilos33')
  and not exists (select 1 from public.historial h);
