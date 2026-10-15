import { describe, expect, test } from 'vitest'
import { calcularBono, opcionesIniciales, type Empleado, type FilaBono } from './calculo'
import { excelBonos, tablaCliente } from './reporte'

const emp = (num: string, nombre: string, sd: number): Empleado => ({ num, nombre, puesto: 'Buyer', ingreso: null, salario_diario: sd, sodexo: 200, activo: true, fuente: 'Listado de nómina S40' })
const fila = (id: string, num: string, c: Partial<FilaBono> = {}): FilaBono => ({ id, nombreCorreo: id, num, tipo: 'gross', usd: '250', estado: 'monto', notas: '', ...c })
const o = { ...opcionesIniciales(), titulo: 'Bonos Q4 2026', tipoCambio: '16.9712', fuenteTC: 'DOF' }
const rs = [calcularBono(fila('a', '1'), emp('1', 'ALEMAN CONTRERAS VIANEY', 1165.68), o), calcularBono(fila('b', '2', { estado: 'tbd', usd: '', notas: 'Later' }), emp('2', 'CAMARILLO EDGAR', 1500), o)]

describe('salidas', () => {
  test('tabla para el cliente: renglones, TBD y total', () => {
    const { texto, html } = tablaCliente(rs, o)
    const lineas = texto.split('\n')
    expect(lineas[1]).toBe('Aleman Contreras Vianey\tBuyer\tGross\t$250.00\t4,242.80\t2,719.36\t7.25%\t7,466.92\t')
    expect(lineas[2]).toContain('TBD')
    expect(lineas.at(-1)).toBe('Total\t\t\t$250.00\t4,242.80\t2,719.36\t\t7,466.92\t')
    expect(html).toContain('<table')
  })
  test('Excel con 3 hojas', async () => {
    const blob = await excelBonos(rs, o)
    expect(blob.size).toBeGreaterThan(2000)
  })
})
