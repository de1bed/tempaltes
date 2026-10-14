// Horario de las salas, siempre en hora de la Ciudad de México (aunque el navegador esté en otra zona).
export const ZONA = 'America/Mexico_City'
export const HORA_INICIO = 7
export const HORA_FIN = 21
export const DIAS_ADELANTE = 30

const partes = new Intl.DateTimeFormat('en-US', {
  timeZone: ZONA,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  weekday: 'short',
  hourCycle: 'h23',
})

/** Día (`YYYY-MM-DD`), día de la semana y minutos desde medianoche, en la Ciudad de México. */
export function local(fecha: Date) {
  const p = Object.fromEntries(partes.formatToParts(fecha).map((x) => [x.type, x.value]))
  return { dia: `${p.year}-${p.month}-${p.day}`, semana: p.weekday, minutos: Number(p.hour) * 60 + Number(p.minute) }
}

/** Momento exacto de `dia` a los `minutos` (hora de la Ciudad de México). */
export function aFecha(dia: string, minutos: number): Date {
  const base = new Date(`${dia}T12:00:00Z`)
  const desfase = local(base).minutos - 12 * 60
  return new Date(Date.parse(`${dia}T00:00:00Z`) + (minutos - desfase) * 60_000)
}

/** Días hábiles (lunes a viernes) desde hoy hasta 30 días adelante. */
export function diasHabiles(ahora = new Date()): string[] {
  const dias: string[] = []
  for (let i = 0; i <= DIAS_ADELANTE; i++) {
    const { dia, semana } = local(new Date(ahora.getTime() + i * 24 * 3600_000))
    if (semana !== 'Sat' && semana !== 'Sun' && !dias.includes(dia)) dias.push(dia)
  }
  return dias
}

export interface Bloque {
  inicio: string
  fin: string
}

/** Horarios de inicio (minutos) cada 30 min en que cabe una reunión de `duracion` sin encimarse. */
export function horariosLibres(dia: string, duracion: number, ocupado: Bloque[], ahora = new Date()): number[] {
  const libres: number[] = []
  for (let m = HORA_INICIO * 60; m + duracion <= HORA_FIN * 60; m += 30) {
    const inicio = aFecha(dia, m).getTime()
    const fin = inicio + duracion * 60_000
    if (inicio < ahora.getTime()) continue
    if (ocupado.some((b) => Date.parse(b.inicio) < fin && Date.parse(b.fin) > inicio)) continue
    libres.push(m)
  }
  return libres
}

export function textoHora(minutos: number): string {
  const h = Math.floor(minutos / 60)
  const m = minutos % 60
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'a.m.' : 'p.m.'}`
}

export function horaDe(iso: string): string {
  return textoHora(local(new Date(iso)).minutos)
}

export function textoDia(dia: string, opciones: Intl.DateTimeFormatOptions = { weekday: 'long', day: 'numeric', month: 'long' }): string {
  return aFecha(dia, 12 * 60).toLocaleDateString('es-MX', { timeZone: ZONA, ...opciones })
}

/** Lunes = 0 … domingo = 6, por la fecha de calendario (no por la zona del navegador). */
export function indiceSemana(dia: string): number {
  const [y, m, d] = dia.split('-').map(Number)
  return (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7
}

/** Suma días de calendario a una fecha `YYYY-MM-DD`. */
export function sumarDias(dia: string, n: number): string {
  const [y, m, d] = dia.split('-').map(Number)
  const fecha = new Date(Date.UTC(y, m - 1, d + n))
  const mm = String(fecha.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(fecha.getUTCDate()).padStart(2, '0')
  return `${fecha.getUTCFullYear()}-${mm}-${dd}`
}

/** Meses `YYYY-MM` que aparecen en una lista de días ya ordenada. */
export function mesesDelRango(dias: readonly string[]): string[] {
  const meses: string[] = []
  for (const dia of dias) {
    const mes = dia.slice(0, 7)
    if (meses.at(-1) !== mes) meses.push(mes)
  }
  return meses
}

export interface CeldaMes {
  dia: string
  habil: boolean
}

/** Semanas de lunes a domingo que cubren el mes `YYYY-MM`. */
export function semanasDelMes(mes: string, habiles: ReadonlySet<string>): CeldaMes[][] {
  const primero = `${mes}-01`
  const [y, m] = mes.split('-').map(Number)
  const ultimo = `${mes}-${String(new Date(Date.UTC(y, m, 0)).getUTCDate()).padStart(2, '0')}`
  const inicio = sumarDias(primero, -indiceSemana(primero))
  const fin = sumarDias(ultimo, 6 - indiceSemana(ultimo))
  const semanas: CeldaMes[][] = []
  for (let d = inicio; d <= fin; d = sumarDias(d, 1)) {
    if (semanas.length === 0 || semanas.at(-1)!.length === 7) semanas.push([])
    semanas.at(-1)!.push({ dia: d, habil: habiles.has(d) })
  }
  return semanas
}
