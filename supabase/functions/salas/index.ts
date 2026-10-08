// Reservación de salas: valida horario y permisos, evita choques (la base de datos no permite
// reservaciones encimadas) y copia cada reservación al calendario Outlook de la sala.
// Sin las credenciales de Microsoft (MS_TENANT_ID, MS_CLIENT_ID, MS_CLIENT_SECRET) funciona solo en la app.
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
  buzon: string | null
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

// ───── Microsoft Graph (Outlook) ─────

const MS = {
  tenant: Deno.env.get('MS_TENANT_ID'),
  cliente: Deno.env.get('MS_CLIENT_ID'),
  secreto: Deno.env.get('MS_CLIENT_SECRET'),
}
const outlookConfigurado = Boolean(MS.tenant && MS.cliente && MS.secreto)
let tokenGraph: { valor: string; vence: number } | null = null

async function graph(ruta: string, init: RequestInit = {}): Promise<Response> {
  if (!tokenGraph || tokenGraph.vence < Date.now() + 60_000) {
    const r = await fetch(`https://login.microsoftonline.com/${MS.tenant}/oauth2/v2.0/token`, {
      method: 'POST',
      body: new URLSearchParams({ client_id: MS.cliente!, client_secret: MS.secreto!, scope: 'https://graph.microsoft.com/.default', grant_type: 'client_credentials' }),
    })
    const j = await r.json()
    if (!r.ok) throw new Error(`Microsoft no dio acceso: ${j.error_description ?? j.error ?? r.status}`)
    tokenGraph = { valor: j.access_token, vence: Date.now() + j.expires_in * 1000 }
  }
  return fetch(`https://graph.microsoft.com/v1.0${ruta}`, {
    ...init,
    headers: { Authorization: `Bearer ${tokenGraph.valor}`, 'Content-Type': 'application/json', Prefer: 'outlook.timezone="UTC"', ...(init.headers ?? {}) },
  })
}

const usaOutlook = (sala: Sala) => outlookConfigurado && Boolean(sala.buzon)
const utc = (d: Date) => ({ dateTime: d.toISOString().replace('Z', ''), timeZone: 'UTC' })
const desdeGraph = (t: { dateTime: string }) => new Date(t.dateTime.endsWith('Z') ? t.dateTime : `${t.dateTime}Z`)

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
  const r = await graph(`/users/${encodeURIComponent(sala.buzon!)}/calendarView?${q}`)
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
  const ruta = `/users/${encodeURIComponent(sala.buzon!)}/events`
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
  const { data } = await admin.from('salas').select('id, nombre, buzon').eq('id', id).eq('activa', true).maybeSingle()
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
          const res = await graph(`/users/${encodeURIComponent(sala.buzon!)}/events/${anterior.outlook_event_id}`, {
            method: 'PATCH',
            body: JSON.stringify({ start: utc(inicio), end: utc(fin) }),
          })
          if (!res.ok) throw new Error(`Outlook (${res.status}): ${await res.text()}`)
          await guardarSync(r.id, { sync_error: null })
        } else {
          if (usaOutlook(salaAnterior) && anterior.outlook_event_id) await cancelarEnOutlook(salaAnterior, anterior.outlook_event_id, 'La reunión se cambió de sala.')
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
          await cancelarEnOutlook(sala, r.outlook_event_id, 'Reservación cancelada desde la app de Treve.')
        } catch (e) {
          console.error(e)
          await guardarSync(r.id, { sync_error: String(e).slice(0, 500) })
        }
      }
      await registrar(quien, 'sala_cancelada', sala, r)
      return { ok: true }
    }

    default:
      throw new ErrorSalas('Acción no válida')
  }
}

/** Cancela el evento (avisa a los invitados); si no se puede, lo borra. */
async function cancelarEnOutlook(sala: Sala, eventoId: string, comentario: string) {
  const ruta = `/users/${encodeURIComponent(sala.buzon!)}/events/${eventoId}`
  let res = await graph(`${ruta}/cancel`, { method: 'POST', body: JSON.stringify({ Comment: comentario }) })
  if (!res.ok && res.status !== 404) res = await graph(ruta, { method: 'DELETE' })
  if (!res.ok && res.status !== 404) throw new Error(`Outlook (${res.status}): ${await res.text()}`)
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return responder({ error: 'Método no permitido' }, 405)
  try {
    return responder(await manejar(req))
  } catch (e) {
    if (e instanceof ErrorSalas) return responder({ error: e.message }, e.estado)
    console.error(e)
    return responder({ error: 'Error interno' }, 500)
  }
})
