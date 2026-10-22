-- Link de reunión opcional (Meet, Zoom, etc.) en cada reservación.
-- Solo se agrega la columna; no se tocan filas existentes (quedan en '').
alter table public.reservaciones
  add column if not exists enlace_reunion text not null default '' check (length(enlace_reunion) <= 500);
