import type { ResultadoCorrida } from '../corridas/calculo'
import { ajusteMoneda, corridaSemana, type Empleado } from './calculo'

/**
 * Nómina semanal de toda la plantilla de 33 Hilos con la corrida aprobada: lo mismo que la base
 * "Salary 33 Threads" (neto, bruto, cuotas patronales, finiquito, costos, servicio y total a
 * facturar por persona) y el detalle para el listado de nómina (PDF).
 */

export interface Semana {
  numero: number
  /** Lunes y domingo (YYYY-MM-DD). */
  desde: string
  hasta: string
}

/** Semana ISO (lunes a domingo) de una fecha, como "Semanal No: 40 · del 28/sep al 04/oct". */
export function semanaDe(fecha: Date): Semana {
  const d = new Date(Date.UTC(fecha.getFullYear(), fecha.getMonth(), fecha.getDate()))
  const dia = d.getUTCDay() || 7
  const lunes = new Date(d.getTime() - (dia - 1) * 86400000)
  const jueves = new Date(lunes.getTime() + 3 * 86400000)
  const inicioAnio = new Date(Date.UTC(jueves.getUTCFullYear(), 0, 1))
  const numero = Math.floor((jueves.getTime() - inicioAnio.getTime()) / 86400000 / 7) + 1
  const iso = (x: Date) => x.toISOString().slice(0, 10)
  return { numero, desde: iso(lunes), hasta: iso(new Date(lunes.getTime() + 6 * 86400000)) }
}

/** Semana número `n` del año (ISO). */
export function semanaNumero(anio: number, n: number): Semana {
  const enero4 = new Date(Date.UTC(anio, 0, 4))
  const lunes1 = new Date(enero4.getTime() - ((enero4.getUTCDay() || 7) - 1) * 86400000)
  return semanaDe(new Date(lunes1.getTime() + (n - 1) * 7 * 86400000 + 12 * 3600000))
}

export interface FilaNomina {
  empleado: Empleado
  r: ResultadoCorrida
  /** Bono bruto de la semana (0 si no hay). */
  bono: number
  /** Salario diario integrado que usa el IMSS (topado a 25 UMA). */
  sbc: number
}

/** `redondear`: neto en múltiplos de 50 centavos con el ajuste por diferencia de moneda, como el sistema de nómina. */
export function nominaSemanal(empleados: Empleado[], servicio = '7.25', bonos: Map<string, number> = new Map(), redondear = true): FilaNomina[] {
  return empleados.map((e) => {
    const bono = bonos.get(e.num) ?? 0
    const sinAjuste = corridaSemana(e, bono, servicio)
    const ajuste = redondear ? ajusteMoneda(sinAjuste.neto.monto) : 0
    const r = ajuste ? corridaSemana(e, bono, servicio, ajuste) : sinAjuste
    const libro = r.libros.find((l) => l.plantilla === 'general')?.libro
    const sbc = Number(libro?.valor('IMSS Calculo', 'D3') ?? 0)
    return { empleado: e, r, bono, sbc }
  })
}

export interface TotalesNomina {
  personas: number
  bruto: number
  bono: number
  imss: number
  isr: number
  deducciones: number
  neto: number
  sodexo: number
  netoSodexo: number
  imssPatronal: number
  infonavit: number
  retiro: number
  estatal: number
  patronales: number
  finiquito: number
  administrativos: number
  base: number
  servicio: number
  factura: number
}

export function totalesNomina(filas: FilaNomina[]): TotalesNomina {
  const t: TotalesNomina = { personas: filas.length, bruto: 0, bono: 0, imss: 0, isr: 0, deducciones: 0, neto: 0, sodexo: 0, netoSodexo: 0, imssPatronal: 0, infonavit: 0, retiro: 0, estatal: 0, patronales: 0, finiquito: 0, administrativos: 0, base: 0, servicio: 0, factura: 0 }
  for (const { r, bono } of filas) {
    t.bruto += r.totalPercepciones.monto
    t.bono += bono
    t.imss += r.deducciones[0].monto
    t.isr += r.deducciones[1].monto
    t.deducciones += r.totalDeducciones.monto
    t.neto += r.neto.monto
    t.sodexo += r.sodexo.monto
    t.netoSodexo += r.netoSodexo.monto
    t.imssPatronal += r.patronales[0].monto
    t.infonavit += r.patronales[1].monto
    t.retiro += r.patronales[2].monto
    t.estatal += r.patronales[3].monto
    t.patronales += r.totalPatronales.monto
    t.finiquito += r.costos[0].monto
    t.administrativos += r.costos[1].monto
    t.base += r.costos[2].monto
    t.servicio += r.costos[3].monto
    t.factura += r.total.monto
  }
  return t
}

/** Bonos brutos por número de empleado, a partir de los resultados de la corrida de bonos. */
export function bonosPorEmpleado(rs: { estado: string; empleado: Empleado | null; bonoBruto: number }[]): Map<string, number> {
  const m = new Map<string, number>()
  for (const r of rs) if (r.estado === 'ok' && r.empleado) m.set(r.empleado.num, (m.get(r.empleado.num) ?? 0) + r.bonoBruto)
  return m
}

