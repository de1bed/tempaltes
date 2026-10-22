import { describe, expect, it } from 'vitest'
import { aFecha, diasHabiles, horariosLibres, icsLocal, indiceSemana, local, mesesDelRango, rfc3339Local, semanasDelMes, sumarDias, textoHora, ZONA } from './tiempo'

describe('horario de salas (Tijuana)', () => {
  it('convierte 11:00 Tijuana a 18:00 UTC en PDT, no al mediodía de Ciudad de México', () => {
    // 22 oct 2026 es PDT (UTC-7). Ciudad de México sería 11:00 → 17:00 UTC y el invite mostraría 12:00.
    expect(aFecha('2026-10-22', 11 * 60).toISOString()).toBe('2026-10-22T18:00:00.000Z')
    expect(aFecha('2026-10-22', 12 * 60).toISOString()).toBe('2026-10-22T19:00:00.000Z')
    expect(local(new Date('2026-10-22T18:00:00Z'))).toEqual({ dia: '2026-10-22', semana: 'Thu', minutos: 11 * 60 })
    expect(ZONA).toBe('America/Tijuana')
  })

  it('respeta el horario de invierno (PST, UTC-8)', () => {
    expect(aFecha('2026-12-01', 7 * 60).toISOString()).toBe('2026-12-01T15:00:00.000Z')
    expect(aFecha('2026-12-01', 11 * 60).toISOString()).toBe('2026-12-01T19:00:00.000Z')
    expect(local(new Date('2026-12-01T19:00:00Z')).minutos).toBe(11 * 60)
  })

  it('escribe reloj de pared local sin Z para ICS y Graph', () => {
    const inicio = aFecha('2026-10-22', 11 * 60).toISOString()
    const fin = aFecha('2026-10-22', 12 * 60).toISOString()
    expect(icsLocal(inicio)).toBe('20261022T110000')
    expect(icsLocal(fin)).toBe('20261022T120000')
    expect(rfc3339Local(inicio)).toBe('2026-10-22T11:00:00')
    expect(rfc3339Local(inicio).includes('Z')).toBe(false)
  })

  it('solo días hábiles en los próximos 30 días', () => {
    const dias = diasHabiles(new Date('2026-10-10T18:00:00Z')) // sábado
    expect(dias[0]).toBe('2026-10-12')
    expect(dias.every((d) => !['Sat', 'Sun'].includes(local(aFecha(d, 720)).semana))).toBe(true)
    expect(dias.at(-1)).toBe('2026-11-09')
  })

  it('horarios libres respetan lo ocupado, la duración y las 9 p.m.', () => {
    const antes = new Date('2026-10-01T00:00:00Z')
    const ocupado = [{ inicio: '2026-10-12T16:00:00Z', fin: '2026-10-12T17:00:00Z' }] // 9 a 10 a.m. Tijuana
    const libres = horariosLibres('2026-10-12', 60, ocupado, antes)
    expect(libres[0]).toBe(7 * 60)
    expect(libres).toContain(8 * 60)
    expect(libres).not.toContain(8 * 60 + 30)
    expect(libres).not.toContain(9 * 60 + 30)
    expect(libres).toContain(10 * 60)
    expect(libres.at(-1)).toBe(20 * 60)
    expect(textoHora(20 * 60)).toBe('8:00 p.m.')
  })

  it('arma el mes de lunes a domingo y solo habilita los días reservables', () => {
    expect(indiceSemana('2026-10-12')).toBe(0)
    expect(indiceSemana('2026-10-13')).toBe(1)
    expect(indiceSemana('2026-10-18')).toBe(6)
    expect(sumarDias('2026-10-31', 1)).toBe('2026-11-01')
    expect(sumarDias('2026-03-01', -1)).toBe('2026-02-28')

    const habiles = diasHabiles(new Date('2026-10-13T18:00:00Z'))
    expect(mesesDelRango(habiles)).toEqual(['2026-10', '2026-11'])
    const semanas = semanasDelMes('2026-10', new Set(habiles))
    expect(semanas.every((s) => s.length === 7)).toBe(true)
    expect(semanas[0][0].dia).toBe('2026-09-28')
    expect(semanas.flat().find((c) => c.dia === '2026-10-13')?.habil).toBe(true)
    expect(semanas.flat().find((c) => c.dia === '2026-10-18')?.habil).toBe(false)
  })

  it('no ofrece horarios que ya pasaron', () => {
    const libres = horariosLibres('2026-10-12', 30, [], new Date('2026-10-12T19:10:00Z')) // 12:10 p.m. Tijuana
    expect(libres[0]).toBe(12 * 60 + 30)
  })
})
