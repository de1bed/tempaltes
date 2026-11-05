import { supabase } from '../lib/supabase'
import { ALFABETO_CODIGO, rutaPagina, type Curso, type Paso, type PasoVisible, type Presentacion, type Pregunta } from '../../supabase/functions/induccion/logica'

export type { Curso, Paso, PasoVisible, Presentacion, Pregunta }

const URL_FUNCION = 'https://ficswawndpxegjkzxkvj.supabase.co/functions/v1/induccion'
const LLAVE_PUBLICABLE = 'sb_publishable_1mxr9VCFpSJ4T9GjEttaSg_pvTXOOyW'

// ───── Página pública (sin cuenta) ─────

export interface ResumenIntento {
  aciertos: number
  total: number
  calificacion: number
  aprobado: boolean
  fin: string
  /** Texto de las preguntas que falló. */
  incorrectas: string[]
}

export interface EstadoParticipante {
  participante: {
    token: string
    nombre: string
    inicio: string
    paso: number
    pagina: number
    videos_vistos: string[]
    contenido_terminado: string | null
    intentos: number
    mejor_calificacion: number | null
    aprobado_en: string | null
  }
  sesion: { nombre: string; tipo: 'individual' | 'grupo'; incluye_contenido: boolean; vigente: boolean }
  curso: {
    titulo: string
    pasos: PasoVisible[]
    preguntas: { id: string; texto: string; opciones: string[] }[]
    calificacion_minima: number
    permite_repetir: boolean
  }
  ultimo: ResumenIntento | null
}

/** Llamada a la Edge Function sin sesión (la persona entra con el código). */
export async function induccionPublico<T>(accion: string, datos: Record<string, unknown> = {}): Promise<T> {
  const r = await fetch(URL_FUNCION, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: LLAVE_PUBLICABLE, Authorization: `Bearer ${LLAVE_PUBLICABLE}` },
    body: JSON.stringify({ accion, ...datos }),
  }).catch(() => null)
  if (!r) throw new Error('No se pudo conectar. Revisa tu internet e intenta de nuevo.')
  const cuerpo = await r.json().catch(() => null)
  if (!r.ok) throw new Error(cuerpo?.error ?? 'No se pudo completar. Intenta de nuevo.')
  return cuerpo as T
}

// ───── Recursos Humanos (con sesión y permiso de Capacitación) ─────

export interface Sesion {
  id: string
  curso_id: string
  codigo: string
  tipo: 'individual' | 'grupo'
  nombre: string
  correo: string | null
  incluye_contenido: boolean
  activa: boolean
  vence: string
  creada_por_nombre: string
  creada: string
}

export interface Participante {
  id: string
  sesion_id: string
  nombre: string
  correo: string | null
  inicio: string
  ultimo_avance: string
  paso: number
  pagina: number
  videos_vistos: string[]
  contenido_terminado: string | null
  intentos: number
  mejor_calificacion: number | null
  aprobado_en: string | null
}

export interface Intento {
  id: string
  participante_id: string
  inicio: string
  fin: string
  aciertos: number
  total: number
  calificacion: number
  aprobado: boolean
  detalle: { id: string; texto: string; opciones: string[]; correcta: number; respuesta: number }[]
}

export const BUCKET = 'induccion'

/** Mensaje en español de un error de Supabase. */
export function mensaje(e: unknown): string {
  const m = e instanceof Error ? e.message : typeof e === 'object' && e && 'message' in e ? String((e as { message: unknown }).message) : String(e)
  if (/row-level security|permission denied/i.test(m)) return 'No tienes permiso de Capacitación.'
  if (/failed to fetch|network/i.test(m)) return 'No se pudo conectar. Revisa tu internet e intenta de nuevo.'
  return m
}

export async function leerCurso(): Promise<Curso | null> {
  const { data, error } = await supabase.from('induccion_cursos').select('id, titulo, pasos, preguntas, calificacion_minima, permite_repetir').order('actualizado').limit(1).maybeSingle()
  if (error) throw error
  return data as Curso | null
}

export async function guardarCurso(id: string, cambios: Partial<Omit<Curso, 'id'>>) {
  const { error } = await supabase.from('induccion_cursos').update({ ...cambios, actualizado: new Date().toISOString() }).eq('id', id)
  if (error) throw error
}

export async function leerPresentaciones(): Promise<Presentacion[]> {
  const { data, error } = await supabase.from('induccion_presentaciones').select('id, clave, nombre, paginas, version, extension, proporcion, actualizado').order('nombre')
  if (error) throw error
  return (data ?? []).map((p) => ({ ...p, proporcion: Number(p.proporcion) })) as Presentacion[]
}

/** Enlaces temporales a archivos del bucket (diapositivas, videos), en el mismo orden. */
export async function firmar(rutas: string[], segundos = 3 * 3600): Promise<string[]> {
  if (rutas.length === 0) return []
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrls(rutas, segundos)
  if (error) throw error
  const porRuta = new Map((data ?? []).map((d) => [d.path, d.signedUrl]))
  return rutas.map((r) => porRuta.get(r) ?? '')
}

export const miniatura = (p: Presentacion) => firmar([rutaPagina(p, 1)]).then((r) => r[0])

/** Código de 6 caracteres sin letras que se confundan. */
export function generarCodigo(): string {
  const azar = crypto.getRandomValues(new Uint32Array(6))
  return Array.from(azar, (n) => ALFABETO_CODIGO[n % ALFABETO_CODIGO.length]).join('')
}

/** Dirección que abre la inducción de una sesión (también la del QR). */
export const enlaceSesion = (codigo: string) => `${window.location.origin}${window.location.pathname}#induccion/${codigo}`

/** Código con guion para leerlo en voz alta: ABC-123. */
export const codigoLegible = (c: string) => `${c.slice(0, 3)}-${c.slice(3)}`

export function duracion(desde: string, hasta: string | null): string {
  if (!hasta) return '—'
  const min = Math.max(0, Math.round((Date.parse(hasta) - Date.parse(desde)) / 60_000))
  if (min < 60) return `${min} min`
  const h = Math.floor(min / 60)
  if (h >= 24) return `${Math.floor(h / 24)} d ${h % 24} h`
  return `${h} h ${min % 60} min`
}

export const fechaHora = (iso: string) =>
  new Date(iso).toLocaleString('es-MX', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'America/Tijuana' })

export const fechaLarga = (iso: string) => new Date(iso).toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'America/Tijuana' })
