import { describe, expect, it } from 'vitest'
import { finDeVigencia, textoVigencia } from './contratos'

describe('vigencia del contrato', () => {
  it('las vigencias fijas no cambian', () => {
    expect(finDeVigencia({ fecha: '2026-09-24', vigencia: 'anual' })).toBe('2027-09-24')
    expect(textoVigencia({ fecha: '2026-09-24', vigencia: 'anual' }, 'es')).toBe('anual')
  })

  it('personalizada: fecha elegida, en meses o días', () => {
    const d = { fecha: '2026-09-24', vigencia: 'personalizada' as const, finVigencia: '2029-03-24' }
    expect(finDeVigencia(d)).toBe('2029-03-24')
    expect(textoVigencia(d, 'es')).toBe('de 30 meses')
    expect(textoVigencia(d, 'en')).toBe('30-month')
    expect(textoVigencia({ ...d, finVigencia: '2026-10-04' }, 'es')).toBe('de 10 días')
  })

  it('personalizada: máximo 5 años y nunca antes del inicio', () => {
    expect(finDeVigencia({ fecha: '2026-09-24', vigencia: 'personalizada', finVigencia: '2035-01-01' })).toBe('2031-09-24')
    expect(textoVigencia({ fecha: '2026-09-24', vigencia: 'personalizada', finVigencia: '2035-01-01' }, 'es')).toBe('de 60 meses')
    expect(finDeVigencia({ fecha: '2026-09-24', vigencia: 'personalizada', finVigencia: '2026-01-01' })).toBe('2027-09-24')
    expect(finDeVigencia({ fecha: '2026-09-24', vigencia: 'personalizada' })).toBe('2027-09-24')
  })
})
