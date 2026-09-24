import { describe, expect, it } from 'vitest'
import { cambiarIdioma, datosIniciales } from './modelo'

describe('cambiarIdioma', () => {
  it('traduce los textos que no se han editado', () => {
    const d = datosIniciales().payroll
    const es = cambiarIdioma('payroll', d, 'es')
    expect(es.idioma).toBe('es')
    expect(es.frecuencia).toBe('Semanal')
    expect(es.terminos).toMatch(/^Nómina semanal/)
    // Ida y vuelta regresa exactamente a los textos originales.
    expect(cambiarIdioma('payroll', es, 'en')).toEqual(d)
  })

  it('conserva los textos que el usuario editó y los datos capturados', () => {
    const d = { ...datosIniciales().servicios, intro: 'Texto propio', empresa: 'PLD Blinds' }
    const en = cambiarIdioma('servicios', d, 'en')
    expect(en.intro).toBe('Texto propio')
    expect(en.empresa).toBe('PLD Blinds')
    expect(en.tituloPortada).toBe('Employer Registration Certificate Filing')
  })
})
