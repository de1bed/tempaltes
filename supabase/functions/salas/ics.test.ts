import { describe, expect, it } from 'vitest'
import ICAL from 'ical.js'
import { DOMINIO_UID, generarFeed, ocupadosDeIcs } from './ics'

// Como lo publica Outlook.com: zona horaria de Windows con su VTIMEZONE.
const OUTLOOK = [
  'BEGIN:VCALENDAR',
  'METHOD:PUBLISH',
  'PRODID:Microsoft Exchange Server 2010',
  'VERSION:2.0',
  'X-WR-CALNAME:Sala principal',
  'BEGIN:VTIMEZONE',
  'TZID:Central Standard Time (Mexico)',
  'BEGIN:STANDARD',
  'DTSTART:16010101T000000',
  'TZOFFSETFROM:-0600',
  'TZOFFSETTO:-0600',
  'END:STANDARD',
  'END:VTIMEZONE',
  // Junta suelta: 10:00–11:00 hora de México.
  'BEGIN:VEVENT',
  'UID:junta-1',
  'SUMMARY:Ocupado',
  'DTSTART;TZID=Central Standard Time (Mexico):20261020T100000',
  'DTEND;TZID=Central Standard Time (Mexico):20261020T110000',
  'X-MICROSOFT-CDO-BUSYSTATUS:BUSY',
  'END:VEVENT',
  // Semanal los martes 9:00–9:30, sin el 27 de octubre; la del 3 de noviembre se movió a las 13:00.
  'BEGIN:VEVENT',
  'UID:semanal',
  'SUMMARY:Ocupado',
  'RRULE:FREQ=WEEKLY;BYDAY=TU',
  'EXDATE;TZID=Central Standard Time (Mexico):20261027T090000',
  'DTSTART;TZID=Central Standard Time (Mexico):20261013T090000',
  'DTEND;TZID=Central Standard Time (Mexico):20261013T093000',
  'END:VEVENT',
  'BEGIN:VEVENT',
  'UID:semanal',
  'RECURRENCE-ID;TZID=Central Standard Time (Mexico):20261103T090000',
  'SUMMARY:Ocupado',
  'DTSTART;TZID=Central Standard Time (Mexico):20261103T130000',
  'DTEND;TZID=Central Standard Time (Mexico):20261103T133000',
  'END:VEVENT',
  // Todo el día.
  'BEGIN:VEVENT',
  'UID:todo-el-dia',
  'SUMMARY:Ocupado',
  'DTSTART;VALUE=DATE:20261022',
  'DTEND;VALUE=DATE:20261023',
  'END:VEVENT',
  // Libre y cancelado: no ocupan.
  'BEGIN:VEVENT',
  'UID:libre',
  'DTSTART;TZID=Central Standard Time (Mexico):20261021T120000',
  'DTEND;TZID=Central Standard Time (Mexico):20261021T130000',
  'X-MICROSOFT-CDO-BUSYSTATUS:FREE',
  'END:VEVENT',
  'BEGIN:VEVENT',
  'UID:cancelado',
  'STATUS:CANCELLED',
  'DTSTART;TZID=Central Standard Time (Mexico):20261021T140000',
  'DTEND;TZID=Central Standard Time (Mexico):20261021T150000',
  'END:VEVENT',
  // Reservación de la app que alguien importó a Outlook.
  'BEGIN:VEVENT',
  `UID:abc@${DOMINIO_UID}`,
  'DTSTART:20261021T160000Z',
  'DTEND:20261021T170000Z',
  'END:VEVENT',
  'END:VCALENDAR',
].join('\r\n')

describe('ocupadosDeIcs', () => {
  const desde = new Date('2026-10-19T06:00:00Z') // lunes 19 oct, medianoche en México
  const hasta = new Date('2026-11-07T06:00:00Z')
  const bloques = ocupadosDeIcs(OUTLOOK, desde, hasta, (uid) => uid.endsWith(`@${DOMINIO_UID}`))

  it('convierte la zona de Windows a UTC', () => {
    expect(bloques).toContainEqual({ inicio: '2026-10-20T16:00:00.000Z', fin: '2026-10-20T17:00:00.000Z' })
  })
  it('expande lo semanal, respeta lo quitado y lo movido', () => {
    const martes = bloques.filter((b) => b.fin.slice(11, 16) === '15:30' || b.inicio.slice(11, 16) === '19:00')
    expect(martes.map((b) => b.inicio)).toEqual(['2026-10-20T15:00:00.000Z', '2026-11-03T19:00:00.000Z'])
  })
  it('todo el día ocupa el día completo en México', () => {
    expect(bloques).toContainEqual({ inicio: '2026-10-22T06:00:00.000Z', fin: '2026-10-23T06:00:00.000Z' })
  })
  it('no cuenta libres, cancelados ni reservaciones de la app', () => {
    expect(bloques.some((b) => b.inicio.startsWith('2026-10-21'))).toBe(false)
  })
  it('respeta el rango pedido', () => {
    expect(bloques.every((b) => b.fin > desde.toISOString() && b.inicio < hasta.toISOString())).toBe(true)
    expect(bloques).toHaveLength(4)
  })
})

// Como lo publica de verdad Outlook.com para las salas de Treve: zona "UTC" propia (con STANDARD y DAYLIGHT en +0000).
const OUTLOOK_UTC = [
  'BEGIN:VCALENDAR',
  'METHOD:PUBLISH',
  'PRODID:Microsoft Exchange Server 2010',
  'VERSION:2.0',
  'X-WR-CALNAME:Treve - Salita 2',
  'BEGIN:VTIMEZONE',
  'TZID:UTC',
  'BEGIN:STANDARD',
  'DTSTART:16010101T000000',
  'TZOFFSETFROM:+0000',
  'TZOFFSETTO:+0000',
  'END:STANDARD',
  'BEGIN:DAYLIGHT',
  'DTSTART:16010101T000000',
  'TZOFFSETFROM:+0000',
  'TZOFFSETTO:+0000',
  'END:DAYLIGHT',
  'END:VTIMEZONE',
  'BEGIN:VEVENT',
  'DESCRIPTION:Sala: Salita 2\\nPersonas: 2\\nInvitados: a@treve.mx\\, b@treve.mx',
  'UID:040000008200E00074C5B7101A82E0080000000069846F14C43BDD01000000000000000',
  ' 010000000E65318A0673E67489FBE0530467AF194',
  'SUMMARY:Junta',
  'DTSTART;TZID=UTC:20261103T210000',
  'DTEND;TZID=UTC:20261103T220000',
  'CLASS:PUBLIC',
  'TRANSP:OPAQUE',
  'STATUS:CONFIRMED',
  'X-MICROSOFT-CDO-BUSYSTATUS:BUSY',
  'X-MICROSOFT-CDO-ALLDAYEVENT:FALSE',
  'END:VEVENT',
  'END:VCALENDAR',
].join('\r\n')

describe('calendario real de Outlook.com (zona UTC propia)', () => {
  it('lee la hora exacta en UTC', () => {
    expect(ocupadosDeIcs(OUTLOOK_UTC, new Date('2026-11-01T00:00:00Z'), new Date('2026-11-05T00:00:00Z'))).toEqual([
      { inicio: '2026-11-03T21:00:00.000Z', fin: '2026-11-03T22:00:00.000Z' },
    ])
  })
  it('lo de fuera del rango no cuenta', () => {
    expect(ocupadosDeIcs(OUTLOOK_UTC, new Date('2026-11-04T00:00:00Z'), new Date('2026-11-05T00:00:00Z'))).toEqual([])
  })
})

describe('generarFeed', () => {
  const feed = generarFeed('Sala principal · Treve', [
    {
      id: 'r1',
      codigo: 'SALA-ABC123',
      inicio: '2026-10-20T16:00:00.000Z',
      fin: '2026-10-20T17:00:00.000Z',
      titulo: 'Junta con cliente; revisión, presupuesto · Ana',
      descripcion: 'Reservado por Ana\nCódigo: SALA-ABC123 — una descripción larga para que la línea pase de setenta y cinco bytes con acentos áéíóú',
      lugar: 'Sala principal',
      actualizado: '2026-10-15T10:00:00.000Z',
    },
  ])

  it('es un calendario válido que se vuelve a leer igual', () => {
    const ev = new ICAL.Event(new ICAL.Component(ICAL.parse(feed)).getFirstSubcomponent('vevent')!)
    expect(ev.uid).toBe(`r1@${DOMINIO_UID}`)
    expect(ev.summary).toBe('Junta con cliente; revisión, presupuesto · Ana')
    expect(ev.description).toContain('SALA-ABC123')
    expect(ev.startDate.toJSDate().toISOString()).toBe('2026-10-20T16:00:00.000Z')
  })
  it('usa CRLF y ninguna línea pasa de 75 bytes', () => {
    expect(feed.includes('\r\n')).toBe(true)
    for (const l of feed.split('\r\n')) expect(new TextEncoder().encode(l).length).toBeLessThanOrEqual(75)
  })
  it('lo que genera se lee como ocupado', () => {
    expect(ocupadosDeIcs(feed, new Date('2026-10-20T00:00:00Z'), new Date('2026-10-21T00:00:00Z'))).toEqual([
      { inicio: '2026-10-20T16:00:00.000Z', fin: '2026-10-20T17:00:00.000Z' },
    ])
  })
})
