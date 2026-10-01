import { describe, expect, it } from 'vitest'
import { calcularCorrida } from './calculo'
import { desdeJson, type Valor } from './motor/libro'
import hilosEjemplo from './pruebas/hilos33-sd914-sodexo200.json'
import conSeptimo from './pruebas/kofile-sd1728-con-septimo.json'
import sinSeptimo from './pruebas/kofile-sd1728-sin-septimo.json'
import { corridasIniciales, type GeneralData, type Hilos33Data, type KofileData } from './tipos'

/*
 * Casos reales enviados por Trebot / Nóminas (paquete 2026-10-01). La app debe dar
 * los mismos números que los Excel entregados.
 */

const ini = corridasIniciales()
const kofile = (p: Partial<KofileData>) => calcularCorrida('kofile', { ...ini.kofile, puesto: 'Prueba', ...p })
const general = (p: Partial<GeneralData>) => calcularCorrida('general', { ...ini.general, puesto: 'Prueba', ...p })
const hilos = (p: Partial<Hilos33Data>) => calcularCorrida('hilos33', { ...ini.hilos33, puesto: 'Prueba', ...p })

type Ejemplo = { valores: Record<string, Record<string, { n: number } | { s: string } | { b: boolean } | { e: string }>> }

/** Compara cada celda con fórmula del libro contra el valor que tiene el Excel del ejemplo. */
function diferenciasContra(libro: ReturnType<typeof kofile>['libros'][number]['libro'], ejemplo: Ejemplo, tolerancia = 1e-6) {
  const dif: string[] = []
  for (const hoja of libro.hojas) {
    for (const celda of libro.celdasConFormula(hoja)) {
      const esperado: Valor = desdeJson(ejemplo.valores[hoja]?.[celda])
      const obtenido = libro.valor(hoja, celda)
      if (typeof esperado === 'number' && typeof obtenido === 'number') {
        if (Math.abs(esperado - obtenido) > tolerancia * Math.max(1, Math.abs(esperado))) dif.push(`${hoja}!${celda}: ejemplo=${esperado} app=${obtenido}`)
      } else if (String(esperado ?? '') !== String(obtenido ?? '') && !(esperado === null && obtenido === 0)) {
        dif.push(`${hoja}!${celda}: ejemplo=${String(esperado)} app=${String(obtenido)}`)
      }
    }
  }
  return dif
}

const sinErrores = (r: ReturnType<typeof kofile>) => r.validaciones.filter((v) => !v.ok).map((v) => v.texto)

describe('Kofile (simulación extendida)', () => {
  it('bruto catorcenal 42,694 → salario diario 1,332.068582 (como el ejemplo enviado)', () => {
    const r = kofile({ objetivo: 'brutoPeriodo', monto: '42694' })
    expect(r.salarioDiario).toBeCloseTo(1332.068582, 6)
    expect(r.totalPercepciones.monto).toBeCloseTo(42694, 2)
    expect(sinErrores(r)).toEqual([])
  })

  it('bruto catorcenal 45,000 → salario diario 1,406.956640', () => {
    const r = kofile({ objetivo: 'brutoPeriodo', monto: '45000' })
    expect(r.salarioDiario).toBeCloseTo(1406.95664, 6)
    expect(r.totalPercepciones.monto).toBeCloseTo(45000, 2)
  })

  it('SD 1,728.14 con séptimo día: todo el libro igual al Excel entregado', () => {
    const r = kofile({ objetivo: 'salarioDiario', monto: '1728.14' })
    expect(diferenciasContra(r.libros[0].libro, conSeptimo as Ejemplo).slice(0, 10)).toEqual([])
    // validacion_resumen.json del ejemplo
    expect(r.totalPercepciones.monto).toBeCloseTo(54890.07916072468, 6)
    expect(r.totalDeducciones.monto).toBeCloseTo(14298.423578547945, 6)
    expect(r.neto.monto).toBeCloseTo(40591.65558217673, 6)
    expect(r.totalPatronales.monto).toBeCloseTo(8535.587702406121, 6)
    expect(r.total.monto).toBeCloseTo(63425.6668631308, 6)
    expect(sinErrores(r)).toEqual([])
  })

  it('SD 1,728.14 sin séptimo día: todo el libro igual al Excel entregado', () => {
    const r = kofile({ objetivo: 'salarioDiario', monto: '1728.14', septimo: false })
    expect(diferenciasContra(r.libros[0].libro, sinSeptimo as Ejemplo).slice(0, 10)).toEqual([])
    expect(r.totalPercepciones.monto).toBeCloseTo(51433.79916072468, 6)
    expect(r.neto.monto).toBeCloseTo(38241.385582176736, 6)
    expect(r.total.monto).toBeCloseTo(59811.0892391308, 6)
  })

  it('Project Manager 50,000 brutos mensuales sin Sodexo → salario diario 1,644.736842', () => {
    const r = kofile({ objetivo: 'brutoMensual', monto: '50000', bonoDesempeno: 'monto', bonoDesempenoMonto: '5000', diasVacaciones: '12' })
    expect(r.salarioDiario).toBe(1644.736842)
    expect(r.libros[0].libro.formula('Calculo', 'D44')).toBe('+(D19*12)*0.25/12/2.17')
    expect(r.libros[0].libro.numero('Calculo', 'D51')).toBeCloseTo(5000 / 2.17, 6)
    expect(sinErrores(r)).toEqual([])
  })

  it('neto objetivo: busca el salario y cierra al centavo', () => {
    const r = kofile({ objetivo: 'neto', monto: '30000' })
    expect(Math.abs(r.neto.monto - 30000)).toBeLessThan(0.01)
    expect(sinErrores(r)).toEqual([])
  })

  it('esquema asimilado: factura bi-weekly = subtotal + service fee', () => {
    const r = kofile({ objetivo: 'neto', monto: '30000', esquema: 'asimilado' })
    expect(Math.abs(r.neto.monto - 30000)).toBeLessThan(0.01)
    expect(r.total.celda).toBe('Simulacion Asimilado!AW48')
    expect(sinErrores(r)).toEqual([])
  })

  it('bloquea si faltan datos críticos', () => {
    expect(calcularCorrida('kofile', { ...ini.kofile, monto: '' }).faltantes).toEqual(['Puesto / posición', 'Monto objetivo (Bruto catorcenal (total de percepciones))'])
    expect(kofile({ esquema: 'asimilado', objetivo: 'netoSodexo', monto: '1' }).faltantes).toHaveLength(1)
  })

  it('marca conceptos no soportados como pendientes, sin calcularlos', () => {
    const r = kofile({ objetivo: 'salarioDiario', monto: '1000', pendientes: ['primaDominical'] })
    const p = r.validaciones.filter((v) => v.nivel === 'pendiente')
    expect(p).toHaveLength(1)
    expect(p[0].texto).toMatch(/Prima dominical/)
  })
})

describe('Corrida general Treve', () => {
  // Casos documentados en treve-simulacion-corrida-salarial.md
  it.each([
    ['neto + Sodexo 17,000 (Sodexo 200)', { objetivo: 'netoSodexo', monto: '17000', sodexo: '200' }, 2703.9, { percepciones: 22712.76, deducciones: 5912.76 }],
    ['neto + Sodexo 15,000 (Sodexo 200)', { objetivo: 'netoSodexo', monto: '15000', sodexo: '200' }, 2351.55, { percepciones: 19753.02, deducciones: 4953.02 }],
    ['neto 15,000 sin Sodexo', { objetivo: 'neto', monto: '15000', sodexo: '0' }, 2386.78, { percepciones: 20048.95, deducciones: 5048.98 }],
  ] as const)('%s → salario diario como el entregado', (_n, datos, sd, esperado) => {
    const r = general(datos)
    expect(r.salarioDiario).toBe(sd)
    expect(r.totalPercepciones.monto).toBeCloseTo(esperado.percepciones, 2)
    expect(r.totalDeducciones.monto).toBeCloseTo(esperado.deducciones, 2)
    expect(sinErrores(r)).toEqual([])
  })

  it('SD 914.62 + Sodexo 200: montos documentados', () => {
    const r = general({ objetivo: 'salarioDiario', monto: '914.62', sodexo: '200' })
    expect(r.totalPercepciones.monto).toBeCloseTo(7682.81, 2)
    expect(r.deducciones.map((d) => +d.monto.toFixed(2))).toEqual([176.57, 1206.23, 0])
    expect(r.netoSodexo.monto).toBeCloseTo(6500.01, 2)
    expect(r.totalPatronales.monto).toBeCloseTo(2011.45, 2)
    expect(r.total.monto).toBeCloseTo(9894.26, 2)
  })

  it('las hojas ocultas con copia del resumen (Sheet5, 33 Hilos) se actualizan con la corrida', () => {
    const r = general({ objetivo: 'netoSodexo', monto: '6500', sodexo: '200' })
    const libro = r.libros[0].libro
    // Como en la entrega validada del 2026-07-20: Simulacion, Sheet5 y 33 Hilos muestran 6,500.
    for (const [hoja, celda] of [['Simulacion', 'D21'], ['Sheet5', 'D21'], ['33 Hilos ', 'D21'], ['33 Hilos ', 'I21']]) {
      expect(libro.numero(hoja, celda), `${hoja}!${celda}`).toBeCloseTo(6500, 1)
    }
    expect(libro.numero('Sheet5', 'D29')).toBeCloseTo(r.total.monto, 6)
    // El caso del 2026-07-20 dio SD 916.75 con la plantilla anterior; con la aprobada el 2026-08-19
    // da 914.62, el mismo salario del caso de Xochitl (SD 914.62 → neto + Sodexo 6,500.01).
    expect(r.salarioDiario).toBe(914.62)
    expect(sinErrores(r)).toEqual([])
  })

  it('SD 1,000 sin Sodexo: ISR e IMSS documentados', () => {
    const r = general({ objetivo: 'salarioDiario', monto: '1000', sodexo: '0' })
    expect(r.deducciones[1].monto).toBe(1364.98)
    expect(r.deducciones[0].monto).toBeCloseTo(193.9754, 4)
  })
})

describe('33 Hilos', () => {
  it('SD 914.62 + Sodexo 200: igual al ejemplo enviado', () => {
    const r = hilos({ objetivo: 'salarioDiario', monto: '914.62', sodexo: '200', puesto: '33 Hilos' })
    const libro = r.libros[0].libro
    // El ejemplo trae los montos pegados ya redondeados a centavos; los totales acumulan
    // ese redondeo (hasta 2 centavos). La app escribe los montos exactos de la corrida general.
    const ejemplo = (hilosEjemplo as Ejemplo).valores['33 Hilos ']
    for (const celda of ['F6', 'F7', 'F8', 'F9', 'F10', 'F13', 'F14', 'F16', 'F18', 'F19', 'F20', 'F23', 'F24', 'F25', 'F26', 'F27', 'F29', 'F30', 'F32', 'F33', 'F34', 'J3', 'K3', 'L3', 'M3', 'O3', 'Q3']) {
      const esperado = desdeJson(ejemplo[celda]) as number
      expect(Math.abs(libro.numero('33 Hilos ', celda) - esperado), celda).toBeLessThan(0.021)
    }
    expect(sinErrores(r)).toEqual([])
  })
})

describe('robustez', () => {
  it('cualquier combinación de formato, objetivo y monto se calcula sin romperse', () => {
    for (const id of ['kofile', 'general', 'hilos33'] as const) {
      for (const objetivo of ['salarioDiario', 'brutoPeriodo', 'brutoMensual', 'neto', 'netoSodexo'] as const) {
        for (const monto of ['', '0', '0.5', '100', '5000', '250000', 'abc']) {
          for (const esquema of ['nomina', 'asimilado'] as const) {
            const d = { ...ini[id], objetivo, monto, esquema }
            expect(() => calcularCorrida(id, d), `${id} ${objetivo} ${monto} ${esquema}`).not.toThrow()
          }
        }
      }
    }
  })
})
