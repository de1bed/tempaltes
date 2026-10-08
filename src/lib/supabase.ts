import { createClient } from '@supabase/supabase-js'
import type { TipoDocumento } from './modelo'

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
  secciones: TipoDocumento[]
  creado: string
}

export interface Usuario extends Perfil {
  ultimo_acceso: string | null
}

/** Llama a la Edge Function de administración; lanza el mensaje de error que devuelve. */
export async function adminUsuarios<T = { ok: true }>(accion: string, datos: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await supabase.functions.invoke('admin-usuarios', { body: { accion, ...datos } })
  if (error) {
    // FunctionsHttpError trae la respuesta: se muestra el mensaje en español de la función.
    const respuesta = (error as { context?: Response }).context
    const cuerpo = respuesta ? await respuesta.json().catch(() => null) : null
    throw new Error(cuerpo?.error ?? 'No se pudo conectar. Revisa tu internet e intenta de nuevo.')
  }
  return data as T
}
