import { describe, expect, it } from 'vitest'
import { listarClausulas } from './contratos'
import { cambiarIdioma, datosIniciales, rellenar } from './modelo'

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

describe('Feedbak: horas de soporte y cláusulas', () => {
  it('sustituye {horasSoporte} en los términos', () => {
    expect(rellenar(datosIniciales().feedbak.terminos, { horasSoporte: '8' })).toContain('incluye 8 horas de soporte')
  })

  it('lista las cláusulas del contrato numerables', () => {
    const titulos = listarClausulas(datosIniciales().licencia.cuerpo)
    expect(titulos[0]).toMatch(/Definiciones/i)
    expect(titulos.length).toBeGreaterThan(8)
  })
})

describe('todas las plantillas', () => {
  const inicial = datosIniciales()
  for (const id of Object.keys(inicial) as (keyof typeof inicial)[]) {
    it(`${id}: ida y vuelta de idioma conserva los textos`, () => {
      const d = inicial[id]
      const otro = d.idioma === 'es' ? 'en' : 'es'
      const traducido = cambiarIdioma(id, d, otro)
      expect(traducido.idioma).toBe(otro)
      expect(cambiarIdioma(id, traducido, d.idioma)).toEqual(d)
    })
  }
})
