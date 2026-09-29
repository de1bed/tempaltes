import type { ReactNode } from 'react'
import { LineaEditable } from './Editable'
import type { Bloque } from './Paginado'

/**
 * Convierte texto y tablas en bloques para Paginado, de modo que cualquier
 * contenido (una carta larga, muchos puntos, una tabla con muchas filas) se
 * reparta solo entre hojas.
 */

interface Texto {
  valor: string
  onCambio: (v: string) => void
  id: string
  vars?: Record<string, string>
  placeholder: string
}

/** Una línea = un bloque. `como="p"` párrafos; `como="li"` puntos con viñeta ("*…" = nota sin viñeta). */
export function bloquesLineas({ valor, onCambio, id, vars, placeholder, como, clase }: Texto & { como: 'p' | 'li' | 'div'; clase?: string }): Bloque[] {
  const items = valor.split('\n')
  return items.map((l, i) => {
    const vacio = !l.trim()
    const editable = <LineaEditable items={items} i={i} onCambio={onCambio} id={id} vars={vars} placeholder={placeholder} />
    const ultimo = i === items.length - 1
    if (como === 'li') {
      return {
        key: `${id}-${i}`,
        pegado: !ultimo,
        nodo: (
          <ul className={['item', clase, vacio ? 'vacio' : ''].filter(Boolean).join(' ')}>
            <li className={l.startsWith('*') ? 'nota' : undefined}>{editable}</li>
          </ul>
        ),
      }
    }
    const Tag = como
    return {
      key: `${id}-${i}`,
      pegado: como === 'div' && !ultimo,
      nodo: <Tag className={[clase, vacio ? 'vacio' : ''].filter(Boolean).join(' ') || undefined}>{editable}</Tag>,
    }
  })
}

/**
 * Texto por secciones, una línea por bloque:
 *   "## Título" título (nunca queda solo al final de una hoja)
 *   "- texto"   subpunto
 *   "*texto"    nota sin viñeta
 *   "---"       la siguiente línea empieza en hoja nueva
 *   otra        punto con viñeta
 */
export function bloquesSecciones({
  valor,
  onCambio,
  id,
  vars,
  placeholder,
  placeholderTitulo,
  claseTitulo = 'h-sec',
  claseLista = 'terms',
}: Texto & { placeholderTitulo: string; claseTitulo?: string; claseLista?: string }): Bloque[] {
  const items = valor.split('\n')
  const bloques: Bloque[] = []
  let salto = false
  items.forEach((l, i) => {
    if (l.trim() === '---') {
      salto = true
      return
    }
    const comun = { items, i, onCambio, id, vars }
    const siguiente = items[i + 1] ?? ''
    const siguienteEsPunto = siguiente.trim() !== '' && !siguiente.startsWith('## ') && siguiente.trim() !== '---'
    if (l.startsWith('## ')) {
      bloques.push({
        key: `${id}-${i}`,
        salto,
        conSiguiente: true,
        pegado: siguienteEsPunto,
        nodo: (
          <div className={l.slice(3).trim() ? `${claseTitulo} titulo-bloque` : `${claseTitulo} titulo-bloque vacio`}>
            <LineaEditable {...comun} prefijo="## " placeholder={placeholderTitulo} />
          </div>
        ),
      })
    } else {
      const sub = l.startsWith('- ')
      const nota = !sub && l.startsWith('*')
      const vacio = !l.replace(/^- /, '').trim()
      bloques.push({
        key: `${id}-${i}`,
        salto,
        pegado: siguienteEsPunto,
        nodo: (
          <ul className={['item', claseLista, vacio ? 'vacio' : ''].filter(Boolean).join(' ')}>
            <li className={sub ? 'sub' : nota ? 'nota' : undefined}>
              <LineaEditable {...comun} prefijo={sub ? '- ' : ''} placeholder={placeholder} />
            </li>
          </ul>
        ),
      })
    }
    salto = false
  })
  return bloques
}

/**
 * Tabla partible: encabezado y cada fila son bloques. Si la tabla pasa a otra
 * hoja, el encabezado se repite arriba. Todas las piezas comparten anchos de
 * columna (colgroup) para quedar alineadas.
 */
export function bloquesTabla({
  key,
  clase,
  anchos,
  encabezado,
  filas,
  pie,
  salto,
}: {
  key: string
  clase?: string
  anchos: (string | undefined)[]
  encabezado: ReactNode
  filas: { key: string; nodo: ReactNode }[]
  pie?: ReactNode
  salto?: Bloque['salto']
}): Bloque[] {
  const columnas = (
    <colgroup>
      {anchos.map((w, i) => (
        <col key={i} style={w ? { width: w } : undefined} />
      ))}
    </colgroup>
  )
  const base = ['partida', clase].filter(Boolean).join(' ')
  const claveEncabezado = `${key}-encabezado`
  const cuerpo = [...filas, ...(pie ? [{ key: 'pie', nodo: pie }] : [])]
  return [
    {
      key: claveEncabezado,
      salto,
      pegado: true,
      conSiguiente: true,
      nodo: (
        <table className={base}>
          {columnas}
          <thead>{encabezado}</thead>
        </table>
      ),
    },
    ...cuerpo.map((f, i) => ({
      key: `${key}-${f.key}`,
      pegado: i < cuerpo.length - 1,
      repite: claveEncabezado,
      nodo: (
        <table className={`${base} fila-tabla`}>
          {columnas}
          <tbody>{f.nodo}</tbody>
        </table>
      ),
    })),
  ]
}

/** El bloque anterior al cierre va junto con él: el cierre (firma, aprobación) nunca queda solo en una hoja. */
export function conCierre(bloques: Bloque[]): Bloque[] {
  const i = bloques.length - 2
  return bloques.map((b, j) => (j === i ? { ...b, conSiguiente: true } : b))
}
