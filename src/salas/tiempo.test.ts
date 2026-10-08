import { describe, expect, it } from 'vitest'
import { aFecha, diasHabiles, horariosLibres, local, textoHora } from './tiempo'

describe('horario de salas (Ciudad de México)', () => {
  it('convierte hora local a UTC (UTC-6, sin horario de verano)', () => {
    expect(aFecha('2026-10-12', 9 * 60).toISOString()).toBe('2026-10-12T15:00:00.000Z')
    expect(aFecha('2026-12-01', 7 * 60).toISOString()).toBe('2026-12-01T13:00:00.000Z')
    expect(local(new Date('2026-10-12T15:00:00Z'))).toEqual({ dia: '2026-10-12', semana: 'Mon', minutos: 540 })
  })

  it('solo días hábiles en los próximos 30 días', () => {
    const dias = diasHabiles(new Date('2026-10-10T18:00:00Z')) // sábado
    expect(dias[0]).toBe('2026-10-12')
    expect(dias.every((d) => !['Sat', 'Sun'].includes(local(aFecha(d, 720)).semana))).toBe(true)
    expect(dias.at(-1)).toBe('2026-11-09')
  })

  it('horarios libres respetan lo ocupado, la duración y las 9 p.m.', () => {
    const antes = new Date('2026-10-01T00:00:00Z')
    const ocupado = [{ inicio: '2026-10-12T15:00:00Z', fin: '2026-10-12T16:00:00Z' }] // 9 a 10 a.m.
    const libres = horariosLibres('2026-10-12', 60, ocupado, antes)
    expect(libres[0]).toBe(7 * 60)
    expect(libres).toContain(8 * 60)
    expect(libres).not.toContain(8 * 60 + 30)
    expect(libres).not.toContain(9 * 60 + 30)
    expect(libres).toContain(10 * 60)
    expect(libres.at(-1)).toBe(20 * 60)
    expect(textoHora(20 * 60)).toBe('8:00 p.m.')
  })

  it('no ofrece horarios que ya pasaron', () => {
    const libres = horariosLibres('2026-10-12', 30, [], new Date('2026-10-12T18:10:00Z')) // 12:10 p.m.
    expect(libres[0]).toBe(12 * 60 + 30)
  })
})
