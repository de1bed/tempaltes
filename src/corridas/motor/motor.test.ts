import { describe, expect, it } from 'vitest'
import general from '../plantillas/general.json'
import hilos33 from '../plantillas/hilos33.json'
import kofile from '../plantillas/kofile.json'
import { leerFormula } from './formula'
import { ErrorExcel, Libro, redondear, type PlantillaJson, type Valor } from './libro'

const PLANTILLAS = { kofile, general, hilos33 } as unknown as Record<string, PlantillaJson>

function igual(a: Valor, b: Valor): boolean {
  if (typeof a === 'number' && typeof b === 'number') return Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(b))
  if (a instanceof ErrorExcel && b instanceof ErrorExcel) return a.codigo === b.codigo
  if ((a === null || a === '') && (b === null || b === '' || b === 0)) return true
  return a === b
}

describe('motor de fórmulas', () => {
  it('lee referencias, rangos de otras hojas y precedencia', () => {
    expect(leerFormula("=+'IMSS Calculo'!D54".slice(1))).toEqual({ tipo: 'unario', op: '+', arg: { tipo: 'ref', hoja: 'IMSS Calculo', celda: 'D54' } })
    expect(leerFormula('VLOOKUP($D$82,$D$174:$G$184,4)')).toMatchObject({ tipo: 'funcion', nombre: 'VLOOKUP' })
    expect(leerFormula('1+2*3^2')).toMatchObject({ tipo: 'binario', op: '+', der: { op: '*' } })
  })

  it('redondea como Excel', () => {
    expect(redondear(2.345, 2)).toBe(2.35)
    expect(redondear(-2.345, 2)).toBe(-2.35)
    expect(redondear(1.005, 2)).toBe(1.01)
  })

  // La prueba principal: el motor reproduce TODOS los valores que Excel guardó en cada plantilla.
  for (const [nombre, plantilla] of Object.entries(PLANTILLAS)) {
    it(`reproduce cada fórmula de la plantilla ${nombre}`, () => {
      const libro = new Libro(plantilla)
      const diferencias: string[] = []
      let total = 0
      for (const hoja of libro.hojas) {
        for (const celda of libro.celdasConFormula(hoja)) {
          total++
          const esperado = libro.valorGuardado(hoja, celda)
          const obtenido = libro.valor(hoja, celda)
          if (!igual(obtenido, esperado)) diferencias.push(`${hoja}!${celda}: Excel=${String(esperado)} motor=${String(obtenido)} (=${libro.formula(hoja, celda)})`)
        }
      }
      expect(diferencias.slice(0, 40)).toEqual([])
      expect(total).toBeGreaterThan(10)
    })
  }
})
