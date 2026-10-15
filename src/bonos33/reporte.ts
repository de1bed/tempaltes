import { nombrePropio, num, totales, type OpcionesBonos, type ResultadoBono } from './calculo'
import { col, E, escribirXlsx, type Celda, type Hoja } from './xlsx'

/**
 * Salidas de la corrida de bonos: el Excel (tabla de facturación + corridas con y sin bono de
 * cada persona + notas) y la tabla en inglés que se manda al cliente para autorización.
 */

const usd = (x: number) => x.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
const mxn = (x: number) => x.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const ESTADO_EN: Record<ResultadoBono['estado'], string> = { ok: '', pendiente: 'TBD', excluido: 'N/A', sinEmpleado: 'Not found' }

export function nombreArchivo(o: OpcionesBonos) {
  return `Bonos 33 Hilos - ${o.titulo.trim() || 'corrida'}${o.fechaPago ? ` - ${o.fechaPago}` : ''}`.replace(/[\\/:*?"<>|]+/g, '-')
}

const textoCuotas = (o: OpcionesBonos) =>
  o.cuotas === 'semana' ? 'Employer contributions of the full bonus week (current format)' : 'Increase in employer contributions caused by the bonus'

/* ───────── Tabla para el cliente (correo) ───────── */

const COLUMNAS = ['Name', 'Position', 'Type', 'Bonus (USD)', 'Gross Bonus (MXN)', 'Employer Contributions', 'Service %', 'Total Billing (MXN)', 'Notes']

function filasCliente(rs: ResultadoBono[]): string[][] {
  return rs.map((r) => {
    const nombre = r.empleado ? nombrePropio(r.empleado.nombre) : r.fila.nombreCorreo
    const puesto = r.empleado?.puesto ?? ''
    if (r.estado !== 'ok') return [nombre, puesto, r.fila.estado === 'monto' ? (r.fila.tipo === 'net' ? 'Net' : 'Gross') : '', ESTADO_EN[r.estado], '', '', '', '', r.fila.notas]
    return [
      nombre,
      puesto,
      r.fila.tipo === 'net' ? 'Net' : 'Gross',
      usd(r.usd),
      mxn(r.bonoBruto),
      mxn(r.patronalesFactura),
      `${r.servicio}%`,
      mxn(r.totalFactura),
      [r.fila.tipo === 'net' ? `Net ${mxn(r.montoMxn)} MXN grossed up` : '', r.fila.notas].filter(Boolean).join(' · '),
    ]
  })
}

/** Tabla HTML (estilos en línea para Outlook) y texto con tabuladores (para Excel), lista para pegar. */
export function tablaCliente(rs: ResultadoBono[], o: OpcionesBonos): { html: string; texto: string } {
  const t = totales(rs)
  const filas = filasCliente(rs)
  const total = ['Total', '', '', usd(t.usd), mxn(t.bonoBruto), mxn(t.patronalesFactura), '', mxn(t.totalFactura), '']
  const th = 'style="background:#0b4c5e;color:#fff;padding:6px 10px;border:1px solid #0b4c5e;font:600 12px Arial;text-align:center"'
  const td = (i: number) => `style="padding:5px 10px;border:1px solid #d6dde0;font:12px Arial;${i >= 3 && i <= 7 ? 'text-align:right;white-space:nowrap' : ''}"`
  const tdTotal = (i: number) => `style="padding:6px 10px;border:1px solid #d6dde0;border-top:2px solid #0b4c5e;background:#eef1f2;font:700 12px Arial;${i >= 3 ? 'text-align:right;white-space:nowrap' : ''}"`
  const enc = `<p style="font:13px Arial;margin:0 0 8px"><b>33 Threads · ${escaparHtml(o.titulo)}</b><br>Exchange rate: <b>${num(o.tipoCambio).toFixed(4)}</b> MXN per USD${o.fuenteTC ? ` (${escaparHtml(o.fuenteTC)})` : ''}${o.fechaPago ? ` · Payment date: ${o.fechaPago}` : ''}<br>Total billing = (gross bonus + employer contributions) × (1 + service %). ${escaparHtml(textoCuotas(o))}.</p>`
  const html = `${enc}<table style="border-collapse:collapse"><thead><tr>${COLUMNAS.map((c) => `<th ${th}>${c}</th>`).join('')}</tr></thead><tbody>${filas
    .map((f) => `<tr>${f.map((c, i) => `<td ${td(i)}>${escaparHtml(c)}</td>`).join('')}</tr>`)
    .join('')}<tr>${total.map((c, i) => `<td ${tdTotal(i)}>${escaparHtml(c)}</td>`).join('')}</tr></tbody></table>`
  const texto = [COLUMNAS, ...filas, total].map((f) => f.join('\t')).join('\n')
  return { html, texto }
}

function escaparHtml(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/* ───────── Excel ───────── */

interface Bloque {
  /** Celda (hoja "Payroll runs") con las cuotas patronales que se facturan. */
  cuotas: string
  /** Celda con el bono bruto. */
  bono: string
}

function hojaCorridas(rs: ResultadoBono[], o: OpcionesBonos): { hoja: Hoja; bloques: Map<ResultadoBono, Bloque> } {
  const c: Record<string, Celda> = {}
  const combinadas: string[] = []
  const bloques = new Map<ResultadoBono, Bloque>()
  const servicio = num(o.servicio) / 100
  c.A1 = { v: `33 Threads · ${o.titulo} · weekly payroll run without and with bonus`, s: E.titulo }
  c.A2 = { v: 'Amounts from the approved Treve payroll template (income tax and state tax recalculated with the bonus; IMSS base capped at 25 UMA, as in payroll).', s: E.nota }
  combinadas.push('A2:E2')
  let f = 4
  for (const r of rs.filter((x) => x.estado === 'ok' && x.base && x.con)) {
    const b = r.base!
    const k = r.con!
    c[`A${f}`] = { v: `${nombrePropio(r.empleado!.nombre)} · ${r.empleado!.puesto}`, s: E.seccion }
    c[`E${f}`] = { v: `No. ${r.empleado!.num} · Daily salary ${mxn(b.salarioDiario)}`, s: E.nota }
    f++
    ;['Concept', 'Without bonus', 'With bonus', 'Difference'].forEach((t, i) => (c[`${col(i + 1)}${f}`] = { v: t, s: E.encabezado }))
    const ini = f + 1
    const filas: { t: string; sin?: number; con?: number; formula?: (cc: string) => string; s?: number }[] = [
      { t: 'Ordinary Salary', sin: b.percepciones[0].monto, con: k.percepciones[0].monto },
      { t: 'Seventh Day', sin: b.percepciones[1].monto, con: k.percepciones[1].monto },
      { t: 'Punctuality Bonus', sin: b.percepciones[2].monto, con: k.percepciones[2].monto },
      { t: 'Attendance bonus', sin: b.percepciones[3].monto, con: k.percepciones[3].monto },
      { t: r.fila.tipo === 'net' ? 'Bonus (net grossed up)' : 'Bonus', sin: 0, con: r.bonoBruto },
      { t: 'Weekly Gross Salary', formula: (cc) => `SUM(${cc}${ini}:${cc}${ini + 4})`, sin: b.totalPercepciones.monto, con: k.totalPercepciones.monto, s: E.dineroNegrita },
      { t: 'IMSS (Housing Fund)', sin: b.deducciones[0].monto, con: k.deducciones[0].monto },
      { t: 'ISPT (Tax Worker)', sin: b.deducciones[1].monto, con: k.deducciones[1].monto },
      { t: 'Currency Adjustments', sin: b.deducciones[2].monto, con: k.deducciones[2].monto },
      { t: 'Total deductions', formula: (cc) => `SUM(${cc}${ini + 6}:${cc}${ini + 8})`, sin: b.totalDeducciones.monto, con: k.totalDeducciones.monto, s: E.dineroNegrita },
      { t: 'Weekly Net Salary', formula: (cc) => `${cc}${ini + 5}-${cc}${ini + 9}`, sin: b.neto.monto, con: k.neto.monto, s: E.dineroNegrita },
      { t: 'Sodexo', sin: b.sodexo.monto, con: k.sodexo.monto },
      { t: 'Weekly Net Salary + Sodexo', formula: (cc) => `${cc}${ini + 10}+${cc}${ini + 11}`, sin: b.netoSodexo.monto, con: k.netoSodexo.monto, s: E.dineroNegrita },
      { t: 'IMSS (Company tax)', sin: b.patronales[0].monto, con: k.patronales[0].monto },
      { t: 'Infonavit', sin: b.patronales[1].monto, con: k.patronales[1].monto },
      { t: 'Retirement', sin: b.patronales[2].monto, con: k.patronales[2].monto },
      { t: 'State Tax', sin: b.patronales[3].monto, con: k.patronales[3].monto },
      { t: 'Total Taxes', formula: (cc) => `SUM(${cc}${ini + 13}:${cc}${ini + 16})`, sin: b.totalPatronales.monto, con: k.totalPatronales.monto, s: E.dineroNegrita },
      { t: 'Termination Provision', sin: b.costos[0].monto, con: k.costos[0].monto },
      { t: 'Operating and Administrative Costs', sin: b.costos[1].monto, con: k.costos[1].monto },
      { t: 'Total Base', formula: (cc) => `${cc}${ini + 5}+${cc}${ini + 11}+${cc}${ini + 17}+${cc}${ini + 18}+${cc}${ini + 19}`, sin: b.costos[2].monto, con: k.costos[2].monto, s: E.dineroNegrita },
      { t: `Service cost (${o.servicio}%)`, formula: (cc) => `${cc}${ini + 20}*${servicio}`, sin: b.costos[3].monto, con: k.costos[3].monto },
      { t: 'Weekly invoice (+ TAX)', formula: (cc) => `${cc}${ini + 20}+${cc}${ini + 21}`, sin: b.total.monto, con: k.total.monto, s: E.dineroNegrita },
    ]
    filas.forEach((x, i) => {
      const fila = ini + i
      const s = (x.s ?? E.dinero) as Celda['s']
      c[`A${fila}`] = { v: x.t, s: x.s ? E.negrita : E.normal }
      c[`B${fila}`] = { v: x.sin ?? 0, f: x.formula?.('B'), s }
      c[`C${fila}`] = { v: x.con ?? 0, f: x.formula?.('C'), s }
      c[`D${fila}`] = { v: (x.con ?? 0) - (x.sin ?? 0), f: `C${fila}-B${fila}`, s }
    })
    const fin = ini + filas.length
    c[`A${fin}`] = { v: 'Net bonus received by the employee', s: E.negrita }
    c[`D${fin}`] = { v: r.netoBono, f: `D${ini + 10}`, s: E.dineroResaltado }
    c[`A${fin + 1}`] = { v: `Employer contributions billed (${o.cuotas === 'semana' ? 'full bonus week' : 'increase only'})`, s: E.negrita }
    const celdaCuotas = o.cuotas === 'semana' ? `C${ini + 17}` : `D${ini + 17}`
    c[`D${fin + 1}`] = { v: r.patronalesFactura, f: celdaCuotas, s: E.dineroResaltado }
    bloques.set(r, { cuotas: `D${fin + 1}`, bono: `C${ini + 4}` })
    f = fin + 4
  }
  return { hoja: { nombre: 'Payroll runs', celdas: c, anchos: [38, 16, 16, 16, 40], combinadas }, bloques }
}

function hojaResumen(rs: ResultadoBono[], o: OpcionesBonos, bloques: Map<ResultadoBono, Bloque>): Hoja {
  const c: Record<string, Celda> = {}
  const tc = num(o.tipoCambio)
  c.A1 = { v: `33 Threads · ${o.titulo}`, s: E.titulo }
  c.A2 = { v: 'Exchange rate (MXN per USD)', s: E.negrita }
  c.B2 = { v: tc, s: E.tc }
  c.C2 = { v: o.fuenteTC || 'Captured by hand', s: E.nota }
  c.A3 = { v: 'Payment date', s: E.negrita }
  c.B3 = { v: o.fechaPago || '—' }
  c.A4 = { v: 'Employer contributions', s: E.negrita }
  c.B4 = { v: textoCuotas(o) }
  const h = 6
  COLUMNAS.forEach((t, i) => (c[`${col(i + 1)}${h}`] = { v: t, s: E.encabezado }))
  let f = h + 1
  const datos = rs
  for (const r of datos) {
    const nombre = r.empleado ? nombrePropio(r.empleado.nombre) : r.fila.nombreCorreo
    c[`A${f}`] = { v: nombre }
    c[`B${f}`] = { v: r.empleado?.puesto ?? '' }
    c[`C${f}`] = { v: r.fila.estado === 'monto' ? (r.fila.tipo === 'net' ? 'Net' : 'Gross') : '' }
    if (r.estado === 'ok') {
      const b = bloques.get(r)!
      c[`D${f}`] = { v: r.usd, s: E.usd }
      // Bruto: USD × TC. Neto: el bruto que deja ese neto (sale de la corrida con bono).
      c[`E${f}`] = r.fila.tipo === 'net' ? { v: r.bonoBruto, f: `'Payroll runs'!${b.bono}`, s: E.dinero } : { v: r.bonoBruto, f: `D${f}*$B$2`, s: E.dinero }
      c[`F${f}`] = { v: r.patronalesFactura, f: `'Payroll runs'!${b.cuotas}`, s: E.dinero }
      c[`G${f}`] = { v: r.servicio / 100, s: E.porcentaje }
      c[`H${f}`] = { v: r.totalFactura, f: `(E${f}+F${f})*(1+G${f})`, s: E.dineroNegrita }
      c[`I${f}`] = { v: [r.fila.tipo === 'net' ? `Net ${mxn(r.montoMxn)} MXN (USD × rate) grossed up` : '', r.fila.notas].filter(Boolean).join(' · '), s: E.nota }
    } else {
      c[`D${f}`] = { v: ESTADO_EN[r.estado] }
      c[`I${f}`] = { v: r.fila.notas, s: E.nota }
    }
    f++
  }
  const t = totales(rs)
  c[`A${f}`] = { v: 'Total', s: E.totalTexto }
  ;['B', 'C', 'G', 'I'].forEach((x) => (c[`${x}${f}`] = { v: '', s: E.totalTexto }))
  c[`D${f}`] = { v: t.usd, f: `SUM(D${h + 1}:D${f - 1})`, s: E.totalUsd }
  c[`E${f}`] = { v: t.bonoBruto, f: `SUM(E${h + 1}:E${f - 1})`, s: E.totalDinero }
  c[`F${f}`] = { v: t.patronalesFactura, f: `SUM(F${h + 1}:F${f - 1})`, s: E.totalDinero }
  c[`H${f}`] = { v: t.totalFactura, f: `SUM(H${h + 1}:H${f - 1})`, s: E.totalDinero }
  c[`A${f + 2}`] = { v: 'Total billing = (gross bonus + employer contributions) × (1 + service %). Gross bonus = USD × exchange rate; for net bonuses, the gross that leaves the net amount after income tax.', s: E.nota }
  return { nombre: 'Billing summary', celdas: c, anchos: [34, 34, 8, 13, 17, 17, 10, 18, 44], congelarFilas: h, combinadas: [`A${f + 2}:I${f + 2}`] }
}

function hojaNotas(rs: ResultadoBono[], o: OpcionesBonos, avisos: string[]): Hoja {
  const c: Record<string, Celda> = {}
  c.A1 = { v: 'Notas y validación', s: E.titulo }
  const lineas = [
    `Generado: ${new Date().toLocaleString('es-MX')}`,
    `Tipo de cambio: ${num(o.tipoCambio).toFixed(4)} — ${o.fuenteTC || 'capturado a mano'}`,
    'Cálculo: plantilla aprobada de corridas Treve (formato 33 Hilos). El bono entra como "otras percepciones" gravadas (Calculo!D49): se recalculan ISR e impuesto estatal; el IMSS no cambia.',
    'IMSS con el salario base de cotización topado a 25 UMA (IMSS Calculo!G3), como la nómina real y el Excel de bonos de Nóminas.',
    'Bonos netos: se busca el bruto que deja el neto pedido (USD × tipo de cambio) al centavo.',
    `Cuotas patronales facturadas: ${o.cuotas === 'semana' ? 'las de toda la semana con bono (formato actual del Excel)' : 'solo el incremento por el bono'}.`,
    ...rs.flatMap((r) => r.avisos.map((a) => `${r.empleado ? nombrePropio(r.empleado.nombre) : r.fila.nombreCorreo}: ${a}`)),
    ...avisos,
  ]
  lineas.forEach((l, i) => (c[`A${i + 3}`] = { v: l }))
  return { nombre: 'Notas', celdas: c, anchos: [140] }
}

export async function excelBonos(rs: ResultadoBono[], o: OpcionesBonos, avisos: string[] = []): Promise<Blob> {
  const { hoja: corridas, bloques } = hojaCorridas(rs, o)
  return escribirXlsx([hojaResumen(rs, o, bloques), corridas, hojaNotas(rs, o, avisos)])
}
