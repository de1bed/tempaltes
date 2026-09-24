/**
 * Tabuladores Feedbak, transcritos de los Excel "Cotizador ... Cliente 00-2026"
 * (hoja "2025", columna de Pesos). Los precios son fijos: el vendedor solo
 * captura el producto, los colaboradores y los administradores requeridos.
 *
 * Rangos de colaboradores (igual que los IF anidados del Excel):
 *   <101 · <501 · <1501 · <3001 · <7001 · <12000 · 12000+
 */

export type ProductoFeedbak =
  | 'checador'
  | 'checador-facial'
  | 'mk-checador'
  | 'mk-checador-facial'

export type Moneda = 'MXN' | 'USD'

const LIMITES = [101, 501, 1501, 3001, 7001, 12000]

/** Índice de rango (0 a 6) según número de colaboradores. */
export function rango(colaboradores: number): number {
  const i = LIMITES.findIndex((limite) => colaboradores < limite)
  return i === -1 ? LIMITES.length : i
}

interface DefinicionProducto {
  nombre: string
  /** Texto para "Plataformas incluidas" y la carta. */
  plataformas: string
  plataformasEn: string
  /** Precio mensual por usuario (MXN) por rango. */
  precios: [number, number, number, number, number, number, number]
  /** Setup inicial (MXN), se cobra en la primera factura. */
  setup: (colaboradores: number) => number
}

// Los Excel de Checador dejan el rango 12000+ sin valor (devuelven FALSE);
// se extiende el último precio definido.
export const PRODUCTOS: Record<ProductoFeedbak, DefinicionProducto> = {
  checador: {
    nombre: 'Checador',
    plataformas: 'Checador',
    plataformasEn: 'Checador',
    precios: [24, 19, 12, 7, 7, 7, 7],
    setup: () => 2000,
  },
  'checador-facial': {
    nombre: 'Checador con reconocimiento facial',
    plataformas: 'Checador con reconocimiento facial',
    plataformasEn: 'Checador with facial recognition',
    precios: [26, 21, 14, 9, 9, 9, 9],
    setup: () => 2000,
  },
  'mk-checador': {
    nombre: 'Mi Kiosko + Checador',
    plataformas: 'Mi Kiosko y Checador',
    plataformasEn: 'Mi Kiosko and Checador',
    precios: [36, 29, 22, 17, 13, 8, 5],
    setup: (n) => (n > 100 ? 0 : 3000),
  },
  'mk-checador-facial': {
    nombre: 'Mi Kiosko + Checador con reconocimiento facial',
    plataformas: 'Mi Kiosko y Checador con reconocimiento facial',
    plataformasEn: 'Mi Kiosko and Checador with facial recognition',
    precios: [38, 31, 24, 19, 15, 8, 5],
    setup: (n) => (n > 100 ? 0 : 3000),
  },
}

const ADMINS_INCLUIDOS = [2, 3, 6, 10, 20, 30, 50]
const PRECIO_ADMIN_EXTRA = [250, 150, 100, 50, 10, 8, 5]

export function descuentoSemestral(n: number): number {
  if (n < 101) return 0.03
  if (n < 501) return 0.06
  if (n <= 1500) return 0.12
  return 0.15
}

export function descuentoAnual(n: number): number {
  if (n < 101) return 0.05
  if (n < 501) return 0.1
  if (n <= 1500) return 0.15
  return 0.2
}

export interface EntradaFeedbak {
  producto: ProductoFeedbak
  colaboradores: number
  /** Administradores que pide el cliente; los que excedan los incluidos se cobran. */
  administradores: number
  moneda: Moneda
  /** Pesos por dólar. Solo se usa cuando moneda = USD. */
  tipoCambio: number
}

export interface CotizacionFeedbak {
  producto: DefinicionProducto
  colaboradores: number
  moneda: Moneda
  precioUsuario: number
  mensualUsuarios: number
  adminsIncluidos: number
  adminsExtra: number
  precioAdminExtra: number
  mensualAdminsExtra: number
  totalMensual: number
  setup: number
  primeraFactura: number
  semestralBase: number
  descuentoSemestral: number
  semestral: number
  anualBase: number
  descuentoAnual: number
  anual: number
}

export function cotizarFeedbak(e: EntradaFeedbak): CotizacionFeedbak {
  const n = Math.max(1, Math.floor(e.colaboradores || 0))
  const r = rango(n)
  const def = PRODUCTOS[e.producto]
  const tc = e.moneda === 'USD' && e.tipoCambio > 0 ? e.tipoCambio : 1
  const conv = (pesos: number) => pesos / tc

  const precioUsuario = def.precios[r]
  const adminsIncluidos = ADMINS_INCLUIDOS[r]
  const adminsExtra = Math.max(0, Math.floor(e.administradores || 0) - adminsIncluidos)
  const precioAdminExtra = PRECIO_ADMIN_EXTRA[r]

  const mensualUsuarios = precioUsuario * n
  const mensualAdminsExtra = precioAdminExtra * adminsExtra
  const totalMensual = mensualUsuarios + mensualAdminsExtra
  const setup = def.setup(n)
  const primeraFactura = totalMensual + setup

  // Igual que el Excel: primera factura (con setup) + 5 u 11 mensualidades.
  const semestralBase = primeraFactura + totalMensual * 5
  const dSem = descuentoSemestral(n)
  const anualBase = primeraFactura + totalMensual * 11
  const dAnual = descuentoAnual(n)

  return {
    producto: def,
    colaboradores: n,
    moneda: e.moneda,
    precioUsuario: conv(precioUsuario),
    mensualUsuarios: conv(mensualUsuarios),
    adminsIncluidos,
    adminsExtra,
    precioAdminExtra: conv(precioAdminExtra),
    mensualAdminsExtra: conv(mensualAdminsExtra),
    totalMensual: conv(totalMensual),
    setup: conv(setup),
    primeraFactura: conv(primeraFactura),
    semestralBase: conv(semestralBase),
    descuentoSemestral: dSem,
    semestral: conv(semestralBase * (1 - dSem)),
    anualBase: conv(anualBase),
    descuentoAnual: dAnual,
    anual: conv(anualBase * (1 - dAnual)),
  }
}
