// Inducción para nuevos ingresos: las personas entran sin cuenta con el código (o QR) de su sesión,
// ven las diapositivas y videos, y contestan el cuestionario. La calificación se hace aquí: las
// respuestas correctas nunca llegan al navegador. Recursos Humanos ve el avance y los resultados
// directo en las tablas (permiso "capacitacion").
import { createClient } from 'npm:@supabase/supabase-js@2.117.1'
import { calificar, faltante, limpiarCodigo, pasosVisibles, preguntasPublicas, type Curso, type Presentacion, type Revision } from './logica.ts'

/** Intentos fallidos de código por hora y por IP antes de bloquear. */
const MAX_INTENTOS = 20
/** Duración de los enlaces a las diapositivas y videos. */
const VIGENCIA_ENLACES = 6 * 3600

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const admin = createClient(Deno.env.get('SUPABASE_URL')!, JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS')!)['default'], {
  auth: { persistSession: false, autoRefreshToken: false },
})

class ErrorInduccion extends Error {
  constructor(
    mensaje: string,
    public estado = 400,
  ) {
    super(mensaje)
  }
}

function responder(cuerpo: unknown, estado = 200) {
  return new Response(JSON.stringify(cuerpo), { status: estado, headers: { ...CORS, 'Content-Type': 'application/json' } })
}

interface Sesion {
  id: string
  curso_id: string
  codigo: string
  tipo: 'individual' | 'grupo'
  nombre: string
  correo: string | null
  incluye_contenido: boolean
  activa: boolean
  vence: string
}

interface Participante {
  id: string
  sesion_id: string
  token: string
  nombre: string
  correo: string | null
  inicio: string
  paso: number
  pagina: number
  videos_vistos: string[]
  contenido_terminado: string | null
  intentos: number
  mejor_calificacion: number | null
  aprobado_en: string | null
}

const vigente = (s: Sesion) => s.activa && Date.parse(s.vence) > Date.now()

function exigirVigente(s: Sesion) {
  if (!s.activa) throw new ErrorInduccion('Esta sesión ya se cerró. Pide un código nuevo a Recursos Humanos.', 403)
  if (Date.parse(s.vence) <= Date.now()) throw new ErrorInduccion('Esta sesión ya venció. Pide un código nuevo a Recursos Humanos.', 403)
}

function texto(v: unknown, max: number): string {
  return typeof v === 'string' ? v.trim().replace(/\s+/g, ' ').slice(0, max) : ''
}

function correoOpcional(v: unknown): string | null {
  const c = texto(v, 200).toLowerCase()
  if (!c) return null
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c)) throw new ErrorInduccion('El correo no es válido')
  return c
}

// ───── Intentos de código (por IP) ─────

function ipDe(req: Request) {
  return req.headers.get('cf-connecting-ip') ?? req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'desconocida'
}

async function revisarIntentos(clave: string) {
  const { count } = await admin.from('salas_intentos').select('id', { count: 'exact', head: true }).eq('clave', clave).gt('creado', new Date(Date.now() - 3600_000).toISOString())
  if ((count ?? 0) >= MAX_INTENTOS) throw new ErrorInduccion('Demasiados intentos con un código incorrecto. Espera una hora e inténtalo de nuevo.', 429)
}

async function anotarFallo(clave: string) {
  await admin.from('salas_intentos').insert({ clave })
  await admin.from('salas_intentos').delete().lt('creado', new Date(Date.now() - 24 * 3600_000).toISOString())
}

// ───── Lectura ─────

async function leerCurso(id: string): Promise<Curso> {
  const { data, error } = await admin.from('induccion_cursos').select('id, titulo, pasos, preguntas, calificacion_minima, permite_repetir').eq('id', id).maybeSingle()
  if (error) throw error
  if (!data) throw new ErrorInduccion('El curso de esta sesión ya no existe', 404)
  return data as Curso
}

async function leerPresentaciones(): Promise<Presentacion[]> {
  const { data, error } = await admin.from('induccion_presentaciones').select('id, clave, nombre, paginas, version, extension, proporcion')
  if (error) throw error
  return (data ?? []).map((p) => ({ ...p, proporcion: Number(p.proporcion) })) as Presentacion[]
}

async function firmar(rutas: string[]): Promise<string[]> {
  const { data, error } = await admin.storage.from('induccion').createSignedUrls(rutas, VIGENCIA_ENLACES)
  if (error) throw error
  const porRuta = new Map((data ?? []).map((d) => [d.path, d.signedUrl]))
  return rutas.map((r) => porRuta.get(r) ?? '')
}

async function porToken(token: unknown): Promise<{ participante: Participante; sesion: Sesion }> {
  if (typeof token !== 'string' || !/^[0-9a-f-]{36}$/i.test(token)) throw new ErrorInduccion('Enlace no válido', 404)
  const { data: participante } = await admin.from('induccion_participantes').select('*').eq('token', token.toLowerCase()).maybeSingle()
  if (!participante) throw new ErrorInduccion('No encontramos tu avance. Vuelve a entrar con el código.', 404)
  const { data: sesion } = await admin.from('induccion_sesiones').select('*').eq('id', participante.sesion_id).maybeSingle()
  if (!sesion) throw new ErrorInduccion('Esta sesión ya no existe', 404)
  return { participante: participante as Participante, sesion: sesion as Sesion }
}

/** Último intento, para mostrar el resultado al volver: sin las respuestas correctas de lo que falló. */
async function ultimoIntento(participanteId: string) {
  const { data } = await admin.from('induccion_intentos').select('aciertos, total, calificacion, aprobado, detalle, fin').eq('participante_id', participanteId).order('fin', { ascending: false }).limit(1).maybeSingle()
  return data ? resumenIntento(data as { aciertos: number; total: number; calificacion: number; aprobado: boolean; detalle: Revision[]; fin: string }) : null
}

function resumenIntento(i: { aciertos: number; total: number; calificacion: number; aprobado: boolean; detalle: Revision[]; fin: string }) {
  return {
    aciertos: i.aciertos,
    total: i.total,
    calificacion: i.calificacion,
    aprobado: i.aprobado,
    fin: i.fin,
    // Solo el texto de las que fallaron: si puede repetir, no se le dan las respuestas.
    incorrectas: i.detalle.filter((d) => d.respuesta !== d.correcta).map((d) => d.texto),
  }
}

/** Todo lo que necesita la página de la persona: su avance, el contenido (con enlaces temporales) y el cuestionario. */
async function estado(participante: Participante, sesion: Sesion) {
  const curso = await leerCurso(sesion.curso_id)
  const pasos = sesion.incluye_contenido ? await pasosVisibles(curso, await leerPresentaciones(), firmar) : []
  return {
    participante: {
      token: participante.token,
      nombre: participante.nombre,
      inicio: participante.inicio,
      paso: participante.paso,
      pagina: participante.pagina,
      videos_vistos: participante.videos_vistos,
      contenido_terminado: participante.contenido_terminado,
      intentos: participante.intentos,
      mejor_calificacion: participante.mejor_calificacion,
      aprobado_en: participante.aprobado_en,
    },
    sesion: { nombre: sesion.nombre, tipo: sesion.tipo, incluye_contenido: sesion.incluye_contenido, vigente: vigente(sesion) },
    curso: {
      titulo: curso.titulo,
      pasos,
      preguntas: preguntasPublicas(curso.preguntas),
      calificacion_minima: curso.calificacion_minima,
      permite_repetir: curso.permite_repetir,
    },
    ultimo: participante.intentos ? await ultimoIntento(participante.id) : null,
  }
}

// ───── Acciones ─────

async function entrar(req: Request, cuerpo: Record<string, unknown>) {
  const clave = `induccion:ip:${ipDe(req)}`
  await revisarIntentos(clave)
  const codigo = limpiarCodigo(cuerpo.codigo)
  const { data } = codigo.length === 6 ? await admin.from('induccion_sesiones').select('*').eq('codigo', codigo).maybeSingle() : { data: null }
  if (!data) {
    await anotarFallo(clave)
    throw new ErrorInduccion('El código no es correcto. Revísalo e intenta de nuevo.', 403)
  }
  const sesion = data as Sesion
  exigirVigente(sesion)

  // Mismo navegador: retoma donde se quedó.
  if (typeof cuerpo.token === 'string' && /^[0-9a-f-]{36}$/i.test(cuerpo.token)) {
    const { data: previo } = await admin.from('induccion_participantes').select('*').eq('token', cuerpo.token.toLowerCase()).eq('sesion_id', sesion.id).maybeSingle()
    if (previo) return estado(previo as Participante, sesion)
  }

  if (sesion.tipo === 'individual') {
    // El código es personal: con él se retoma desde cualquier dispositivo.
    const { data: previo } = await admin.from('induccion_participantes').select('*').eq('sesion_id', sesion.id).order('inicio').limit(1).maybeSingle()
    if (previo) return estado(previo as Participante, sesion)
    const { data: nuevo, error } = await admin.from('induccion_participantes').insert({ sesion_id: sesion.id, nombre: sesion.nombre, correo: sesion.correo }).select('*').single()
    if (error) throw error
    return estado(nuevo as Participante, sesion)
  }

  // Grupo: primero se confirma el código y se pide el nombre de quien entra.
  if (cuerpo.nombre === undefined) {
    const curso = await leerCurso(sesion.curso_id)
    return { pedir_nombre: { grupo: sesion.nombre, titulo: curso.titulo, incluye_contenido: sesion.incluye_contenido } }
  }
  const nombre = texto(cuerpo.nombre, 120)
  if (nombre.length < 3) throw new ErrorInduccion('Escribe tu nombre completo')
  const { count } = await admin.from('induccion_participantes').select('id', { count: 'exact', head: true }).eq('sesion_id', sesion.id)
  if ((count ?? 0) >= 200) throw new ErrorInduccion('Esta sesión ya tiene el máximo de personas (200).')
  const { data: nuevo, error } = await admin.from('induccion_participantes').insert({ sesion_id: sesion.id, nombre, correo: correoOpcional(cuerpo.correo) }).select('*').single()
  if (error) throw error
  return estado(nuevo as Participante, sesion)
}

async function avance(cuerpo: Record<string, unknown>) {
  const { participante, sesion } = await porToken(cuerpo.token)
  exigirVigente(sesion)
  if (!sesion.incluye_contenido) return { ok: true }
  const curso = await leerCurso(sesion.curso_id)
  const presentaciones = await leerPresentaciones()
  // Mismo orden y mismos pasos que ve la persona (los incompletos no cuentan).
  const visibles = curso.pasos.filter((p) => !faltante(p, presentaciones))
  const paso = Number(cuerpo.paso)
  const pagina = Number(cuerpo.pagina ?? 0)
  if (!Number.isInteger(paso) || paso < 0 || paso > visibles.length) throw new ErrorInduccion('Paso no válido')
  if (!Number.isInteger(pagina) || pagina < 0 || pagina > 1000) throw new ErrorInduccion('Diapositiva no válida')

  const vistos = new Set(participante.videos_vistos)
  const video = typeof cuerpo.video === 'string' ? cuerpo.video : null
  if (video && visibles.some((p) => p.tipo === 'video' && p.id === video)) vistos.add(video)

  const cambios: Record<string, unknown> = { paso, pagina, videos_vistos: [...vistos], ultimo_avance: new Date().toISOString() }
  if (paso === visibles.length && !participante.contenido_terminado) {
    const pendiente = visibles.find((p) => p.tipo === 'video' && p.obligatorio && !vistos.has(p.id))
    if (pendiente) throw new ErrorInduccion(`Falta ver completo el video “${pendiente.titulo}”.`)
    cambios.contenido_terminado = new Date().toISOString()
  }
  const { error } = await admin.from('induccion_participantes').update(cambios).eq('id', participante.id)
  if (error) throw error
  return { ok: true, contenido_terminado: (cambios.contenido_terminado as string | undefined) ?? participante.contenido_terminado }
}

async function contestar(cuerpo: Record<string, unknown>) {
  const { participante, sesion } = await porToken(cuerpo.token)
  exigirVigente(sesion)
  const curso = await leerCurso(sesion.curso_id)
  if (participante.aprobado_en) throw new ErrorInduccion('Ya aprobaste este curso.')
  if (sesion.incluye_contenido && !participante.contenido_terminado) throw new ErrorInduccion('Primero termina la presentación y los videos.')
  if (!curso.permite_repetir && participante.intentos > 0) throw new ErrorInduccion('Este cuestionario solo se puede contestar una vez.')
  if (curso.preguntas.length === 0) throw new ErrorInduccion('El cuestionario todavía no tiene preguntas.')
  const respuestas = cuerpo.respuestas && typeof cuerpo.respuestas === 'object' ? (cuerpo.respuestas as Record<string, unknown>) : {}

  // Hora en que abrió el cuestionario (para saber cuánto tardó); si no es creíble, ahora.
  const ahora = Date.now()
  const pedido = typeof cuerpo.inicio === 'string' ? Date.parse(cuerpo.inicio) : NaN
  const inicio = Number.isFinite(pedido) && pedido <= ahora && pedido > Math.max(ahora - 24 * 3600_000, Date.parse(participante.inicio) - 60_000) ? pedido : ahora

  const r = calificar(curso.preguntas, respuestas, curso.calificacion_minima)
  const fin = new Date(ahora).toISOString()
  const { error } = await admin.from('induccion_intentos').insert({
    participante_id: participante.id,
    inicio: new Date(inicio).toISOString(),
    fin,
    aciertos: r.aciertos,
    total: r.total,
    calificacion: r.calificacion,
    aprobado: r.aprobado,
    detalle: r.detalle,
  })
  if (error) throw error
  const cambios: Record<string, unknown> = {
    intentos: participante.intentos + 1,
    mejor_calificacion: Math.max(participante.mejor_calificacion ?? 0, r.calificacion),
    ultimo_avance: fin,
  }
  if (r.aprobado) cambios.aprobado_en = fin
  const { error: e2 } = await admin.from('induccion_participantes').update(cambios).eq('id', participante.id)
  if (e2) throw e2
  return { resultado: resumenIntento({ ...r, fin }), puede_repetir: !r.aprobado && curso.permite_repetir }
}

async function manejar(req: Request) {
  const cuerpo = (await req.json().catch(() => null)) as Record<string, unknown> | null
  if (!cuerpo || typeof cuerpo !== 'object') throw new ErrorInduccion('Solicitud no válida')
  switch (cuerpo.accion) {
    case 'entrar':
      return entrar(req, cuerpo)
    case 'estado': {
      const { participante, sesion } = await porToken(cuerpo.token)
      return estado(participante, sesion)
    }
    case 'avance':
      return avance(cuerpo)
    case 'responder':
      return contestar(cuerpo)
    default:
      throw new ErrorInduccion('Acción no válida')
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return responder({ error: 'Método no permitido' }, 405)
  try {
    return responder(await manejar(req))
  } catch (e) {
    if (e instanceof ErrorInduccion) return responder({ error: e.message }, e.estado)
    console.error(e)
    return responder({ error: 'Error interno' }, 500)
  }
})
