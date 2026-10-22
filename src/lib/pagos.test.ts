import { describe, expect, it } from 'vitest'
import { pagosDelPlan, sumarMeses } from './pagos'
import { cotizarFeedbak } from './tabuladores'

describe('calendario de pagos', () => {
  const c = cotizarFeedbak({ producto: 'checador', colaboradores: 50, administradores: 2, moneda: 'MXN', tipoCambio: 17 })

  it('suma meses respetando fin de mes', () => {
    expect(sumarMeses('2026-01-31', 1)).toBe('2026-02-28')
    expect(sumarMeses('2026-11-15', 3)).toBe('2027-02-15')
    expect(sumarMeses('2028-01-31', 1)).toBe('2028-02-29')
  })

  it('mensual: 12 pagos, el primero con configuración inicial', () => {
    const pagos = pagosDelPlan('mensual', c, '2026-11-01')
    expect(pagos).toHaveLength(12)
    expect(pagos[0]).toEqual({ fecha: '2026-11-01', monto: c.primeraFactura })
    expect(pagos[1]).toEqual({ fecha: '2026-12-01', monto: c.totalMensual })
    expect(pagos[11].fecha).toBe('2027-10-01')
  })

  it('el primer pago coincide con el monto del plan del tabulador', () => {
    expect(pagosDelPlan('trimestral', c, '2026-11-01')[0].monto).toBeCloseTo(c.trimestral, 6)
    expect(pagosDelPlan('semestral', c, '2026-11-01')[0].monto).toBeCloseTo(c.semestral, 6)
    const anual = pagosDelPlan('anual', c, '2026-11-01')
    expect(anual).toHaveLength(1)
    expect(anual[0].monto).toBeCloseTo(c.anual, 6)
  })

  it('renovaciones sin configuración inicial y con su descuento', () => {
    const sem = pagosDelPlan('semestral', c, '2026-11-01')
    expect(sem.map((p) => p.fecha)).toEqual(['2026-11-01', '2027-05-01'])
    expect(sem[1].monto).toBeCloseTo(c.totalMensual * 6 * (1 - c.descuentoSemestral), 6)
  })

  it('precios manuales reemplazan al tabulador', () => {
    const m = cotizarFeedbak({
      producto: 'checador',
      colaboradores: 50,
      administradores: 5,
      moneda: 'USD',
      tipoCambio: 20,
      manual: { precioUsuario: 2, setup: 100, adminsIncluidos: 3, precioAdminExtra: 10, descuentoTrimestral: 0, descuentoSemestral: 0.1, descuentoAnual: 0.2 },
    })
    expect(m.totalMensual).toBe(2 * 50 + 10 * 2)
    expect(m.primeraFactura).toBe(220)
    expect(m.semestral).toBeCloseTo((220 + 120 * 5) * 0.9, 6)
  })
})
