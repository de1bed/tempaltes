import { describe, expect, it } from 'vitest'
import { calcularCorrida } from './calculo'
import { nominaDesdeCorrida, resumenCorrida, type EnvioCorrida } from './envios'
import { corridasIniciales } from './tipos'
import { datosIniciales } from '../lib/modelo'

describe('corrida → cotización de nómina', () => {
  it('semanal (General): pasa bruto, patronales y provisión tal cual', () => {
    const d = { ...corridasIniciales().general, puesto: 'Operador', monto: '400', objetivo: 'salarioDiario' as const }
    const r = calcularCorrida('general', d)
    const s = resumenCorrida(r)
    expect(s.brutoSemanal).toBeCloseTo(r.totalPercepciones.monto, 2)
    expect(s.patronalesSemanal).toBeCloseTo(r.totalPatronales.monto, 2)
    expect(s.provisionSemanal).toBeGreaterThan(0)
  })

  it('catorcenal (Kofile): se lleva a semana', () => {
    const d = { ...corridasIniciales().kofile, puesto: 'Analista', monto: '400', objetivo: 'salarioDiario' as const }
    const r = calcularCorrida('kofile', d)
    expect(resumenCorrida(r).brutoSemanal).toBeCloseTo(r.totalPercepciones.monto / 2, 2)
  })

  it('llena la cotización de nómina', () => {
    const resumen = { periodo: 'Semanal', dias: 7, salarioDiario: 400, brutoSemanal: 3360, patronalesSemanal: 932.25, provisionSemanal: 230.77, netoPeriodo: 3000, totalEtiqueta: 'Costo', totalPeriodo: 4492.25 }
    const e = { empresa: 'ACME', puesto: 'Operador', resumen } as EnvioCorrida
    const p = nominaDesdeCorrida(e, datosIniciales().payroll)
    expect(p).toMatchObject({ empresa: 'ACME', puesto: 'Operador', tituloPortada: 'Operador', salario: '3360.00', impuestos: '932.25', prestaciones: '230.77' })
  })
})
