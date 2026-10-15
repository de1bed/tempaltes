import type { Reservacion } from '../lib/supabase'

/** Texto del evento: lleva el código para que la app reconozca la reservación si vuelve desde Outlook. */
function detalle(r: Reservacion, sala: string) {
  return {
    titulo: `${r.motivo} · ${sala}`,
    cuerpo: `Reservación de ${sala} hecha en la app de Treve.\nCódigo: ${r.codigo}`,
  }
}

/** Abre Outlook (cuenta personal, outlook.live.com) con el evento ya lleno para guardarlo e invitar. */
export function enlaceOutlook(r: Reservacion, sala: string, trabajo = false): string {
  const { titulo, cuerpo } = detalle(r, sala)
  const q = new URLSearchParams({
    path: '/calendar/action/compose',
    rru: 'addevent',
    subject: titulo,
    startdt: new Date(r.inicio).toISOString(),
    enddt: new Date(r.fin).toISOString(),
    location: sala,
    body: cuerpo,
  })
  return `https://outlook.${trabajo ? 'office' : 'live'}.com/calendar/0/deeplink/compose?${q}`
}

const compacta = (iso: string) => new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')

export function enlaceGoogle(r: Reservacion, sala: string): string {
  const { titulo, cuerpo } = detalle(r, sala)
  const q = new URLSearchParams({ action: 'TEMPLATE', text: titulo, dates: `${compacta(r.inicio)}/${compacta(r.fin)}`, details: cuerpo, location: sala })
  return `https://calendar.google.com/calendar/render?${q}`
}

const escapar = (s: string) => s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n')

/** Archivo .ics de la reservación (Outlook de escritorio, Apple, etc.). Mismo UID que el calendario de la sala. */
export function archivoIcs(r: Reservacion, sala: string): Blob {
  const { titulo, cuerpo } = detalle(r, sala)
  const lineas = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Treve//Salas//ES',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${r.id}@salas.treve`,
    `DTSTAMP:${compacta(new Date().toISOString())}`,
    `DTSTART:${compacta(r.inicio)}`,
    `DTEND:${compacta(r.fin)}`,
    `SUMMARY:${escapar(titulo)}`,
    `LOCATION:${escapar(sala)}`,
    `DESCRIPTION:${escapar(cuerpo)}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ]
  return new Blob([lineas.join('\r\n') + '\r\n'], { type: 'text/calendar' })
}
