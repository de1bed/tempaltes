import { describe, expect, test } from 'vitest'
import type { Empleado } from './calculo'
import { fechaListado, leerBase, leerListado } from './listado'
import { aplicarCambios, compararListado } from './plantilla'

// Texto como lo arma lineasPdf a partir del "Listado de Nómina" (datos inventados).
const LINEAS = [
  'HR SERVICES IN TRAINING TIJUANA',
  'Listado de Nomina',
  'Semanal No: 40',
  'Del 28/sep/2026 al 04/oct/2026',
  'Departamento   02   Logística',
  '90001   PEREZ LOPEZ ANA MARIA - Global Logistics',
  'Fecha de Ingreso:   15/jul/2024   RFC: XXXX000000XX0   Afiliació 00000000000',
  'Salario Diario:   1,183.61   S.D.I:   1,356.90   Sal. Variable: 106.77',
  '1   SUELDO ORDINARIO   7,101.66   51   I S P T   1,934.78',
  'Total Percepciones:   10,481.34   Total Deducciones:   2,188.34',
  'Monto Neto:   8,293.00',
  '200099   RUIZ SOTO JUAN - Dealer',
  'Fecha de Ingreso:   08/sep/2026   RFC: XXXX000000XX0',
  'Salario Diario:   914.62   S.D.I:   959.71',
  'Total Percepciones:   8,448.08   Total Deducciones:   1,000.00',
  'Total Percepciones:   274,373.90   Total Deducciones:   70,064.40',
  'Neto a pagar:   204,309.50   Total de empleados:   2',
]

describe('listado de nómina (PDF)', () => {
  const l = leerListado(LINEAS)
  test('periodo y personas', () => {
    expect(l.periodo).toBe('Semanal No. 40 · del 28/sep/2026 al 04/oct/2026')
    expect(l.totalEmpleados).toBe(2)
    expect(l.personas).toEqual([
      { num: '90001', nombre: 'PEREZ LOPEZ ANA MARIA', puesto: 'Global Logistics', ingreso: '2024-07-15', salario_diario: 1183.61, sdi: 1356.9, totalPercepciones: 10481.34 },
      { num: '200099', nombre: 'RUIZ SOTO JUAN', puesto: 'Dealer', ingreso: '2026-09-08', salario_diario: 914.62, sdi: 959.71, totalPercepciones: 8448.08 },
    ])
  })
  test('fechas en español', () => expect(fechaListado('02/dic/2025')).toBe('2025-12-02'))

  const plantilla: Empleado[] = [
    { num: '90001', nombre: 'PEREZ LOPEZ ANA MARIA', puesto: 'Global Logistics Specialist', ingreso: '2024-07-15', salario_diario: 1165.68, sodexo: 200, activo: true, fuente: 'Listado S39' },
    { num: '90002', nombre: 'GOMEZ DIAZ LUIS', puesto: 'Buyer', ingreso: null, salario_diario: 1500, sodexo: 200, activo: true, fuente: 'Listado S39' },
  ]
  test('cambios: salario, alta y quien ya no aparece (sin marcar)', () => {
    const c = compararListado(plantilla, l.personas, 'Listado S40')
    expect(c.map((x) => [x.tipo, x.num, x.marcado])).toEqual([
      ['salario', '90001', true],
      ['nuevo', '200099', true],
      ['falta', '90002', false],
    ])
    const filas = aplicarCambios(plantilla, c, 'Listado S40')
    expect(filas.map((f) => [f.num, f.salario_diario, f.fuente, f.activo, f.puesto])).toEqual([
      ['200099', 914.62, 'Listado S40', true, 'Dealer'],
      ['90001', 1183.61, 'Listado S40', true, 'Global Logistics Specialist'],
    ])
  })
})

describe('base Salary 33 Threads (Excel)', () => {
  test('salario diario = bruto semanal ÷ 8.4', () => {
    const filas = [
      [null, 'Start Date', 'Num', 'Name', 'Position', 'Net Weekly Salary', 'Gross Weekly Salary'],
      [null, 46000, 90001, 'Ana Maria Perez Lopez', 'Global Logistics Specialist ', 8079.23, 9942.324],
      [null, null, 'Total', null, null, null, 1],
    ]
    expect(leerBase(filas)).toEqual([{ num: '90001', nombre: 'Ana Maria Perez Lopez', puesto: 'Global Logistics Specialist', ingreso: '2025-12-09', brutoSemanal: 9942.324, salario_diario: 1183.61 }])
  })
})
