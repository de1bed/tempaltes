// Calendarios .ics sin Azure:
// - generarFeed: el calendario de una sala con las reservaciones de la app, para suscribirlo en Outlook.
// - ocupadosDeIcs: lee el calendario de la sala que Outlook publica (enlace ICS) para saber qué está ocupado.
import ICAL from 'ical.js'
import { ZONA } from './zona.ts'

export interface EventoFeed {
  id: string
  codigo: string
  inicio: string
  fin: string
  titulo: string
  descripcion: string
  lugar: string
  actualizado: string
  url?: string
}

export interface Bloque {
  inicio: string
  fin: string
}

/** Sufijo del UID de los eventos que salen de la app (para no contarlos dos veces). */
export const DOMINIO_UID = 'salas.treve'

const escapar = (s: string) => s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n')
const fechaIcsUtc = (iso: string) => new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')

const formato = new Intl.DateTimeFormat('en-US', {
  timeZone: ZONA,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
})

function partesDe(fecha: Date) {
  const p = Object.fromEntries(formato.formatToParts(fecha).map((x) => [x.type, x.value]))
  if (p.hour === '24') p.hour = '00'
  return p
}

/** Reloj de pared local para ICS DTSTART/DTEND con TZID (sin Z). */
export function icsLocal(iso: string): string {
  const p = partesDe(new Date(iso))
  return `${p.year}${p.month}${p.day}T${p.hour}${p.minute}${p.second || '00'}`
}

/** Reloj de pared RFC3339 sin offset: Graph + IANA TZID, para que Outlook no asuma Ciudad de México. */
export function rfc3339Local(iso: string): string {
  const p = partesDe(new Date(iso))
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second || '00'}`
}

export function horaGraph(d: Date | string) {
  const iso = typeof d === 'string' ? d : d.toISOString()
  return { dateTime: rfc3339Local(iso), timeZone: ZONA }
}

export function lugarConEnlace(sala: string, enlace?: string | null) {
  const link = enlace?.trim()
  return link ? `${sala} | ${link}` : sala
}

/**
 * America/Tijuana sigue el DST del Pacífico de EE. UU. (excepción fronteriza después de que
 * México abolió el DST en 2022). Outlook necesita este bloque o puede asumir Ciudad de México.
 */
function vtimezoneTijuana() {
  return [
    'BEGIN:VTIMEZONE',
    `TZID:${ZONA}`,
    `X-LIC-LOCATION:${ZONA}`,
    'BEGIN:DAYLIGHT',
    'TZOFFSETFROM:-0800',
    'TZOFFSETTO:-0700',
    'TZNAME:PDT',
    'DTSTART:19700308T020000',
    'RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=2SU',
    'END:DAYLIGHT',
    'BEGIN:STANDARD',
    'TZOFFSETFROM:-0700',
    'TZOFFSETTO:-0800',
    'TZNAME:PST',
    'DTSTART:19701101T020000',
    'RRULE:FREQ=YEARLY;BYMONTH=11;BYDAY=1SU',
    'END:STANDARD',
    'END:VTIMEZONE',
  ]
}

/** Corta las líneas a 75 bytes (RFC 5545) sin partir caracteres UTF-8. */
function plegar(linea: string): string {
  const bytes = new TextEncoder()
  const partes: string[] = []
  let actual = ''
  let tam = 0
  for (const c of linea) {
    const n = bytes.encode(c).length
    if (tam + n > (partes.length ? 74 : 75)) {
      partes.push(actual)
      actual = ''
      tam = 0
    }
    actual += c
    tam += n
  }
  partes.push(actual)
  return partes.join('\r\n ')
}

export function generarFeed(nombre: string, eventos: EventoFeed[], ahora = new Date()): string {
  const sello = fechaIcsUtc(ahora.toISOString())
  const lineas = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Treve//Salas//ES',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapar(nombre)}`,
    `X-WR-TIMEZONE:${ZONA}`,
    'REFRESH-INTERVAL;VALUE=DURATION:PT15M',
    'X-PUBLISHED-TTL:PT15M',
    ...vtimezoneTijuana(),
  ]
  for (const e of eventos) {
    lineas.push(
      'BEGIN:VEVENT',
      `UID:${e.id}@${DOMINIO_UID}`,
      `DTSTAMP:${sello}`,
      `LAST-MODIFIED:${fechaIcsUtc(e.actualizado)}`,
      `DTSTART;TZID=${ZONA}:${icsLocal(e.inicio)}`,
      `DTEND;TZID=${ZONA}:${icsLocal(e.fin)}`,
      `SUMMARY:${escapar(e.titulo)}`,
      `LOCATION:${escapar(e.lugar)}`,
      `DESCRIPTION:${escapar(e.descripcion)}`,
    )
    if (e.url) lineas.push(`URL:${e.url}`)
    lineas.push('STATUS:CONFIRMED', 'TRANSP:OPAQUE', 'END:VEVENT')
  }
  lineas.push('END:VCALENDAR')
  return lineas.map(plegar).join('\r\n') + '\r\n'
}

/** Medianoche (hora de Tijuana) del día `YYYY-MM-DD`, en UTC. */
function medianocheLocal(dia: string): Date {
  const p = partesDe(new Date(`${dia}T12:00:00Z`))
  const desfase = Number(p.hour) * 60 + Number(p.minute) - 12 * 60
  return new Date(Date.parse(`${dia}T00:00:00Z`) - desfase * 60_000)
}

type Tiempo = InstanceType<typeof ICAL.Time>
type Componente = InstanceType<typeof ICAL.Component>

/** Fecha real de un tiempo de ical.js; los eventos de todo el día ocupan el día completo en Tijuana. */
function aFecha(t: Tiempo): Date {
  if (t.isDate) return medianocheLocal(`${t.year}-${String(t.month).padStart(2, '0')}-${String(t.day).padStart(2, '0')}`)
  return t.toJSDate()
}

/** El evento no ocupa la sala: cancelado, marcado como libre o transparente. */
function libre(c: Componente): boolean {
  const estado = String(c.getFirstPropertyValue('status') ?? '').toUpperCase()
  const transp = String(c.getFirstPropertyValue('transp') ?? '').toUpperCase()
  const ocupado = String(c.getFirstPropertyValue('x-microsoft-cdo-busystatus') ?? '').toUpperCase()
  return estado === 'CANCELLED' || transp === 'TRANSPARENT' || ocupado === 'FREE'
}

/**
 * Bloques ocupados entre `desde` y `hasta` en un calendario .ics (expande eventos que se repiten).
 * `ignorar` dice si un evento es una reservación de la app (para no contarla dos veces).
 */
export function ocupadosDeIcs(texto: string, desde: Date, hasta: Date, ignorar: (uid: string, texto: string) => boolean = () => false): Bloque[] {
  const raiz = new ICAL.Component(ICAL.parse(texto))
  for (const tz of raiz.getAllSubcomponents('vtimezone')) ICAL.TimezoneService.register(new ICAL.Timezone(tz))

  // Agrupa por UID: el evento principal y sus excepciones (una ocurrencia movida o cancelada).
  const porUid = new Map<string, { principal?: Componente; excepciones: Componente[] }>()
  for (const ev of raiz.getAllSubcomponents('vevent')) {
    const uid = String(ev.getFirstPropertyValue('uid') ?? crypto.randomUUID())
    const grupo = porUid.get(uid) ?? { excepciones: [] }
    if (ev.hasProperty('recurrence-id')) grupo.excepciones.push(ev)
    else grupo.principal = ev
    porUid.set(uid, grupo)
  }

  const bloques: Bloque[] = []
  const agregar = (c: Componente, inicio: Date, fin: Date) => {
    if (libre(c) || fin <= desde || inicio >= hasta) return
    bloques.push({ inicio: inicio.toISOString(), fin: fin.toISOString() })
  }

  for (const [uid, { principal, excepciones }] of porUid) {
    const base = principal ?? excepciones[0]
    if (!base) continue
    const textoEvento = `${base.getFirstPropertyValue('summary') ?? ''} ${base.getFirstPropertyValue('description') ?? ''}`
    if (ignorar(uid, textoEvento)) continue
    if (!principal) {
      // Solo excepciones sin el principal: cada una es un evento suelto.
      for (const ex of excepciones) {
        const e = new ICAL.Event(ex)
        agregar(ex, aFecha(e.startDate), aFecha(e.endDate))
      }
      continue
    }
    const evento = new ICAL.Event(principal)
    for (const ex of excepciones) evento.relateException(new ICAL.Event(ex))
    if (!evento.isRecurring()) {
      agregar(principal, aFecha(evento.startDate), aFecha(evento.endDate))
      continue
    }
    const it = evento.iterator()
    for (let i = 0, t = it.next(); t && i < 5000; i++, t = it.next()) {
      if (aFecha(t) >= hasta) break
      const det = evento.getOccurrenceDetails(t)
      agregar(det.item.component, aFecha(det.startDate), aFecha(det.endDate))
    }
  }
  return bloques.sort((a, b) => a.inicio.localeCompare(b.inicio))
}
