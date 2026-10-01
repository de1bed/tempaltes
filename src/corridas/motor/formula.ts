/**
 * Lector de fórmulas de Excel: convierte el texto de una fórmula en un árbol
 * que el libro (libro.ts) evalúa. Cubre lo que usan las plantillas aprobadas:
 * números, textos, referencias (A1, $A$1, Hoja!A1, 'Hoja con espacios'!A1:B9),
 * operadores + - * / ^ & = <> < > <= >= y %, y llamadas a funciones.
 */

export type Nodo =
  | { tipo: 'num'; valor: number }
  | { tipo: 'texto'; valor: string }
  | { tipo: 'bool'; valor: boolean }
  | { tipo: 'ref'; hoja?: string; celda: string }
  | { tipo: 'rango'; hoja?: string; desde: string; hasta: string }
  | { tipo: 'unario'; op: '+' | '-' | '%'; arg: Nodo }
  | { tipo: 'binario'; op: string; izq: Nodo; der: Nodo }
  | { tipo: 'funcion'; nombre: string; args: Nodo[] }

type Token =
  | { t: 'num'; v: number }
  | { t: 'texto'; v: string }
  | { t: 'ref'; hoja?: string; v: string }
  | { t: 'nombre'; v: string }
  | { t: 'op'; v: string }
  | { t: '(' | ')' | ',' | ':' }

const CELDA = /^\$?[A-Z]{1,3}\$?\d+/

function tokenizar(f: string): Token[] {
  const tokens: Token[] = []
  let i = 0
  while (i < f.length) {
    const c = f[i]
    if (c === ' ' || c === '\n' || c === '\t') {
      i++
      continue
    }
    if (c === '"') {
      let v = ''
      i++
      while (i < f.length) {
        if (f[i] === '"' && f[i + 1] === '"') {
          v += '"'
          i += 2
        } else if (f[i] === '"') break
        else v += f[i++]
      }
      i++
      tokens.push({ t: 'texto', v })
      continue
    }
    if (c === "'") {
      // 'Nombre de hoja'!A1
      let hoja = ''
      i++
      while (i < f.length) {
        if (f[i] === "'" && f[i + 1] === "'") {
          hoja += "'"
          i += 2
        } else if (f[i] === "'") break
        else hoja += f[i++]
      }
      i++
      if (f[i] !== '!') throw new Error(`Se esperaba ! después de '${hoja}' en ${f}`)
      i++
      const m = CELDA.exec(f.slice(i))
      if (!m) throw new Error(`Referencia inválida después de '${hoja}'! en ${f}`)
      tokens.push({ t: 'ref', hoja, v: m[0].replace(/\$/g, '') })
      i += m[0].length
      continue
    }
    if (/[0-9.]/.test(c)) {
      const m = /^(\d+\.?\d*|\.\d+)(E[+-]?\d+)?/i.exec(f.slice(i))!
      tokens.push({ t: 'num', v: parseFloat(m[0]) })
      i += m[0].length
      continue
    }
    if (/[A-Za-z_$]/.test(c)) {
      const resto = f.slice(i)
      const hoja = /^([A-Za-z_][\w.]*)!/.exec(resto)
      if (hoja) {
        const m = CELDA.exec(resto.slice(hoja[0].length))
        if (!m) throw new Error(`Referencia inválida en ${f}`)
        tokens.push({ t: 'ref', hoja: hoja[1], v: m[0].replace(/\$/g, '') })
        i += hoja[0].length + m[0].length
        continue
      }
      const celda = CELDA.exec(resto)
      // Una celda no puede ir seguida de letras, dígitos o "(" (eso sería un nombre o función).
      if (celda && !/^[\w(]/.test(resto.slice(celda[0].length))) {
        tokens.push({ t: 'ref', v: celda[0].replace(/\$/g, '') })
        i += celda[0].length
        continue
      }
      const nombre = /^[A-Za-z_][\w.]*/.exec(resto)!
      tokens.push({ t: 'nombre', v: nombre[0].toUpperCase() })
      i += nombre[0].length
      continue
    }
    const dos = f.slice(i, i + 2)
    if (dos === '<=' || dos === '>=' || dos === '<>') {
      tokens.push({ t: 'op', v: dos })
      i += 2
      continue
    }
    if ('+-*/^&=<>%'.includes(c)) {
      tokens.push({ t: 'op', v: c })
      i++
      continue
    }
    if (c === '(' || c === ')' || c === ',' || c === ':') {
      tokens.push({ t: c })
      i++
      continue
    }
    throw new Error(`Carácter inesperado "${c}" en la fórmula ${f}`)
  }
  return tokens
}

// Precedencia de Excel (de menor a mayor): comparación, &, + -, * /, ^, % y signo.
const NIVELES: string[][] = [['=', '<>', '<', '>', '<=', '>='], ['&'], ['+', '-'], ['*', '/'], ['^']]

export function leerFormula(formula: string): Nodo {
  const tokens = tokenizar(formula)
  let p = 0
  const ver = () => tokens[p]
  const esOp = (ops: string[]) => {
    const t = ver()
    return t?.t === 'op' && ops.includes(t.v)
  }

  function binario(nivel: number): Nodo {
    if (nivel === NIVELES.length) return unario()
    let izq = binario(nivel + 1)
    while (esOp(NIVELES[nivel])) {
      const op = (tokens[p++] as { v: string }).v
      izq = { tipo: 'binario', op, izq, der: binario(nivel + 1) }
    }
    return izq
  }

  function unario(): Nodo {
    if (esOp(['+', '-'])) {
      const op = (tokens[p++] as { v: '+' | '-' }).v
      return { tipo: 'unario', op, arg: unario() }
    }
    let nodo = primario()
    while (esOp(['%'])) {
      p++
      nodo = { tipo: 'unario', op: '%', arg: nodo }
    }
    return nodo
  }

  function primario(): Nodo {
    const t = tokens[p++]
    if (!t) throw new Error(`Fórmula incompleta: ${formula}`)
    switch (t.t) {
      case 'num':
        return { tipo: 'num', valor: t.v }
      case 'texto':
        return { tipo: 'texto', valor: t.v }
      case 'ref': {
        if (ver()?.t === ':') {
          p++
          const fin = tokens[p++]
          if (fin?.t !== 'ref') throw new Error(`Rango inválido en ${formula}`)
          return { tipo: 'rango', hoja: t.hoja, desde: t.v, hasta: fin.v }
        }
        return { tipo: 'ref', hoja: t.hoja, celda: t.v }
      }
      case 'nombre': {
        if (ver()?.t !== '(') {
          if (t.v === 'TRUE' || t.v === 'FALSE') return { tipo: 'bool', valor: t.v === 'TRUE' }
          throw new Error(`Nombre desconocido ${t.v} en ${formula}`)
        }
        p++
        const args: Nodo[] = []
        if (ver()?.t !== ')') {
          for (;;) {
            args.push(binario(0))
            if (ver()?.t === ',') {
              p++
              continue
            }
            break
          }
        }
        if (tokens[p++]?.t !== ')') throw new Error(`Falta ) en ${formula}`)
        return { tipo: 'funcion', nombre: t.v, args }
      }
      case '(': {
        const nodo = binario(0)
        if (tokens[p++]?.t !== ')') throw new Error(`Falta ) en ${formula}`)
        return nodo
      }
      default:
        throw new Error(`Token inesperado en ${formula}`)
    }
  }

  const arbol = binario(0)
  if (p < tokens.length) throw new Error(`Sobra texto en la fórmula ${formula}`)
  return arbol
}
