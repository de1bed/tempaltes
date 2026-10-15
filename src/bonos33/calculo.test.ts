import { describe, expect, test } from 'vitest'
import { brutoParaNeto, calcularBono, corridaSemana, emparejar, leerTablaCorreo, opcionesIniciales, type Empleado, type FilaBono } from './calculo'
import excel from './pruebas/excel-bonos-q4.json'

// Bloques de la hoja "CORRIDDAS DE ACTIVOS" del Excel de bonos Q4 que mandó Nóminas (solo montos).
const emp = (sd: number, sodexo = 200, nombre = 'PRUEBA PERSONA'): Empleado => ({ num: '1', nombre, puesto: 'Puesto', ingreso: null, salario_diario: sd, sodexo, activo: true, fuente: 'Listado de nómina' })

describe('reproduce el Excel de bonos de Nóminas', () => {
  // Bloques donde el Excel es consistente (el salario de la semana con bono es el mismo de la semana normal).
  const casos = excel.filter((c) => c.bono > 0)
  test.each(casos.map((c) => [c.caso, c] as const))('%s', (_, c) => {
    const e = emp(c.sd, c.sodexo)
    const base = corridaSemana(e, 0)
    const con = corridaSemana(e, c.bono)
    expect(con.totalPercepciones.monto).toBeCloseTo(c.con.bruto, 2)
    // ISR e impuesto estatal están tecleados en el Excel (a veces con 1 centavo de diferencia).
    expect(con.deducciones[1].monto).toBeCloseTo(c.con.isr, 1)
    expect(con.deducciones[0].monto).toBeCloseTo(c.con.imss, 2)
    expect(con.neto.monto).toBeCloseTo(c.con.neto, 1)
    expect(con.patronales[3].monto).toBeCloseTo(c.con.estatal, 1)
    expect(con.totalPatronales.monto).toBeCloseTo(c.con.patronales, 1)
    expect(con.total.monto).toBeCloseTo(c.con.factura, 1)
    expect(base.deducciones[0].monto).toBeCloseTo(c.con.imss, 2)
  })
})

describe('bono neto (gross-up)', () => {
  test('1,250 USD netos con TC 16.9712 → bruto 31,914.36 (como el Excel)', () => {
    const e = emp(2993.35)
    const bruto = brutoParaNeto(e, 1250 * 16.9712)
    expect(bruto).toBeCloseTo(31914.36, 1)
    const extra = corridaSemana(e, bruto).neto.monto - corridaSemana(e, 0).neto.monto
    expect(Math.abs(extra - 21214)).toBeLessThan(0.02)
  })
})

describe('tabla del correo', () => {
  const pegado = [
    'Name\t\tBonus amount\n(USD)\tNotes',
    'Angeles, Regine\tGross\t$417.00\t',
    'Camarillo, Edgar\t\tTBD\tI will share as soon as I have it',
    'Vargas, Francisco\tNet\t$1,250.00\t',
    'Hernandez, Ulises\tGross\tN/A\t',
  ].join('\n')
  test('lee nombres, tipo, monto, TBD y N/A', () => {
    const f = leerTablaCorreo(pegado)
    expect(f.map((x) => [x.nombreCorreo, x.tipo, x.usd, x.estado])).toEqual([
      ['Angeles, Regine', 'gross', '417', 'monto'],
      ['Camarillo, Edgar', 'gross', '', 'tbd'],
      ['Vargas, Francisco', 'net', '1250', 'monto'],
      ['Hernandez, Ulises', 'gross', '', 'na'],
    ])
    expect(f[1].notas).toBe('I will share as soon as I have it')
  })
  test('acepta columnas separadas por espacios y celdas en renglones', () => {
    expect(leerTablaCorreo('Vargas, Francisco    Net    $1,250.00').map((x) => [x.tipo, x.usd])).toEqual([['net', '1250']])
    expect(leerTablaCorreo('Angeles, Regine\nGross\n$417.00\nMeza Arredondo, Jorge A.\nGross\n$1,719.00').map((x) => [x.nombreCorreo, x.usd])).toEqual([
      ['Angeles, Regine', '417'],
      ['Meza Arredondo, Jorge A.', '1719'],
    ])
  })
})

describe('emparejar nombres del correo con la plantilla', () => {
  const plantilla = ['HERNANDEZ MARTINEZ ANDREA ISABEL', 'HERNANDEZ ZAVALA ULISES AMAURY', 'GUTIERREZ SANDOVAL BRENDA', 'ROSAS GUTIERREZ WENDY ALESSANDRA', 'ARAIZA SAUCEDO BRENDA ELIZABETH', 'VIRREY CERRITEÑO JUAN ALBERTO'].map((n, i) => ({ ...emp(1000), num: String(i), nombre: n }))
  test.each([
    ['Hernandez Martinez, Andrea I.', 'HERNANDEZ MARTINEZ ANDREA ISABEL'],
    ['Hernandez, Ulises', 'HERNANDEZ ZAVALA ULISES AMAURY'],
    ['Gutierrez Sandoval, Brenda', 'GUTIERREZ SANDOVAL BRENDA'],
    ['Virrey, Juan', 'VIRREY CERRITEÑO JUAN ALBERTO'],
  ])('%s', (correo, esperado) => expect(emparejar(correo, plantilla)?.nombre).toBe(esperado))
  test('sin coincidencia suficiente no adivina', () => expect(emparejar('Hernandez, Pedro', plantilla)).toBeNull())
})

describe('facturación', () => {
  const fila: FilaBono = { id: 'a', nombreCorreo: 'x', num: '1', tipo: 'gross', usd: '250', estado: 'monto', notas: '' }
  const o = { ...opcionesIniciales(), tipoCambio: '16.9712' }
  test('semana completa: (bono + cuotas de la semana con bono) × 1.0725, como la tabla del Excel', () => {
    const r = calcularBono(fila, emp(1165.68), o)
    expect(r.bonoBruto).toBeCloseTo(4242.8, 2)
    expect(r.patronalesFactura).toBeCloseTo(2719.36, 2)
    expect(r.totalFactura).toBeCloseTo(7466.92, 2)
  })
  test('solo incremento: cuotas que sube el bono', () => {
    const r = calcularBono(fila, emp(1165.68), { ...o, cuotas: 'incremento' })
    expect(r.patronalesFactura).toBeCloseTo(194.32, 2)
  })
  test('TBD y N/A no se calculan', () => {
    expect(calcularBono({ ...fila, estado: 'tbd', usd: '' }, emp(1000), o).estado).toBe('pendiente')
    expect(calcularBono({ ...fila, estado: 'na', usd: '' }, emp(1000), o).estado).toBe('excluido')
    expect(calcularBono(fila, null, o).estado).toBe('sinEmpleado')
  })
})
