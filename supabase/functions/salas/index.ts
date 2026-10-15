// Reservación de salas: valida horario y permisos, evita choques (la base de datos no permite
// reservaciones encimadas) y copia cada reservación al calendario Outlook de la sala.
// Dos formas de llegar a Outlook (cuenta personal, outlook.live.com):
// - Conexión completa (Microsoft Graph): el administrador conecta la cuenta (OAuth) y elige qué calendario es cada
//   sala; cada reservación se crea en ese calendario y Outlook manda las invitaciones. Requiere MS_CLIENT_ID /
//   MS_CLIENT_SECRET. Con el permiso de correo, también avisa de solicitudes de horario.
// - Sin Azure (respaldo): calendario .ics por sala para suscribir y lectura del calendario que Outlook publica.
// Además: administradores de salas (permiso "salas_admin"), historial por reservación, solicitudes de horario
// entre personas y reservación para externos (sin cuenta) con el código impreso de cada sala.
import { createClient } from 'npm:@supabase/supabase-js@2.117.1'
import { comentarioCancelacion, correoRespuesta, correoSolicitud, cuerpoInvitacion, textoDia, textoHorario, type Aviso, type DatosReunion } from './correo.ts'
import { DOMINIO_UID, generarFeed, ocupadosDeIcs } from './ics.ts'

const ZONA = 'America/Mexico_City'
const HORA_INICIO = 7 // 7:00 a.m.
const HORA_FIN = 21 // 9:00 p.m.
const DIAS_ADELANTE = 30
const PASO_MIN = 15
const MAX_INVITADOS = 30
/** Externos: duración máxima y reservaciones futuras por correo. */
const EXTERNO_MAX_HORAS = 4
const EXTERNO_MAX_ACTIVAS = 3
/** Intentos fallidos de código por hora antes de bloquear. */
const MAX_INTENTOS = 15

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const admin = createClient(Deno.env.get('SUPABASE_URL')!, JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS')!)['default'], {
  auth: { persistSession: false, autoRefreshToken: false },
})

class ErrorSalas extends Error {
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

/** Quien hace la acción: una cuenta de la plataforma o un externo (sin cuenta). */
interface Persona {
  id: string | null
  email: string
  nombre: string
  es_admin: boolean
  /** Administrador de salas (o de la plataforma): mueve y cancela cualquier reservación. */
  admin_salas: boolean
  externo: boolean
}

interface Sala {
  id: string
  nombre: string
  calendario_id: string | null
  /** Enlace ICS que Outlook publica del calendario de la sala (sin Azure). */
  publicado: string | null
}

interface Reservacion {
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
  estado: string
  outlook_event_id: string | null
  sync_error: string | null
  actualizado?: string
  responsable_nombre: string | null
  responsable_email: string | null
  notas: string
  origen: 'cuenta' | 'externo'
  empresa: string | null
}

/** Quién llama: con sesión, activo y con permiso de Salas o Administrar salas (o administrador). */
async function exigirPersona(req: Request): Promise<Persona> {
  const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '')
  if (!token) throw new ErrorSalas('Inicia sesión', 401)
  const { data, error } = await admin.auth.getUser(token)
  if (error || !data.user) throw new ErrorSalas('Sesión no válida', 401)
  const { data: perfil } = await admin.from('perfiles').select('email, nombre, es_admin, activo, secciones').eq('id', data.user.id).maybeSingle()
  const adminSalas = Boolean(perfil?.es_admin || perfil?.secciones.includes('salas_admin'))
  if (!perfil?.activo || !(adminSalas || perfil.secciones.includes('salas'))) throw new ErrorSalas('No tienes acceso a Salas', 403)
  return { id: data.user.id, email: perfil.email, nombre: perfil.nombre, es_admin: perfil.es_admin, admin_salas: adminSalas, externo: false }
}

// ───── Horario (hora de la Ciudad de México) ─────

const formato = new Intl.DateTimeFormat('en-US', {
  timeZone: ZONA,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  weekday: 'short',
  hourCycle: 'h23',
})

function local(fecha: Date) {
  const p = Object.fromEntries(formato.formatToParts(fecha).map((x) => [x.type, x.value]))
  return { dia: `${p.year}-${p.month}-${p.day}`, semana: p.weekday, minutos: Number(p.hour) * 60 + Number(p.minute) }
}

/** Inicio y fin (UTC) del día `YYYY-MM-DD` en la Ciudad de México. */
function rangoDelDia(dia: string): [Date, Date] {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dia)) throw new ErrorSalas('Fecha no válida')
  // Medianoche local = medianoche UTC menos el desfase de ese momento.
  const base = new Date(`${dia}T12:00:00Z`)
  const desfase = local(base).minutos - 12 * 60 // minutos que la hora local va detrás/adelante de UTC
  const inicio = new Date(Date.parse(`${dia}T00:00:00Z`) - desfase * 60_000)
  return [inicio, new Date(inicio.getTime() + 24 * 3600_000)]
}

function validarHorario(inicioTxt: unknown, finTxt: unknown, maxHoras = 8): [Date, Date] {
  if (typeof inicioTxt !== 'string' || typeof finTxt !== 'string') throw new ErrorSalas('Falta el horario')
  const inicio = new Date(inicioTxt)
  const fin = new Date(finTxt)
  if (Number.isNaN(inicio.getTime()) || Number.isNaN(fin.getTime())) throw new ErrorSalas('Horario no válido')
  const duracion = (fin.getTime() - inicio.getTime()) / 60_000
  if (duracion < PASO_MIN || duracion > maxHoras * 60) throw new ErrorSalas(`La duración debe ser de 15 minutos a ${maxHoras} horas`)
  const ahora = Date.now()
  if (inicio.getTime() < ahora - 60_000) throw new ErrorSalas('Ese horario ya pasó')
  if (inicio.getTime() > ahora + DIAS_ADELANTE * 24 * 3600_000) throw new ErrorSalas(`Solo se puede reservar con hasta ${DIAS_ADELANTE} días de anticipación`)
  const a = local(inicio)
  const b = local(fin)
  if (['Sat', 'Sun'].includes(a.semana)) throw new ErrorSalas('Las salas se reservan de lunes a viernes')
  const finMin = b.dia === a.dia ? b.minutos : b.minutos + 24 * 60
  if (a.minutos < HORA_INICIO * 60 || finMin > HORA_FIN * 60) throw new ErrorSalas('El horario es de 7:00 a.m. a 9:00 p.m.')
  if (a.minutos % PASO_MIN || b.minutos % PASO_MIN) throw new ErrorSalas('Los horarios van cada 15 minutos')
  return [inicio, fin]
}

const horarioCorto = (r: { inicio: string; fin: string }) => `${textoDia(r.inicio)}, ${textoHorario(r.inicio, r.fin)}`

// ───── Datos que escribe la gente ─────

const CORREO = /^[^\s@<>,;]+@[^\s@<>,;]+\.[^\s@<>,;]+$/

function texto(v: unknown, max: number, campo?: string): string {
  const s = typeof v === 'string' ? v.trim().slice(0, max) : ''
  if (campo && !s) throw new ErrorSalas(`Falta ${campo}`)
  return s
}

function correo(v: unknown, campo: string): string {
  const s = texto(v, 200).toLowerCase()
  if (!CORREO.test(s)) throw new ErrorSalas(`Revisa el correo de ${campo}`)
  return s
}

function invitados(v: unknown): string[] {
  const lista = Array.isArray(v) ? v.map((x) => String(x).trim().toLowerCase()).filter(Boolean) : []
  const malos = lista.filter((x) => !CORREO.test(x))
  if (malos.length) throw new ErrorSalas(`Revisa estos correos: ${malos.slice(0, 3).join(', ')}`)
  const unicos = [...new Set(lista)]
  if (unicos.length > MAX_INVITADOS) throw new ErrorSalas(`Máximo ${MAX_INVITADOS} invitados`)
  return unicos
}

function personas(v: unknown): number {
  const n = Number(v ?? 1)
  if (!Number.isInteger(n) || n < 1 || n > 100) throw new ErrorSalas('Número de personas no válido')
  return n
}

/** Dirección de la app que manda el navegador (para los enlaces de los correos). */
function app(v: unknown): string | null {
  const s = typeof v === 'string' ? v.trim() : ''
  return /^https:\/\/[^\s"<>]{3,300}$/.test(s) ? s : null
}

// ───── Microsoft Graph (Outlook personal) ─────

const MS = { cliente: Deno.env.get('MS_CLIENT_ID'), secreto: Deno.env.get('MS_CLIENT_SECRET') }
const outlookConfigurado = Boolean(MS.cliente && MS.secreto)
const LOGIN = 'https://login.microsoftonline.com/consumers/oauth2/v2.0'
/** Lo que se pide al conectar. El correo (Mail.Send) va aparte: si no se aceptó, el calendario sigue funcionando. */
const PERMISOS_CONECTAR = 'offline_access User.Read Calendars.ReadWrite Mail.Send'
const PERMISOS = { cal: 'offline_access User.Read Calendars.ReadWrite', mail: 'offline_access Mail.Send' } as const
type Uso = keyof typeof PERMISOS
/** A donde regresa Microsoft después de conectar: esta misma función. */
const REDIRECCION = `${Deno.env.get('SUPABASE_URL')}/functions/v1/salas`
const tokens: Record<Uso, { valor: string; vence: number } | null> = { cal: null, mail: null }

async function pedirToken(parametros: Record<string, string>, scope: string) {
  const r = await fetch(`${LOGIN}/token`, {
    method: 'POST',
    body: new URLSearchParams({ client_id: MS.cliente!, client_secret: MS.secreto!, scope, ...parametros }),
  })
  const j = await r.json()
  if (!r.ok) throw new Error(`Microsoft no dio acceso: ${j.error_description ?? j.error ?? r.status}`)
  return j as { access_token: string; refresh_token?: string; expires_in: number }
}

async function tokenDe(uso: Uso): Promise<string> {
  const t = tokens[uso]
  if (t && t.vence > Date.now() + 60_000) return t.valor
  const { data: conexion } = await admin.from('outlook_conexion').select('refresh_token').eq('id', 1).maybeSingle()
  if (!conexion) throw new Error('Outlook no está conectado')
  const j = await pedirToken({ grant_type: 'refresh_token', refresh_token: conexion.refresh_token }, PERMISOS[uso])
  // Microsoft cambia el refresh token en cada uso: se guarda el nuevo.
  if (j.refresh_token) await admin.from('outlook_conexion').update({ refresh_token: j.refresh_token, actualizado: new Date().toISOString() }).eq('id', 1)
  tokens[uso] = { valor: j.access_token, vence: Date.now() + j.expires_in * 1000 }
  return j.access_token
}

async function graph(ruta: string, init: RequestInit = {}, uso: Uso = 'cal'): Promise<Response> {
  const token = await tokenDe(uso)
  return fetch(`https://graph.microsoft.com/v1.0${ruta}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Prefer: 'outlook.timezone="UTC"', ...(init.headers ?? {}) },
  })
}

/** Manda un correo desde la cuenta de Outlook conectada. Nunca detiene la acción: si no se puede, regresa false. */
async function enviarCorreo(para: string[], asunto: string, html: string): Promise<boolean> {
  const destinos = [...new Set(para.filter((x) => CORREO.test(x)).map((x) => x.toLowerCase()))]
  if (!outlookConfigurado || !destinos.length) return false
  try {
    const r = await graph(
      '/me/sendMail',
      {
        method: 'POST',
        body: JSON.stringify({
          message: { subject: asunto, body: { contentType: 'HTML', content: html }, toRecipients: destinos.map((address) => ({ emailAddress: { address } })) },
          saveToSentItems: true,
        }),
      },
      'mail',
    )
    if (!r.ok) throw new Error(`Outlook (${r.status}): ${await r.text()}`)
    return true
  } catch (e) {
    console.error('correo', e)
    return false
  }
}

const usaOutlook = (sala: Sala) => outlookConfigurado && Boolean(sala.calendario_id)
const calendario = (sala: Sala) => `/me/calendars/${encodeURIComponent(sala.calendario_id!)}`
const utc = (d: Date | string) => ({ dateTime: new Date(d).toISOString().replace('Z', ''), timeZone: 'UTC' })
const desdeGraph = (t: { dateTime: string }) => new Date(t.dateTime.endsWith('Z') ? t.dateTime : `${t.dateTime}Z`)

/** Microsoft regresa aquí (GET) después de que el administrador conecta la cuenta. */
async function terminarConexion(url: URL): Promise<Response> {
  const estado = url.searchParams.get('state') ?? ''
  const { data: guardado } = await admin.from('outlook_oauth_estados').delete().eq('estado', estado).select('volver, creado').maybeSingle()
  if (!guardado || Date.parse(guardado.creado) < Date.now() - 15 * 60_000) return new Response('El enlace venció. Vuelve a dar clic en "Conectar Outlook".', { status: 400 })
  const volver = (resultado: string) => Response.redirect(`${guardado.volver}${guardado.volver.includes('?') ? '&' : '?'}outlook=${resultado}#salas`, 302)
  const codigo = url.searchParams.get('code')
  if (!codigo) return volver('cancelado')
  try {
    const j = await pedirToken({ grant_type: 'authorization_code', code: codigo, redirect_uri: REDIRECCION }, PERMISOS_CONECTAR)
    if (!j.refresh_token) throw new Error('Microsoft no dio permiso permanente (offline_access)')
    const yo = await fetch('https://graph.microsoft.com/v1.0/me', { headers: { Authorization: `Bearer ${j.access_token}` } }).then((r) => r.json())
    const cuenta = yo.mail ?? yo.userPrincipalName ?? 'cuenta de Outlook'
    const { error } = await admin.from('outlook_conexion').upsert({ id: 1, cuenta, refresh_token: j.refresh_token, actualizado: new Date().toISOString() })
    if (error) throw error
    tokens.cal = null
    tokens.mail = null
    return volver('conectado')
  } catch (e) {
    console.error(e)
    return volver('error')
  }
}

interface Ocupado {
  inicio: string
  fin: string
  titulo: string
}

/** Calendario publicado por Outlook (texto .ics), con 1 minuto de memoria para no pedirlo en cada clic. */
const cacheIcs = new Map<string, { texto: string; hora: number }>()
async function leerPublicado(url: string, fresco = false): Promise<string> {
  const guardado = cacheIcs.get(url)
  if (!fresco && guardado && guardado.hora > Date.now() - 60_000) return guardado.texto
  const r = await fetch(url, { headers: { Accept: 'text/calendar' }, signal: AbortSignal.timeout(10_000) })
  if (!r.ok) throw new Error(`Outlook respondió ${r.status} al leer el calendario publicado`)
  const texto = await r.text()
  if (!texto.includes('BEGIN:VCALENDAR')) throw new Error('El enlace no es un calendario ICS')
  cacheIcs.set(url, { texto, hora: Date.now() })
  return texto
}

/** Lo ocupado en el calendario publicado, sin las reservaciones de la app que alguien haya agregado a Outlook. */
async function ocupadoEnPublicado(sala: Sala, desde: Date, hasta: Date, codigos: Set<string>): Promise<Ocupado[]> {
  const texto = await leerPublicado(sala.publicado!)
  const deLaApp = (uid: string, contenido: string) => uid.endsWith(`@${DOMINIO_UID}`) || [...codigos].some((c) => contenido.includes(c))
  return ocupadosDeIcs(texto, desde, hasta, deLaApp).map((b) => ({ ...b, titulo: 'Ocupado en Outlook' }))
}

/** Eventos del calendario Outlook de la sala que no salieron de la app (reservas directas en Outlook). */
async function ocupadoEnOutlook(sala: Sala, desde: Date, hasta: Date, propias: Reservacion[]): Promise<Ocupado[]> {
  if (!usaOutlook(sala)) return sala.publicado ? ocupadoEnPublicado(sala, desde, hasta, new Set(propias.map((r) => r.codigo))) : []
  const propios = new Set(propias.map((r) => r.outlook_event_id).filter(Boolean) as string[])
  const codigos = propias.map((r) => r.codigo)
  const q = new URLSearchParams({ startDateTime: desde.toISOString(), endDateTime: hasta.toISOString(), $select: 'id,subject,start,end,showAs,isCancelled,bodyPreview', $top: '200' })
  const r = await graph(`${calendario(sala)}/calendarView?${q}`)
  if (!r.ok) throw new Error(`No se pudo leer el calendario de Outlook (${r.status}): ${await r.text()}`)
  const j = await r.json()
  return (j.value as { id: string; start: { dateTime: string }; end: { dateTime: string }; showAs: string; isCancelled: boolean; bodyPreview?: string }[])
    .filter((e) => !propios.has(e.id) && !e.isCancelled && e.showAs !== 'free' && !codigos.some((c) => e.bodyPreview?.includes(c)))
    .map((e) => ({ inicio: desdeGraph(e.start).toISOString(), fin: desdeGraph(e.end).toISOString(), titulo: 'Ocupado en Outlook' }))
}

// ───── Reservación → Outlook ─────

const responsable = (r: Reservacion) => ({ nombre: r.responsable_nombre || r.creado_por_nombre, email: r.responsable_email || r.creado_por_email })

/** Quién recibe la invitación: el responsable, quien la registró y los invitados. */
const asistentes = (r: Reservacion) => [...new Set([responsable(r).email, r.creado_por_email, ...r.invitados].map((x) => x.toLowerCase()))]

function datosReunion(r: Reservacion, sala: Sala, urlApp: string | null, gestion?: string | null): DatosReunion {
  return {
    motivo: r.motivo,
    sala: sala.nombre,
    inicio: r.inicio,
    fin: r.fin,
    responsable: responsable(r),
    registro: { nombre: r.creado_por_nombre, email: r.creado_por_email },
    personas: r.personas,
    invitados: r.invitados,
    notas: r.notas,
    codigo: r.codigo,
    empresa: r.empresa,
    app: urlApp,
    gestion: gestion ?? null,
  }
}

function eventoOutlook(r: Reservacion, sala: Sala, urlApp: string | null, conInvitados: boolean, aviso?: Aviso, gestion?: string | null) {
  return {
    subject: `${r.motivo} · ${sala.nombre}`,
    body: { contentType: 'HTML', content: cuerpoInvitacion(datosReunion(r, sala, urlApp, gestion), aviso) },
    start: utc(r.inicio),
    end: utc(r.fin),
    location: { displayName: sala.nombre },
    showAs: 'busy',
    transactionId: r.id,
    ...(conInvitados ? { attendees: asistentes(r).map((address) => ({ emailAddress: { address }, type: 'required' })) } : {}),
  }
}

/** Crea el evento en Outlook; si Outlook rechaza las invitaciones, lo crea sin invitados. */
async function crearEnOutlook(r: Reservacion, sala: Sala, urlApp: string | null, aviso?: Aviso, gestion?: string | null): Promise<string> {
  const ruta = `${calendario(sala)}/events`
  let res = await graph(ruta, { method: 'POST', body: JSON.stringify(eventoOutlook(r, sala, urlApp, true, aviso, gestion)) })
  if (!res.ok && res.status < 500) res = await graph(ruta, { method: 'POST', body: JSON.stringify(eventoOutlook(r, sala, urlApp, false, aviso, gestion)) })
  if (!res.ok) throw new Error(`Outlook (${res.status}): ${await res.text()}`)
  return (await res.json()).id
}

/** Cancela el evento (avisa a los invitados con el comentario); si no se puede, lo borra. */
async function cancelarEnOutlook(eventoId: string, comentario: string) {
  const ruta = `/me/events/${encodeURIComponent(eventoId)}`
  let res = await graph(`${ruta}/cancel`, { method: 'POST', body: JSON.stringify({ Comment: comentario.slice(0, 900) }) })
  if (!res.ok && res.status !== 404) res = await graph(ruta, { method: 'DELETE' })
  if (!res.ok && res.status !== 404) throw new Error(`Outlook (${res.status}): ${await res.text()}`)
}

async function guardarSync(id: string, cambios: { outlook_event_id?: string | null; sync_error: string | null }) {
  await admin.from('reservaciones').update(cambios).eq('id', id)
}

/** Crea el evento y guarda el resultado; un error de Outlook no deshace la reservación. */
async function sincronizarNueva(r: Reservacion, sala: Sala, urlApp: string | null, aviso?: Aviso, gestion?: string | null): Promise<'ok' | 'error' | 'no'> {
  if (!usaOutlook(sala)) return 'no'
  try {
    r.outlook_event_id = await crearEnOutlook(r, sala, urlApp, aviso, gestion)
    r.sync_error = null
    await guardarSync(r.id, { outlook_event_id: r.outlook_event_id, sync_error: null })
    return 'ok'
  } catch (e) {
    console.error(e)
    r.sync_error = String(e).slice(0, 500)
    await guardarSync(r.id, { sync_error: r.sync_error })
    return 'error'
  }
}

async function enlaceGestion(r: Reservacion, urlApp: string | null): Promise<string | null> {
  if (r.origen !== 'externo' || !urlApp) return null
  const { data } = await admin.from('reservaciones_gestion').select('token').eq('reservacion_id', r.id).maybeSingle()
  return data ? `${urlApp.split('#')[0]}#externo/gestion/${data.token}` : null
}

// ───── Historial y bitácora ─────

async function historial(r: { id: string }, accion: string, quien: Persona, detalle?: unknown) {
  const { error } = await admin.from('salas_historial').insert({ reservacion_id: r.id, accion, quien_email: quien.email, quien_nombre: quien.nombre, externo: quien.externo, detalle: detalle ?? null })
  if (error) console.error('historial', error)
}

async function registrar(quien: Persona, accion: string, sala: Sala, r: Reservacion) {
  const { error } = await admin.from('bitacora').insert({
    usuario_id: quien.id,
    email: quien.email,
    accion,
    plantilla: 'salas',
    documento: `${sala.nombre} · ${horarioCorto(r)} · ${r.codigo}`.slice(0, 300),
    detalle: { codigo: r.codigo, motivo: r.motivo, responsable: responsable(r).email, externo: quien.externo, inicio: r.inicio, fin: r.fin },
  })
  if (error) console.error('bitácora', error)
}

const resumen = (r: Reservacion, sala?: Sala) => ({ sala: sala?.nombre ?? r.sala_id, motivo: r.motivo, inicio: r.inicio, fin: r.fin })

// ───── Lecturas ─────

async function leerSala(id: unknown): Promise<Sala> {
  if (typeof id !== 'string') throw new ErrorSalas('Falta la sala')
  const { data } = await admin.from('salas').select('id, nombre, calendario_id, salas_ics (publicado)').eq('id', id).eq('activa', true).maybeSingle()
  if (!data) throw new ErrorSalas('Esa sala no existe')
  const ics = data.salas_ics as { publicado: string | null } | { publicado: string | null }[] | null
  return { id: data.id, nombre: data.nombre, calendario_id: data.calendario_id, publicado: (Array.isArray(ics) ? ics[0] : ics)?.publicado ?? null }
}

async function leerReservacionId(id: unknown): Promise<Reservacion> {
  if (typeof id !== 'string' || !/^[0-9a-f-]{36}$/i.test(id)) throw new ErrorSalas('Reservación no válida')
  const { data } = await admin.from('reservaciones').select('*').eq('id', id).maybeSingle()
  if (!data || data.estado !== 'activa') throw new ErrorSalas('Esa reservación ya no está activa', 404)
  return data as Reservacion
}

/** La reservación, si quien llama puede cambiarla: quien la hizo, su responsable o un administrador de salas. */
async function leerReservacion(id: unknown, quien: Persona): Promise<Reservacion> {
  const r = await leerReservacionId(id)
  if (!esDueno(r, quien) && !quien.admin_salas) throw new ErrorSalas('Solo quien reservó (o un administrador de salas) puede cambiarla', 403)
  return r
}

const esDueno = (r: Reservacion, quien: Persona) => (quien.id !== null && r.creado_por === quien.id) || r.responsable_email?.toLowerCase() === quien.email.toLowerCase()

async function reservasActivas(salaId: string, desde: Date, hasta: Date): Promise<Reservacion[]> {
  const { data, error } = await admin
    .from('reservaciones')
    .select('*')
    .eq('sala_id', salaId)
    .eq('estado', 'activa')
    .lt('inicio', hasta.toISOString())
    .gt('fin', desde.toISOString())
    .order('inicio')
  if (error) throw error
  return data as Reservacion[]
}

/** Revisa que Outlook no tenga algo encimado (la base de datos ya cuida las reservas de la app). */
async function revisarOutlook(sala: Sala, inicio: Date, fin: Date, ignorar?: Reservacion | null) {
  if (!revisaOutlook(sala)) return
  const propias = await reservasActivas(sala.id, inicio, fin)
  if (ignorar) propias.push(ignorar)
  let choques: Ocupado[]
  try {
    choques = await ocupadoEnOutlook(sala, inicio, fin, propias)
  } catch (e) {
    // Si Outlook no responde, se reserva igual (la app evita choques entre sus reservaciones).
    console.error(e)
    return
  }
  if (choques.length) throw new ErrorSalas('Ese horario ya está ocupado en el calendario de Outlook de la sala', 409)
}

/** Hay algo que revisar en Outlook: conexión completa o calendario publicado. */
const revisaOutlook = (sala: Sala) => usaOutlook(sala) || Boolean(sala.publicado)

function exigirAdmin(quien: Persona) {
  if (!quien.es_admin) throw new ErrorSalas('Solo el administrador puede hacer esto', 403)
}

function exigirAdminSalas(quien: Persona) {
  if (!quien.admin_salas) throw new ErrorSalas('Solo un administrador de salas puede hacer esto', 403)
}

function choque(error: { code?: string } | null) {
  if (error?.code === '23P01') throw new ErrorSalas('Alguien acaba de reservar ese horario. Elige otro.', 409)
  if (error) throw error
}

/** Disponibilidad de un día: reservaciones de la app y lo ocupado en Outlook. */
async function disponibilidad(sala: Sala, fecha: unknown) {
  const [desde, hasta] = rangoDelDia(String(fecha))
  const reservas = await reservasActivas(sala.id, desde, hasta)
  let outlook: Ocupado[] = []
  let aviso: string | null = null
  try {
    outlook = await ocupadoEnOutlook(sala, desde, hasta, reservas)
  } catch (e) {
    console.error(e)
    aviso = 'No se pudo consultar Outlook; se muestran solo las reservaciones de la app.'
  }
  return { reservas, outlook, aviso }
}

// ───── Crear, mover y cancelar (compartido por cuentas, externos y solicitudes) ─────

interface NuevaReservacion {
  sala: Sala
  inicio: Date
  fin: Date
  motivo: string
  personas: number
  invitados: string[]
  notas: string
  responsable: { nombre: string; email: string }
  empresa?: string | null
  /** Reservación que se está reemplazando (su evento de Outlook todavía existe y no cuenta como choque). */
  reemplaza?: Reservacion
}

async function crearReservacion(n: NuevaReservacion, quien: Persona, urlApp: string | null, aviso?: Aviso) {
  await revisarOutlook(n.sala, n.inicio, n.fin, n.reemplaza)
  const { data, error } = await admin
    .from('reservaciones')
    .insert({
      sala_id: n.sala.id,
      inicio: n.inicio.toISOString(),
      fin: n.fin.toISOString(),
      motivo: n.motivo,
      personas: n.personas,
      invitados: n.invitados,
      notas: n.notas,
      creado_por: quien.id,
      creado_por_email: quien.email,
      creado_por_nombre: quien.nombre,
      responsable_nombre: n.responsable.nombre,
      responsable_email: n.responsable.email,
      origen: quien.externo ? 'externo' : 'cuenta',
      empresa: n.empresa ?? null,
    })
    .select('*')
    .single()
  choque(error)
  const r = data as Reservacion
  let gestion: string | null = null
  if (quien.externo) {
    const { data: g } = await admin.from('reservaciones_gestion').insert({ reservacion_id: r.id }).select('token').single()
    gestion = g && urlApp ? `${urlApp.split('#')[0]}#externo/gestion/${g.token}` : null
  }
  const outlook = await sincronizarNueva(r, n.sala, urlApp, aviso, gestion)
  await historial(r, 'creada', quien, { ...resumen(r, n.sala), responsable: n.responsable.email, invitados: r.invitados.length })
  await registrar(quien, quien.externo ? 'sala_reservada_externo' : 'sala_reservada', n.sala, r)
  return { reservacion: r, outlook, gestion, invitados: asistentes(r).length }
}

async function cancelarReservacion(r: Reservacion, sala: Sala, quien: Persona, razon: string, accion = 'cancelada') {
  const { error } = await admin.from('reservaciones').update({ estado: 'cancelada', actualizado: new Date().toISOString() }).eq('id', r.id).eq('estado', 'activa')
  if (error) throw error
  if (usaOutlook(sala) && r.outlook_event_id) {
    try {
      await cancelarEnOutlook(r.outlook_event_id, comentarioCancelacion(resumen(r, sala), razon))
    } catch (e) {
      console.error(e)
      await guardarSync(r.id, { sync_error: String(e).slice(0, 500) })
    }
  }
  // Las solicitudes pendientes sobre esta reservación ya no aplican.
  await admin.from('solicitudes_sala').update({ estado: 'cancelada', respondido: new Date().toISOString() }).eq('reservacion_id', r.id).eq('estado', 'pendiente')
  await historial(r, accion, quien, { razon })
  await registrar(quien, 'sala_cancelada', sala, r)
}

/** Cambia sala u horario; misma sala actualiza el evento de Outlook, otra sala lo cancela y crea de nuevo. */
async function moverReservacion(anterior: Reservacion, sala: Sala, inicio: Date, fin: Date, quien: Persona, urlApp: string | null) {
  const salaAnterior = sala.id === anterior.sala_id ? sala : await leerSala(anterior.sala_id)
  if (inicio.toISOString() === new Date(anterior.inicio).toISOString() && fin.toISOString() === new Date(anterior.fin).toISOString() && sala.id === anterior.sala_id) {
    throw new ErrorSalas('Elige un horario distinto al actual')
  }
  const mismaSala = sala.id === anterior.sala_id
  await revisarOutlook(sala, inicio, fin, mismaSala ? anterior : null)
  const { data, error } = await admin
    .from('reservaciones')
    .update({ sala_id: sala.id, inicio: inicio.toISOString(), fin: fin.toISOString(), actualizado: new Date().toISOString() })
    .eq('id', anterior.id)
    .select('*')
    .single()
  choque(error)
  const r = data as Reservacion
  const aviso: Aviso = { tipo: 'cambio', antes: { sala: salaAnterior.nombre, inicio: anterior.inicio, fin: anterior.fin } }
  const gestion = await enlaceGestion(r, urlApp)
  let outlook: 'ok' | 'error' | 'no' = 'no'
  // Misma sala: se actualiza el mismo evento (Outlook avisa a los invitados). Otra sala: se cancela y se crea de nuevo.
  try {
    if (mismaSala && usaOutlook(sala) && anterior.outlook_event_id) {
      const res = await graph(`/me/events/${encodeURIComponent(anterior.outlook_event_id)}`, {
        method: 'PATCH',
        body: JSON.stringify({ start: utc(inicio), end: utc(fin), body: { contentType: 'HTML', content: cuerpoInvitacion(datosReunion(r, sala, urlApp, gestion), aviso) } }),
      })
      if (!res.ok) throw new Error(`Outlook (${res.status}): ${await res.text()}`)
      await guardarSync(r.id, { sync_error: null })
      outlook = 'ok'
    } else {
      if (usaOutlook(salaAnterior) && anterior.outlook_event_id) {
        await cancelarEnOutlook(anterior.outlook_event_id, `La reunión "${anterior.motivo}" se cambió a ${sala.nombre}, ${horarioCorto(r)}. Llega una invitación nueva.`)
      }
      if (!usaOutlook(sala)) await guardarSync(r.id, { outlook_event_id: null, sync_error: null })
      outlook = await sincronizarNueva(r, sala, urlApp, aviso, gestion)
    }
  } catch (e) {
    console.error(e)
    outlook = 'error'
    await guardarSync(r.id, { sync_error: String(e).slice(0, 500) })
  }
  await historial(r, 'movida', quien, { antes: resumen(anterior, salaAnterior), despues: resumen(r, sala), por_admin: !esDueno(anterior, quien) })
  await registrar(quien, 'sala_movida', sala, r)
  return { reservacion: r, outlook }
}

/** Razón visible para los invitados cuando cancela o mueve alguien que no es el responsable. */
const porQuien = (r: Reservacion, quien: Persona) => (esDueno(r, quien) ? `La canceló ${quien.nombre || quien.email}.` : `La canceló ${quien.nombre || quien.email} (administración de salas).`)

// ───── Externos (sin cuenta, con el código impreso de la sala) ─────

function ipDe(req: Request) {
  return req.headers.get('cf-connecting-ip') ?? req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'desconocida'
}

async function revisarIntentos(clave: string) {
  const { count } = await admin.from('salas_intentos').select('id', { count: 'exact', head: true }).eq('clave', clave).gt('creado', new Date(Date.now() - 3600_000).toISOString())
  if ((count ?? 0) >= MAX_INTENTOS) throw new ErrorSalas('Demasiados intentos con un código incorrecto. Espera una hora e inténtalo de nuevo.', 429)
}

const limpiarCodigo = (v: unknown) => (typeof v === 'string' ? v.toUpperCase().replace(/[^A-Z0-9]/g, '') : '')

/** Valida el código de la sala; los intentos fallidos se cuentan por IP. */
async function salaExterna(req: Request, cuerpo: Record<string, unknown>): Promise<Sala> {
  const clave = `ip:${ipDe(req)}`
  await revisarIntentos(clave)
  const sala = await leerSala(cuerpo.sala_id).catch(() => null)
  const { data: acceso } = sala ? await admin.from('salas_acceso').select('codigo, activo').eq('sala_id', sala.id).maybeSingle() : { data: null }
  if (!sala || !acceso?.activo || acceso.codigo !== limpiarCodigo(cuerpo.codigo)) {
    await admin.from('salas_intentos').insert({ clave })
    await admin.from('salas_intentos').delete().lt('creado', new Date(Date.now() - 24 * 3600_000).toISOString())
    throw new ErrorSalas(acceso && !acceso.activo ? 'El acceso para externos de esta sala está desactivado.' : 'El código no es correcto. Revísalo en la hoja de la sala.', 403)
  }
  return sala
}

async function reservacionPorToken(token: unknown): Promise<Reservacion> {
  if (typeof token !== 'string' || !/^[0-9a-f-]{36}$/i.test(token)) throw new ErrorSalas('Enlace no válido', 404)
  const { data } = await admin.from('reservaciones_gestion').select('reservacion_id').eq('token', token.toLowerCase()).maybeSingle()
  if (!data) throw new ErrorSalas('Enlace no válido', 404)
  const { data: r } = await admin.from('reservaciones').select('*').eq('id', data.reservacion_id).maybeSingle()
  if (!r) throw new ErrorSalas('Enlace no válido', 404)
  return r as Reservacion
}

const personaExterna = (r: Reservacion): Persona => ({ ...responsable(r), id: null, es_admin: false, admin_salas: false, externo: true })

/** Reservación activa y futura, para cambiarla desde el enlace. */
function exigirVigente(r: Reservacion) {
  if (r.estado !== 'activa') throw new ErrorSalas('Esta reservación ya estaba cancelada')
  if (Date.parse(r.fin) < Date.now()) throw new ErrorSalas('Esta reunión ya pasó')
}

async function manejarExterno(req: Request, cuerpo: Record<string, unknown>) {
  switch (cuerpo.accion) {
    case 'externo_sala': {
      const sala = await salaExterna(req, cuerpo)
      return { sala: { id: sala.id, nombre: sala.nombre } }
    }
    case 'externo_disponibilidad': {
      const sala = await salaExterna(req, cuerpo)
      const { reservas, outlook } = await disponibilidad(sala, cuerpo.fecha)
      // Sin nombres ni motivos: solo los horarios ocupados.
      return { ocupado: [...reservas, ...outlook].map((b) => ({ inicio: b.inicio, fin: b.fin })) }
    }
    case 'externo_reservar': {
      const sala = await salaExterna(req, cuerpo)
      const [inicio, fin] = validarHorario(cuerpo.inicio, cuerpo.fin, EXTERNO_MAX_HORAS)
      const nombre = texto(cuerpo.nombre, 120, 'tu nombre')
      const email = correo(cuerpo.email, 'contacto')
      const empresa = texto(cuerpo.empresa, 120, 'tu empresa')
      const { count } = await admin
        .from('reservaciones')
        .select('id', { count: 'exact', head: true })
        .eq('origen', 'externo')
        .eq('estado', 'activa')
        .ilike('creado_por_email', email)
        .gt('fin', new Date().toISOString())
      if ((count ?? 0) >= EXTERNO_MAX_ACTIVAS) throw new ErrorSalas(`Ya tienes ${EXTERNO_MAX_ACTIVAS} reservaciones próximas. Cancela alguna o pide apoyo a Trevé.`, 429)
      const quien: Persona = { id: null, email, nombre, es_admin: false, admin_salas: false, externo: true }
      const resultado = await crearReservacion(
        { sala, inicio, fin, motivo: texto(cuerpo.motivo, 200, 'el motivo'), personas: personas(cuerpo.personas), invitados: invitados(cuerpo.invitados), notas: texto(cuerpo.notas, 1000), responsable: { nombre, email }, empresa },
        quien,
        app(cuerpo.app),
      )
      return { ...resultado, reservacion: { codigo: resultado.reservacion.codigo, inicio: resultado.reservacion.inicio, fin: resultado.reservacion.fin, motivo: resultado.reservacion.motivo } }
    }
    case 'externo_entrar': {
      // Con el código de la reservación y el correo con que se hizo: devuelve el enlace para administrarla.
      const clave = `ip:${ipDe(req)}`
      await revisarIntentos(clave)
      const codigo = limpiarCodigo(cuerpo.codigo).replace(/^SALA/, '')
      const email = typeof cuerpo.email === 'string' ? cuerpo.email.trim().toLowerCase() : ''
      const { data } = /^[A-F0-9]{6}$/.test(codigo) && email ? await admin.from('reservaciones').select('*').eq('codigo', `SALA-${codigo}`).eq('origen', 'externo').maybeSingle() : { data: null }
      const r = data as Reservacion | null
      if (!r || ![responsable(r).email, r.creado_por_email].some((x) => x.toLowerCase() === email)) {
        await admin.from('salas_intentos').insert({ clave })
        throw new ErrorSalas('No encontramos una reservación con ese código y ese correo. Revisa la invitación que te llegó.', 404)
      }
      let { data: g } = await admin.from('reservaciones_gestion').select('token').eq('reservacion_id', r.id).maybeSingle()
      if (!g) ({ data: g } = await admin.from('reservaciones_gestion').insert({ reservacion_id: r.id }).select('token').single())
      if (!g) throw new ErrorSalas('No se pudo abrir la reservación. Intenta de nuevo.', 500)
      return { token: g.token }
    }
    case 'externo_ver': {
      const r = await reservacionPorToken(cuerpo.token)
      const sala = await leerSala(r.sala_id)
      return {
        reservacion: { codigo: r.codigo, sala_id: sala.id, sala: sala.nombre, inicio: r.inicio, fin: r.fin, motivo: r.motivo, estado: r.estado, responsable: responsable(r), empresa: r.empresa, invitados: r.invitados },
        max_horas: EXTERNO_MAX_HORAS,
      }
    }
    case 'externo_horarios': {
      // Lo ocupado de un día en su sala, sin contar su propia reunión.
      const r = await reservacionPorToken(cuerpo.token)
      const sala = await leerSala(r.sala_id)
      const { reservas, outlook } = await disponibilidad(sala, cuerpo.fecha)
      return { ocupado: [...reservas.filter((x) => x.id !== r.id), ...outlook].map((b) => ({ inicio: b.inicio, fin: b.fin })) }
    }
    case 'externo_mover': {
      const anterior = await reservacionPorToken(cuerpo.token)
      exigirVigente(anterior)
      const sala = await leerSala(anterior.sala_id)
      const [inicio, fin] = validarHorario(cuerpo.inicio, cuerpo.fin, EXTERNO_MAX_HORAS)
      const { reservacion: r, outlook } = await moverReservacion(anterior, sala, inicio, fin, personaExterna(anterior), app(cuerpo.app))
      return { reservacion: { inicio: r.inicio, fin: r.fin }, outlook }
    }
    case 'externo_cancelar': {
      const r = await reservacionPorToken(cuerpo.token)
      exigirVigente(r)
      const sala = await leerSala(r.sala_id)
      const quien = personaExterna(r)
      await cancelarReservacion(r, sala, quien, `La canceló ${quien.nombre || quien.email}.`)
      return { ok: true }
    }
  }
  return null
}

// ───── Acciones con sesión ─────

async function manejar(req: Request) {
  const cuerpo = (await req.json().catch(() => ({}))) as Record<string, unknown>
  const externo = await manejarExterno(req, cuerpo)
  if (externo) return externo
  const quien = await exigirPersona(req)
  const urlApp = app(cuerpo.app)

  switch (cuerpo.accion) {
    case 'disponibilidad': {
      const sala = await leerSala(cuerpo.sala_id)
      const { reservas, outlook, aviso } = await disponibilidad(sala, cuerpo.fecha)
      return { reservaciones: reservas, outlook, outlook_activo: revisaOutlook(sala), aviso }
    }

    case 'reservar': {
      const sala = await leerSala(cuerpo.sala_id)
      const [inicio, fin] = validarHorario(cuerpo.inicio, cuerpo.fin)
      const resp = {
        nombre: texto(cuerpo.responsable_nombre, 120) || quien.nombre,
        email: cuerpo.responsable_email ? correo(cuerpo.responsable_email, 'quien reserva') : quien.email,
      }
      return crearReservacion(
        { sala, inicio, fin, motivo: texto(cuerpo.motivo, 200, 'el motivo de la reunión'), personas: personas(cuerpo.personas), invitados: invitados(cuerpo.invitados), notas: texto(cuerpo.notas, 1000), responsable: resp },
        quien,
        urlApp,
      )
    }

    case 'mover': {
      const anterior = await leerReservacion(cuerpo.id, quien)
      const sala = await leerSala(cuerpo.sala_id || anterior.sala_id)
      const [inicio, fin] = validarHorario(cuerpo.inicio, cuerpo.fin)
      return moverReservacion(anterior, sala, inicio, fin, quien, urlApp)
    }

    case 'cancelar': {
      const r = await leerReservacion(cuerpo.id, quien)
      const sala = await leerSala(r.sala_id)
      const razon = [porQuien(r, quien), texto(cuerpo.razon, 300)].filter(Boolean).join(' ')
      await cancelarReservacion(r, sala, quien, razon)
      return { ok: true }
    }

    case 'reintentar_outlook': {
      const r = await leerReservacion(cuerpo.id, quien)
      const sala = await leerSala(r.sala_id)
      if (!usaOutlook(sala)) throw new ErrorSalas('Esta sala no está conectada a Outlook')
      if (r.outlook_event_id && !r.sync_error) return { outlook: 'ok' }
      const outlook = await sincronizarNueva(r, sala, urlApp, undefined, await enlaceGestion(r, urlApp))
      await historial(r, 'reintento_outlook', quien, { resultado: outlook })
      if (outlook === 'error') throw new ErrorSalas(`Outlook no aceptó la reservación: ${r.sync_error?.slice(0, 200)}`)
      return { outlook }
    }

    // ───── Solicitudes de horario ─────
    case 'solicitar': {
      const objetivo = await leerReservacionId(cuerpo.reservacion_id)
      if (esDueno(objetivo, quien)) throw new ErrorSalas('Esa reservación ya es tuya')
      if (Date.parse(objetivo.inicio) < Date.now()) throw new ErrorSalas('Esa reunión ya empezó')
      const sala = await leerSala(objetivo.sala_id)
      const datos = {
        motivo: texto(cuerpo.motivo, 200, 'el motivo de tu reunión'),
        personas: personas(cuerpo.personas),
        invitados: invitados(cuerpo.invitados),
        notas: texto(cuerpo.notas, 1000),
        responsable_nombre: texto(cuerpo.responsable_nombre, 120) || quien.nombre,
        responsable_email: cuerpo.responsable_email ? correo(cuerpo.responsable_email, 'quien reserva') : quien.email,
      }
      const mensaje = texto(cuerpo.mensaje, 500)
      const { data, error } = await admin
        .from('solicitudes_sala')
        .insert({ reservacion_id: objetivo.id, solicitante_id: quien.id, solicitante_email: quien.email, solicitante_nombre: quien.nombre, datos, mensaje })
        .select('id')
        .single()
      if (error?.code === '23505') throw new ErrorSalas('Ya tienes una solicitud pendiente para ese horario')
      if (error) throw error
      await historial(objetivo, 'solicitud', quien, { motivo: datos.motivo, mensaje })
      const aviso = correoSolicitud(datosReunion(objetivo, sala, urlApp), { nombre: quien.nombre, email: quien.email }, datos.motivo, mensaje, urlApp)
      const avisado = await enviarCorreo([responsable(objetivo).email, objetivo.creado_por_email], aviso.asunto, aviso.html)
      return { id: data.id, avisado }
    }

    case 'solicitudes': {
      // Las pendientes cuya reunión ya empezó vencen solas.
      const { data: viejas } = await admin.from('solicitudes_sala').select('id, reservaciones!inner(inicio)').eq('estado', 'pendiente').lt('reservaciones.inicio', new Date().toISOString())
      if (viejas?.length) await admin.from('solicitudes_sala').update({ estado: 'vencida' }).in('id', viejas.map((v) => v.id))
      const campos = 'id, reservacion_id, solicitante_email, solicitante_nombre, datos, mensaje, estado, respuesta, respondido_por, creado, respondido, reservaciones(id, codigo, sala_id, inicio, fin, motivo, creado_por, creado_por_email, creado_por_nombre, responsable_nombre, responsable_email, estado)'
      const { data: pendientes, error } = await admin.from('solicitudes_sala').select(campos).eq('estado', 'pendiente').order('creado')
      if (error) throw error
      const recibidas = (pendientes ?? []).filter((s) => {
        const r = s.reservaciones as unknown as Reservacion | null
        return r && (quien.admin_salas || esDueno(r, quien))
      })
      const { data: enviadas } = await admin
        .from('solicitudes_sala')
        .select(campos)
        .eq('solicitante_email', quien.email)
        .gt('creado', new Date(Date.now() - 30 * 24 * 3600_000).toISOString())
        .order('creado', { ascending: false })
        .limit(20)
      return { recibidas, enviadas: enviadas ?? [] }
    }

    case 'responder': {
      const id = typeof cuerpo.id === 'string' && /^[0-9a-f-]{36}$/i.test(cuerpo.id) ? cuerpo.id : null
      if (!id) throw new ErrorSalas('Solicitud no válida')
      const { data: s } = await admin.from('solicitudes_sala').select('*').eq('id', id).maybeSingle()
      if (!s || s.estado !== 'pendiente') throw new ErrorSalas('Esa solicitud ya no está pendiente')
      const objetivo = await leerReservacion(s.reservacion_id, quien)
      if (Date.parse(objetivo.inicio) < Date.now()) throw new ErrorSalas('Esa reunión ya empezó; la solicitud venció')
      const sala = await leerSala(objetivo.sala_id)
      const aceptar = cuerpo.aceptar === true
      const respuesta = texto(cuerpo.respuesta, 500)
      const solicitante: Persona = { id: s.solicitante_id, email: s.solicitante_email, nombre: s.solicitante_nombre, es_admin: false, admin_salas: false, externo: false }
      const d = s.datos as { motivo: string; personas: number; invitados: string[]; notas: string; responsable_nombre: string; responsable_email: string }
      let nueva: Reservacion | null = null
      if (aceptar) {
        // Se libera el horario y se reserva para quien lo pidió; si eso falla, se reactiva la original.
        const razon = `${quien.nombre || quien.email} cedió el horario a ${solicitante.nombre || solicitante.email}.${respuesta ? ` ${respuesta}` : ''}`
        await admin.from('reservaciones').update({ estado: 'cancelada', actualizado: new Date().toISOString() }).eq('id', objetivo.id)
        try {
          const creada = await crearReservacion(
            { sala, inicio: new Date(objetivo.inicio), fin: new Date(objetivo.fin), motivo: d.motivo, personas: d.personas, invitados: d.invitados, notas: d.notas, responsable: { nombre: d.responsable_nombre, email: d.responsable_email }, reemplaza: objetivo },
            solicitante,
            urlApp,
          )
          nueva = creada.reservacion
        } catch (e) {
          await admin.from('reservaciones').update({ estado: 'activa' }).eq('id', objetivo.id)
          throw e
        }
        if (usaOutlook(sala) && objetivo.outlook_event_id) {
          await cancelarEnOutlook(objetivo.outlook_event_id, comentarioCancelacion(resumen(objetivo, sala), razon)).catch((e) => console.error(e))
        }
        await historial(objetivo, 'cedida', quien, { a: solicitante.email, nueva: nueva.codigo, respuesta })
        await registrar(quien, 'sala_cancelada', sala, objetivo)
        await admin.from('solicitudes_sala').update({ estado: 'cancelada', respondido: new Date().toISOString() }).eq('reservacion_id', objetivo.id).eq('estado', 'pendiente').neq('id', id)
      } else {
        await historial(objetivo, 'solicitud_rechazada', quien, { de: solicitante.email, respuesta })
      }
      await admin.from('solicitudes_sala').update({ estado: aceptar ? 'aceptada' : 'rechazada', respuesta: respuesta || null, respondido_por: quien.email, respondido: new Date().toISOString() }).eq('id', id)
      const aviso = correoRespuesta(resumen(objetivo, sala), aceptar, quien.nombre || quien.email, respuesta, urlApp)
      const avisado = await enviarCorreo([solicitante.email], aviso.asunto, aviso.html)
      return { ok: true, nueva, avisado }
    }

    case 'cancelar_solicitud': {
      const id = typeof cuerpo.id === 'string' && /^[0-9a-f-]{36}$/i.test(cuerpo.id) ? cuerpo.id : null
      if (!id) throw new ErrorSalas('Solicitud no válida')
      const { data, error } = await admin.from('solicitudes_sala').update({ estado: 'cancelada', respondido: new Date().toISOString() }).eq('id', id).eq('estado', 'pendiente').eq('solicitante_email', quien.email).select('id')
      if (error) throw error
      if (!data?.length) throw new ErrorSalas('Esa solicitud ya no está pendiente')
      return { ok: true }
    }

    // ───── Historial ─────
    case 'historial': {
      if (cuerpo.reservacion_id) {
        const { data: r } = await admin.from('reservaciones').select('*').eq('id', String(cuerpo.reservacion_id)).maybeSingle()
        if (!r || (!quien.admin_salas && !esDueno(r as Reservacion, quien))) throw new ErrorSalas('No puedes ver ese historial', 403)
        const { data } = await admin.from('salas_historial').select('*').eq('reservacion_id', r.id).order('creado')
        return { historial: data ?? [] }
      }
      exigirAdminSalas(quien)
      const { data, error } = await admin
        .from('salas_historial')
        .select('*, reservaciones(codigo, sala_id, motivo, inicio, fin, estado, origen, empresa)')
        .order('creado', { ascending: false })
        .limit(150)
      if (error) throw error
      return { historial: data ?? [] }
    }

    // ───── Acceso para externos (administradores de salas) ─────
    case 'acceso_estado': {
      exigirAdminSalas(quien)
      const { data } = await admin.from('salas_acceso').select('sala_id, codigo, activo, actualizado')
      return { acceso: data ?? [] }
    }

    case 'acceso_cambiar': {
      exigirAdminSalas(quien)
      const sala = await leerSala(cuerpo.sala_id)
      const cambios: Record<string, unknown> = { actualizado: new Date().toISOString() }
      if (cuerpo.nuevo_codigo === true) {
        const letras = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
        cambios.codigo = Array.from(crypto.getRandomValues(new Uint8Array(8)), (n) => letras[n % 32]).join('')
      }
      if (typeof cuerpo.activo === 'boolean') cambios.activo = cuerpo.activo
      const { data, error } = await admin.from('salas_acceso').update(cambios).eq('sala_id', sala.id).select('sala_id')
      if (error) throw error
      if (!data?.length) throw new ErrorSalas('Esa sala no tiene acceso para externos; recarga la página')
      return { ok: true }
    }

    // ───── Conexión con Outlook (solo administrador de la plataforma) ─────
    case 'outlook_estado': {
      exigirAdmin(quien)
      const { data: conexion } = await admin.from('outlook_conexion').select('cuenta, actualizado').eq('id', 1).maybeSingle()
      const { data: salas } = await admin.from('salas').select('id, nombre, calendario_id, calendario_nombre').order('orden')
      let calendarios: { id: string; nombre: string }[] = []
      let aviso: string | null = null
      let correoActivo = false
      if (conexion && outlookConfigurado) {
        try {
          const r = await graph('/me/calendars?$select=id,name&$top=100')
          if (!r.ok) throw new Error(`Outlook (${r.status}): ${await r.text()}`)
          calendarios = (await r.json()).value.map((c: { id: string; name: string }) => ({ id: c.id, nombre: c.name }))
        } catch (e) {
          console.error(e)
          aviso = 'La conexión con Outlook dejó de funcionar. Vuelve a conectar la cuenta.'
        }
        correoActivo = await tokenDe('mail').then(
          () => true,
          () => false,
        )
      }
      const { data: ics } = await admin.from('salas_ics').select('sala_id, token, publicado')
      const enlaces = (ics ?? []).map((x) => ({ sala_id: x.sala_id, feed: `${BASE_FEED}/${x.token}.ics`, publicado: x.publicado }))
      return { configurado: outlookConfigurado, conexion, calendarios, salas, aviso, ics: enlaces, correo: correoActivo }
    }

    case 'ics_publicado': {
      exigirAdmin(quien)
      const sala = await leerSala(cuerpo.sala_id)
      const url = typeof cuerpo.url === 'string' ? cuerpo.url.trim().replace(/^webcals?:\/\//i, 'https://') : ''
      let proximos = 0
      if (url) {
        if (!/^https:\/\/\S+$/.test(url) || url.length > 2000) throw new ErrorSalas('Pega el enlace ICS completo (empieza con https://)')
        try {
          const texto = await leerPublicado(url, true)
          const ahora = new Date()
          proximos = ocupadosDeIcs(texto, ahora, new Date(ahora.getTime() + DIAS_ADELANTE * 24 * 3600_000)).length
        } catch (e) {
          console.error(e)
          throw new ErrorSalas(`No se pudo leer ese enlace: ${e instanceof Error ? e.message : e}. Revisa que sea el enlace ICS (no el HTML).`)
        }
      }
      const { error } = await admin.from('salas_ics').upsert({ sala_id: sala.id, publicado: url || null, actualizado: new Date().toISOString() })
      if (error) throw error
      return { ok: true, proximos }
    }

    case 'ics_regenerar': {
      exigirAdmin(quien)
      const sala = await leerSala(cuerpo.sala_id)
      const { error } = await admin.from('salas_ics').upsert({ sala_id: sala.id, token: crypto.randomUUID(), actualizado: new Date().toISOString() })
      if (error) throw error
      return { ok: true }
    }

    case 'outlook_iniciar': {
      exigirAdmin(quien)
      if (!outlookConfigurado) throw new ErrorSalas('Faltan MS_CLIENT_ID y MS_CLIENT_SECRET en los secretos de Supabase')
      const volver = typeof cuerpo.volver === 'string' ? cuerpo.volver : ''
      if (!/^https?:\/\/[^\s#]+$/.test(volver)) throw new ErrorSalas('Dirección de regreso no válida')
      const estado = crypto.randomUUID()
      await admin.from('outlook_oauth_estados').delete().lt('creado', new Date(Date.now() - 3600_000).toISOString())
      const { error } = await admin.from('outlook_oauth_estados').insert({ estado, volver })
      if (error) throw error
      const q = new URLSearchParams({ client_id: MS.cliente!, response_type: 'code', redirect_uri: REDIRECCION, response_mode: 'query', scope: PERMISOS_CONECTAR, state: estado, prompt: 'select_account' })
      return { url: `${LOGIN}/authorize?${q}` }
    }

    case 'outlook_asignar': {
      exigirAdmin(quien)
      const sala = await leerSala(cuerpo.sala_id)
      const calendarioId = typeof cuerpo.calendario_id === 'string' && cuerpo.calendario_id ? cuerpo.calendario_id : null
      const nombre = typeof cuerpo.calendario_nombre === 'string' ? cuerpo.calendario_nombre.slice(0, 200) : null
      const { error } = await admin.from('salas').update({ calendario_id: calendarioId, calendario_nombre: calendarioId ? nombre : null }).eq('id', sala.id)
      if (error) throw error
      return { ok: true }
    }

    case 'outlook_desconectar': {
      exigirAdmin(quien)
      await admin.from('outlook_conexion').delete().eq('id', 1)
      await admin.from('salas').update({ calendario_id: null, calendario_nombre: null }).neq('id', '')
      tokens.cal = null
      tokens.mail = null
      return { ok: true }
    }

    default:
      throw new ErrorSalas('Acción no válida')
  }
}

/** Calendario .ics de una sala (enlace secreto) para suscribirlo en Outlook, Google o Apple. */
async function feedDeSala(token: string): Promise<Response> {
  const { data: ics } = await admin.from('salas_ics').select('sala_id').eq('token', token).maybeSingle()
  if (!ics) return new Response('Calendario no encontrado', { status: 404 })
  const { data: sala } = await admin.from('salas').select('nombre').eq('id', ics.sala_id).maybeSingle()
  const { data: reservas, error } = await admin
    .from('reservaciones')
    .select('*')
    .eq('sala_id', ics.sala_id)
    .eq('estado', 'activa')
    .gte('fin', new Date(Date.now() - 30 * 24 * 3600_000).toISOString())
    .order('inicio')
    .limit(1000)
  if (error) throw error
  const nombre = sala?.nombre ?? 'Sala'
  const texto = generarFeed(
    `${nombre} · Treve`,
    (reservas as Reservacion[]).map((r) => ({
      id: r.id,
      codigo: r.codigo,
      inicio: r.inicio,
      fin: r.fin,
      titulo: `${r.motivo} · ${responsable(r).nombre || responsable(r).email}`,
      descripcion: [
        `Reserva: ${responsable(r).nombre} (${responsable(r).email})${r.empresa ? ` · ${r.empresa}` : ''}`,
        `Personas: ${r.personas}`,
        r.invitados.length ? `Invitados: ${r.invitados.join(', ')}` : '',
        r.notas ? `Notas: ${r.notas}` : '',
        `Código: ${r.codigo}`,
      ]
        .filter(Boolean)
        .join('\n'),
      lugar: nombre,
      actualizado: r.actualizado ?? r.inicio,
    })),
  )
  return new Response(texto, {
    headers: { 'Content-Type': 'text/calendar; charset=utf-8', 'Content-Disposition': `inline; filename="sala.ics"`, 'Cache-Control': 'no-cache, max-age=0' },
  })
}

/** Dirección pública de los calendarios .ics: …/functions/v1/salas/ics/<token>.ics */
const BASE_FEED = `${Deno.env.get('SUPABASE_URL')}/functions/v1/salas/ics`

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method === 'GET' || req.method === 'HEAD') {
    const url = new URL(req.url)
    const feed = url.pathname.match(/\/ics\/([0-9a-f-]{36})\.ics$/i)
    if (feed) return feedDeSala(feed[1].toLowerCase()).catch((e) => (console.error(e), new Response('Error interno', { status: 500 })))
    if (url.searchParams.has('state')) return terminarConexion(url).catch((e) => (console.error(e), new Response('Error interno', { status: 500 })))
  }
  if (req.method !== 'POST') return responder({ error: 'Método no permitido' }, 405)
  try {
    return responder(await manejar(req))
  } catch (e) {
    if (e instanceof ErrorSalas) return responder({ error: e.message }, e.estado)
    console.error(e)
    return responder({ error: 'Error interno' }, 500)
  }
})
