import { Libro, type PlantillaJson } from './motor/libro'
import generalJson from './plantillas/general.json'
import hilos33Json from './plantillas/hilos33.json'
import kofileJson from './plantillas/kofile.json'
import {
  CONCEPTOS_EXTRA,
  type ConceptoExtra,
  type CorridaData,
  type CorridaId,
  type GeneralData,
  type Hilos33Data,
  type KofileData,
  type Objetivo,
} from './tipos'

/**
 * Corridas: cada tipo usa SOLO su plantilla aprobada (Kofile, General Treve, 33 Hilos).
 * La app captura los datos en las mismas celdas que se capturaban a mano en el Excel,
 * busca el salario diario cuando se pide un bruto o un neto, y lee los resultados
 * de las celdas del propio Excel. No hay fórmulas propias de cálculo.
 */

export const PLANTILLAS_CORRIDA: Record<CorridaId, PlantillaJson> = {
  kofile: kofileJson as unknown as PlantillaJson,
  general: generalJson as unknown as PlantillaJson,
  hilos33: hilos33Json as unknown as PlantillaJson,
}

/** Nombre de los archivos aprobados (como los mandó Nóminas) para citarlos en la corrida. */
export const ARCHIVOS_APROBADOS: Record<CorridaId, string> = {
  kofile: 'Simulaciones_2026_cat_10082026_KOFILE_BASE_RECIBIDA_2026-08-19.xlsx',
  general: 'Simulaciones_2026_para_David_FORMATO_COMPLETO_APROBADO_2026-08-19.xlsx',
  hilos33: 'Estructura_Corrida_33_Hilos_BASE.xlsx',
}

const SIM_ASIM = 'Simulacion Asimilado '
const HILOS = '33 Hilos '

export interface Linea {
  concepto: string
  monto: number
  /** Celda del Excel de donde sale el monto, para auditoría. */
  celda: string
}

export interface Validacion {
  ok: boolean
  texto: string
  /** pendiente = concepto no soportado (no bloquea, se informa). */
  nivel?: 'error' | 'pendiente'
}

export interface ResultadoCorrida {
  id: CorridaId
  salarioDiario: number
  periodo: { dias: number; nombre: string }
  percepciones: Linea[]
  totalPercepciones: Linea
  deducciones: Linea[]
  totalDeducciones: Linea
  neto: Linea
  sodexo: Linea
  netoSodexo: Linea
  patronales: Linea[]
  totalPatronales: Linea
  /** Costos y facturación (dependen del formato). */
  costos: Linea[]
  /** Monto final destacado (costo nómina, invoice bi-weekly o weekly invoice). */
  total: Linea
  objetivo: { tipo: Objetivo; etiqueta: string; meta: number; obtenido: number; diferencia: number; celda: string }
  supuestos: string[]
  validaciones: Validacion[]
  /** Datos críticos que faltan: mientras haya alguno no se genera nada. */
  faltantes: string[]
  /** Libros con los datos capturados, para escribir el Excel. */
  libros: { plantilla: CorridaId; libro: Libro }[]
  /** Celdas nuevas en el Excel → celda de la que toman el formato (misma hoja). */
  estilosExcel: Record<string, string>
}

const num = (s: string | undefined) => {
  const n = parseFloat(String(s ?? '').replace(/[$,\s]/g, ''))
  return Number.isFinite(n) ? n : 0
}
const redondearA = (x: number, d: number) => Math.round(x * 10 ** d) / 10 ** d
const dinero = (x: number) => x.toLocaleString('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 2, maximumFractionDigits: 2 })

/**
 * Busca el salario diario para que `medir()` llegue a `meta` (la operación que antes
 * se hacía "jugando con los números"). El resultado es monótono creciente con el
 * salario, así que basta con bisección; al final se redondea a los decimales pedidos
 * y se elige el valor que deja la menor diferencia.
 */
export function buscarSalario(fijar: (sd: number) => void, medir: () => number, meta: number, decimales: number): number {
  const f = (sd: number) => {
    fijar(sd)
    const v = medir()
    return Number.isNaN(v) ? -Infinity : v
  }
  let lo = 0
  let hi = 1000
  while (f(hi) < meta && hi < 1e8) hi *= 2
  for (let i = 0; i < 200 && hi - lo > 1e-10; i++) {
    const mid = (lo + hi) / 2
    if (f(mid) < meta) lo = mid
    else hi = mid
  }
  const paso = 10 ** -decimales
  const base = redondearA(hi, decimales)
  let mejor = base
  let menor = Infinity
  for (let k = -2; k <= 2; k++) {
    const sd = redondearA(base + k * paso, decimales)
    if (sd <= 0) continue
    const d = Math.abs(f(sd) - meta)
    if (d < menor - 1e-12) {
      menor = d
      mejor = sd
    }
  }
  fijar(mejor)
  return mejor
}

const t = (idioma: 'es' | 'en') => (es: string, en: string) => (idioma === 'es' ? es : en)

/* Traducción de los conceptos del Excel (los textos en español salen de la plantilla). */
const CONCEPTOS_EN: Record<string, string> = {
  'Sueldo Ordinario': 'Ordinary salary',
  'Septimo Dia': 'Seventh day',
  'Prima Vacacional': 'Vacation premium',
  Aguinaldo: 'Christmas bonus (aguinaldo)',
  'Reparto de Utilidades (PTU)': 'Profit sharing (PTU)',
  'Bono fondo de ahorro': 'Savings fund bonus',
  'Bono vale de despesa': 'Food voucher bonus',
  Internet: 'Internet',
  'Bono Navideño': 'Holiday bonus',
  'Bono de desempeño mensual': 'Monthly performance bonus',
  'Bono Puntualidad': 'Punctuality bonus',
  'Bono Asistencia': 'Attendance bonus',
  'IMSS Trabajador': 'IMSS (employee social security)',
  'ISPT Trabajador': 'ISPT (employee income tax)',
  'Ajuste Moneda': 'Currency adjustment',
  'IMSS Empresa': 'IMSS (employer)',
  Infonavit: 'Infonavit',
  RCV: 'Retirement (RCV)',
  'Impuesto Estatal': 'State payroll tax',
}

export function traducirConcepto(concepto: string, idioma: 'es' | 'en'): string {
  if (idioma === 'es') return concepto
  return CONCEPTOS_EN[concepto.trim()] ?? concepto
}

function nombreObjetivo(id: CorridaId, o: Objetivo, idioma: 'es' | 'en', asimilado = false): string {
  const tr = t(idioma)
  const periodo = id === 'kofile' ? tr('catorcenal', 'bi-weekly') : tr('semanal', 'weekly')
  switch (o) {
    case 'salarioDiario':
      return tr('Salario diario', 'Daily salary')
    case 'brutoPeriodo':
      return tr(`Bruto ${periodo} (total de percepciones)`, `Gross ${periodo} (total income)`)
    case 'brutoMensual':
      return tr('Bruto mensual (salario mensual)', 'Gross monthly (monthly salary)')
    case 'neto':
      return asimilado ? tr(`Neto ${periodo} (asimilado)`, `Net ${periodo} (assimilated)`) : tr(`Neto ${periodo} a pagar`, `Net ${periodo} pay`)
    case 'netoSodexo':
      return tr(`Neto ${periodo} + Sodexo`, `Net ${periodo} + Sodexo`)
  }
}

export const OBJETIVOS: Record<CorridaId, Objetivo[]> = {
  kofile: ['brutoPeriodo', 'salarioDiario', 'brutoMensual', 'neto', 'netoSodexo'],
  general: ['netoSodexo', 'neto', 'salarioDiario', 'brutoPeriodo', 'brutoMensual'],
  hilos33: ['salarioDiario', 'netoSodexo', 'neto', 'brutoPeriodo', 'brutoMensual'],
}

export function etiquetaObjetivo(id: CorridaId, o: Objetivo, idioma: 'es' | 'en' = 'es', asimilado = false) {
  return nombreObjetivo(id, o, idioma, asimilado)
}

/* ───────── Piezas comunes ───────── */

function linea(libro: Libro, hoja: string, celdaMonto: string, concepto: string | undefined, idioma: 'es' | 'en', celdaConcepto?: string): Linea {
  const texto = concepto ?? String(libro.valor(hoja, celdaConcepto ?? '') ?? '')
  return { concepto: traducirConcepto(texto.trim(), idioma), monto: monto(libro, hoja, celdaMonto), celda: `${hoja.trim()}!${celdaMonto}` }
}

/** Filas de la columna de montos con el concepto en la columna de la izquierda. */
function lineas(libro: Libro, hoja: string, colConcepto: string, colMonto: string, filas: number[], idioma: 'es' | 'en'): Linea[] {
  return filas.map((f) => linea(libro, hoja, `${colMonto}${f}`, undefined, idioma, `${colConcepto}${f}`))
}

const casi = (a: number, b: number, tol = 0.005) => Math.abs(a - b) <= tol

/** Valor numérico de una celda; un error de Excel (#N/A…) o un texto se vuelve NaN y lo marca la validación. */
function monto(libro: Libro, hoja: string, celda: string): number {
  const v = libro.valor(hoja, celda)
  if (v === null) return 0
  return typeof v === 'number' ? v : NaN
}

function datosCriticos(id: CorridaId, d: CorridaData): string[] {
  const faltan: string[] = []
  if (!d.puesto.trim()) faltan.push('Puesto / posición')
  if (num(d.monto) <= 0) faltan.push(`Monto objetivo (${nombreObjetivo(id, d.objetivo, 'es')})`)
  if (id === 'kofile') {
    const k = d as KofileData
    if (k.esquema === 'asimilado' && d.objetivo === 'netoSodexo') faltan.push('El esquema asimilado no maneja Sodexo: elige otro objetivo')
    if (k.bonoDesempeno === 'monto' && num(k.bonoDesempenoMonto) <= 0) faltan.push('Monto del bono de desempeño mensual')
    if (num(k.diasVacaciones) <= 0) faltan.push('Días de vacaciones para la prima vacacional')
    if (k.esquema === 'asimilado' && num(k.tipoCambio) <= 0) faltan.push('Tipo de cambio')
  }
  return faltan
}

/**
 * Renglón de la hoja Calculo donde entra cada concepto adicional. Son renglones que ya
 * existen en la plantilla y que Calculo suma a percepciones y grava con sus propias
 * exenciones (horas extra: Calculo!E37; prima dominical: Calculo!E41). Los conceptos sin
 * renglón en un formato no se calculan: quedan como pendientes.
 */
const CELDAS_EXTRA: Record<'kofile' | 'general', Partial<Record<ConceptoExtra, string>>> = {
  kofile: { primaDominical: 'D41', horasExtraDobles: 'D37', horasExtraTriples: 'D38' },
  general: {
    primaDominical: 'D41',
    horasExtraDobles: 'D37',
    horasExtraTriples: 'D38',
    // "Otras Percepciones" (Calculo!D49): gravado completo.
    bonoTurno: 'D49',
    bonoTransporte: 'D49',
    fondoAhorro: 'D49',
    otrasPercepciones: 'D49',
  },
}

/** Celda de Calculo donde entra el concepto en esta corrida (undefined = la plantilla no lo tiene). */
export function celdaConcepto(id: CorridaId, c: ConceptoExtra): string | undefined {
  return CELDAS_EXTRA[id === 'kofile' ? 'kofile' : 'general'][c]
}

const EXTRAS_EN: Record<ConceptoExtra, string> = {
  primaDominical: 'Sunday premium',
  horasExtraDobles: 'Double overtime',
  horasExtraTriples: 'Triple overtime',
  bonoTurno: 'Shift bonus',
  bonoTransporte: 'Transportation bonus',
  fondoAhorro: 'Savings fund',
  otrasPercepciones: 'Other income',
}

/** Captura los conceptos adicionales en Calculo y regresa una línea por concepto (para la hoja y los números). */
function capturarExtras(libro: Libro, id: CorridaId, d: CorridaData): Linea[] {
  const lineasExtra: Linea[] = []
  const porCelda = new Map<string, number>()
  for (const c of Object.keys(CONCEPTOS_EXTRA) as ConceptoExtra[]) {
    const m = num(d.extras?.[c])
    const celda = celdaConcepto(id, c)
    if (!m || !celda) continue
    porCelda.set(celda, (porCelda.get(celda) ?? 0) + m)
    lineasExtra.push({ concepto: d.idioma === 'es' ? CONCEPTOS_EXTRA[c] : EXTRAS_EN[c], monto: m, celda: `Calculo!${celda}` })
  }
  for (const [celda, m] of porCelda) libro.capturar('Calculo', celda, { valor: m })
  return lineasExtra
}

/** Conceptos con monto que este formato no tiene: se informan, no se calculan. */
function pendientes(id: CorridaId, d: CorridaData): Validacion[] {
  return (Object.keys(CONCEPTOS_EXTRA) as ConceptoExtra[])
    .filter((c) => num(d.extras?.[c]) !== 0 && !celdaConcepto(id, c))
    .map((c) => ({
      ok: false,
      nivel: 'pendiente' as const,
      texto: `${CONCEPTOS_EXTRA[c]} (${dinero(num(d.extras?.[c]))}): la plantilla ${id === 'kofile' ? 'Kofile' : ''} no tiene renglón para este concepto; queda pendiente de confirmar con Nóminas (no se calculó).`.replace('  ', ' '),
    }))
}

function supuestoExtras(extras: Linea[], idioma: 'es' | 'en'): string[] {
  if (!extras.length) return []
  const lista = extras.map((l) => `${l.concepto} ${dinero(l.monto)} (${l.celda})`).join(', ')
  return [idioma === 'es' ? `Otros conceptos capturados en la hoja Calculo de la plantilla: ${lista}.` : `Other items captured in the template's Calculo sheet: ${lista}.`]
}

const ETIQUETA_OTRAS = { es: 'Otras percepciones (incluidas en el total)', en: 'Other income (included in total)' }

function noCero(valor: number, nombre: string): Validacion {
  return { ok: Number.isFinite(valor) && valor > 0, texto: `${nombre} con valor (${dinero(valor)})` }
}

/** Fija el salario diario según el objetivo y regresa la info del objetivo. */
function resolverObjetivo(
  id: CorridaId,
  d: CorridaData,
  libro: Libro,
  medidas: Partial<Record<Objetivo, [hoja: string, celda: string]>>,
  asimilado = false,
): ResultadoCorrida['objetivo'] {
  const meta = num(d.monto)
  const decimales = Number(d.decimales) || 2
  const fijar = (sd: number) => libro.capturar('Calculo', 'D19', { valor: sd })
  const etiqueta = nombreObjetivo(id, d.objetivo, d.idioma, asimilado)
  if (meta <= 0) {
    // Falta el monto (queda en "faltantes"): se deja el salario de la plantilla para no mostrar errores.
    return { tipo: d.objetivo, etiqueta, meta, obtenido: 0, diferencia: 0, celda: '—' }
  }
  if (d.objetivo === 'salarioDiario') {
    fijar(meta)
    return { tipo: d.objetivo, etiqueta, meta, obtenido: meta, diferencia: 0, celda: 'Calculo!D19' }
  }
  if (d.objetivo === 'brutoMensual') {
    // Mismo criterio que la plantilla: salario mensual = salario diario × factor mensual (Calculo!J55).
    const factor = monto(libro, 'Calculo', 'J55')
    const sd = redondearA(meta / factor, decimales)
    fijar(sd)
    const obtenido = sd * factor
    return { tipo: d.objetivo, etiqueta, meta, obtenido, diferencia: obtenido - meta, celda: 'Calculo!D19 × Calculo!J55' }
  }
  const medida = medidas[d.objetivo]
  if (!medida) {
    // Objetivo que este esquema no maneja (queda en "faltantes" y no se genera nada).
    fijar(0)
    return { tipo: d.objetivo, etiqueta, meta, obtenido: 0, diferencia: -meta, celda: '—' }
  }
  const [hoja, celda] = medida
  buscarSalario(fijar, () => monto(libro, hoja, celda), meta, decimales)
  const obtenido = monto(libro, hoja, celda)
  return { tipo: d.objetivo, etiqueta, meta, obtenido, diferencia: obtenido - meta, celda: `${hoja.trim()}!${celda}` }
}

function validarObjetivo(o: ResultadoCorrida['objetivo'], d: CorridaData): Validacion {
  if (o.tipo === 'salarioDiario') return { ok: o.meta > 0, texto: `Salario diario capturado: ${dinero(o.meta)}` }
  // Con salario diario a 2 decimales el resultado puede quedar a centavos del objetivo (cada centavo
  // de salario mueve el bruto catorcenal ~30 centavos); con 6 decimales cierra al centavo.
  const tolerancia = Number(d.decimales) === 6 ? 0.01 : 0.5
  return {
    ok: Math.abs(o.diferencia) <= tolerancia,
    texto: `${o.etiqueta}: objetivo ${dinero(o.meta)}, resultado ${dinero(o.obtenido)} (diferencia ${dinero(o.diferencia)})`,
  }
}

/* ───────── Kofile ───────── */

function capturarKofile(libro: Libro, d: KofileData) {
  libro.capturar('Calculo', 'D64', { valor: num(d.sodexo) })
  libro.capturar('Calculo', 'D46', { valor: num(d.ptu) })
  libro.capturar('Calculo', 'D49', { valor: num(d.internet) })
  libro.capturar('Calculo', 'D50', { valor: num(d.navideno) })
  libro.capturar('Simulacion', 'D21', { valor: d.esquema === 'nomina' ? num(d.ajusteMoneda) : 0 })
  // Sin séptimo día: así lo maneja Nóminas en los ejemplos (Calculo!D36 = 0).
  if (!d.septimo) libro.capturar('Calculo', 'D36', { valor: 0 })
  const dias = num(d.diasVacaciones)
  if (dias !== 24) libro.capturar('Calculo', 'D44', { formula: `+(D19*${dias})*0.25/12/2.17` })
  if (d.bonoDesempeno === 'monto') libro.capturar('Calculo', 'E19', { valor: num(d.bonoDesempenoMonto) })
  libro.capturar(SIM_ASIM, 'AW34', { valor: num(d.costoOperativo) })
  libro.capturar(SIM_ASIM, 'AW37', { valor: num(d.medicoAnual) })
  libro.capturar(SIM_ASIM, 'AW41', { valor: num(d.seguroVidaAnual) })
  libro.capturar(SIM_ASIM, 'AX47', { valor: num(d.serviceFee) / 100 })
  if (d.puesto.trim()) libro.capturar(SIM_ASIM, 'AU1', { valor: d.puesto.trim() })
}

function kofile(d: KofileData): ResultadoCorrida {
  const tr = t(d.idioma)
  const libro = new Libro(PLANTILLAS_CORRIDA.kofile)
  capturarKofile(libro, d)
  const extras = capturarExtras(libro, 'kofile', d)
  const estilosExcel: Record<string, string> = {}
  if (extras.length) {
    // El resumen (Simulacion) no lista estos renglones de Calculo: se agrega una línea que los
    // incluye en el total, para que percepciones, ISR y neto sigan cuadrando con Calculo!D55.
    libro.capturar('Simulacion', 'C17', { valor: ETIQUETA_OTRAS.es })
    libro.capturar('Simulacion', 'D17', { formula: 'SUM(Calculo!D37:D43)+SUM(Calculo!D52:D54)' })
    libro.capturar('Simulacion', 'D16', { formula: 'SUM(D6:D15)+D17' })
    libro.capturar(SIM_ASIM, 'AW16', { formula: 'SUM(AW6:AW15)+Simulacion!D17' })
    Object.assign(estilosExcel, { 'Simulacion!C17': 'C15', 'Simulacion!D17': 'D15' })
  }
  const asim = d.esquema === 'asimilado'
  const objetivo = resolverObjetivo(
    'kofile',
    d,
    libro,
    asim
      ? { brutoPeriodo: [SIM_ASIM, 'AW16'], neto: [SIM_ASIM, 'AW25'] }
      : { brutoPeriodo: ['Simulacion', 'D16'], neto: ['Simulacion', 'D25'], netoSodexo: ['Simulacion', 'D27'] },
    asim,
  )
  const i = d.idioma
  const sd = monto(libro, 'Calculo', 'D19')
  const tc = num(d.tipoCambio)
  const supuestos = [
    tr('Plantilla: Kofile – simulación extendida aprobada (Simulaciones_2026_cat_10082026).', 'Template: approved Kofile extended simulation (Simulaciones_2026_cat_10082026).'),
    tr(`Periodo catorcenal (${monto(libro, 'Calculo', 'D9')} días de pago), como en la plantilla.`, `Bi-weekly period (${monto(libro, 'Calculo', 'D9')} pay days), as in the template.`),
    asim
      ? tr('Esquema asimilado: ISR de la hoja IMPUESTOS KOFILE (catorcenal), sin IMSS ni cuotas patronales.', 'Assimilated scheme: income tax from the IMPUESTOS KOFILE sheet (bi-weekly), no IMSS or employer contributions.')
      : tr('Esquema nómina: ISR/ISPT por tabla mensual del Art. 113 e IMSS de la hoja IMSS Calculo.', 'Payroll scheme: income tax from the Art. 113 monthly table and IMSS from the IMSS Calculo sheet.'),
    d.septimo ? tr('Incluye séptimo día (2 días por catorcena).', 'Includes seventh day (2 days per period).') : tr('Sin séptimo día (Calculo!D36 = 0).', 'Without seventh day (Calculo!D36 = 0).'),
    num(d.sodexo) > 0 ? tr(`Sodexo por periodo: ${dinero(num(d.sodexo))}.`, `Sodexo per period: ${dinero(num(d.sodexo))}.`) : tr('Sin Sodexo.', 'No Sodexo.'),
    tr(`Prima vacacional con ${num(d.diasVacaciones)} días${num(d.diasVacaciones) === 24 ? ' (plantilla)' : ' (ajustado al caso)'}.`, `Vacation premium with ${num(d.diasVacaciones)} days${num(d.diasVacaciones) === 24 ? ' (template)' : ' (adjusted for this case)'}.`),
    d.bonoDesempeno === 'monto'
      ? tr(`Bono de desempeño mensual fijo de ${dinero(num(d.bonoDesempenoMonto))} (Calculo!E19).`, `Fixed monthly performance bonus of ${dinero(num(d.bonoDesempenoMonto))} (Calculo!E19).`)
      : tr('Bono de desempeño mensual según la plantilla (salario mensual ÷ 2.17 por catorcena).', 'Monthly performance bonus per template (monthly salary ÷ 2.17 per period).'),
  ]
  if (objetivo.tipo === 'brutoMensual') supuestos.push(tr(`Salario diario = bruto mensual ÷ ${monto(libro, 'Calculo', 'J55')} (factor mensual de la plantilla).`, `Daily salary = gross monthly ÷ ${monto(libro, 'Calculo', 'J55')} (template monthly factor).`))
  supuestos.push(...supuestoExtras(extras, d.idioma))

  const validaciones: Validacion[] = [validarObjetivo(objetivo, d), noCero(sd, 'Salario diario')]
  let r: Omit<ResultadoCorrida, 'objetivo' | 'supuestos' | 'validaciones' | 'faltantes' | 'libros' | 'id' | 'salarioDiario' | 'periodo' | 'estilosExcel'>
  if (!asim) {
    const S = 'Simulacion'
    r = {
      percepciones: [...lineas(libro, S, 'C', 'D', [6, 7, 8, 9, 10, 11, 12, 13, 14, 15], i), ...extras],
      totalPercepciones: linea(libro, S, 'D16', tr('Total percepciones', 'Total income'), i),
      deducciones: lineas(libro, S, 'C', 'D', [19, 20, 21], i),
      totalDeducciones: linea(libro, S, 'D22', tr('Total deducciones', 'Total deductions'), i),
      neto: linea(libro, S, 'D25', tr('Neto a pagar', 'Net pay'), i),
      sodexo: linea(libro, S, 'D26', 'Sodexo', i),
      netoSodexo: linea(libro, S, 'D27', tr('Neto + Sodexo', 'Net + Sodexo'), i),
      patronales: lineas(libro, S, 'C', 'D', [29, 30, 31, 32], i),
      totalPatronales: linea(libro, S, 'D33', tr('Total patronales', 'Total employer contributions'), i),
      costos: [linea(libro, S, 'D37', tr('Provisión de finiquito (FQ)', 'Termination provision'), i)],
      total: linea(libro, S, 'D35', tr('Costo nómina catorcenal', 'Bi-weekly payroll cost'), i),
    }
    const g = (c: string) => monto(libro, 'Calculo', c)
    validaciones.push(
      { ok: casi(r.totalPercepciones.monto, g('D55')), texto: 'Total percepciones del resumen = Calculo!D55' },
      { ok: casi(r.totalDeducciones.monto, g('D62') + num(d.ajusteMoneda)), texto: 'Total deducciones del resumen = Calculo!D62 (+ ajuste moneda)' },
      { ok: casi(r.neto.monto, r.totalPercepciones.monto - r.totalDeducciones.monto), texto: 'Neto = percepciones − deducciones' },
      { ok: casi(r.netoSodexo.monto, r.neto.monto + r.sodexo.monto), texto: 'Neto + Sodexo = neto + Sodexo' },
      noCero(r.totalPercepciones.monto, 'Total percepciones'),
      noCero(monto(libro, 'Calculo', 'D61'), 'IMSS trabajador'),
      noCero(r.neto.monto, 'Neto a pagar'),
      noCero(r.total.monto, 'Costo nómina'),
      { ok: Number.isFinite(g('D58')), texto: `ISR/ISPT calculado (${dinero(g('D58'))})` },
    )
  } else {
    const A = SIM_ASIM
    r = {
      percepciones: [...lineas(libro, A, 'AV', 'AW', [6, 7, 8, 9, 10, 11, 12, 13, 14, 15], i).map((l) => ({ ...l, concepto: limpiarBilingue(l.concepto, i) })), ...extras],
      totalPercepciones: linea(libro, A, 'AW16', tr('Total percepciones', 'Total income'), i),
      deducciones: [linea(libro, A, 'AW20', tr('ISR asimilado (IMPUESTOS KOFILE)', 'Assimilated income tax (IMPUESTOS KOFILE)'), i)],
      totalDeducciones: linea(libro, A, 'AW21', tr('Total deducciones', 'Total deductions'), i),
      neto: linea(libro, A, 'AW25', tr('Neto a pagar', 'Net pay'), i),
      sodexo: { concepto: 'Sodexo', monto: 0, celda: '—' },
      netoSodexo: linea(libro, A, 'AW25', tr('Neto a pagar', 'Net pay'), i),
      patronales: [],
      totalPatronales: linea(libro, A, 'AW32', tr('Total patronales', 'Total employer contributions'), i),
      costos: [
        linea(libro, A, 'AW34', 'Operational week cost', i),
        linea(libro, A, 'AW35', 'Payroll bi-week cost', i),
        linea(libro, A, 'AW39', 'Medical bi-weekly', i),
        linea(libro, A, 'AW43', 'Life insurance bi-weekly', i),
        linea(libro, A, 'AW46', 'Sub-total 1', i),
        linea(libro, A, 'AW47', `Service fee (${num(d.serviceFee)}%)`, i),
      ],
      total: linea(libro, A, 'AW48', 'GT BiWeekly invoice (MXN)', i),
    }
    if (tc > 0) r.costos.push({ concepto: `GT BiWeekly invoice (USD, TC ${tc})`, monto: r.total.monto / tc, celda: `${A.trim()}!AW48 ÷ TC` })
    validaciones.push(
      { ok: casi(r.totalPercepciones.monto, monto(libro, 'Simulacion', 'D16')), texto: 'Percepciones asimilado = percepciones de Simulacion' },
      { ok: casi(r.neto.monto, r.totalPercepciones.monto - r.totalDeducciones.monto), texto: 'Neto = percepciones − deducciones' },
      { ok: casi(r.total.monto, monto(libro, A, 'AW46') + monto(libro, A, 'AW47')), texto: 'GT BiWeekly invoice = subtotal + service fee' },
      { ok: casi(monto(libro, A, 'AW47'), monto(libro, A, 'AW46') * (num(d.serviceFee) / 100)), texto: 'Service fee = subtotal × %' },
      noCero(r.totalPercepciones.monto, 'Total percepciones'),
      noCero(r.totalDeducciones.monto, 'ISR asimilado'),
      noCero(r.neto.monto, 'Neto a pagar'),
      noCero(r.total.monto, 'GT BiWeekly invoice'),
    )
  }
  return {
    id: 'kofile',
    salarioDiario: sd,
    periodo: { dias: monto(libro, 'Calculo', 'D9'), nombre: tr('Catorcenal', 'Bi-weekly') },
    ...r,
    objetivo,
    supuestos,
    validaciones: [...validaciones, ...pendientes('kofile', d)],
    faltantes: datosCriticos('kofile', d),
    libros: [{ plantilla: 'kofile', libro }],
    estilosExcel,
  }
}

/** "Sueldo Ordinario (Salary)" → solo la parte del idioma pedido. */
function limpiarBilingue(texto: string, idioma: 'es' | 'en'): string {
  const m = /^(.*?)\s*\(([^)]*)\)?\s*$/.exec(texto)
  if (!m || /^[\d.,%\s]+$/.test(m[2])) return texto
  return (idioma === 'es' ? m[1] : m[2]).trim()
}

/* ───────── General Treve (y base de 33 Hilos) ───────── */

function libroGeneral(d: CorridaData) {
  const libro = new Libro(PLANTILLAS_CORRIDA.general)
  libro.capturar('Calculo', 'D64', { valor: num(d.sodexo) })
  libro.capturar('Simulacion', 'D15', { valor: num(d.ajusteMoneda) })
  const extras = capturarExtras(libro, 'general', d)
  const estilosExcel: Record<string, string> = {}
  if (extras.length) {
    // Simulacion solo suma sueldo, séptimo y bonos (D6:D9): se agrega una línea con el resto
    // de percepciones de Calculo para que el total siga igual a Calculo!D55.
    libro.capturar('Simulacion', 'C11', { valor: ETIQUETA_OTRAS.es })
    libro.capturar('Simulacion', 'D11', { formula: 'SUM(Calculo!D37:D46)+SUM(Calculo!D49:D54)' })
    libro.capturar('Simulacion', 'D10', { formula: 'SUM(D6:D9)+D11' })
    Object.assign(estilosExcel, { 'Simulacion!C11': 'C9', 'Simulacion!D11': 'D9' })
  }
  const objetivo = resolverObjetivo('general', d, libro, {
    brutoPeriodo: ['Simulacion', 'D10'],
    neto: ['Simulacion', 'D19'],
    netoSodexo: ['Simulacion', 'D21'],
  })
  return { libro, objetivo, extras, estilosExcel }
}

function supuestosGenerales(d: CorridaData, libro: Libro, objetivo: ResultadoCorrida['objetivo'], extras: Linea[]): string[] {
  const tr = t(d.idioma)
  const s = [
    tr(`Periodo semanal (${monto(libro, 'Calculo', 'D9')} días de pago), como en la plantilla.`, `Weekly period (${monto(libro, 'Calculo', 'D9')} pay days), as in the template.`),
    tr('ISR/ISPT por tabla mensual del Art. 113 e IMSS de la hoja IMSS Calculo (plantilla aprobada, formato completo).', 'Income tax from the Art. 113 monthly table and IMSS from the IMSS Calculo sheet (approved full template).'),
    num(d.sodexo) > 0 ? tr(`Sodexo semanal: ${dinero(num(d.sodexo))}.`, `Weekly Sodexo: ${dinero(num(d.sodexo))}.`) : tr('Sin Sodexo.', 'No Sodexo.'),
  ]
  if (objetivo.tipo === 'brutoMensual') s.push(tr(`Salario diario = bruto mensual ÷ ${monto(libro, 'Calculo', 'J55')} (factor mensual de la plantilla).`, `Daily salary = gross monthly ÷ ${monto(libro, 'Calculo', 'J55')} (template monthly factor).`))
  if (num(d.ajusteMoneda) !== 0) s.push(tr(`Ajuste moneda: ${dinero(num(d.ajusteMoneda))}.`, `Currency adjustment: ${dinero(num(d.ajusteMoneda))}.`))
  s.push(...supuestoExtras(extras, d.idioma))
  return s
}

function lineasGenerales(libro: Libro, d: CorridaData, extras: Linea[]) {
  const tr = t(d.idioma)
  const i = d.idioma
  const S = 'Simulacion'
  return {
    percepciones: [...lineas(libro, S, 'C', 'D', [6, 7, 8, 9], i), ...extras],
    totalPercepciones: linea(libro, S, 'D10', tr('Total percepciones', 'Total income'), i),
    deducciones: lineas(libro, S, 'C', 'D', [13, 14, 15], i),
    totalDeducciones: linea(libro, S, 'D16', tr('Total deducciones', 'Total deductions'), i),
    neto: linea(libro, S, 'D19', tr('Neto a pagar', 'Net pay'), i),
    sodexo: linea(libro, S, 'D20', 'Sodexo', i),
    netoSodexo: linea(libro, S, 'D21', tr('Neto + Sodexo', 'Net + Sodexo'), i),
    patronales: lineas(libro, S, 'C', 'D', [23, 24, 25, 26], i),
    totalPatronales: linea(libro, S, 'D27', tr('Total patronales', 'Total employer contributions'), i),
  }
}

function validacionesGenerales(libro: Libro, d: CorridaData, r: ReturnType<typeof lineasGenerales>): Validacion[] {
  const g = (c: string) => monto(libro, 'Calculo', c)
  return [
    noCero(monto(libro, 'Calculo', 'D19'), 'Salario diario'),
    { ok: casi(r.totalPercepciones.monto, g('D55')), texto: 'Total percepciones del resumen = Calculo!D55' },
    { ok: casi(r.totalDeducciones.monto, g('D62') + num(d.ajusteMoneda)), texto: 'Total deducciones del resumen = Calculo!D62 (+ ajuste moneda)' },
    { ok: casi(r.neto.monto, r.totalPercepciones.monto - r.totalDeducciones.monto), texto: 'Neto = percepciones − deducciones' },
    { ok: casi(r.netoSodexo.monto, r.neto.monto + r.sodexo.monto), texto: 'Neto + Sodexo = neto + Sodexo' },
    noCero(r.totalPercepciones.monto, 'Total percepciones'),
    noCero(g('D61'), 'IMSS trabajador'),
    noCero(r.neto.monto, 'Neto a pagar'),
    { ok: Number.isFinite(g('D58')), texto: `ISR/ISPT calculado (${dinero(g('D58'))})` },
  ]
}

/**
 * Hojas ocultas de la plantilla general (Sheet5 y "33 Hilos ") que son copias del resumen
 * de Simulacion pegadas como valores de una corrida anterior. Nóminas pide que también
 * reflejen la corrida nueva: se pegan los valores de Simulacion fila por fila, solo donde
 * el concepto coincide. Regresa cuántas celdas se actualizaron.
 */
const COPIAS_RESUMEN: [hoja: string, columnas: [concepto: string, monto: string][]][] = [
  ['Sheet5', [['C', 'D']]],
  ['33 Hilos ', [['C', 'D'], ['H', 'I']]],
]

function actualizarCopiasResumen(libro: Libro): { hoja: string; celdas: number }[] {
  return COPIAS_RESUMEN.filter(([hoja]) => libro.hojas.includes(hoja)).map(([hoja, columnas]) => {
    let celdas = 0
    for (const [colConcepto, colMonto] of columnas) {
      for (let f = 6; f <= 29; f++) {
        const concepto = libro.valor(hoja, `${colConcepto}${f}`)
        const original = libro.valor('Simulacion', `C${f}`)
        if (typeof concepto !== 'string' || typeof original !== 'string' || concepto.trim() !== original.trim()) continue
        if (libro.formula(hoja, `${colMonto}${f}`) !== undefined) continue
        libro.capturar(hoja, `${colMonto}${f}`, { valor: monto(libro, 'Simulacion', `D${f}`) })
        celdas++
      }
    }
    return { hoja: hoja.trim(), celdas }
  })
}

function general(d: GeneralData): ResultadoCorrida {
  const tr = t(d.idioma)
  const { libro, objetivo, extras, estilosExcel } = libroGeneral(d)
  const copias = actualizarCopiasResumen(libro)
  const r = lineasGenerales(libro, d, extras)
  const total = linea(libro, 'Simulacion', 'D29', tr('Costo nómina semanal', 'Weekly payroll cost'), d.idioma)
  return {
    id: 'general',
    salarioDiario: monto(libro, 'Calculo', 'D19'),
    periodo: { dias: monto(libro, 'Calculo', 'D9'), nombre: tr('Semanal', 'Weekly') },
    ...r,
    costos: [linea(libro, 'Simulacion', 'D31', tr('Provisión de finiquito (FQ)', 'Termination provision'), d.idioma)],
    total,
    objetivo,
    supuestos: [tr('Plantilla: corrida general Treve – formato completo aprobado (2026-08-19).', 'Template: approved Treve general payroll run – full format (2026-08-19).'), ...supuestosGenerales(d, libro, objetivo, extras)],
    validaciones: [
      validarObjetivo(objetivo, d),
      ...validacionesGenerales(libro, d, r),
      noCero(total.monto, 'Costo nómina'),
      ...copias.map(({ hoja, celdas }) => ({
        ok: casi(monto(libro, hoja === '33 Hilos' ? '33 Hilos ' : hoja, 'D21'), r.netoSodexo.monto) && celdas > 0,
        texto: `Hoja oculta ${hoja} (copia del resumen) actualizada con esta corrida (${celdas} montos)`,
      })),
      ...pendientes('general', d),
    ],
    faltantes: datosCriticos('general', d),
    libros: [{ plantilla: 'general', libro }],
    estilosExcel,
  }
}

/* ───────── 33 Hilos ───────── */

function hilos33(d: Hilos33Data): ResultadoCorrida {
  const tr = t(d.idioma)
  const { libro: gen, objetivo, extras } = libroGeneral(d)
  const r = lineasGenerales(gen, d, extras)
  // El formato 33 Hilos es de presentación: recibe los montos de la corrida general.
  const h = new Libro(PLANTILLAS_CORRIDA.hilos33)
  const S = (c: string) => monto(gen, 'Simulacion', c)
  const pasar: [string, number][] = [
    ['F6', S('D6')],
    ['F7', S('D7')],
    ['F8', S('D8')],
    ['F9', S('D9')],
    ['F13', S('D13')],
    ['F14', S('D14')],
    ['F15', S('D15')],
    ['F19', S('D20')],
    ['F23', S('D23')],
    ['F24', S('D24')],
    ['F25', S('D25')],
    ['F26', S('D26')],
    ['E33', num(d.servicio) / 100],
    ['P3', num(d.servicio) / 100],
    ['F30', num(d.costosAdministrativos)],
    ['N3', num(d.costosAdministrativos)],
  ]
  for (const [celda, valor] of pasar) h.capturar(HILOS, celda, { valor })
  if (extras.length) {
    // Igual que en la corrida general: una línea con las otras percepciones, incluida en el bruto.
    h.capturar(HILOS, 'D11', { valor: d.idioma === 'es' ? ETIQUETA_OTRAS.es : 'Other income (included in gross)' })
    h.capturar(HILOS, 'F11', { valor: S('D11') })
    h.capturar(HILOS, 'F10', { formula: 'SUM(F6:F9)+F11' })
  }
  if (d.puesto.trim()) {
    h.capturar(HILOS, 'B3', { valor: d.puesto.trim() })
    h.capturar(HILOS, 'I3', { valor: d.puesto.trim() })
  }
  const H = (c: string) => monto(h, HILOS, c)
  const i = d.idioma
  const L = (c: string, es: string, en: string) => linea(h, HILOS, c, tr(es, en), i)
  const total = L('F34', 'Factura semanal (+ IVA)', 'Weekly invoice (+ TAX)')
  return {
    id: 'hilos33',
    salarioDiario: monto(gen, 'Calculo', 'D19'),
    periodo: { dias: monto(gen, 'Calculo', 'D9'), nombre: tr('Semanal', 'Weekly') },
    percepciones: [
      L('F6', 'Sueldo ordinario', 'Ordinary salary'),
      L('F7', 'Séptimo día', 'Seventh day'),
      L('F8', 'Bono de puntualidad', 'Punctuality bonus'),
      L('F9', 'Bono de asistencia', 'Attendance bonus'),
      ...extras,
    ],
    totalPercepciones: L('F10', 'Salario bruto semanal', 'Weekly gross salary'),
    deducciones: [L('F13', 'IMSS (trabajador)', 'IMSS (Housing Fund)'), L('F14', 'ISPT (impuesto trabajador)', 'ISPT (Tax Worker)'), L('F15', 'Ajuste moneda', 'Currency adjustments')],
    totalDeducciones: L('F16', 'Total deducciones', 'Total deductions'),
    neto: L('F18', 'Salario neto semanal', 'Weekly net salary'),
    sodexo: L('F19', 'Sodexo', 'Sodexo'),
    netoSodexo: L('F20', 'Salario neto semanal + Sodexo', 'Weekly net salary + Sodexo'),
    patronales: [L('F23', 'IMSS (empresa)', 'IMSS (Company tax)'), L('F24', 'Infonavit', 'Infonavit'), L('F25', 'Retiro', 'Retirement'), L('F26', 'Impuesto estatal', 'State tax')],
    totalPatronales: L('F27', 'Total impuestos', 'Total taxes'),
    costos: [
      L('F29', 'Provisión de finiquito', 'Termination provision'),
      L('F30', 'Costos operativos y administrativos', 'Operating and administrative costs'),
      L('F32', 'Total base', 'Total base'),
      L('F33', `Costo de servicio (${num(d.servicio)}%)`, `Service cost (${num(d.servicio)}%)`),
    ],
    total,
    objetivo,
    supuestos: [
      tr('Formato 33 Hilos (Estructura_Corrida_33_Hilos_BASE) con montos de la corrida general Treve aprobada.', '33 Hilos format (Estructura_Corrida_33_Hilos_BASE) with amounts from the approved Treve general payroll run.'),
      ...supuestosGenerales(d, gen, objetivo, extras),
      tr(`Costo de servicio ${num(d.servicio)}% y costos administrativos ${dinero(num(d.costosAdministrativos))}.`, `Service cost ${num(d.servicio)}% and administrative costs ${dinero(num(d.costosAdministrativos))}.`),
    ],
    validaciones: [
      validarObjetivo(objetivo, d),
      ...validacionesGenerales(gen, d, r),
      { ok: casi(H('F10'), r.totalPercepciones.monto), texto: '33 Hilos: salario bruto = total percepciones de la corrida general' },
      { ok: casi(H('F16'), r.totalDeducciones.monto), texto: '33 Hilos: deducciones = corrida general' },
      { ok: casi(H('F20'), r.netoSodexo.monto), texto: '33 Hilos: neto + Sodexo = corrida general' },
      { ok: casi(H('F27'), r.totalPatronales.monto), texto: '33 Hilos: impuestos patronales = corrida general' },
      { ok: casi(H('F34'), H('F32') + H('F33')), texto: '33 Hilos: factura = total base + costo de servicio' },
      { ok: casi(H('Q3'), H('F34')) && casi(H('J3'), H('F20')) && casi(H('K3'), H('F10')), texto: '33 Hilos: tabla resumen (fila 3) = desglose' },
      noCero(total.monto, 'Factura semanal'),
      ...pendientes('hilos33', d),
    ],
    faltantes: datosCriticos('hilos33', d),
    libros: [
      { plantilla: 'hilos33', libro: h },
      { plantilla: 'general', libro: gen },
    ],
    estilosExcel: {},
  }
}

/* ───────── Entrada ───────── */

const cache = new Map<string, ResultadoCorrida>()

export function calcularCorrida(id: CorridaId, d: CorridaData): ResultadoCorrida {
  const clave = `${id}:${JSON.stringify(d)}`
  const previo = cache.get(clave)
  if (previo) return previo
  const r = id === 'kofile' ? kofile(d as KofileData) : id === 'general' ? general(d as GeneralData) : hilos33(d as Hilos33Data)
  if (cache.size > 30) cache.clear()
  cache.set(clave, r)
  return r
}

/** Resumen de validación (JSON) con entradas, supuestos y resultados. */
export function resumenValidacion(id: CorridaId, d: CorridaData, r: ResultadoCorrida) {
  const montos = (ls: Linea[]) => ls.map((l) => ({ concepto: l.concepto, monto: redondearA(l.monto, 6), celda: l.celda }))
  return {
    corrida: id,
    generado: new Date().toISOString(),
    plantillas: r.libros.map((l) => ARCHIVOS_APROBADOS[l.plantilla]),
    entradas: d,
    objetivo: r.objetivo,
    salario_diario: r.salarioDiario,
    periodo: r.periodo,
    percepciones: montos(r.percepciones),
    total_percepciones: r.totalPercepciones.monto,
    deducciones: montos(r.deducciones),
    total_deducciones: r.totalDeducciones.monto,
    neto: r.neto.monto,
    sodexo: r.sodexo.monto,
    neto_mas_sodexo: r.netoSodexo.monto,
    patronales: montos(r.patronales),
    total_patronales: r.totalPatronales.monto,
    costos: montos(r.costos),
    total: { concepto: r.total.concepto, monto: r.total.monto, celda: r.total.celda },
    supuestos: r.supuestos,
    validaciones: r.validaciones,
    celdas_capturadas: r.libros.flatMap(({ plantilla, libro }) => libro.datosCapturados.map((c) => ({ archivo: ARCHIVOS_APROBADOS[plantilla], ...c }))),
  }
}
