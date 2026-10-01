import { nombreSeguro } from '../lib/pdf'
import { calcularCorrida, resumenValidacion } from './calculo'
import generalXlsx from './plantillas/general.xlsx?url'
import hilos33Xlsx from './plantillas/hilos33.xlsx?url'
import kofileXlsx from './plantillas/kofile.xlsx?url'
import type { CorridaData, CorridaId, KofileData } from './tipos'

const PLANTILLAS_XLSX: Record<CorridaId, string> = { kofile: kofileXlsx, general: generalXlsx, hilos33: hilos33Xlsx }

const PREFIJO: Record<CorridaId, string> = { kofile: 'Corrida Kofile', general: 'Corrida General Treve', hilos33: 'Corrida 33 Hilos' }

/** "Corrida Kofile - Project Manager - Bruto mensual 50000 - 2026-10-01" */
export function nombreCorrida(id: CorridaId, d: CorridaData): string {
  const monto = d.monto.trim() || '0'
  const objetivo = {
    salarioDiario: `SD ${monto}`,
    brutoPeriodo: `Bruto ${id === 'kofile' ? 'catorcenal' : 'semanal'} ${monto}`,
    brutoMensual: `Bruto mensual ${monto}`,
    neto: `Neto ${monto}`,
    netoSodexo: `Neto+Sodexo ${monto}`,
  }[d.objetivo]
  const extras = [
    id === 'kofile' && (d as KofileData).esquema === 'asimilado' ? 'asimilado' : '',
    id === 'kofile' && !(d as KofileData).septimo ? 'sin septimo' : '',
    Number(d.sodexo) > 0 ? `Sodexo ${d.sodexo}` : 'sin Sodexo',
  ].filter(Boolean)
  return [PREFIJO[id], d.puesto.trim() || 'Puesto', `${objetivo} (${extras.join(', ')})`, d.fecha].join(' - ')
}

function guardar(datos: BlobPart, tipo: string, nombre: string) {
  const url = URL.createObjectURL(new Blob([datos], { type: tipo }))
  const a = document.createElement('a')
  a.href = url
  a.download = nombre
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

/** Excel completo: copia limpia de la plantilla aprobada con los datos capturados y todos los valores calculados. */
export async function descargarExcel(id: CorridaId, d: CorridaData) {
  const r = calcularCorrida(id, d)
  if (r.faltantes.length) throw new Error(`Faltan datos: ${r.faltantes.join(', ')}`)
  const [{ escribirExcel }, plantilla] = await Promise.all([import('./excel'), fetch(PLANTILLAS_XLSX[id]).then((res) => res.arrayBuffer())])
  const datos = await escribirExcel(plantilla, r.libros[0].libro, r.estilosExcel)
  guardar(datos as BlobPart, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', `${nombreSeguro(nombreCorrida(id, d))}.xlsx`)
}

/** Resumen de validación (entradas, supuestos, resultados y celdas capturadas) en JSON. */
export function descargarValidacion(id: CorridaId, d: CorridaData) {
  const r = calcularCorrida(id, d)
  guardar(JSON.stringify(resumenValidacion(id, d, r), null, 2), 'application/json', `${nombreSeguro(nombreCorrida(id, d))} - validacion.json`)
}
