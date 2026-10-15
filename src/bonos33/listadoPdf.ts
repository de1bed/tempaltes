import { totalesNomina, type FilaNomina, type Semana } from './nomina'

/**
 * PDF con el formato del "Listado de Nómina" del sistema (como LN_33_HILOS_S40.pdf): por persona,
 * percepciones y deducciones con sus claves, totales y neto; al final, los totales por concepto,
 * el bono de despensa (Sodexo), los impuestos patronales y la facturación a 33 Threads.
 * Es una simulación con la plantilla aprobada: no sustituye el recibo del sistema de nómina.
 */

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
/** "2024-07-15" → "15/jul/2024" */
export const fechaCorta = (iso: string | null | undefined) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? '')
  return m ? `${m[3]}/${MESES[Number(m[2]) - 1]}/${m[1]}` : '—'
}
const n2 = (x: number) => x.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export interface OpcionesListado {
  semana: Semana
  empresa: string
  /** Texto del bono (p. ej. "Bonos Q4 2026"), si la semana lleva bonos. */
  bono?: string
}

/** Renglones de percepciones y deducciones de una persona (clave, concepto, monto), como en el listado. */
export function conceptos(f: FilaNomina) {
  const r = f.r
  const percepciones: [string, string, number][] = [
    ['1', 'SUELDO ORDINARIO', r.percepciones[0].monto],
    ['2', 'SEPTIMO DIA', r.percepciones[1].monto],
    ['11', 'BONO DE ASISTENCIA', r.percepciones[3].monto],
    ['12', 'BONO DE PUNTUALIDAD', r.percepciones[2].monto],
  ]
  if (f.bono) percepciones.push(['16', 'GRATIFICACION (BONO)', f.bono])
  const deducciones: [string, string, number][] = [
    ['51', 'I S P T', r.deducciones[1].monto],
    ['52', 'IMSS', r.deducciones[0].monto],
  ]
  if (Math.abs(r.deducciones[2].monto) >= 0.005) deducciones.push(['99', 'AJUSTE POR DIFERENCIA DE MONEDA', r.deducciones[2].monto])
  return { percepciones, deducciones }
}

export async function listadoNominaPdf(filas: FilaNomina[], o: OpcionesListado): Promise<Blob> {
  const { jsPDF } = await import('jspdf')
  const pdf = new jsPDF({ unit: 'mm', format: 'letter', orientation: 'portrait', compress: true })
  const ancho = pdf.internal.pageSize.getWidth()
  const alto = pdf.internal.pageSize.getHeight()
  const mx = 12
  const der = ancho - mx
  const mitad = ancho / 2 + 2
  let pagina = 0
  let y = 0

  const texto = (t: string, x: number, yy: number, op: { tam?: number; negrita?: boolean; der?: boolean; gris?: boolean } = {}) => {
    pdf.setFont('helvetica', op.negrita ? 'bold' : 'normal')
    pdf.setFontSize(op.tam ?? 8)
    pdf.setTextColor(op.gris ? 90 : 20, op.gris ? 107 : 30, op.gris ? 112 : 35)
    pdf.text(t, x, yy, op.der ? { align: 'right' } : undefined)
  }
  const linea = (x1: number, x2: number, yy: number, grosor = 0.2) => {
    pdf.setDrawColor(150)
    pdf.setLineWidth(grosor)
    pdf.line(x1, yy, x2, yy)
  }

  function encabezado() {
    if (pagina > 0) pdf.addPage()
    pagina++
    texto(o.empresa, mx, 14, { tam: 11, negrita: true })
    texto('Listado de Nomina', mx, 19, { tam: 9 })
    texto(`Semanal No: ${o.semana.numero}`, mx, 23.5, { tam: 9 })
    texto(`Del ${fechaCorta(o.semana.desde)} al ${fechaCorta(o.semana.hasta)}`, mx, 28, { tam: 9 })
    texto('Simulación con la plantilla aprobada de corridas Treve', der, 14, { tam: 7, der: true, gris: true })
    if (o.bono) texto(`Incluye ${o.bono}`, der, 19, { tam: 8, der: true, negrita: true })
    linea(mx, der, 31, 0.4)
    y = 37
  }
  function pie() {
    texto(`Pagina: ${pagina}`, der, alto - 8, { tam: 7.5, der: true, gris: true })
  }

  const ALTO_PERSONA = 46
  encabezado()
  for (const f of filas) {
    if (y + ALTO_PERSONA > alto - 14) {
      pie()
      encabezado()
    }
    const e = f.empleado
    const r = f.r
    texto(`${e.num}`, mx, y, { negrita: true, tam: 8.5 })
    texto(`${e.nombre} - ${e.puesto || ''}`.trim(), mx + 16, y, { negrita: true, tam: 8.5 })
    y += 4.2
    texto(`Fecha de Ingreso:  ${fechaCorta(e.ingreso)}`, mx, y)
    texto(`Salario Diario:  ${n2(e.salario_diario)}`, mx + 52, y)
    texto(`S.B.C. IMSS:  ${n2(f.sbc)}`, mx + 100, y)
    texto(`Sodexo:  ${n2(e.sodexo)}`, mx + 145, y)
    y += 3.8
    texto('Dias pagados:  7.00 (6 + septimo)', mx, y, { gris: true })
    y += 5
    const { percepciones, deducciones } = conceptos(f)
    const filasConcepto = Math.max(percepciones.length, deducciones.length)
    for (let i = 0; i < filasConcepto; i++) {
      const p = percepciones[i]
      const d = deducciones[i]
      if (p) {
        texto(p[0], mx + 6, y, { der: true })
        texto(p[1], mx + 9, y)
        texto(n2(p[2]), mitad - 8, y, { der: true })
      }
      if (d) {
        texto(d[0], mitad + 6, y, { der: true })
        texto(d[1], mitad + 9, y)
        texto(n2(d[2]), der, y, { der: true })
      }
      y += 3.6
    }
    y += 1
    linea(mitad - 45, mitad - 8, y - 2.4)
    linea(der - 37, der, y - 2.4)
    texto('Total Percepciones:', mx + 50, y + 1)
    texto(n2(r.totalPercepciones.monto), mitad - 8, y + 1, { der: true, negrita: true })
    texto('Total Deducciones:', mitad + 50, y + 1)
    texto(n2(r.totalDeducciones.monto), der, y + 1, { der: true, negrita: true })
    y += 5
    texto('Monto Neto:', mx + 50, y)
    texto(n2(r.neto.monto), mitad - 8, y, { der: true, negrita: true })
    y += 7
    linea(mx, der, y - 3.5, 0.1)
  }

  // Totales generales por concepto.
  const t = totalesNomina(filas)
  if (y + 110 > alto - 14) {
    pie()
    encabezado()
  }
  texto('TOTALES DE LA NOMINA', mx, y, { negrita: true, tam: 9.5 })
  y += 6
  const suma = (i: number, deduccion = false) => {
    const acum = new Map<string, [string, number]>()
    for (const f of filas) for (const [c, nombre, m] of conceptos(f)[deduccion ? 'deducciones' : 'percepciones']) acum.set(c, [nombre, (acum.get(c)?.[1] ?? 0) + m])
    return [...acum].sort((a, b) => Number(a[0]) - Number(b[0]))[i]
  }
  for (let i = 0; i < 6; i++) {
    const p = suma(i)
    const d = suma(i, true)
    if (!p && !d) break
    if (p) {
      texto(p[0], mx + 6, y, { der: true })
      texto(p[1][0], mx + 9, y)
      texto(n2(p[1][1]), mitad - 8, y, { der: true })
    }
    if (d) {
      texto(d[0], mitad + 6, y, { der: true })
      texto(d[1][0], mitad + 9, y)
      texto(n2(d[1][1]), der, y, { der: true })
    }
    y += 3.8
  }
  y += 2
  linea(mx, der, y - 2.5)
  texto('Total Percepciones:', mx + 50, y + 1)
  texto(n2(t.bruto), mitad - 8, y + 1, { der: true, negrita: true })
  texto('Total Deducciones:', mitad + 50, y + 1)
  texto(n2(t.deducciones), der, y + 1, { der: true, negrita: true })
  y += 5.5
  texto('Neto a pagar:', mx + 50, y)
  texto(n2(t.neto), mitad - 8, y, { der: true, negrita: true })
  texto('Total de empleados:', mitad + 50, y)
  texto(String(t.personas), der, y, { der: true, negrita: true })
  y += 10

  texto('OTROS CONCEPTOS E IMPUESTOS', mx, y, { negrita: true, tam: 9.5 })
  y += 6
  const otros: [string, string, number, string, string, number][] = [
    ['026', 'BONO DE DESPENSA (SODEXO)', t.sodexo, '91', 'IMSS PATRONAL', t.imssPatronal],
    ['', '', 0, '92', 'INFONAVIT 5%', t.infonavit],
    ['', '', 0, '93', 'RETIRO CESANTIA Y VEJEZ', t.retiro],
    ['', '', 0, '94', 'IMPUESTO ESTATAL', t.estatal],
  ]
  for (const [c1, n1, m1, c2, nom2, m2] of otros) {
    if (c1) {
      texto(c1, mx + 6, y, { der: true })
      texto(n1, mx + 9, y)
      texto(n2(m1), mitad - 8, y, { der: true })
    }
    texto(c2, mitad + 6, y, { der: true })
    texto(nom2, mitad + 9, y)
    texto(n2(m2), der, y, { der: true })
    y += 3.8
  }
  y += 1
  linea(der - 37, der, y - 2.4)
  texto('Total Impuestos:', mitad + 50, y + 1)
  texto(n2(t.patronales), der, y + 1, { der: true, negrita: true })
  y += 10

  texto('FACTURACION 33 THREADS (SEMANAL)', mx, y, { negrita: true, tam: 9.5 })
  y += 6
  const factura: [string, number][] = [
    ['Salario bruto', t.bruto],
    ['Sodexo', t.sodexo],
    ['Impuestos patronales', t.patronales],
    ['Provision de finiquito', t.finiquito],
    ['Costos operativos y administrativos', t.administrativos],
    ['Total base', t.base],
    ['Costo de servicio', t.servicio],
  ]
  for (const [c, m] of factura) {
    texto(c, mx + 9, y)
    texto(n2(m), mitad - 8, y, { der: true })
    y += 3.8
  }
  linea(mitad - 45, mitad - 8, y - 2.4)
  texto('Factura semanal (+ IVA)', mx + 9, y + 1, { negrita: true })
  texto(n2(t.factura), mitad - 8, y + 1, { der: true, negrita: true })
  pie()
  return pdf.output('blob')
}

export const nombreListado = (o: OpcionesListado) => `Listado de Nomina 33 Hilos - Semana ${o.semana.numero} (${o.semana.desde} a ${o.semana.hasta})${o.bono ? ' - con bonos' : ''}`

