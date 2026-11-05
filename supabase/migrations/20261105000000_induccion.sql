-- Módulo Capacitación: curso de inducción para nuevos ingresos.
-- Recursos Humanos (permiso "capacitacion") sube las presentaciones (PDF → imágenes), arma los pasos
-- (diapositivas y videos), edita el cuestionario y abre sesiones individuales o de grupo con un código/QR.
-- Las personas que toman la inducción no tienen cuenta: entran con el código y todo lo que hacen pasa
-- por la Edge Function `induccion` (llave secreta), que nunca les manda las respuestas correctas.

-- Nuevo permiso "capacitacion".
alter table public.perfiles drop constraint perfiles_secciones_check;
alter table public.perfiles add constraint perfiles_secciones_check
  check (secciones <@ array['cotizacion', 'contrato', 'corrida', 'salas', 'salas_admin', 'felicitaciones', 'capacitacion']::text[]);

create function public.puede_capacitacion() returns boolean
  language sql stable set search_path = '' as $$
  select exists (
    select 1 from public.perfiles p
    where p.id = (select auth.uid()) and p.activo and (p.es_admin or 'capacitacion' = any (p.secciones))
  );
$$;

-- ───── Contenido ─────

create table public.induccion_presentaciones (
  id uuid primary key default gen_random_uuid(),
  -- Con esta clave la usan los pasos del curso.
  clave text not null unique check (clave ~ '^[a-z0-9-]{1,40}$'),
  nombre text not null check (length(trim(nombre)) between 1 and 120),
  -- 0 = todavía no se sube el PDF.
  paginas int not null default 0 check (paginas between 0 and 300),
  -- Cada vez que se sube de nuevo cambia la carpeta (presentaciones/<id>/v<version>/001.webp).
  version int not null default 0,
  extension text not null default 'webp' check (extension in ('webp', 'jpg', 'png')),
  proporcion numeric not null default 1.7778 check (proporcion > 0.2 and proporcion < 5),
  actualizado timestamptz not null default now(),
  actualizado_por uuid default auth.uid() references auth.users (id) on delete set null
);

create table public.induccion_cursos (
  id uuid primary key default gen_random_uuid(),
  titulo text not null check (length(trim(titulo)) between 1 and 120),
  -- [{id, tipo: 'diapositivas', titulo, presentacion, desde, hasta} | {id, tipo: 'video', titulo, youtube, archivo, obligatorio}]
  pasos jsonb not null default '[]' check (jsonb_typeof(pasos) = 'array'),
  -- [{id, texto, opciones: [..], correcta}]
  preguntas jsonb not null default '[]' check (jsonb_typeof(preguntas) = 'array'),
  calificacion_minima int not null default 80 check (calificacion_minima between 1 and 100),
  permite_repetir boolean not null default true,
  actualizado timestamptz not null default now(),
  actualizado_por uuid default auth.uid() references auth.users (id) on delete set null
);

-- ───── Sesiones y resultados ─────

create table public.induccion_sesiones (
  id uuid primary key default gen_random_uuid(),
  curso_id uuid not null references public.induccion_cursos (id) on delete cascade,
  codigo text not null unique check (codigo ~ '^[A-Z0-9]{6}$'),
  -- individual: una persona con su propio código. grupo: QR para varias personas a la vez.
  tipo text not null check (tipo in ('individual', 'grupo')),
  -- Nombre de la persona (individual) o del grupo.
  nombre text not null check (length(trim(nombre)) between 1 and 120),
  correo text check (correo is null or length(correo) <= 200),
  -- false: la presentación se proyecta y en el celular solo se contesta el cuestionario.
  incluye_contenido boolean not null default true,
  activa boolean not null default true,
  vence timestamptz not null,
  creada_por uuid default auth.uid() references auth.users (id) on delete set null,
  creada_por_nombre text not null default '',
  creada timestamptz not null default now()
);
create index induccion_sesiones_creada_idx on public.induccion_sesiones (creada desc);

create table public.induccion_participantes (
  id uuid primary key default gen_random_uuid(),
  sesion_id uuid not null references public.induccion_sesiones (id) on delete cascade,
  -- Lo guarda su navegador para retomar donde se quedó.
  token uuid not null unique default gen_random_uuid(),
  nombre text not null check (length(trim(nombre)) between 1 and 120),
  correo text check (correo is null or length(correo) <= 200),
  inicio timestamptz not null default now(),
  ultimo_avance timestamptz not null default now(),
  -- Paso y diapositiva donde va (para retomar y para verlo en vivo).
  paso int not null default 0,
  pagina int not null default 0,
  videos_vistos text[] not null default '{}',
  contenido_terminado timestamptz,
  intentos int not null default 0,
  mejor_calificacion int,
  aprobado_en timestamptz
);
create index induccion_participantes_sesion_idx on public.induccion_participantes (sesion_id);
create index induccion_participantes_inicio_idx on public.induccion_participantes (inicio desc);

create table public.induccion_intentos (
  id uuid primary key default gen_random_uuid(),
  participante_id uuid not null references public.induccion_participantes (id) on delete cascade,
  inicio timestamptz not null,
  fin timestamptz not null default now(),
  aciertos int not null,
  total int not null,
  calificacion int not null,
  aprobado boolean not null,
  -- Copia de preguntas, opciones, respuesta correcta y elegida.
  detalle jsonb not null
);
create index induccion_intentos_participante_idx on public.induccion_intentos (participante_id, fin);

-- ───── Permisos ─────

alter table public.induccion_presentaciones enable row level security;
alter table public.induccion_cursos enable row level security;
alter table public.induccion_sesiones enable row level security;
alter table public.induccion_participantes enable row level security;
alter table public.induccion_intentos enable row level security;
revoke all on public.induccion_presentaciones, public.induccion_cursos, public.induccion_sesiones,
  public.induccion_participantes, public.induccion_intentos from anon, authenticated;

-- Contenido: quien tiene Capacitación lo ve y lo mantiene.
grant select, insert, update, delete on public.induccion_presentaciones, public.induccion_cursos to authenticated;
create policy "capacitacion presentaciones" on public.induccion_presentaciones for all to authenticated
  using ((select public.puede_capacitacion())) with check ((select public.puede_capacitacion()));
create policy "capacitacion cursos" on public.induccion_cursos for all to authenticated
  using ((select public.puede_capacitacion())) with check ((select public.puede_capacitacion()));

-- Sesiones: se crean, cierran y borran desde la app.
grant select, delete on public.induccion_sesiones to authenticated;
grant insert (curso_id, codigo, tipo, nombre, correo, incluye_contenido, vence, creada_por_nombre) on public.induccion_sesiones to authenticated;
grant update (nombre, correo, incluye_contenido, activa, vence) on public.induccion_sesiones to authenticated;
create policy "capacitacion sesiones" on public.induccion_sesiones for all to authenticated
  using ((select public.puede_capacitacion())) with check ((select public.puede_capacitacion()));

-- Resultados: solo lectura (y borrar pruebas). Los escribe la Edge Function.
grant select, delete on public.induccion_participantes, public.induccion_intentos to authenticated;
create policy "capacitacion ve participantes" on public.induccion_participantes for select to authenticated using ((select public.puede_capacitacion()));
create policy "capacitacion borra participantes" on public.induccion_participantes for delete to authenticated using ((select public.puede_capacitacion()));
create policy "capacitacion ve intentos" on public.induccion_intentos for select to authenticated using ((select public.puede_capacitacion()));
create policy "capacitacion borra intentos" on public.induccion_intentos for delete to authenticated using ((select public.puede_capacitacion()));

-- ───── Archivos (diapositivas y videos), privados ─────

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('induccion', 'induccion', false, 52428800, array['image/webp', 'image/jpeg', 'image/png', 'video/mp4', 'video/webm'])
on conflict (id) do nothing;

create policy "capacitacion lee archivos" on storage.objects for select to authenticated
  using (bucket_id = 'induccion' and (select public.puede_capacitacion()));
create policy "capacitacion sube archivos" on storage.objects for insert to authenticated
  with check (bucket_id = 'induccion' and (select public.puede_capacitacion()));
create policy "capacitacion cambia archivos" on storage.objects for update to authenticated
  using (bucket_id = 'induccion' and (select public.puede_capacitacion()));
create policy "capacitacion borra archivos" on storage.objects for delete to authenticated
  using (bucket_id = 'induccion' and (select public.puede_capacitacion()));

-- ───── Contenido inicial (material de RH, noviembre 2026) ─────

insert into public.induccion_presentaciones (clave, nombre, actualizado_por) values
  ('induccion', 'Inducción TREVÉ 2026', null),
  ('mms', 'Gastos médicos menores (MMS · Aon)', null);

insert into public.induccion_cursos (titulo, calificacion_minima, permite_repetir, actualizado_por, pasos, preguntas)
values ('Inducción TREVÉ', 80, true, null,
'[
  {"id": "bienvenida", "tipo": "diapositivas", "titulo": "Bienvenida a TREVÉ", "presentacion": "induccion", "desde": 1, "hasta": 25},
  {"id": "video-acoso", "tipo": "video", "titulo": "Hostigamiento y acoso laboral", "youtube": "jPP7EDNG58U", "archivo": null, "obligatorio": true},
  {"id": "reglamento", "tipo": "diapositivas", "titulo": "Reglamento, seguridad y contacto", "presentacion": "induccion", "desde": 26, "hasta": null},
  {"id": "mms", "tipo": "diapositivas", "titulo": "Extensión: gastos médicos menores (MMS)", "presentacion": "mms", "desde": 1, "hasta": null},
  {"id": "video-mms", "tipo": "video", "titulo": "Gastos médicos menores en 30 segundos", "youtube": null, "archivo": null, "obligatorio": false}
]'::jsonb,
'[
  {"id": "q1", "texto": "¿Por qué banco se deposita tu nómina?", "opciones": ["BBVA Bancomer", "Santander", "Banorte", "HSBC"], "correcta": 0},
  {"id": "q2", "texto": "¿Cada cuándo se paga la nómina?", "opciones": ["Cada semana, los viernes", "Cada quincena", "Cada mes", "Cada semana, los lunes"], "correcta": 0},
  {"id": "q3", "texto": "¿Cuándo recibes tu primer pago?", "opciones": ["El viernes de tu primera semana", "A partir de la segunda semana laborada (semana de atraso)", "Al cumplir un mes"], "correcta": 1},
  {"id": "q4", "texto": "¿Cómo se pide un permiso de ausencia?", "opciones": ["De palabra a tu jefe el mismo día", "Por escrito a Recursos Humanos, con al menos tres días hábiles de anticipación", "Por mensaje a un compañero"], "correcta": 1},
  {"id": "q5", "texto": "¿Con qué se justifica una falta por enfermedad?", "opciones": ["Con una receta de cualquier médico", "Con el uso del servicio médico MMS", "Avisando por WhatsApp"], "correcta": 1},
  {"id": "q6", "texto": "¿De cuánto es la suma asegurada del seguro de vida THONA?", "opciones": ["$20,000", "$40,000", "$100,000"], "correcta": 1},
  {"id": "q7", "texto": "Según el reglamento, ¿se sanciona el hostigamiento o acoso aunque haya pasado una sola vez?", "opciones": ["Sí, por una sola ocasión o de forma reiterada", "No, solo si se repite"], "correcta": 0},
  {"id": "q8", "texto": "¿Se permiten las muestras públicas de afecto entre colaboradores durante la jornada?", "opciones": ["Sí", "No, están prohibidas", "Solo en el comedor"], "correcta": 1},
  {"id": "q9", "texto": "¿Puedes vender comida, ropa u otros artículos dentro de las instalaciones?", "opciones": ["Sí, en la hora de comida", "No, está prohibido", "Sí, si son productos de catálogo"], "correcta": 1},
  {"id": "q10", "texto": "¿A qué correo envías dudas, sugerencias o quejas?", "opciones": ["eticalaboral@treve.mx", "Al correo personal de tu jefe", "No hay correo: solo en persona"], "correcta": 0},
  {"id": "q11", "texto": "¿Qué aseguradora da el servicio de gastos médicos menores?", "opciones": ["MMS Santander", "THONA Seguros", "IMSS"], "correcta": 0},
  {"id": "q12", "texto": "¿Cuál es el teléfono del call center de Aon, disponible 24/7?", "opciones": ["55 4169 0755", "(664) 331 66 72", "911"], "correcta": 0}
]'::jsonb);
