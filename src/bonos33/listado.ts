/**
 * Lectura del "Listado de Nómina" semanal de 33 Hilos (PDF del sistema de nómina) y de la base
 * "Salary 33 Threads" (Excel). De ahí sale la plantilla: número, nombre, puesto, ingreso y salario diario.
 */

export interface PersonaListado {
  num: string
  nombre: string
  /** El PDF corta el puesto ("Senior"); se prefiere el de la base si ya existe. */
  puesto: string
  ingreso: string | null
  salario_diario: number
  sdi: number | null
  totalPercepciones: number | null
}

export interface Listado {
  /** "Semanal No: 40 · Del 28/sep/2026 al 04/oct/2026" */
  periodo: string
  personas: PersonaListado[]
  totalEmpleados: number | null
}

const MESES: Record<string, string> = { ene: '01', feb: '02', mar: '03', abr: '04', may: '05', jun: '06', jul: '07', ago: '08', sep: '09', oct: '10', nov: '11', dic: '12' }

/** "15/jul/2024" → "2024-07-15" */
export function fechaListado(s: string): string | null {
  const m = /^(\d{1,2})\/([a-z]{3})\/(\d{4})$/i.exec(s.trim())
  const mes = m && MESES[m[2].toLowerCase()]
  return m && mes ? `${m[3]}-${mes}-${m[1].padStart(2, '0')}` : null
}

const numero = (s: string) => Number(s.replace(/,/g, ''))

/** Lee las líneas de texto del listado (una por renglón, como las arma `lineasPdf`). */
export function leerListado(lineas: string[]): Listado {
  const personas: PersonaListado[] = []
  let actual: PersonaListado | null = null
  let semana = ''
  let rango = ''
  let totalEmpleados: number | null = null
  for (const cruda of lineas) {
    const l = cruda.replace(/\s+/g, ' ').trim()
    if (!l) continue
    const s = /Semanal No:\s*(\d+)/i.exec(l)
    if (s && !semana) semana = s[1]
    const r = /Del (\d{1,2}\/\w{3}\/\d{4}) al (\d{1,2}\/\w{3}\/\d{4})/i.exec(l)
    if (r && !rango) rango = `del ${r[1]} al ${r[2]}`
    const te = /Total de empleados:\s*(\d+)/i.exec(l)
    if (te) totalEmpleados = Number(te[1])
    // "20111 SOSA TELLO ALICIA SARAHI - Global Logistics"
    const cab = /^(\d{5,6}) ([A-ZÁÉÍÓÚÜÑ][A-ZÁÉÍÓÚÜÑ .'-]+?) -\s*(.*)$/.exec(l)
    if (cab) {
      actual = { num: cab[1], nombre: cab[2].trim(), puesto: cab[3].replace(/\s+/g, ' ').trim(), ingreso: null, salario_diario: 0, sdi: null, totalPercepciones: null }
      personas.push(actual)
      continue
    }
    if (!actual) continue
    const ing = /Fecha de Ingreso:\s*(\d{1,2}\/\w{3}\/\d{4})/i.exec(l)
    if (ing) actual.ingreso = fechaListado(ing[1])
    const sd = /Salario Diario:\s*([\d,]+\.\d+)/i.exec(l)
    if (sd) actual.salario_diario = numero(sd[1])
    const sdi = /S\.D\.I:\s*([\d,]+\.\d+)/i.exec(l)
    if (sdi) actual.sdi = numero(sdi[1])
    const tp = /Total Percepciones:\s*([\d,]+\.\d+)/i.exec(l)
    if (tp && actual.totalPercepciones === null) {
      actual.totalPercepciones = numero(tp[1])
      // Después del total de la persona solo vienen los totales generales.
      actual = null
    }
  }
  return {
    periodo: [semana && `Semanal No. ${semana}`, rango].filter(Boolean).join(' · '),
    personas: personas.filter((p) => p.salario_diario > 0),
    totalEmpleados,
  }
}

/* ───────── Base "Salary 33 Threads" (Excel) ───────── */

export interface PersonaBase {
  num: string
  nombre: string
  puesto: string
  ingreso: string | null
  /** Gross Weekly Salary. */
  brutoSemanal: number
  /** Bruto semanal ÷ 8.4 (6 días + séptimo + 70% de bonos de puntualidad y asistencia). */
  salario_diario: number
}

/** Días que paga la semana de 33 Hilos: 6 de sueldo + séptimo + puntualidad (0.7) + asistencia (0.7). */
export const DIAS_SEMANA_BRUTA = 8.4

/** Filas de la hoja de la base (encabezados en cualquier renglón: Num, Name, Position, Gross Weekly Salary, Start Date). */
export function leerBase(filas: (string | number | null)[][]): PersonaBase[] {
  const iCab = filas.findIndex((f) => f.some((c) => /^num$/i.test(String(c ?? '').trim())) && f.some((c) => /gross weekly/i.test(String(c ?? ''))))
  if (iCab < 0) return []
  const cab = filas[iCab].map((c) => String(c ?? '').trim().toLowerCase())
  const col = (re: RegExp) => cab.findIndex((c) => re.test(c))
  const cNum = col(/^num$/)
  const cNombre = col(/^name$/)
  const cPuesto = col(/^position$/)
  const cBruto = col(/gross weekly/)
  const cIngreso = col(/start date/)
  const out: PersonaBase[] = []
  for (const f of filas.slice(iCab + 1)) {
    const num = String(f[cNum] ?? '').trim()
    const bruto = Number(f[cBruto])
    if (!/^\d+$/.test(num) || !(bruto > 0)) continue
    out.push({
      num,
      nombre: String(f[cNombre] ?? '').replace(/\s+/g, ' ').trim(),
      puesto: String(f[cPuesto] ?? '').replace(/\s+/g, ' ').trim(),
      ingreso: cIngreso >= 0 ? fechaExcel(f[cIngreso]) : null,
      brutoSemanal: bruto,
      salario_diario: Math.round((bruto / DIAS_SEMANA_BRUTA) * 100) / 100,
    })
  }
  return out
}

/** Número de serie de Excel (45512) o texto ISO → "YYYY-MM-DD". */
function fechaExcel(v: string | number | null | undefined): string | null {
  if (typeof v === 'number' && v > 20000) return new Date(Math.round((v - 25569) * 86400000)).toISOString().slice(0, 10)
  const s = String(v ?? '')
  return /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : null
}
