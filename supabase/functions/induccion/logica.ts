// Lógica del curso de inducción sin dependencias: la usan la Edge Function (Deno) y la app (navegador).
// Aquí se decide qué ve la persona (sin las respuestas correctas) y cómo se califica.

/** Diapositivas de una presentación (imágenes generadas desde el PDF que sube Recursos Humanos). */
export interface PasoDiapositivas {
  id: string
  tipo: 'diapositivas'
  titulo: string
  /** Clave de la presentación (`induccion`, `mms`, …). */
  presentacion: string
  /** Primera y última diapositiva, contando desde 1. `hasta` null = hasta el final. */
  desde: number
  hasta: number | null
}

export interface PasoVideo {
  id: string
  tipo: 'video'
  titulo: string
  /** Id del video de YouTube (11 caracteres). */
  youtube?: string | null
  /** Ruta del archivo en el bucket `induccion` (MP4 subido a la app). */
  archivo?: string | null
  /** Hay que verlo completo para seguir. */
  obligatorio: boolean
}

export type Paso = PasoDiapositivas | PasoVideo

export interface Pregunta {
  id: string
  texto: string
  opciones: string[]
  /** Índice de la opción correcta. */
  correcta: number
}

export interface Curso {
  id: string
  titulo: string
  pasos: Paso[]
  preguntas: Pregunta[]
  calificacion_minima: number
  permite_repetir: boolean
}

export interface Presentacion {
  id: string
  clave: string
  nombre: string
  paginas: number
  version: number
  extension: string
  /** Ancho ÷ alto de las diapositivas. */
  proporcion: number
  actualizado?: string
}

/** Ruta de una diapositiva en el bucket (n desde 1). */
export const rutaPagina = (p: Pick<Presentacion, 'id' | 'version' | 'extension'>, n: number) =>
  `presentaciones/${p.id}/v${p.version}/${String(n).padStart(3, '0')}.${p.extension}`

/** Rango de diapositivas que de verdad existen (vacío si la presentación no se ha subido). */
export function rangoPaginas(paso: PasoDiapositivas, p: Presentacion | undefined): number[] {
  if (!p || p.paginas < 1) return []
  const desde = Math.max(1, Math.floor(paso.desde || 1))
  const hasta = Math.min(p.paginas, paso.hasta == null ? p.paginas : Math.floor(paso.hasta))
  const r: number[] = []
  for (let n = desde; n <= hasta; n++) r.push(n)
  return r
}

/** Id de YouTube de un enlace (watch, youtu.be, shorts, embed) o del id solo. */
export function idYoutube(texto: string): string | null {
  const t = texto.trim()
  if (/^[\w-]{11}$/.test(t)) return t
  const m = t.match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([\w-]{11})/)
  return m ? m[1] : null
}

/** Paso que la persona puede ver: diapositivas con sus imágenes o un video con fuente. */
export type PasoVisible =
  | { id: string; tipo: 'diapositivas'; titulo: string; paginas: string[]; proporcion: number }
  | { id: string; tipo: 'video'; titulo: string; youtube: string | null; url: string | null; obligatorio: boolean }

/** Lo que falta para que un paso se muestre (para avisar en la administración); null si está completo. */
export function faltante(paso: Paso, presentaciones: Presentacion[]): string | null {
  if (paso.tipo === 'video') return paso.youtube || paso.archivo ? null : 'Falta el video: no se muestra hasta que se agregue.'
  const p = presentaciones.find((x) => x.clave === paso.presentacion)
  if (!p) return 'La presentación no existe.'
  if (p.paginas < 1) return `Falta subir el PDF de “${p.nombre}”: no se muestra hasta entonces.`
  if (rangoPaginas(paso, p).length === 0) return `Las diapositivas ${paso.desde}–${paso.hasta ?? 'fin'} no existen (la presentación tiene ${p.paginas}).`
  return null
}

/**
 * Pasos que ve la persona, en orden. Los incompletos (presentación sin subir, video sin enlace) se omiten.
 * `firmar` convierte rutas del bucket en enlaces temporales.
 */
export async function pasosVisibles(curso: Pick<Curso, 'pasos'>, presentaciones: Presentacion[], firmar: (rutas: string[]) => Promise<string[]>): Promise<PasoVisible[]> {
  const rutas: string[] = []
  const plan: ({ paso: Paso; desde: number; cuantas: number } | null)[] = curso.pasos.map((paso) => {
    if (faltante(paso, presentaciones)) return null
    const desde = rutas.length
    if (paso.tipo === 'diapositivas') {
      const p = presentaciones.find((x) => x.clave === paso.presentacion)!
      for (const n of rangoPaginas(paso, p)) rutas.push(rutaPagina(p, n))
    } else if (paso.archivo && !paso.youtube) rutas.push(paso.archivo)
    return { paso, desde, cuantas: rutas.length - desde }
  })
  const firmadas = rutas.length ? await firmar(rutas) : []
  const visibles: PasoVisible[] = []
  for (const x of plan) {
    if (!x) continue
    const { paso } = x
    if (paso.tipo === 'diapositivas') {
      const p = presentaciones.find((y) => y.clave === paso.presentacion)!
      visibles.push({ id: paso.id, tipo: 'diapositivas', titulo: paso.titulo, paginas: firmadas.slice(x.desde, x.desde + x.cuantas), proporcion: p.proporcion })
    } else {
      visibles.push({ id: paso.id, tipo: 'video', titulo: paso.titulo, youtube: paso.youtube || null, url: x.cuantas ? firmadas[x.desde] : null, obligatorio: paso.obligatorio })
    }
  }
  return visibles
}

/** Preguntas sin la respuesta correcta (lo único que llega al celular de la persona). */
export const preguntasPublicas = (preguntas: Pregunta[]) => preguntas.map(({ id, texto, opciones }) => ({ id, texto, opciones }))

export interface Revision {
  id: string
  texto: string
  opciones: string[]
  correcta: number
  /** Opción elegida (-1 si no contestó). */
  respuesta: number
}

export interface Calificacion {
  aciertos: number
  total: number
  /** 0 a 100, redondeado. */
  calificacion: number
  aprobado: boolean
  /** Copia de cada pregunta con su respuesta: el historial no cambia si después se edita el cuestionario. */
  detalle: Revision[]
}

export function calificar(preguntas: Pregunta[], respuestas: Record<string, unknown>, minima: number): Calificacion {
  const detalle = preguntas.map((q) => {
    const r = respuestas[q.id]
    const respuesta = typeof r === 'number' && Number.isInteger(r) && r >= 0 && r < q.opciones.length ? r : -1
    return { id: q.id, texto: q.texto, opciones: q.opciones, correcta: q.correcta, respuesta }
  })
  const aciertos = detalle.filter((d) => d.respuesta === d.correcta).length
  const total = preguntas.length
  const calificacion = total ? Math.round((aciertos / total) * 100) : 0
  return { aciertos, total, calificacion, aprobado: total > 0 && calificacion >= minima, detalle }
}

/** Revisa un cuestionario antes de guardarlo; devuelve el primer problema o null. */
export function validarPreguntas(preguntas: Pregunta[]): string | null {
  if (preguntas.length === 0) return 'Agrega al menos una pregunta.'
  for (const [i, q] of preguntas.entries()) {
    const n = i + 1
    if (!q.texto.trim()) return `La pregunta ${n} no tiene texto.`
    const opciones = q.opciones.map((o) => o.trim())
    if (opciones.length < 2) return `La pregunta ${n} necesita al menos dos opciones.`
    if (opciones.some((o) => !o)) return `La pregunta ${n} tiene una opción vacía.`
    if (new Set(opciones).size !== opciones.length) return `La pregunta ${n} tiene opciones repetidas.`
    if (!(q.correcta >= 0 && q.correcta < opciones.length)) return `Marca la respuesta correcta de la pregunta ${n}.`
  }
  return null
}

/** Código de sesión: 6 caracteres fáciles de dictar (sin 0/O ni 1/I/L). */
export const ALFABETO_CODIGO = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
export const limpiarCodigo = (v: unknown) => (typeof v === 'string' ? v.toUpperCase().replace(/[^A-Z0-9]/g, '') : '')
