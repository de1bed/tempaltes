// Calendarios .ics sin Azure:
// - generarFeed: el calendario de una sala con las reservaciones de la app, para suscribirlo en Outlook.
// - ocupadosDeIcs: lee el calendario de la sala que Outlook publica (enlace ICS) para saber qué está ocupado.
import ICAL from 'ical.js'

export interface EventoFeed {
  id: string
  codigo: string
  inicio: string
  fin: string
  titulo: string
  descripcion: string
  lugar: string
  actualizado: string
}

export interface Bloque {
  inicio: string
  fin: string
}

const ZONA = 'America/Mexico_City'
/** Sufijo del UID de los eventos que salen de la app (para no contarlos dos veces). */
export const DOMINIO_UID = 'salas.treve'

const escapar = (s: string) => s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n')
const fechaIcs = (iso: string) => new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')

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
  const sello = fechaIcs(ahora.toISOString())
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
  ]
  for (const e of eventos) {
    lineas.push(
      'BEGIN:VEVENT',
      `UID:${e.id}@${DOMINIO_UID}`,
      `DTSTAMP:${sello}`,
      `LAST-MODIFIED:${fechaIcs(e.actualizado)}`,
      `DTSTART:${fechaIcs(e.inicio)}`,
      `DTEND:${fechaIcs(e.fin)}`,
      `SUMMARY:${escapar(e.titulo)}`,
      `LOCATION:${escapar(e.lugar)}`,
      `DESCRIPTION:${escapar(e.descripcion)}`,
      'STATUS:CONFIRMED',
      'TRANSP:OPAQUE',
      'END:VEVENT',
    )
  }
  lineas.push('END:VCALENDAR')
  return lineas.map(plegar).join('\r\n') + '\r\n'
}

const formato = new Intl.DateTimeFormat('en-US', { timeZone: ZONA, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })

/** Medianoche (hora de la Ciudad de México) del día `YYYY-MM-DD`, en UTC. */
function medianocheMx(dia: string): Date {
  const p = Object.fromEntries(formato.formatToParts(new Date(`${dia}T12:00:00Z`)).map((x) => [x.type, x.value]))
  const desfase = Number(p.hour) * 60 + Number(p.minute) - 12 * 60
  return new Date(Date.parse(`${dia}T00:00:00Z`) - desfase * 60_000)
}

type Tiempo = InstanceType<typeof ICAL.Time>
type Componente = InstanceType<typeof ICAL.Component>

/** Fecha real de un tiempo de ical.js; los eventos de todo el día ocupan el día completo en la Ciudad de México. */
function aFecha(t: Tiempo): Date {
  if (t.isDate) return medianocheMx(`${t.year}-${String(t.month).padStart(2, '0')}-${String(t.day).padStart(2, '0')}`)
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
