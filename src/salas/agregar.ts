import type { Reservacion } from '../lib/supabase'
import { icsLocal, rfc3339Local, VTIMEZONE_TIJUANA, ZONA } from './tiempo'

/** Texto del evento: lleva el código para que la app reconozca la reservación si vuelve desde Outlook. */
function detalle(r: Reservacion, sala: string) {
  const enlace = r.enlace_reunion?.trim()
  return {
    titulo: `${r.motivo} · ${sala}`,
    cuerpo: [
      `Reservación de ${sala} hecha en la app de Treve.`,
      `Código: ${r.codigo}`,
      enlace ? `Link de reunión: ${enlace}` : '',
      r.notas?.trim() ? `Notas: ${r.notas}` : '',
    ]
      .filter(Boolean)
      .join('\n'),
    lugar: enlace ? `${sala} | ${enlace}` : sala,
    url: enlace || undefined,
  }
}

/** Abre Outlook (cuenta personal, outlook.live.com) con el evento ya lleno para guardarlo e invitar. */
export function enlaceOutlook(r: Reservacion, sala: string, trabajo = false): string {
  const { titulo, cuerpo, lugar } = detalle(r, sala)
  const q = new URLSearchParams({
    path: '/calendar/action/compose',
    rru: 'addevent',
    subject: titulo,
    startdt: rfc3339Local(r.inicio),
    enddt: rfc3339Local(r.fin),
    location: lugar,
    body: cuerpo,
  })
  return `https://outlook.${trabajo ? 'office' : 'live'}.com/calendar/0/deeplink/compose?${q}`
}

export function enlaceGoogle(r: Reservacion, sala: string): string {
  const { titulo, cuerpo, lugar } = detalle(r, sala)
  const q = new URLSearchParams({
    action: 'TEMPLATE',
    text: titulo,
    dates: `${icsLocal(r.inicio)}/${icsLocal(r.fin)}`,
    details: cuerpo,
    location: lugar,
    ctz: ZONA,
  })
  return `https://calendar.google.com/calendar/render?${q}`
}

const escapar = (s: string) => s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n')

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

/** Archivo .ics de la reservación (Outlook de escritorio, Apple, etc.). Mismo UID que el calendario de la sala. */
export function archivoIcs(r: Reservacion, sala: string): Blob {
  const { titulo, cuerpo, lugar, url } = detalle(r, sala)
  const lineas = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Treve//Salas//ES',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-TIMEZONE:${ZONA}`,
    ...VTIMEZONE_TIJUANA,
    'BEGIN:VEVENT',
    `UID:${r.id}@salas.treve`,
    `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')}`,
    `DTSTART;TZID=${ZONA}:${icsLocal(r.inicio)}`,
    `DTEND;TZID=${ZONA}:${icsLocal(r.fin)}`,
    `SUMMARY:${escapar(titulo)}`,
    `LOCATION:${escapar(lugar)}`,
    `DESCRIPTION:${escapar(cuerpo)}`,
  ]
  if (url) lineas.push(`URL:${url}`)
  lineas.push('END:VEVENT', 'END:VCALENDAR')
  return new Blob([lineas.map(plegar).join('\r\n') + '\r\n'], { type: 'text/calendar' })
}
