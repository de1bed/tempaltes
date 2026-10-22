import { describe, expect, it } from 'vitest'
import { listarClausulas, posicionClausula } from './contratos'
import { cambiarIdioma, datosIniciales, normalizarTerminosFeedbak, rellenar } from './modelo'

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

  it('pone el número aunque el borrador traiga la frase genérica', () => {
    const viejo = 'La propuesta incluye las horas de soporte indicadas durante la implementación.'
    const en = 'This proposal includes the support hours indicated during implementation.'
    expect(rellenar(viejo, { horasSoporte: '12' })).toContain('incluye 12 horas de soporte')
    expect(rellenar(viejo, { horasSoporte: '12' })).not.toMatch(/indicadas/)
    expect(rellenar(en, { horasSoporte: '12' })).toContain('includes 12 support hours')
    expect(normalizarTerminosFeedbak(viejo)).toContain('{horasSoporte} horas de soporte')
  })

  it('lista las cláusulas del contrato numerables', () => {
    const titulos = listarClausulas(datosIniciales().licencia.cuerpo)
    expect(titulos[0]).toMatch(/Definiciones/i)
    expect(titulos.length).toBeGreaterThan(8)
  })

  it('ubica cada cláusula del índice en el texto', () => {
    const cuerpo = datosIniciales().licencia.cuerpo
    const titulos = listarClausulas(cuerpo)
    const primera = posicionClausula(cuerpo, 0)
    const ultima = posicionClausula(cuerpo, titulos.length - 1)
    expect(cuerpo.slice(primera!.start, primera!.end)).toBe(`## ${titulos[0]}`)
    expect(cuerpo.slice(ultima!.start, ultima!.end)).toBe(`## ${titulos[titulos.length - 1]}`)
    expect(posicionClausula(cuerpo, titulos.length)).toBeNull()
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
