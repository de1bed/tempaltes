/** Fechas del módulo Felicitaciones: próximos cumpleaños y aniversarios del directorio. */

/** Años de aniversario con diseño en las plantillas (fondos 1 a 15). */
export const MAX_ANIOS = 15

export interface ConFechas {
  id: string
  nacimiento: string | null
  ingreso: string | null
}

export interface Efemeride<T extends ConFechas = ConFechas> {
  tipo: 'cumpleanos' | 'aniversario'
  persona: T
  /** Día del festejo, 'YYYY-MM-DD'. */
  fecha: string
  /** Días que faltan (0 = hoy). */
  dias: number
  /** Solo aniversarios: años que cumple. */
  anios?: number
}

const partes = (iso: string) => iso.split('-').map(Number) as [number, number, number]
const iso = (y: number, m: number, d: number) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
const bisiesto = (y: number) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0
const diasEntre = (a: string, b: string) => {
  const [ya, ma, da] = partes(a)
  const [yb, mb, db] = partes(b)
  return Math.round((Date.UTC(yb, mb - 1, db) - Date.UTC(ya, ma - 1, da)) / 86_400_000)
}

/** El mismo día y mes en el año dado; el 29 de febrero se festeja el 28 en años no bisiestos. */
function enAnio(fecha: string, anio: number): string {
  const [, m, d] = partes(fecha)
  return m === 2 && d === 29 && !bisiesto(anio) ? iso(anio, 2, 28) : iso(anio, m, d)
}

/** Próxima vez (hoy o después) que cae el día y mes de `fecha`. */
export function proximaVez(fecha: string, hoy: string): string {
  const anio = partes(hoy)[0]
  const este = enAnio(fecha, anio)
  return este >= hoy ? este : enAnio(fecha, anio + 1)
}

/** Cumpleaños y aniversarios de los próximos `dias` días (incluye hoy), del más cercano al más lejano. */
export function proximas<T extends ConFechas>(personas: T[], hoy: string, dias = 30): Efemeride<T>[] {
  const lista: Efemeride<T>[] = []
  for (const persona of personas) {
    if (persona.nacimiento) {
      const fecha = proximaVez(persona.nacimiento, hoy)
      const faltan = diasEntre(hoy, fecha)
      if (faltan <= dias) lista.push({ tipo: 'cumpleanos', persona, fecha, dias: faltan })
    }
    if (persona.ingreso) {
      const fecha = proximaVez(persona.ingreso, hoy)
      const faltan = diasEntre(hoy, fecha)
      const anios = partes(fecha)[0] - partes(persona.ingreso)[0]
      if (faltan <= dias && anios >= 1) lista.push({ tipo: 'aniversario', persona, fecha, dias: faltan, anios })
    }
  }
  return lista.sort((a, b) => a.dias - b.dias || a.tipo.localeCompare(b.tipo))
}

/** Años que cumple en la empresa este año (mínimo 1), para proponer el fondo del aniversario. */
export function aniosEsteAnio(ingreso: string, hoy: string): number {
  return Math.max(1, partes(hoy)[0] - partes(ingreso)[0])
}

/** 'YYYY-MM-DD' → 'dd/mm/aaaa', como en la plantilla de despedida. */
export function textoFecha(fecha: string): string {
  const [y, m, d] = partes(fecha)
  return y && m && d ? `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y}` : ''
}

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
const DIAS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb']

/** "Hoy", "Mañana" o "vie 24 oct". */
export function textoCuando(fecha: string, dias: number): string {
  if (dias === 0) return 'Hoy'
  if (dias === 1) return 'Mañana'
  const [y, m, d] = partes(fecha)
  return `${DIAS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]} ${d} ${MESES[m - 1]}`
}

/** Día y mes de una fecha guardada: "24 oct". */
export function textoDiaMes(fecha: string): string {
  const [, m, d] = partes(fecha)
  return `${d} ${MESES[m - 1]}`
}
