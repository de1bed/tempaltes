import { describe, expect, test } from 'vitest'
import type { Empleado } from './calculo'
import { nominaSemanal, semanaDe, semanaNumero, totalesNomina } from './nomina'

const emp = (num: string, sd: number): Empleado => ({ num, nombre: `P ${num}`, puesto: 'x', ingreso: null, salario_diario: sd, sodexo: 200, activo: true, fuente: 'Listado de nómina' })

describe('semanas como en el listado de nómina', () => {
  test('Semanal No. 40: del 28/sep al 04/oct de 2026', () => {
    expect(semanaDe(new Date(2026, 9, 1))).toEqual({ numero: 40, desde: '2026-09-28', hasta: '2026-10-04' })
    expect(semanaNumero(2026, 40)).toEqual({ numero: 40, desde: '2026-09-28', hasta: '2026-10-04' })
    expect(semanaNumero(2026, 1).desde).toBe('2025-12-29')
  })
})

describe('nómina de la plantilla', () => {
  test('cada persona con su corrida, bono opcional y SBC topado', () => {
    const filas = nominaSemanal([emp('1', 1165.68), emp('2', 2993.35)], '7.25', new Map([['1', 4242.8]]))
    expect(filas[0].r.deducciones[1].monto).toBeCloseTo(2768, 2)
    expect(filas[1].sbc).toBeCloseTo(2932.75, 2)
    expect(filas[1].r.deducciones[0].monto).toBeCloseTo(559.83, 2)
    const t = totalesNomina(filas)
    expect(t.factura).toBeCloseTo(filas[0].r.total.monto + filas[1].r.total.monto, 6)
    expect(t.bono).toBeCloseTo(4242.8, 6)
    // Neto en múltiplos de 50 centavos (ajuste por diferencia de moneda).
    for (const f of filas) expect(Math.abs(f.r.neto.monto * 2 - Math.round(f.r.neto.monto * 2))).toBeLessThan(1e-6)
  })
  test('ajuste como en el listado real: 8,292.84 → −0.16; 19,065.58 → +0.08', async () => {
    const { ajusteMoneda } = await import('./calculo')
    expect(ajusteMoneda(8292.84)).toBeCloseTo(-0.16, 9)
    expect(ajusteMoneda(19065.58)).toBeCloseTo(0.08, 9)
    expect(ajusteMoneda(8384.74)).toBeCloseTo(0.24, 9)
  })
})
