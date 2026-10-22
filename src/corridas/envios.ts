// Corridas → cotizaciones: quien hace la corrida la manda; quien hace cotizaciones la convierte
// en una cotización de nómina (Staffvia · Nómina) con los montos ya puestos.
import type { PayrollData } from '../lib/modelo'
import { supabase, type Perfil } from '../lib/supabase'
import type { ResultadoCorrida } from './calculo'
import type { CorridaData, CorridaId } from './tipos'

export const NOMBRES_CORRIDA: Record<CorridaId, string> = { kofile: 'Kofile', general: 'General Treve', hilos33: '33 Hilos' }

/** Montos de la corrida llevados a semana (la cotización de nómina se captura semanal). */
export interface ResumenCorrida {
  periodo: string
  dias: number
  salarioDiario: number
  /** Total de percepciones por semana. */
  brutoSemanal: number
  /** Cuotas patronales (IMSS, Infonavit, RCV, ISN) por semana. */
  patronalesSemanal: number
  /** Provisión de finiquito (vacaciones, aguinaldo, prima) por semana. */
  provisionSemanal: number
  netoPeriodo: number
  totalEtiqueta: string
  totalPeriodo: number
}

export interface EnvioCorrida {
  id: string
  creado: string
  enviado_por: string | null
  enviado_por_email: string
  enviado_por_nombre: string
  corrida: CorridaId
  empresa: string
  puesto: string
  nota: string
  resumen: ResumenCorrida
  datos: CorridaData
  estado: 'pendiente' | 'convertida' | 'descartada'
  atendido_por: string | null
  atendido_por_nombre: string | null
  atendido_en: string | null
}

const redondear = (n: number) => Math.round(n * 100) / 100

export function resumenCorrida(r: ResultadoCorrida): ResumenCorrida {
  const aSemana = 7 / (r.periodo.dias || 7)
  const provision = r.costos.filter((l) => /finiquito|termination/i.test(l.concepto)).reduce((s, l) => s + l.monto, 0)
  return {
    periodo: r.periodo.nombre,
    dias: r.periodo.dias,
    salarioDiario: r.salarioDiario,
    brutoSemanal: redondear(r.totalPercepciones.monto * aSemana),
    patronalesSemanal: redondear(r.totalPatronales.monto * aSemana),
    provisionSemanal: redondear(provision * aSemana),
    netoPeriodo: redondear(r.neto.monto),
    totalEtiqueta: r.total.concepto,
    totalPeriodo: redondear(r.total.monto),
  }
}

export async function enviarCorrida(id: CorridaId, d: CorridaData, r: ResultadoCorrida, perfil: Perfil, nota: string) {
  const { error } = await supabase.from('envios_corrida').insert({
    enviado_por_nombre: perfil.nombre || perfil.email,
    corrida: id,
    empresa: d.empresa.trim(),
    puesto: d.puesto.trim(),
    nota: nota.trim().slice(0, 1000),
    resumen: resumenCorrida(r),
    datos: d,
  })
  if (error) throw new Error(error.message.includes('row-level') ? 'No tienes permiso para mandar corridas.' : 'No se pudo enviar. Intenta de nuevo.')
}

export async function leerEnvios(): Promise<EnvioCorrida[]> {
  const { data, error } = await supabase.from('envios_corrida').select('*').order('creado', { ascending: false }).limit(200)
  if (error) throw new Error('No se pudieron cargar las corridas recibidas.')
  return data as EnvioCorrida[]
}

export async function marcarEnvio(id: string, estado: 'convertida' | 'descartada', perfil: Perfil) {
  const { error } = await supabase
    .from('envios_corrida')
    .update({ estado, atendido_por: perfil.id, atendido_por_nombre: perfil.nombre || perfil.email, atendido_en: new Date().toISOString() })
    .eq('id', id)
  if (error) throw new Error('No se pudo actualizar. Intenta de nuevo.')
}

/** Datos para la cotización de nómina a partir de la corrida (montos semanales). */
export function nominaDesdeCorrida(e: EnvioCorrida, actual: PayrollData): PayrollData {
  const r = e.resumen
  const puesto = e.puesto || actual.puesto
  return {
    ...actual,
    empresa: e.empresa || actual.empresa,
    puesto,
    tituloPortada: puesto,
    clientePortada: e.empresa ? `TREVE – ${e.empresa}` : actual.clientePortada,
    headcount: actual.headcount || '1',
    salario: r.brutoSemanal.toFixed(2),
    impuestos: r.patronalesSemanal.toFixed(2),
    prestaciones: r.provisionSemanal.toFixed(2),
  }
}
