import { describe, expect, it } from 'vitest'
import { cotizarFeedbak, rango } from './tabuladores'

// Valores esperados tomados de las celdas calculadas de cada Excel.
describe('tabuladores Feedbak', () => {
  it('rangos coinciden con los IF del Excel', () => {
    expect([1, 100, 101, 500, 501, 1500, 1501, 3000, 3001, 7000, 7001, 11999, 12000].map(rango)).toEqual([
      0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6,
    ])
  })

  it('Mi Kiosko + Checador facial, 501 colaboradores', () => {
    const c = cotizarFeedbak({ producto: 'mk-checador-facial', colaboradores: 501, administradores: 0, moneda: 'MXN', tipoCambio: 17 })
    expect(c.precioUsuario).toBe(24)
    expect(c.totalMensual).toBe(12024)
    expect(c.setup).toBe(0)
    expect(c.semestral).toBeCloseTo(63486.72, 2)
    expect(c.anual).toBeCloseTo(122644.8, 2)
    expect(c.adminsIncluidos).toBe(6)
    expect(c.precioAdminExtra).toBe(100)
  })

  it('Checador normal, 50 colaboradores', () => {
    const c = cotizarFeedbak({ producto: 'checador', colaboradores: 50, administradores: 2, moneda: 'MXN', tipoCambio: 17 })
    expect(c.precioUsuario).toBe(24)
    expect(c.primeraFactura).toBe(3200)
    expect(c.semestral).toBeCloseTo(8924, 2)
    expect(c.anual).toBeCloseTo(15580, 2)
    expect(c.adminsExtra).toBe(0)
  })

  it('Checador facial, 22 colaboradores', () => {
    const c = cotizarFeedbak({ producto: 'checador-facial', colaboradores: 22, administradores: 0, moneda: 'MXN', tipoCambio: 17 })
    expect(c.totalMensual).toBe(572)
    expect(c.semestral).toBeCloseTo(5269.04, 2)
    expect(c.anual).toBeCloseTo(8420.8, 2)
  })

  it('Mi Kiosko + Checador, 100 colaboradores', () => {
    const c = cotizarFeedbak({ producto: 'mk-checador', colaboradores: 100, administradores: 0, moneda: 'MXN', tipoCambio: 17 })
    expect(c.setup).toBe(3000)
    expect(c.semestral).toBeCloseTo(23862, 2)
    expect(c.anual).toBeCloseTo(43890, 2)
  })

  it('cobra administradores extra y convierte a dólares', () => {
    const c = cotizarFeedbak({ producto: 'mk-checador', colaboradores: 50, administradores: 4, moneda: 'USD', tipoCambio: 20 })
    expect(c.adminsExtra).toBe(2)
    // (36*50 + 250*2) / 20
    expect(c.totalMensual).toBeCloseTo(115, 6)
  })
})
