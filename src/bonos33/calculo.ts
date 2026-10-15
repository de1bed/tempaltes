import { calcularCorrida, type ResultadoCorrida } from '../corridas/calculo'
import { corridasIniciales, type Hilos33Data } from '../corridas/tipos'

/**
 * Bonos trimestrales de 33 Hilos (33 Threads).
 *
 * El cliente manda por correo una tabla con el bono de cada persona en dólares (bruto o neto).
 * Se convierte con el tipo de cambio FIX que publica el DOF para la fecha de pago y se corre la
 * semana con el bono como "otras percepciones" gravadas (Calculo!D49 de la plantilla aprobada),
 * igual que en el Excel de Nóminas: el ISR y el impuesto estatal se recalculan; el IMSS no cambia.
 * Si el bono es neto, se busca el bruto que deja ese neto adicional (gross-up).
 */

export interface Empleado {
  num: string
  /** Como en el listado de nómina: APELLIDOS NOMBRES. */
  nombre: string
  puesto: string
  ingreso: string | null
  salario_diario: number
  sodexo: number
  activo: boolean
  /** De dónde salió el salario (listado de nómina, base Salary…). */
  fuente: string
  actualizado?: string
}

export type TipoBono = 'gross' | 'net'
/** monto = hay cantidad; tbd = el cliente aún no la manda; na = no aplica. */
export type EstadoFila = 'monto' | 'tbd' | 'na'

export interface FilaBono {
  id: string
  /** Nombre tal como viene en el correo ("Angeles, Regine"). */
  nombreCorreo: string
  /** Empleado de la plantilla con quien se emparejó. */
  num: string | null
  tipo: TipoBono
  usd: string
  estado: EstadoFila
  notas: string
}

/**
 * Cuotas patronales que se facturan con el bono:
 * - semana: las de toda la semana con bono (como la tabla del Excel actual).
 * - incremento: solo lo que sube por el bono (impuesto estatal; el IMSS no cambia).
 */
export type BaseCuotas = 'semana' | 'incremento'

export interface OpcionesBonos {
  titulo: string
  fechaPago: string
  tipoCambio: string
  /** Texto de dónde salió el tipo de cambio (DOF, fecha de publicación). */
  fuenteTC: string
  servicio: string
  cuotas: BaseCuotas
}

export const opcionesIniciales = (): OpcionesBonos => ({
  titulo: `Bonos ${trimestre(new Date())}`,
  fechaPago: '',
  tipoCambio: '',
  fuenteTC: '',
  servicio: '7.25',
  cuotas: 'semana',
})

function trimestre(d: Date) {
  return `Q${Math.floor(d.getMonth() / 3) + 1} ${d.getFullYear()}`
}

export const num = (s: string | number | undefined | null) => {
  if (typeof s === 'number') return Number.isFinite(s) ? s : 0
  const n = parseFloat(String(s ?? '').replace(/[$,\s]/g, ''))
  return Number.isFinite(n) ? n : 0
}

const centavos = (x: number) => Math.round(x * 100) / 100

/* ───────── Nombres ───────── */

/** Palabras de un nombre sin acentos ni signos: "Hernández Martínez, Andrea I." → [hernandez, martinez, andrea, i]. */
export function palabras(nombre: string): string[] {
  return nombre
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
}

/** Qué tanto se parece un nombre del correo al de la plantilla: palabras completas iguales (1) e iniciales (0.5). */
export function parecido(correo: string, plantilla: string): number {
  const p = palabras(plantilla)
  let puntos = 0
  for (const w of palabras(correo)) {
    if (p.includes(w)) puntos += 1
    else if (w.length === 1 && p.some((x) => x.startsWith(w))) puntos += 0.5
  }
  return puntos
}

/** La persona de la plantilla que corresponde al nombre del correo (al menos 2 palabras y sin empate). */
export function emparejar(correo: string, empleados: Empleado[]): Empleado | null {
  const orden = empleados.map((e) => ({ e, p: parecido(correo, e.nombre) })).sort((a, b) => b.p - a.p)
  const [mejor, segundo] = orden
  if (!mejor || mejor.p < 2) return null
  if (segundo && segundo.p === mejor.p) return null
  return mejor.e
}

/* ───────── Tabla del correo ───────── */

const ENCABEZADO = /^(name|nombre|bonus amount|\(usd\)|notes|notas)$/i

/**
 * Lee la tabla pegada del correo (copiada de Outlook llega separada por tabuladores; también
 * acepta columnas separadas por varios espacios). Columnas: nombre, Gross/Net, monto en USD
 * (o TBD / N/A) y notas.
 */
export function leerTablaCorreo(texto: string): Omit<FilaBono, 'id' | 'num'>[] {
  const filas: Omit<FilaBono, 'id' | 'num'>[] = []
  const lineas = texto.replace(/\r/g, '').split('\n')
  for (let i = 0; i < lineas.length; i++) {
    const linea = lineas[i].trim()
    if (!linea) continue
    let celdas = linea.includes('\t') ? linea.split('\t').map((c) => c.trim()) : linea.split(/\s{2,}/).map((c) => c.trim())
    // Outlook a veces pega cada celda en su propio renglón: se juntan hasta tener el monto.
    if (celdas.length === 1 && /,/.test(celdas[0]) && !esMonto(celdas[0])) {
      const junta = [celdas[0]]
      while (i + 1 < lineas.length && junta.length < 4) {
        const sig = lineas[i + 1].trim()
        if (!sig) {
          i++
          continue
        }
        if (/,/.test(sig) && !esMonto(sig) && junta.some(esMonto)) break
        junta.push(sig)
        i++
        if (esMonto(sig)) {
          const nota = lineas[i + 1]?.trim()
          if (nota && !/,/.test(nota) && !esMonto(nota) && !/^(gross|net)$/i.test(nota)) {
            junta.push(nota)
            i++
          }
          break
        }
      }
      celdas = junta
    }
    celdas = celdas.filter((c, j) => j === 0 || c !== '')
    if (celdas.every((c) => ENCABEZADO.test(c) || !c)) continue
    const nombre = celdas[0]
    if (!nombre || ENCABEZADO.test(nombre) || esMonto(nombre)) continue
    const resto = celdas.slice(1)
    const tipoTxt = resto.find((c) => /^(gross|net|bruto|neto)$/i.test(c))
    const montoTxt = resto.find(esMonto)
    if (!montoTxt) continue
    const notas = resto.filter((c) => c !== tipoTxt && c !== montoTxt).join(' ')
    const estado: EstadoFila = /^tbd$/i.test(montoTxt) ? 'tbd' : /^n\/?a$/i.test(montoTxt) ? 'na' : 'monto'
    filas.push({
      nombreCorreo: nombre,
      tipo: tipoTxt && /^(net|neto)$/i.test(tipoTxt) ? 'net' : 'gross',
      usd: estado === 'monto' ? String(num(montoTxt)) : '',
      estado,
      notas,
    })
  }
  return filas
}

function esMonto(c: string) {
  return /^\$?\s*[\d,]+(\.\d+)?$/.test(c.trim()) || /^(tbd|n\/?a)$/i.test(c.trim())
}

/* ───────── Cálculo ───────── */

export interface ResultadoBono {
  fila: FilaBono
  empleado: Empleado | null
  /** ok = calculado; pendiente = TBD; excluido = N/A o sin monto; sinEmpleado = no se encontró en la plantilla. */
  estado: 'ok' | 'pendiente' | 'excluido' | 'sinEmpleado'
  usd: number
  /** USD × tipo de cambio: el bruto (gross) o el neto que debe recibir (net). */
  montoMxn: number
  /** Bono bruto que entra a la nómina. */
  bonoBruto: number
  /** Lo que la persona recibe de más con el bono (neto con bono − neto sin bono). */
  netoBono: number
  /** ISR adicional por el bono. */
  isrBono: number
  base: ResultadoCorrida | null
  con: ResultadoCorrida | null
  patronalesBase: number
  patronalesCon: number
  /** Cuotas patronales que se facturan según la opción elegida. */
  patronalesFactura: number
  servicio: number
  totalFactura: number
  avisos: string[]
}

function datosCorrida(e: Empleado, bono: number, servicio: string, ajuste = 0): Hilos33Data {
  return {
    ...corridasIniciales().hilos33,
    idioma: 'en',
    puesto: e.puesto || e.nombre,
    persona: e.nombre,
    numEmpleado: e.num,
    objetivo: 'salarioDiario',
    monto: String(e.salario_diario),
    sodexo: String(e.sodexo),
    ajusteMoneda: String(ajuste),
    servicio,
    // Como la nómina real (y el Excel de bonos de Nóminas): salario base de cotización topado a 25 UMA.
    topeSbc: true,
    extras: bono ? { otrasPercepciones: String(bono) } : {},
  }
}

/** Corrida semanal de 33 Hilos con el salario de la persona y, si hay, el bono como otras percepciones. */
export function corridaSemana(e: Empleado, bono: number, servicio = '7.25', ajuste = 0): ResultadoCorrida {
  return calcularCorrida('hilos33', datosCorrida(e, bono, servicio, ajuste))
}

/**
 * Ajuste por diferencia de moneda del sistema de nómina: el neto se paga en múltiplos de 50
 * centavos (en el listado: neto 8,292.84 → ajuste −0.16 → 8,293.00).
 */
export function ajusteMoneda(neto: number): number {
  // Sin redondear el ajuste: así el neto queda exacto en el múltiplo de 50 centavos.
  return neto - Math.round(neto * 2) / 2
}

/**
 * Bruto que deja `netoMeta` pesos más de neto que la semana sin bono (bono neto → bruto).
 * El neto crece con el bruto, así que basta con bisección; se redondea a centavos y se toma
 * el bruto que más se acerca.
 */
export function brutoParaNeto(e: Empleado, netoMeta: number, servicio = '7.25'): number {
  if (netoMeta <= 0) return 0
  const netoBase = corridaSemana(e, 0, servicio).neto.monto
  const extra = (g: number) => corridaSemana(e, g, servicio).neto.monto - netoBase
  let lo = netoMeta
  let hi = netoMeta * 2
  while (extra(hi) < netoMeta && hi < netoMeta * 64) hi *= 2
  for (let i = 0; i < 60 && hi - lo > 0.001; i++) {
    const mid = (lo + hi) / 2
    if (extra(mid) < netoMeta) lo = mid
    else hi = mid
  }
  const base = centavos(hi)
  let mejor = base
  let menor = Infinity
  for (let k = -3; k <= 3; k++) {
    const g = centavos(base + k / 100)
    const d = Math.abs(extra(g) - netoMeta)
    if (d < menor - 1e-9) {
      menor = d
      mejor = g
    }
  }
  return mejor
}

export function calcularBono(fila: FilaBono, empleado: Empleado | null, o: OpcionesBonos): ResultadoBono {
  const tc = num(o.tipoCambio)
  const servicioPct = num(o.servicio)
  const usd = fila.estado === 'monto' ? num(fila.usd) : 0
  const vacio: ResultadoBono = {
    fila,
    empleado,
    estado: 'excluido',
    usd,
    montoMxn: 0,
    bonoBruto: 0,
    netoBono: 0,
    isrBono: 0,
    base: null,
    con: null,
    patronalesBase: 0,
    patronalesCon: 0,
    patronalesFactura: 0,
    servicio: servicioPct,
    totalFactura: 0,
    avisos: [],
  }
  if (!empleado) return { ...vacio, estado: 'sinEmpleado', avisos: [`No se encontró a «${fila.nombreCorreo}» en la plantilla de 33 Hilos. Elige a la persona.`] }
  const avisos: string[] = []
  if (!empleado.activo) avisos.push('La persona está marcada como inactiva en la plantilla.')
  if (!/^listado de n[oó]mina/i.test(empleado.fuente)) avisos.push(`El salario diario viene de ${empleado.fuente || 'captura manual'}, no del último listado de nómina. Revísalo.`)
  if (fila.estado === 'tbd') return { ...vacio, estado: 'pendiente', avisos: [...avisos, `Monto pendiente (TBD)${fila.notas ? `: ${fila.notas}` : ''}. No se incluye en el total.`] }
  if (fila.estado === 'na' || usd <= 0) return { ...vacio, avisos: [...avisos, fila.estado === 'na' ? 'No aplica (N/A).' : 'Sin monto.'] }
  if (tc <= 0) return { ...vacio, estado: 'pendiente', avisos: [...avisos, 'Falta el tipo de cambio.'] }

  const servicio = String(servicioPct)
  const montoMxn = usd * tc
  // Bruto: el monto convertido entra tal cual (como en el Excel, sin redondear). Neto: gross-up a centavos.
  const bonoBruto = fila.tipo === 'net' ? brutoParaNeto(empleado, montoMxn, servicio) : montoMxn
  const base = corridaSemana(empleado, 0, servicio)
  const con = corridaSemana(empleado, bonoBruto, servicio)
  const isr = (r: ResultadoCorrida) => r.deducciones.find((l) => /ISPT/i.test(l.concepto))?.monto ?? 0
  const netoBono = con.neto.monto - base.neto.monto
  const patronalesBase = base.totalPatronales.monto
  const patronalesCon = con.totalPatronales.monto
  const patronalesFactura = o.cuotas === 'semana' ? patronalesCon : patronalesCon - patronalesBase
  if (fila.tipo === 'net' && Math.abs(netoBono - montoMxn) > 0.05) avisos.push(`El neto adicional (${netoBono.toFixed(2)}) no cuadra con el neto pedido (${montoMxn.toFixed(2)}).`)
  return {
    fila,
    empleado,
    estado: 'ok',
    usd,
    montoMxn,
    bonoBruto,
    netoBono,
    isrBono: isr(con) - isr(base),
    base,
    con,
    patronalesBase,
    patronalesCon,
    patronalesFactura,
    servicio: servicioPct,
    totalFactura: (bonoBruto + patronalesFactura) * (1 + servicioPct / 100),
    avisos,
  }
}

export interface Totales {
  usd: number
  bonoBruto: number
  netoBono: number
  isrBono: number
  patronalesFactura: number
  totalFactura: number
  calculados: number
  pendientes: number
  excluidos: number
  sinEmpleado: number
}

export function totales(rs: ResultadoBono[]): Totales {
  const t: Totales = { usd: 0, bonoBruto: 0, netoBono: 0, isrBono: 0, patronalesFactura: 0, totalFactura: 0, calculados: 0, pendientes: 0, excluidos: 0, sinEmpleado: 0 }
  for (const r of rs) {
    if (r.estado === 'ok') {
      t.calculados++
      t.usd += r.usd
      t.bonoBruto += r.bonoBruto
      t.netoBono += r.netoBono
      t.isrBono += r.isrBono
      t.patronalesFactura += r.patronalesFactura
      t.totalFactura += r.totalFactura
    } else if (r.estado === 'pendiente') t.pendientes++
    else if (r.estado === 'sinEmpleado') t.sinEmpleado++
    else t.excluidos++
  }
  return t
}

/** Personas activas de la plantilla que no vienen en la tabla del correo. */
export function sinBono(filas: FilaBono[], empleados: Empleado[]): Empleado[] {
  const con = new Set(filas.map((f) => f.num).filter(Boolean))
  return empleados.filter((e) => e.activo && !con.has(e.num))
}

/** "ALEMAN CONTRERAS VIANEY" → "Aleman Contreras Vianey" (para tablas en inglés). */
export function nombrePropio(s: string): string {
  return s.toLowerCase().replace(/(^|[\s-])(\p{L})/gu, (_, a: string, b: string) => a + b.toUpperCase())
}
