// Reservación de salas: valida horario y permisos, evita choques (la base de datos no permite
// reservaciones encimadas) y copia cada reservación al calendario Outlook de la sala.
// Outlook es una cuenta personal (outlook.live.com): el administrador la conecta una vez (OAuth) y elige
// qué calendario es cada sala. Sin MS_CLIENT_ID / MS_CLIENT_SECRET o sin conexión funciona solo en la app.
import { createClient } from 'npm:@supabase/supabase-js@2.117.1'

const ZONA = 'America/Mexico_City'
const HORA_INICIO = 7 // 7:00 a.m.
const HORA_FIN = 21 // 9:00 p.m.
const DIAS_ADELANTE = 30
const PASO_MIN = 15

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

interface Persona {
  id: string
  email: string
  nombre: string
  es_admin: boolean
}

interface Sala {
  id: string
  nombre: string
  calendario_id: string | null
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
}

/** Quién llama: con sesión, activo y con permiso de salas (o administrador). */
async function exigirPersona(req: Request): Promise<Persona> {
  const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '')
  if (!token) throw new ErrorSalas('Inicia sesión', 401)
  const { data, error } = await admin.auth.getUser(token)
  if (error || !data.user) throw new ErrorSalas('Sesión no válida', 401)
  const { data: perfil } = await admin.from('perfiles').select('email, nombre, es_admin, activo, secciones').eq('id', data.user.id).maybeSingle()
  if (!perfil?.activo || !(perfil.es_admin || perfil.secciones.includes('salas'))) throw new ErrorSalas('No tienes acceso a Salas', 403)
  return { id: data.user.id, email: perfil.email, nombre: perfil.nombre, es_admin: perfil.es_admin }
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

function validarHorario(inicioTxt: unknown, finTxt: unknown): [Date, Date] {
  if (typeof inicioTxt !== 'string' || typeof finTxt !== 'string') throw new ErrorSalas('Falta el horario')
  const inicio = new Date(inicioTxt)
  const fin = new Date(finTxt)
  if (Number.isNaN(inicio.getTime()) || Number.isNaN(fin.getTime())) throw new ErrorSalas('Horario no válido')
  const duracion = (fin.getTime() - inicio.getTime()) / 60_000
  if (duracion < PASO_MIN || duracion > 8 * 60) throw new ErrorSalas('La duración debe ser de 15 minutos a 8 horas')
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

function textoHorario(inicio: Date, fin: Date) {
  const f = (d: Date, o: Intl.DateTimeFormatOptions) => d.toLocaleString('es-MX', { timeZone: ZONA, ...o })
  return `${f(inicio, { weekday: 'short', day: 'numeric', month: 'short' })} ${f(inicio, { hour: 'numeric', minute: '2-digit' })}–${f(fin, { hour: 'numeric', minute: '2-digit' })}`
}

// ───── Microsoft Graph (Outlook personal) ─────

const MS = { cliente: Deno.env.get('MS_CLIENT_ID'), secreto: Deno.env.get('MS_CLIENT_SECRET') }
const outlookConfigurado = Boolean(MS.cliente && MS.secreto)
const LOGIN = 'https://login.microsoftonline.com/consumers/oauth2/v2.0'
const PERMISOS_MS = 'offline_access User.Read Calendars.ReadWrite'
/** A donde regresa Microsoft después de conectar: esta misma función. */
const REDIRECCION = `${Deno.env.get('SUPABASE_URL')}/functions/v1/salas`
let tokenGraph: { valor: string; vence: number } | null = null

async function pedirToken(parametros: Record<string, string>) {
  const r = await fetch(`${LOGIN}/token`, {
    method: 'POST',
    body: new URLSearchParams({ client_id: MS.cliente!, client_secret: MS.secreto!, scope: PERMISOS_MS, ...parametros }),
  })
  const j = await r.json()
  if (!r.ok) throw new Error(`Microsoft no dio acceso: ${j.error_description ?? j.error ?? r.status}`)
  return j as { access_token: string; refresh_token?: string; expires_in: number }
}

async function graph(ruta: string, init: RequestInit = {}): Promise<Response> {
  if (!tokenGraph || tokenGraph.vence < Date.now() + 60_000) {
    const { data: conexion } = await admin.from('outlook_conexion').select('refresh_token').eq('id', 1).maybeSingle()
    if (!conexion) throw new Error('Outlook no está conectado')
    const j = await pedirToken({ grant_type: 'refresh_token', refresh_token: conexion.refresh_token })
    // Microsoft cambia el refresh token en cada uso: se guarda el nuevo.
    if (j.refresh_token) await admin.from('outlook_conexion').update({ refresh_token: j.refresh_token, actualizado: new Date().toISOString() }).eq('id', 1)
    tokenGraph = { valor: j.access_token, vence: Date.now() + j.expires_in * 1000 }
  }
  return fetch(`https://graph.microsoft.com/v1.0${ruta}`, {
    ...init,
    headers: { Authorization: `Bearer ${tokenGraph.valor}`, 'Content-Type': 'application/json', Prefer: 'outlook.timezone="UTC"', ...(init.headers ?? {}) },
  })
}

const usaOutlook = (sala: Sala) => outlookConfigurado && Boolean(sala.calendario_id)
const calendario = (sala: Sala) => `/me/calendars/${encodeURIComponent(sala.calendario_id!)}`
const utc = (d: Date) => ({ dateTime: d.toISOString().replace('Z', ''), timeZone: 'UTC' })
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
    const j = await pedirToken({ grant_type: 'authorization_code', code: codigo, redirect_uri: REDIRECCION })
    if (!j.refresh_token) throw new Error('Microsoft no dio permiso permanente (offline_access)')
    const yo = await fetch('https://graph.microsoft.com/v1.0/me', { headers: { Authorization: `Bearer ${j.access_token}` } }).then((r) => r.json())
    const cuenta = yo.mail ?? yo.userPrincipalName ?? 'cuenta de Outlook'
    const { error } = await admin.from('outlook_conexion').upsert({ id: 1, cuenta, refresh_token: j.refresh_token, actualizado: new Date().toISOString() })
    if (error) throw error
    tokenGraph = { valor: j.access_token, vence: Date.now() + j.expires_in * 1000 }
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
  reservacion_id?: string
}

/** Eventos del calendario Outlook de la sala que no salieron de la app (reservas directas en Outlook). */
async function ocupadoEnOutlook(sala: Sala, desde: Date, hasta: Date, propios: Set<string>): Promise<Ocupado[]> {
  if (!usaOutlook(sala)) return []
  const q = new URLSearchParams({ startDateTime: desde.toISOString(), endDateTime: hasta.toISOString(), $select: 'id,subject,start,end,showAs,isCancelled', $top: '200' })
  const r = await graph(`${calendario(sala)}/calendarView?${q}`)
  if (!r.ok) throw new Error(`No se pudo leer el calendario de Outlook (${r.status}): ${await r.text()}`)
  const j = await r.json()
  return (j.value as { id: string; start: { dateTime: string }; end: { dateTime: string }; showAs: string; isCancelled: boolean }[])
    .filter((e) => !propios.has(e.id) && !e.isCancelled && e.showAs !== 'free')
    .map((e) => ({ inicio: desdeGraph(e.start).toISOString(), fin: desdeGraph(e.end).toISOString(), titulo: 'Ocupado en Outlook' }))
}

function eventoOutlook(r: Reservacion, sala: Sala, conInvitados: boolean) {
  const asistentes = [...new Set([r.creado_por_email, ...r.invitados])]
  return {
    subject: `${r.motivo} · ${r.creado_por_nombre || r.creado_por_email}`,
    body: {
      contentType: 'text',
      content: `Reservado desde la app de Treve por ${r.creado_por_nombre || r.creado_por_email} (${r.creado_por_email}).\nPersonas: ${r.personas}\nCódigo: ${r.codigo}`,
    },
    start: utc(new Date(r.inicio)),
    end: utc(new Date(r.fin)),
    location: { displayName: sala.nombre },
    showAs: 'busy',
    transactionId: r.id,
    ...(conInvitados ? { attendees: asistentes.map((address) => ({ emailAddress: { address }, type: 'required' })) } : {}),
  }
}

/** Crea el evento en Outlook; si Outlook rechaza las invitaciones, lo crea sin invitados. */
async function crearEnOutlook(r: Reservacion, sala: Sala): Promise<string> {
  const ruta = `${calendario(sala)}/events`
  let res = await graph(ruta, { method: 'POST', body: JSON.stringify(eventoOutlook(r, sala, true)) })
  if (!res.ok && res.status < 500) res = await graph(ruta, { method: 'POST', body: JSON.stringify(eventoOutlook(r, sala, false)) })
  if (!res.ok) throw new Error(`Outlook (${res.status}): ${await res.text()}`)
  return (await res.json()).id
}

async function guardarSync(id: string, cambios: { outlook_event_id?: string | null; sync_error: string | null }) {
  await admin.from('reservaciones').update(cambios).eq('id', id)
}

async function registrar(quien: Persona, accion: string, sala: Sala, r: Reservacion) {
  const { error } = await admin.from('bitacora').insert({
    usuario_id: quien.id,
    email: quien.email,
    accion,
    plantilla: 'salas',
    documento: `${sala.nombre} · ${textoHorario(new Date(r.inicio), new Date(r.fin))} · ${r.codigo}`,
    detalle: { codigo: r.codigo, motivo: r.motivo, reservo: r.creado_por_email, inicio: r.inicio, fin: r.fin },
  })
  if (error) console.error('bitácora', error)
}

// ───── Acciones ─────

async function leerSala(id: unknown): Promise<Sala> {
  if (typeof id !== 'string') throw new ErrorSalas('Falta la sala')
  const { data } = await admin.from('salas').select('id, nombre, calendario_id').eq('id', id).eq('activa', true).maybeSingle()
  if (!data) throw new ErrorSalas('Esa sala no existe')
  return data
}

async function leerReservacion(id: unknown, quien: Persona): Promise<Reservacion> {
  if (typeof id !== 'string' || !/^[0-9a-f-]{36}$/i.test(id)) throw new ErrorSalas('Reservación no válida')
  const { data } = await admin.from('reservaciones').select('*').eq('id', id).maybeSingle()
  if (!data || data.estado !== 'activa') throw new ErrorSalas('Esa reservación ya no está activa', 404)
  if (data.creado_por !== quien.id && !quien.es_admin) throw new ErrorSalas('Solo quien reservó (o el administrador) puede cambiarla', 403)
  return data
}

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
  return data
}

/** Revisa que Outlook no tenga algo encimado (la base de datos ya cuida las reservas de la app). */
async function revisarOutlook(sala: Sala, inicio: Date, fin: Date, ignorar?: string | null) {
  const propios = new Set((await reservasActivas(sala.id, inicio, fin)).map((r) => r.outlook_event_id).filter(Boolean) as string[])
  if (ignorar) propios.add(ignorar)
  const choques = await ocupadoEnOutlook(sala, inicio, fin, propios)
  if (choques.length) throw new ErrorSalas('Ese horario ya está ocupado en el calendario de Outlook de la sala', 409)
}

function exigirAdmin(quien: Persona) {
  if (!quien.es_admin) throw new ErrorSalas('Solo el administrador puede hacer esto', 403)
}

function choque(error: { code?: string } | null) {
  if (error?.code === '23P01') throw new ErrorSalas('Alguien acaba de reservar ese horario. Elige otro.', 409)
  if (error) throw error
}

async function manejar(req: Request) {
  const cuerpo = (await req.json().catch(() => ({}))) as Record<string, unknown>
  const quien = await exigirPersona(req)

  switch (cuerpo.accion) {
    case 'disponibilidad': {
      const sala = await leerSala(cuerpo.sala_id)
      const [desde, hasta] = rangoDelDia(String(cuerpo.fecha))
      const reservas = await reservasActivas(sala.id, desde, hasta)
      let outlook: Ocupado[] = []
      let aviso: string | null = null
      try {
        outlook = await ocupadoEnOutlook(sala, desde, hasta, new Set(reservas.map((r) => r.outlook_event_id).filter(Boolean) as string[]))
      } catch (e) {
        console.error(e)
        aviso = 'No se pudo consultar Outlook; se muestran solo las reservaciones de la app.'
      }
      return { reservaciones: reservas, outlook, outlook_activo: usaOutlook(sala), aviso }
    }

    case 'reservar': {
      const sala = await leerSala(cuerpo.sala_id)
      const [inicio, fin] = validarHorario(cuerpo.inicio, cuerpo.fin)
      const motivo = typeof cuerpo.motivo === 'string' ? cuerpo.motivo.trim().slice(0, 200) : ''
      if (!motivo) throw new ErrorSalas('Escribe el motivo de la reunión')
      const personas = Number(cuerpo.personas ?? 1)
      if (!Number.isInteger(personas) || personas < 1 || personas > 100) throw new ErrorSalas('Número de personas no válido')
      const invitados = Array.isArray(cuerpo.invitados) ? cuerpo.invitados.map((x) => String(x).trim().toLowerCase()).filter(Boolean) : []
      if (invitados.length > 30 || invitados.some((x) => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(x))) throw new ErrorSalas('Revisa los correos de los invitados')
      if (usaOutlook(sala)) await revisarOutlook(sala, inicio, fin)

      const { data, error } = await admin
        .from('reservaciones')
        .insert({
          sala_id: sala.id,
          inicio: inicio.toISOString(),
          fin: fin.toISOString(),
          motivo,
          personas,
          invitados: [...new Set(invitados)],
          creado_por: quien.id,
          creado_por_email: quien.email,
          creado_por_nombre: quien.nombre,
        })
        .select('*')
        .single()
      choque(error)
      const r = data as Reservacion
      if (usaOutlook(sala)) {
        try {
          r.outlook_event_id = await crearEnOutlook(r, sala)
          await guardarSync(r.id, { outlook_event_id: r.outlook_event_id, sync_error: null })
        } catch (e) {
          console.error(e)
          await guardarSync(r.id, { sync_error: String(e).slice(0, 500) })
        }
      }
      await registrar(quien, 'sala_reservada', sala, r)
      return { reservacion: r }
    }

    case 'mover': {
      const anterior = await leerReservacion(cuerpo.id, quien)
      const sala = await leerSala(cuerpo.sala_id ?? anterior.sala_id)
      const [inicio, fin] = validarHorario(cuerpo.inicio, cuerpo.fin)
      const mismaSala = sala.id === anterior.sala_id
      if (usaOutlook(sala)) await revisarOutlook(sala, inicio, fin, mismaSala ? anterior.outlook_event_id : null)
      const { data, error } = await admin
        .from('reservaciones')
        .update({ sala_id: sala.id, inicio: inicio.toISOString(), fin: fin.toISOString(), actualizado: new Date().toISOString() })
        .eq('id', anterior.id)
        .select('*')
        .single()
      choque(error)
      const r = data as Reservacion
      // Misma sala: se mueve el mismo evento de Outlook. Otra sala: se cancela el anterior y se crea uno nuevo.
      try {
        const salaAnterior = mismaSala ? sala : await leerSala(anterior.sala_id)
        if (mismaSala && usaOutlook(sala) && anterior.outlook_event_id) {
          const res = await graph(`/me/events/${encodeURIComponent(anterior.outlook_event_id)}`, {
            method: 'PATCH',
            body: JSON.stringify({ start: utc(inicio), end: utc(fin) }),
          })
          if (!res.ok) throw new Error(`Outlook (${res.status}): ${await res.text()}`)
          await guardarSync(r.id, { sync_error: null })
        } else {
          if (usaOutlook(salaAnterior) && anterior.outlook_event_id) await cancelarEnOutlook(anterior.outlook_event_id, 'La reunión se cambió de sala.')
          if (usaOutlook(sala)) {
            r.outlook_event_id = await crearEnOutlook(r, sala)
            await guardarSync(r.id, { outlook_event_id: r.outlook_event_id, sync_error: null })
          } else await guardarSync(r.id, { outlook_event_id: null, sync_error: null })
        }
      } catch (e) {
        console.error(e)
        await guardarSync(r.id, { sync_error: String(e).slice(0, 500) })
      }
      await registrar(quien, 'sala_movida', sala, r)
      return { reservacion: r }
    }

    case 'cancelar': {
      const r = await leerReservacion(cuerpo.id, quien)
      const sala = await leerSala(r.sala_id)
      const { error } = await admin.from('reservaciones').update({ estado: 'cancelada', actualizado: new Date().toISOString() }).eq('id', r.id)
      if (error) throw error
      if (usaOutlook(sala) && r.outlook_event_id) {
        try {
          await cancelarEnOutlook(r.outlook_event_id, 'Reservación cancelada desde la app de Treve.')
        } catch (e) {
          console.error(e)
          await guardarSync(r.id, { sync_error: String(e).slice(0, 500) })
        }
      }
      await registrar(quien, 'sala_cancelada', sala, r)
      return { ok: true }
    }

    // ───── Conexión con Outlook (solo administrador) ─────
    case 'outlook_estado': {
      exigirAdmin(quien)
      const { data: conexion } = await admin.from('outlook_conexion').select('cuenta, actualizado').eq('id', 1).maybeSingle()
      const { data: salas } = await admin.from('salas').select('id, nombre, calendario_id, calendario_nombre').order('orden')
      let calendarios: { id: string; nombre: string }[] = []
      let aviso: string | null = null
      if (conexion && outlookConfigurado) {
        try {
          const r = await graph('/me/calendars?$select=id,name&$top=100')
          if (!r.ok) throw new Error(`Outlook (${r.status}): ${await r.text()}`)
          calendarios = (await r.json()).value.map((c: { id: string; name: string }) => ({ id: c.id, nombre: c.name }))
        } catch (e) {
          console.error(e)
          aviso = 'La conexión con Outlook dejó de funcionar. Vuelve a conectar la cuenta.'
        }
      }
      return { configurado: outlookConfigurado, conexion, calendarios, salas, aviso }
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
      const q = new URLSearchParams({ client_id: MS.cliente!, response_type: 'code', redirect_uri: REDIRECCION, response_mode: 'query', scope: PERMISOS_MS, state: estado, prompt: 'select_account' })
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
      tokenGraph = null
      return { ok: true }
    }

    default:
      throw new ErrorSalas('Acción no válida')
  }
}

/** Cancela el evento (avisa a los invitados); si no se puede, lo borra. */
async function cancelarEnOutlook(eventoId: string, comentario: string) {
  const ruta = `/me/events/${encodeURIComponent(eventoId)}`
  let res = await graph(`${ruta}/cancel`, { method: 'POST', body: JSON.stringify({ Comment: comentario }) })
  if (!res.ok && res.status !== 404) res = await graph(ruta, { method: 'DELETE' })
  if (!res.ok && res.status !== 404) throw new Error(`Outlook (${res.status}): ${await res.text()}`)
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method === 'GET') {
    const url = new URL(req.url)
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
