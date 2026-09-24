const numero = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const entero = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 })

export const dinero = (n: number) => `${n < 0 ? '-' : ''}$${numero.format(Math.abs(Number.isFinite(n) ? n : 0))}`
export const miles = (n: number) => entero.format(Number.isFinite(n) ? n : 0)
export const pct = (n: number) => `${+(n * 100).toFixed(2)}%`

/** Número desde un input; vacío o inválido = 0. */
export const num = (v: string | number) => {
  const n = typeof v === 'number' ? v : parseFloat(v.replace(/,/g, ''))
  return Number.isFinite(n) ? n : 0
}

const MESES_ES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
const MESES_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const DIAS_EN = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

/** 'YYYY-MM-DD' → Date local (sin corrimiento por zona horaria). */
export function fecha(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  if (!y || !m || !d) return new Date()
  return new Date(y, m - 1, d)
}

export const hoyISO = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** "27 de Mayo de 2026" (mes capitalizado, estilo Feedbak). */
export const fechaFeedbak = (iso: string) => {
  const d = fecha(iso)
  return `${d.getDate()} de ${cap(MESES_ES[d.getMonth()])} de ${d.getFullYear()}`
}
/** "26 de junio de 2026" */
export const fechaEs = (iso: string) => {
  const d = fecha(iso)
  return `${d.getDate()} de ${MESES_ES[d.getMonth()]} de ${d.getFullYear()}`
}
/** "May 13, 2026" */
export const fechaEn = (iso: string) => {
  const d = fecha(iso)
  return `${MESES_EN[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`
}
/** "Wednesday May 13, 2026" */
export const fechaEnDia = (iso: string) => `${DIAS_EN[fecha(iso).getDay()]} ${fechaEn(iso)}`
export const mesAnioEs = (iso: string) => {
  const d = fecha(iso)
  return `${cap(MESES_ES[d.getMonth()])} ${d.getFullYear()}`
}
export const mesAnioEn = (iso: string) => {
  const d = fecha(iso)
  return `${MESES_EN[d.getMonth()]} ${d.getFullYear()}`
}

export const primerNombre = (nombre: string) => nombre.trim().split(/\s+/)[0] ?? ''

/** Texto multilínea → lista sin líneas vacías. */
export const lineas = (texto: string) =>
  texto
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)

/** Parte una lista en páginas: `primera` elementos en la primera, `resto` en cada una de las siguientes. */
export function paginar<T>(items: T[], primera: number, resto: number): T[][] {
  const paginas = [items.slice(0, primera)]
  for (let i = primera; i < items.length; i += resto) paginas.push(items.slice(i, i + resto))
  return paginas
}
