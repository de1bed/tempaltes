import { createClient } from '@supabase/supabase-js'
import type { Permiso } from './secciones'

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

export interface Sala {
  id: string
  nombre: string
  buzon: string | null
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
}
