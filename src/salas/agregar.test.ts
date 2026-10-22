import { describe, expect, it } from 'vitest'
import type { Reservacion } from '../lib/supabase'
import { archivoIcs, enlaceGoogle, enlaceOutlook } from './agregar'

const SAMPLE_LINK = 'https://meet.google.com/abc-defg-hij'

const muestra = (extra: Partial<Reservacion> = {}): Reservacion => ({
  id: '11111111-1111-1111-1111-111111111111',
  codigo: 'SALA-SAMPLE',
  sala_id: 'principal',
  inicio: '2026-10-22T18:00:00.000Z',
  fin: '2026-10-22T19:00:00.000Z',
  motivo: 'Reunión de prueba',
  personas: 4,
  invitados: ['guest.sample@example.com'],
  creado_por: null,
  creado_por_email: 'sample.booker@example.com',
  creado_por_nombre: 'Sample Booker',
  estado: 'activa',
  outlook_event_id: null,
  sync_error: null,
  responsable_nombre: 'Sample Booker',
  responsable_email: 'sample.booker@example.com',
  notas: 'Traer laptop',
  enlace_reunion: SAMPLE_LINK,
  origen: 'cuenta',
  empresa: null,
  ...extra,
})

async function textoIcs(r: Reservacion) {
  return await archivoIcs(r, 'Sala principal').text()
}

describe('archivo .ics e invitaciones (Tijuana)', () => {
  it('ICS usa TZID America/Tijuana a las 11:00, no UTC ni Ciudad de México', async () => {
    const ics = await textoIcs(muestra())
    expect(ics).toMatch(/TZID:America\/Tijuana/)
    expect(ics).toMatch(/DTSTART;TZID=America\/Tijuana:20261022T110000/)
    expect(ics).toMatch(/DTEND;TZID=America\/Tijuana:20261022T120000/)
    expect(ics.includes('America/Mexico_City')).toBe(false)
    expect(/DTSTART:20261022T180000Z/.test(ics)).toBe(false)
  })

  it('el link de reunión va en LOCATION, URL y DESCRIPTION; las notas se conservan', async () => {
    const ics = (await textoIcs(muestra())).replace(/\r\n /g, '')
    expect(ics).toContain(`URL:${SAMPLE_LINK}`)
    expect(ics).toMatch(/LOCATION:Sala principal \| https:\/\/meet.google.com\/abc-defg-hij/)
    expect(ics).toContain('Link de reunión:')
    expect(ics).toContain('Notas: Traer laptop')
  })

  it('omite el link cuando no hay', async () => {
    const ics = (await textoIcs(muestra({ enlace_reunion: '' }))).replace(/\r\n /g, '')
    expect(ics.includes('\r\nURL:')).toBe(false)
    expect(ics).toContain('LOCATION:Sala principal')
    expect(ics).not.toContain('Link de reunión')
    expect(ics).toContain('Notas: Traer laptop')
  })

  it('Google y Outlook usan reloj de pared Tijuana, no Z', () => {
    const r = muestra()
    const google = enlaceGoogle(r, 'Sala principal')
    expect(google).toContain('ctz=America%2FTijuana')
    expect(google).toContain('20261022T110000')
    expect(google).toContain('20261022T120000')
    expect(google).not.toContain('180000Z')
    expect(google).toContain(encodeURIComponent(SAMPLE_LINK))

    const outlook = enlaceOutlook(r, 'Sala principal')
    expect(outlook).toContain('startdt=2026-10-22T11%3A00%3A00')
    expect(outlook).not.toContain('18%3A00')
    expect(outlook).toContain(encodeURIComponent(SAMPLE_LINK))
  })
})
