import type { Colaborador } from '../lib/supabase'

// Se ordenan por el número del archivo (la URL puede ser un data: URI en el artifact).
const porNumero = (archivos: Record<string, string>) =>
  Object.fromEntries(Object.entries(archivos).map(([ruta, url]) => [Number(ruta.match(/(\d+)\.jpg$/)![1]), url])) as Record<number, string>
const CUMPLE = porNumero(import.meta.glob<string>('./fondos/cumple-*.jpg', { eager: true, import: 'default' }))
export const ANIVERSARIO = porNumero(import.meta.glob<string>('./fondos/aniversario-*.jpg', { eager: true, import: 'default' }))
export const FONDOS_CUMPLE = Object.keys(CUMPLE).map(Number).sort((a, b) => a - b).map((n) => CUMPLE[n])

export type Tipo = 'cumpleanos' | 'aniversario' | 'bienvenida' | 'despedida'

export const TIPOS: { id: Tipo; titulo: string; color: string }[] = [
  { id: 'cumpleanos', titulo: 'Cumpleaños', color: '#E77425' },
  { id: 'aniversario', titulo: 'Aniversario', color: '#13398C' },
  { id: 'bienvenida', titulo: 'Bienvenida', color: '#032B49' },
  { id: 'despedida', titulo: 'Despedida', color: '#B7B09D' },
]

/** Tamaño de cada plantilla en px (el de la diapositiva original) y escala al exportar. */
export const MEDIDAS: Record<Tipo, { ancho: number; alto: number; escala: number }> = {
  cumpleanos: { ancho: 720, alto: 960, escala: 2 },
  aniversario: { ancho: 1200, alto: 1920, escala: 1 },
  bienvenida: { ancho: 720, alto: 960, escala: 2 },
  despedida: { ancho: 720, alto: 960, escala: 2 },
}

export interface DatosTarjeta {
  tipo: Tipo
  nombre: string
  puesto: string
  area: string
  foto: string | null
  /** Despedida: a partir de qué día ('YYYY-MM-DD'). */
  fecha: string
  /** Despedida: con quién comunicarse. */
  contacto: string
  /** Aniversario: años (1-15). */
  anios: number
  /** Cumpleaños: fondo 0-4. */
  fondo: number
  /** Bienvenida: BIENVENIDO / BIENVENIDA. */
  genero: 'o' | 'a'
}

const sinAcentos = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()

/** Búsqueda en el directorio por nombre, puesto o área (sin importar acentos ni mayúsculas). */
export const coincide = (p: Colaborador, q: string) => sinAcentos(`${p.nombre} ${p.puesto} ${p.area}`).includes(sinAcentos(q.trim()))
