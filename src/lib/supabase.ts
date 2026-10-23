import { createClient } from '@supabase/supabase-js'
import type { FeedbakData } from './modelo'
import { entradaFeedbak } from './pagos'
import type { Permiso } from './secciones'
import { cotizarFeedbak } from './tabuladores'

// La llave publicable está hecha para ir en el navegador: sin sesión no da acceso a nada
// (la tabla de perfiles solo deja leer el propio y las cuentas se administran en la Edge Function).
const URL = 'https://ficswawndpxegjkzxkvj.supabase.co'
const LLAVE_PUBLICABLE = 'sb_publishable_1mxr9VCFpSJ4T9GjEttaSg_pvTXOOyW'

export const supabase = createClient(URL, LLAVE_PUBLICABLE)

export interface Perfil {
  id: string
  email: string
  nombre: string
  es_admin: boolean
  activo: boolean
  secciones: Permiso[]
  creado: string
}

export interface Usuario extends Perfil {
  ultimo_acceso: string | null
}

/** Llama a la Edge Function de administración; lanza el mensaje de error que devuelve. */
export function adminUsuarios<T = { ok: true }>(accion: string, datos: Record<string, unknown> = {}): Promise<T> {
  return llamar<T>('admin-usuarios', accion, datos)
}

/** Llama a la Edge Function de salas (reservar, mover, cancelar, disponibilidad). */
export function salasApi<T = { ok: true }>(accion: string, datos: Record<string, unknown> = {}): Promise<T> {
  return llamar<T>('salas', accion, datos)
}

async function llamar<T>(funcion: string, accion: string, datos: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke(funcion, { body: { accion, ...datos } })
  if (error) {
    // FunctionsHttpError trae la respuesta: se muestra el mensaje en español de la función.
    const respuesta = (error as { context?: Response }).context
    const cuerpo = respuesta ? await respuesta.json().catch(() => null) : null
    throw new Error(cuerpo?.error ?? 'No se pudo conectar. Revisa tu internet e intenta de nuevo.')
  }
  return data as T
}

export interface Registro {
  id: number
  usuario_id: string | null
  email: string
  accion: string
  plantilla: string | null
  documento: string | null
  detalle: unknown
  creado: string
}

/**
 * Anota en la bitácora lo que hace la persona (a su nombre: lo pone la base de datos).
 * Nunca detiene ni retrasa lo que se está haciendo: si falla, solo se avisa en la consola.
 */
export function registrar(accion: string, extra: { plantilla?: string; documento?: string; detalle?: unknown } = {}) {
  void supabase
    .from('bitacora')
    .insert({ accion, plantilla: extra.plantilla ?? null, documento: extra.documento?.slice(0, 300) ?? null, detalle: extra.detalle ?? null })
    .then(({ error }) => {
      if (error) console.warn('No se pudo registrar en la bitácora', error.message)
    })
}

export interface FilaCotizacion {
  plantilla: string
  cliente: string | null
  folio: string | null
  total: number | null
}

/** Fila de historial a partir de una cotización Feedbak (datos de muestra en tests). */
export function filaCotizacionFeedbak(d: FeedbakData, folio: string): FilaCotizacion {
  const c = cotizarFeedbak(entradaFeedbak(d))
  const total = Number.isFinite(c.primeraFactura) ? Math.round(c.primeraFactura * 100) / 100 : null
  return {
    plantilla: 'feedbak',
    cliente: d.empresa.trim() || null,
    folio: folio.trim().slice(0, 200) || null,
    total,
  }
}

/** Mensaje para el aviso no bloqueante; null si no hay error. */
export function mensajeErrorCotizacion(error: { message?: string; code?: string; status?: number } | null): string | null {
  if (!error) return null
  const t = `${error.message ?? ''} ${error.code ?? ''}`.toLowerCase()
  if (error.status === 401 || /jwt|expired|session|not authenticated|pgrst301|invalid claim/.test(t)) {
    return 'Tu sesión expiró. Vuelve a iniciar sesión para guardar el historial.'
  }
  return 'No se pudo guardar la cotización en el historial.'
}

/**
 * Anota quién hizo la cotización. Nunca lanza: el PDF no debe esperar ni fallar por esto.
 * Devuelve un aviso si no se pudo guardar.
 */
export function guardarCotizacion(fila: FilaCotizacion): Promise<string | null> {
  return Promise.resolve(
    supabase.from('cotizaciones').insert({
      plantilla: fila.plantilla || 'feedbak',
      cliente: fila.cliente,
      folio: fila.folio,
      total: fila.total,
    }),
  )
    .then(({ error }) => mensajeErrorCotizacion(error))
    .catch(() => 'No se pudo guardar la cotización en el historial.')
}

export interface Sala {
  id: string
  nombre: string
  calendario_id: string | null
  calendario_nombre: string | null
  capacidad: number | null
}

export interface Reservacion {
  id: string
  codigo: string
  sala_id: string
  inicio: string
  fin: string
  motivo: string
  personas: number
  invitados: string[]
  creado_por: string | null
  creado_por_email: string
  creado_por_nombre: string
  estado: 'activa' | 'cancelada'
  outlook_event_id: string | null
  sync_error: string | null
  /** A nombre de quién está (si no, de quien la registró). */
  responsable_nombre: string | null
  responsable_email: string | null
  notas: string
  /** Meet, Zoom, etc. Vacío si no lo pusieron. */
  enlace_reunion: string
  origen: 'cuenta' | 'externo'
  empresa: string | null
}

/** Resultado de Outlook al crear o mover: ok (se copió y se mandaron invitaciones), error, o no conectado. */
export type EstadoOutlook = 'ok' | 'error' | 'no'

/** Llamada sin sesión (externos con el código de la sala). */
export async function salasPublico<T>(accion: string, datos: Record<string, unknown> = {}): Promise<T> {
  const r = await fetch(`${URL}/functions/v1/salas`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: LLAVE_PUBLICABLE, Authorization: `Bearer ${LLAVE_PUBLICABLE}` },
    body: JSON.stringify({ accion, ...datos }),
  }).catch(() => null)
  if (!r) throw new Error('No se pudo conectar. Revisa tu internet e intenta de nuevo.')
  const cuerpo = await r.json().catch(() => null)
  if (!r.ok) throw new Error(cuerpo?.error ?? 'No se pudo completar. Intenta de nuevo.')
  return cuerpo as T
}

export interface Colaborador {
  id: string
  nombre: string
  puesto: string
  area: string
  /** data:image/jpeg;base64,… ya reducida. */
  foto: string | null
  nacimiento: string | null
  ingreso: string | null
  activo: boolean
}
