import { hoyISO } from '../lib/formato'

/** Datos que se capturan para una corrida. Los montos se guardan como texto (tal cual se escriben). */

export type CorridaId = 'kofile' | 'general' | 'hilos33'

/**
 * Qué fija el usuario; la app calcula el salario diario para llegar a ese monto:
 * - salarioDiario: se captura tal cual (no se busca nada).
 * - brutoPeriodo:  total de percepciones del periodo (catorcenal en Kofile, semanal en General/33 Hilos).
 * - brutoMensual:  salario mensual; salario diario = mensual ÷ factor mensual de la plantilla (Calculo!J55 = 30.4).
 * - neto:          neto a pagar (percepciones − deducciones).
 * - netoSodexo:    neto a pagar + Sodexo.
 */
export type Objetivo = 'salarioDiario' | 'brutoPeriodo' | 'brutoMensual' | 'neto' | 'netoSodexo'

/**
 * Conceptos adicionales que a veces piden. Los que tienen renglón en la hoja Calculo de la
 * plantilla se capturan ahí (entran a ISR con las exenciones del propio Excel); los que no
 * tienen renglón en ese formato quedan como pendientes y no se calculan (ver calculo.ts).
 */
export const CONCEPTOS_EXTRA = {
  primaDominical: 'Prima dominical',
  horasExtraDobles: 'Horas extra dobles',
  horasExtraTriples: 'Horas extra triples',
  bonoTurno: 'Bono de turno',
  bonoTransporte: 'Bono de transporte',
  fondoAhorro: 'Fondo de ahorro',
  otrasPercepciones: 'Otras percepciones',
} as const
export type ConceptoExtra = keyof typeof CONCEPTOS_EXTRA

interface CorridaBase {
  idioma: 'es' | 'en'
  fecha: string
  /** Cliente o proyecto. */
  empresa: string
  puesto: string
  objetivo: Objetivo
  monto: string
  /** Decimales del salario diario que se busca (2 como en nómina, 6 como en los ejemplos Kofile). */
  decimales: '2' | '6'
  sodexo: string
  ajusteMoneda: string
  /** Montos por periodo de pago (texto tal cual se escribe). */
  extras: Partial<Record<ConceptoExtra, string>>
  observaciones: string
  elaboro: string
}

export interface KofileData extends CorridaBase {
  /** nómina = hoja Simulacion (ISR por tabla + IMSS); asimilado = hoja Simulacion Asimilado (bloque Genérica) + factura bi-weekly. */
  esquema: 'nomina' | 'asimilado'
  septimo: boolean
  /** Calculo!D44: (SD × días) × 25% / 12 / 2.17. La plantilla usa 24. */
  diasVacaciones: string
  /** Calculo!E19: por plantilla es el salario mensual (SD × 30.4); se puede fijar un monto mensual. */
  bonoDesempeno: 'plantilla' | 'monto'
  bonoDesempenoMonto: string
  ptu: string
  internet: string
  navideno: string
  costoOperativo: string
  medicoAnual: string
  seguroVidaAnual: string
  serviceFee: string
  tipoCambio: string
}

export type GeneralData = CorridaBase

export interface Hilos33Data extends CorridaBase {
  servicio: string
  costosAdministrativos: string
}

export type CorridaData = KofileData | GeneralData | Hilos33Data

const base = (): Omit<CorridaBase, 'decimales' | 'idioma'> => ({
  fecha: hoyISO(),
  empresa: '',
  puesto: '',
  objetivo: 'neto',
  monto: '',
  sodexo: '0',
  ajusteMoneda: '0',
  extras: {},
  observaciones: '',
  elaboro: '',
})

export function corridasIniciales(): { kofile: KofileData; general: GeneralData; hilos33: Hilos33Data } {
  return {
    kofile: {
      ...base(),
      idioma: 'es',
      empresa: 'Kofile',
      objetivo: 'brutoPeriodo',
      decimales: '6',
      esquema: 'nomina',
      septimo: true,
      diasVacaciones: '24',
      bonoDesempeno: 'plantilla',
      bonoDesempenoMonto: '',
      // Valores de la plantilla aprobada (Calculo!D46, D49, D50 y bloque Genérica de Simulacion Asimilado).
      ptu: '1520.58',
      internet: '138.25',
      navideno: '17.28',
      costoOperativo: '1900',
      medicoAnual: '41842.42',
      seguroVidaAnual: '3000',
      serviceFee: '11',
      tipoCambio: '18.2',
    },
    general: { ...base(), idioma: 'es', decimales: '2', sodexo: '200', objetivo: 'netoSodexo' },
    hilos33: { ...base(), idioma: 'en', empresa: '33 Hilos', decimales: '2', sodexo: '200', objetivo: 'salarioDiario', servicio: '7.25', costosAdministrativos: '500' },
  }
}
