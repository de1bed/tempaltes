import { leerFormula, type Nodo } from './formula'

/**
 * Libro de Excel en memoria: evalúa las fórmulas de la plantilla aprobada tal
 * cual, con los datos de captura que se le indiquen. No hay fórmulas propias:
 * todo resultado sale de las celdas del Excel.
 */

export class ErrorExcel {
  readonly codigo: string
  constructor(codigo: string) {
    this.codigo = codigo
  }
  toString() {
    return this.codigo
  }
}

export type Valor = number | string | boolean | ErrorExcel | null

/** Celda tal como sale de scripts/extraer-plantillas-corridas.py. */
type CeldaJson = { f: string; c?: ValorJson } | ValorJson
type ValorJson = { n: number } | { s: string } | { b: boolean } | { e: string }
export interface PlantillaJson {
  archivo: string
  hojas: Record<string, Record<string, CeldaJson>>
}

/** Dato de captura: un valor fijo o una fórmula (sin "="). */
export type Captura = { valor: number | string } | { formula: string }

const N_A = new ErrorExcel('#N/A')
const VALOR = new ErrorExcel('#VALUE!')
const DIV0 = new ErrorExcel('#DIV/0!')

export function desdeJson(v: ValorJson | undefined): Valor {
  if (!v) return null
  if ('n' in v) return v.n
  if ('s' in v) return v.s
  if ('b' in v) return v.b
  return new ErrorExcel(v.e)
}

export function separarCelda(ref: string): [columna: number, fila: number] {
  const m = /^([A-Z]+)(\d+)$/.exec(ref)
  if (!m) throw new Error(`Celda inválida ${ref}`)
  let col = 0
  for (const ch of m[1]) col = col * 26 + (ch.charCodeAt(0) - 64)
  return [col, Number(m[2])]
}

export function nombreColumna(col: number): string {
  let s = ''
  for (let c = col; c > 0; c = Math.floor((c - 1) / 26)) s = String.fromCharCode(65 + ((c - 1) % 26)) + s
  return s
}

/** Redondeo de Excel: a la mitad se aleja de cero, corrigiendo el ruido de punto flotante. */
export function redondear(x: number, decimales: number): number {
  const p = 10 ** decimales
  const y = Number((Math.abs(x) * p).toPrecision(15))
  return (Math.sign(x) * Math.round(y)) / p
}

function truncar(x: number, decimales: number): number {
  const p = 10 ** decimales
  return (Math.sign(x) * Math.floor(Number((Math.abs(x) * p).toPrecision(15)))) / p
}

type Matriz = Valor[][]

export class Libro {
  private formulas = new Map<string, Nodo>()
  private memo = new Map<string, Valor>()
  private evaluando = new Set<string>()
  private capturas = new Map<string, Captura>()
  readonly plantilla: PlantillaJson

  constructor(plantilla: PlantillaJson) {
    this.plantilla = plantilla
  }

  get hojas(): string[] {
    return Object.keys(this.plantilla.hojas)
  }

  private clave(hoja: string, celda: string) {
    return `${hoja}!${celda}`
  }

  /** Captura un dato (reemplaza el valor o la fórmula de la plantilla en esa celda). */
  capturar(hoja: string, celda: string, dato: Captura) {
    if (!(hoja in this.plantilla.hojas)) throw new Error(`La plantilla no tiene la hoja "${hoja}"`)
    this.capturas.set(this.clave(hoja, celda), dato)
    this.memo.clear()
  }

  /** Datos capturados (para escribirlos en el Excel de salida). */
  get datosCapturados(): { hoja: string; celda: string; dato: Captura }[] {
    return [...this.capturas].map(([k, dato]) => {
      const i = k.lastIndexOf('!')
      return { hoja: k.slice(0, i), celda: k.slice(i + 1), dato }
    })
  }

  /** Fórmula vigente de una celda (la capturada o la de la plantilla), sin "=". */
  formula(hoja: string, celda: string): string | undefined {
    const captura = this.capturas.get(this.clave(hoja, celda))
    if (captura) return 'formula' in captura ? captura.formula : undefined
    const c = this.plantilla.hojas[hoja]?.[celda]
    return c && 'f' in c ? c.f : undefined
  }

  /** Valor guardado en la plantilla (lo que mostraba Excel la última vez). */
  valorGuardado(hoja: string, celda: string): Valor {
    const c = this.plantilla.hojas[hoja]?.[celda]
    if (!c) return null
    return 'f' in c ? desdeJson(c.c) : desdeJson(c)
  }

  /** Celdas con fórmula de una hoja (plantilla + capturadas como fórmula). */
  celdasConFormula(hoja: string): string[] {
    const celdas = new Set<string>()
    for (const [ref, c] of Object.entries(this.plantilla.hojas[hoja] ?? {})) if ('f' in c) celdas.add(ref)
    for (const { hoja: h, celda, dato } of this.datosCapturados) {
      if (h !== hoja) continue
      if ('formula' in dato) celdas.add(celda)
      else celdas.delete(celda)
    }
    return [...celdas]
  }

  valor(hoja: string, celda: string): Valor {
    const k = this.clave(hoja, celda)
    if (this.memo.has(k)) return this.memo.get(k)!
    if (this.evaluando.has(k)) throw new Error(`Referencia circular en ${k}`)
    this.evaluando.add(k)
    try {
      const v = this.calcular(hoja, celda)
      this.memo.set(k, v)
      return v
    } finally {
      this.evaluando.delete(k)
    }
  }

  /** Valor numérico (vacío = 0). Lanza si la celda tiene un error o texto. */
  numero(hoja: string, celda: string): number {
    const v = this.valor(hoja, celda)
    if (v === null) return 0
    if (typeof v === 'number') return v
    throw new Error(`${hoja}!${celda} no es numérico (${String(v)})`)
  }

  private calcular(hoja: string, celda: string): Valor {
    const captura = this.capturas.get(this.clave(hoja, celda))
    if (captura && 'valor' in captura) return captura.valor
    const formula = this.formula(hoja, celda)
    if (formula === undefined) return this.valorGuardado(hoja, celda)
    const kf = `${this.clave(hoja, celda)}=${formula}`
    let arbol = this.formulas.get(kf)
    if (!arbol) {
      arbol = leerFormula(formula)
      this.formulas.set(kf, arbol)
    }
    const r = this.evaluar(arbol, hoja)
    if (Array.isArray(r)) return r[0]?.[0] ?? null
    return r
  }

  private rango(hoja: string, desde: string, hasta: string): Matriz {
    const [c1, f1] = separarCelda(desde)
    const [c2, f2] = separarCelda(hasta)
    const filas: Matriz = []
    for (let f = Math.min(f1, f2); f <= Math.max(f1, f2); f++) {
      const fila: Valor[] = []
      for (let c = Math.min(c1, c2); c <= Math.max(c1, c2); c++) fila.push(this.valor(hoja, `${nombreColumna(c)}${f}`))
      filas.push(fila)
    }
    return filas
  }

  private evaluar(n: Nodo, hoja: string): Valor | Matriz {
    switch (n.tipo) {
      case 'num':
      case 'texto':
      case 'bool':
        return n.valor
      case 'ref': {
        const h = n.hoja ?? hoja
        if (!(h in this.plantilla.hojas)) return new ErrorExcel('#REF!')
        return this.valor(h, n.celda)
      }
      case 'rango':
        return this.rango(n.hoja ?? hoja, n.desde, n.hasta)
      case 'unario': {
        // El "+" inicial (=+A1) no convierte: si la celda tiene texto, regresa el texto.
        if (n.op === '+') return this.escalar(n.arg, hoja)
        const v = aNumero(this.escalar(n.arg, hoja))
        if (v instanceof ErrorExcel) return v
        return n.op === '-' ? -v : n.op === '%' ? v / 100 : v
      }
      case 'binario':
        return this.binario(n.op, this.escalar(n.izq, hoja), this.escalar(n.der, hoja))
      case 'funcion':
        return this.funcion(n.nombre, n.args, hoja)
    }
  }

  private escalar(n: Nodo, hoja: string): Valor {
    const v = this.evaluar(n, hoja)
    return Array.isArray(v) ? VALOR : v
  }

  private binario(op: string, a: Valor, b: Valor): Valor {
    if (a instanceof ErrorExcel) return a
    if (b instanceof ErrorExcel) return b
    if (op === '&') return texto(a) + texto(b)
    if (['=', '<>', '<', '>', '<=', '>='].includes(op)) {
      const cmp = comparar(a, b)
      switch (op) {
        case '=':
          return cmp === 0
        case '<>':
          return cmp !== 0
        case '<':
          return cmp < 0
        case '>':
          return cmp > 0
        case '<=':
          return cmp <= 0
        default:
          return cmp >= 0
      }
    }
    const x = aNumero(a)
    const y = aNumero(b)
    if (x instanceof ErrorExcel) return x
    if (y instanceof ErrorExcel) return y
    switch (op) {
      case '+':
        return x + y
      case '-':
        return x - y
      case '*':
        return x * y
      case '/':
        return y === 0 ? DIV0 : x / y
      case '^':
        return x ** y
    }
    throw new Error(`Operador desconocido ${op}`)
  }

  /** Números de los argumentos (rangos: solo celdas numéricas, como Excel). */
  private numeros(args: Nodo[], hoja: string): number[] | ErrorExcel {
    const r: number[] = []
    for (const a of args) {
      const v = this.evaluar(a, hoja)
      if (Array.isArray(v)) {
        for (const fila of v)
          for (const x of fila) {
            if (x instanceof ErrorExcel) return x
            if (typeof x === 'number') r.push(x)
          }
      } else {
        if (v instanceof ErrorExcel) return v
        if (v === null) continue
        const x = aNumero(v)
        if (x instanceof ErrorExcel) return x
        r.push(x)
      }
    }
    return r
  }

  private funcion(nombre: string, args: Nodo[], hoja: string): Valor {
    const num = (i: number) => (args[i] ? aNumero(this.escalar(args[i], hoja)) : 0)
    switch (nombre) {
      case 'SUM': {
        const xs = this.numeros(args, hoja)
        return xs instanceof ErrorExcel ? xs : xs.reduce((s, x) => s + x, 0)
      }
      case 'MIN':
      case 'MAX': {
        const xs = this.numeros(args, hoja)
        if (xs instanceof ErrorExcel) return xs
        if (!xs.length) return 0
        return nombre === 'MIN' ? Math.min(...xs) : Math.max(...xs)
      }
      case 'ROUND':
      case 'TRUNC': {
        const x = num(0)
        const d = num(1)
        if (x instanceof ErrorExcel) return x
        if (d instanceof ErrorExcel) return d
        return nombre === 'ROUND' ? redondear(x, Math.trunc(d)) : truncar(x, Math.trunc(d))
      }
      case 'IF': {
        const cond = this.escalar(args[0], hoja)
        if (cond instanceof ErrorExcel) return cond
        const si = typeof cond === 'string' ? VALOR : Boolean(cond)
        if (si instanceof ErrorExcel) return si
        const rama = si ? args[1] : args[2]
        if (!rama) return si ? true : false
        return this.escalar(rama, hoja)
      }
      case 'VLOOKUP':
        return this.buscarV(args, hoja)
    }
    throw new Error(`La función ${nombre} no está soportada por el motor`)
  }

  /** BUSCARV / VLOOKUP. Sin 4º argumento (o VERDADERO): coincidencia aproximada en tabla ordenada. */
  private buscarV(args: Nodo[], hoja: string): Valor {
    const buscado = this.escalar(args[0], hoja)
    if (buscado instanceof ErrorExcel) return buscado
    const tabla = this.evaluar(args[1], hoja)
    if (!Array.isArray(tabla)) return VALOR
    const col = aNumero(this.escalar(args[2], hoja))
    if (col instanceof ErrorExcel) return col
    const aproximada = args[3] ? Boolean(this.escalar(args[3], hoja)) : true
    if (col < 1 || col > (tabla[0]?.length ?? 0)) return new ErrorExcel('#REF!')
    let fila = -1
    if (aproximada) {
      // Búsqueda binaria como Excel: la última fila cuyo valor es <= al buscado.
      let lo = 0
      let hi = tabla.length - 1
      while (lo <= hi) {
        const mid = (lo + hi) >> 1
        const v = tabla[mid][0]
        if (v === null || comparar(v, buscado) <= 0) {
          if (v !== null) fila = mid
          lo = mid + 1
        } else hi = mid - 1
      }
    } else {
      fila = tabla.findIndex((f) => f[0] !== null && comparar(f[0], buscado) === 0)
    }
    if (fila < 0) return N_A
    return tabla[fila][col - 1]
  }
}

function aNumero(v: Valor): number | ErrorExcel {
  if (v instanceof ErrorExcel) return v
  if (v === null) return 0
  if (typeof v === 'number') return v
  if (typeof v === 'boolean') return v ? 1 : 0
  const t = v.trim()
  if (t === '') return VALOR
  const n = Number(t)
  return Number.isFinite(n) ? n : VALOR
}

function texto(v: Valor): string {
  if (v === null) return ''
  if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE'
  return String(v)
}

/** Comparación de Excel: números < textos < lógicos; textos sin distinguir mayúsculas. */
function comparar(a: Valor, b: Valor): number {
  const rango = (v: Valor) => (typeof v === 'number' || v === null ? 0 : typeof v === 'string' ? 1 : 2)
  if (a === null && typeof b === 'string') a = ''
  if (b === null && typeof a === 'string') b = ''
  const ra = rango(a)
  const rb = rango(b)
  if (ra !== rb) return ra - rb
  if (ra === 0) return (Number(a ?? 0) - Number(b ?? 0)) || 0
  if (ra === 1) {
    const x = String(a).toLowerCase()
    const y = String(b).toLowerCase()
    return x < y ? -1 : x > y ? 1 : 0
  }
  return Number(a) - Number(b)
}
