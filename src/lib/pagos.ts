import { num } from './formato'
import type { FeedbakData, PlanPago, PreciosManualesTexto } from './modelo'
import { preciosTabulador, type CotizacionFeedbak, type EntradaFeedbak } from './tabuladores'

/** Datos del formulario → entrada del cálculo (con precios a mano si el tabulador está apagado). */
export function entradaFeedbak(d: FeedbakData): EntradaFeedbak {
  const base = { producto: d.producto, colaboradores: num(d.colaboradores), administradores: num(d.administradores), moneda: d.moneda, tipoCambio: num(d.tipoCambio) }
  if (d.usarTabulador !== false) return base
  const m = d.manual
  return {
    ...base,
    manual: {
      precioUsuario: num(m.precioUsuario),
      setup: num(m.setup),
      adminsIncluidos: num(m.adminsIncluidos),
      precioAdminExtra: num(m.precioAdminExtra),
      descuentoTrimestral: num(m.descuentoTrimestral) / 100,
      descuentoSemestral: num(m.descuentoSemestral) / 100,
      descuentoAnual: num(m.descuentoAnual) / 100,
    },
  }
}

/** Al apagar el tabulador se arranca con sus mismos precios, para solo cambiar lo necesario. */
export function manualDesdeTabulador(d: FeedbakData): PreciosManualesTexto {
  const p = preciosTabulador({ ...entradaFeedbak({ ...d, usarTabulador: true }) })
  const dos = (n: number) => String(+n.toFixed(2))
  return {
    precioUsuario: dos(p.precioUsuario),
    setup: dos(p.setup),
    adminsIncluidos: String(p.adminsIncluidos),
    precioAdminExtra: dos(p.precioAdminExtra),
    descuentoTrimestral: dos(p.descuentoTrimestral * 100),
    descuentoSemestral: dos(p.descuentoSemestral * 100),
    descuentoAnual: dos(p.descuentoAnual * 100),
  }
}

/** Meses que cubre cada pago y su descuento. */
export function periodoPlan(plan: PlanPago, c: CotizacionFeedbak): { meses: number; descuento: number } {
  switch (plan) {
    case 'mensual':
      return { meses: 1, descuento: 0 }
    case 'trimestral':
      return { meses: 3, descuento: c.descuentoTrimestral }
    case 'semestral':
      return { meses: 6, descuento: c.descuentoSemestral }
    case 'anual':
      return { meses: 12, descuento: c.descuentoAnual }
  }
}

/** 'YYYY-MM-DD' + n meses; si el día no existe en ese mes, se usa el último día (31 ene + 1 = 28/29 feb). */
export function sumarMeses(iso: string, n: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  const total = (m - 1) + n
  const anio = y + Math.floor(total / 12)
  const mes = ((total % 12) + 12) % 12
  const ultimo = new Date(Date.UTC(anio, mes + 1, 0)).getUTCDate()
  return `${anio}-${String(mes + 1).padStart(2, '0')}-${String(Math.min(d, ultimo)).padStart(2, '0')}`
}

export interface Pago {
  fecha: string
  monto: number
}

/**
 * Pagos de un plan en los primeros `meses` meses, empezando en `inicio`.
 * El primer pago incluye la configuración inicial (igual que el tabulador); los siguientes son renovaciones del periodo.
 */
export function pagosDelPlan(plan: PlanPago, c: CotizacionFeedbak, inicio: string, meses = 12): Pago[] {
  const { meses: periodo, descuento } = periodoPlan(plan, c)
  const pagos: Pago[] = []
  for (let mes = 0; mes < meses; mes += periodo) {
    const base = mes === 0 ? c.primeraFactura + c.totalMensual * (periodo - 1) : c.totalMensual * periodo
    pagos.push({ fecha: sumarMeses(inicio, mes), monto: base * (1 - descuento) })
  }
  return pagos
}
