import { useContext, useLayoutEffect, useRef, type ClipboardEvent, type CSSProperties, type KeyboardEvent } from 'react'
import { flushSync } from 'react-dom'
import { cursorAl, EnMedidor, enfocar, posicionCursor, type Ligado } from '../lib/edicion'
import { rellenar } from '../lib/modelo'

/**
 * Edición directa sobre la vista previa. Cada texto editable está ligado a un
 * campo del formulario: lo que se escribe en la hoja actualiza ese campo y
 * viceversa, así que nada se pierde al cambiar de idioma o recargar.
 */

interface EditableProps extends Ligado {
  /** Texto que se muestra sin foco (montos con formato, {empresa} sustituido…). Por defecto, `valor`. */
  mostrar?: string
  placeholder?: string
  id?: string
  className?: string
  style?: CSSProperties
  /** Enter: si no se da, Enter solo termina la edición. Recibe la posición del cursor. */
  onEnter?: (posicion: number, el: HTMLElement) => void
  /** Retroceso con el texto vacío (para quitar un punto de una lista). */
  onBorrarVacio?: () => void
}

export function Editable({ valor, onCambio, mostrar, placeholder, id, className, style, onEnter, onBorrarVacio }: EditableProps) {
  const ref = useRef<HTMLSpanElement>(null)
  const enfocado = useRef(false)
  const medidor = useContext(EnMedidor)
  const texto = mostrar ?? valor
  const ultimo = useRef({ valor, texto })

  // El texto se escribe a mano (no como children) para no mover el cursor mientras se edita.
  useLayoutEffect(() => {
    ultimo.current = { valor, texto }
    const el = ref.current
    if (el && !enfocado.current && el.textContent !== texto) el.textContent = texto
  })

  function onKeyDown(e: KeyboardEvent<HTMLSpanElement>) {
    const el = e.currentTarget
    if (e.key === 'Enter') {
      e.preventDefault()
      if (onEnter) onEnter(posicionCursor(el), el)
      else el.blur()
    } else if (e.key === 'Backspace' && onBorrarVacio && !el.textContent) {
      e.preventDefault()
      onBorrarVacio()
    } else if (e.key === 'Escape') {
      el.blur()
    }
  }

  function onPaste(e: ClipboardEvent<HTMLSpanElement>) {
    // Solo texto plano, en una línea.
    e.preventDefault()
    const t = e.clipboardData.getData('text/plain').replace(/\s*\n\s*/g, ' ')
    document.execCommand('insertText', false, t)
  }

  return (
    <span
      ref={ref}
      id={medidor ? undefined : id}
      className={className ? `editable ${className}` : 'editable'}
      style={style}
      contentEditable
      suppressContentEditableWarning
      role="textbox"
      aria-label={placeholder}
      data-placeholder={placeholder}
      spellCheck
      onFocus={(e) => {
        enfocado.current = true
        // Al editar se muestra el valor real: el monto sin formato o el texto con {empresa}.
        const el = e.currentTarget
        if (el.textContent !== ultimo.current.valor) {
          el.textContent = ultimo.current.valor
          cursorAl(el, true)
        }
      }}
      onBlur={(e) => {
        enfocado.current = false
        e.currentTarget.textContent = ultimo.current.texto
      }}
      onInput={(e) => onCambio((e.currentTarget.textContent ?? '').replace(/\n/g, ' '))}
      onKeyDown={onKeyDown}
      onPaste={onPaste}
    />
  )
}

type Linea = Pick<EditableProps, 'id' | 'valor' | 'mostrar' | 'onCambio' | 'onEnter' | 'onBorrarVacio'>

const TITULO = '## '
const SUB = '- '
const SALTO = '---'

/** Tipo de línea en textos con secciones. Las notas ("*…") conservan su asterisco visible. */
function tipoLinea(l: string): 'titulo' | 'sub' | 'nota' | 'salto' | 'punto' {
  if (l.startsWith(TITULO)) return 'titulo'
  if (l.startsWith(SUB)) return 'sub'
  if (l.trim() === SALTO) return 'salto'
  if (l.startsWith('*')) return 'nota'
  return 'punto'
}

/**
 * Props de edición para la línea `i` de un texto multilínea: escribir la
 * actualiza, Enter la parte en dos y Retroceso en vacío la quita.
 * `prefijo` (p. ej. "## ") se guarda pero no se muestra. Tras un título, Enter
 * abre un punto normal; tras un subpunto, otro subpunto.
 */
function linea(items: string[], i: number, guardar: (l: string[]) => void, id: string, vars?: Record<string, string>, prefijo = ''): Linea {
  const valor = items[i].slice(prefijo.length)
  const esTitulo = prefijo === TITULO
  return {
    id: `${id}-${i}`,
    valor,
    mostrar: vars ? rellenar(valor, vars) : undefined,
    onCambio: (v) => guardar(items.map((x, j) => (j === i ? prefijo + v : x))),
    onEnter: (pos, el) => {
      const antes = esTitulo ? valor : valor.slice(0, pos)
      const despues = esTitulo ? '' : valor.slice(pos)
      el.textContent = antes
      // Se renderiza en el acto para mover el cursor antes de la siguiente tecla.
      flushSync(() => guardar([...items.slice(0, i), prefijo + antes, (esTitulo ? '' : prefijo) + despues, ...items.slice(i + 1)]))
      enfocar(`${id}-${i + 1}`, false)
    },
    onBorrarVacio:
      items.length > 1
        ? () => {
            flushSync(() => guardar(items.filter((_, j) => j !== i)))
            enfocar(`${id}-${Math.max(0, i - 1)}`)
          }
        : undefined,
  }
}

/** Texto multilínea (un párrafo o un punto por línea), editable punto por punto. En listas, "*…" es una nota sin viñeta. */
export function Lineas({
  valor,
  onCambio,
  como,
  id,
  vars,
  placeholder,
  className,
  style,
}: Ligado & {
  como: 'p' | 'li' | 'div'
  id: string
  vars?: Record<string, string>
  placeholder: string
  className?: string
  style?: CSSProperties
}) {
  const items = valor.split('\n')
  const Tag = como
  const guardar = (nuevos: string[]) => onCambio(nuevos.join('\n'))

  const lista = items.map((l, i) => {
    const clases = [l.trim() ? '' : 'vacio', como === 'li' && l.startsWith('*') ? 'nota' : ''].filter(Boolean).join(' ')
    return (
      <Tag key={i} className={clases || undefined}>
        <Editable {...linea(items, i, guardar, id, vars)} placeholder={placeholder} />
      </Tag>
    )
  })

  if (como === 'li')
    return (
      <ul className={className} style={style}>
        {lista}
      </ul>
    )
  return (
    <div className={className} style={{ display: 'contents', ...style }}>
      {lista}
    </div>
  )
}

/**
 * Texto por secciones. Formato de cada línea:
 *   "## Título"  título de sección
 *   "- texto"    subpunto
 *   "*texto"     nota sin viñeta
 *   "---"        salto de hoja
 *   otra         punto con viñeta
 * `hoja` elige el tramo entre saltos; `desde`/`hasta` recortan secciones dentro de él.
 * Todas las hojas editan el mismo texto.
 */
export function Secciones({
  valor,
  onCambio,
  id,
  vars,
  hoja = 0,
  desde = 0,
  hasta,
  placeholder,
  placeholderTitulo,
  claseTitulo = 'h-sec',
  claseLista = 'terms',
}: Ligado & {
  id: string
  vars?: Record<string, string>
  hoja?: number
  desde?: number
  hasta?: number
  placeholder: string
  placeholderTitulo: string
  claseTitulo?: string
  claseLista?: string
}) {
  const items = valor.split('\n')
  const guardar = (nuevos: string[]) => onCambio(nuevos.join('\n'))
  const secciones: { titulo: number | null; puntos: number[] }[] = []
  let tramo = 0
  items.forEach((l, i) => {
    const tipo = tipoLinea(l)
    if (tipo === 'salto') {
      tramo++
      return
    }
    if (tramo !== hoja) return
    if (tipo === 'titulo') secciones.push({ titulo: i, puntos: [] })
    else if (secciones.length === 0) secciones.push({ titulo: null, puntos: [i] })
    else secciones[secciones.length - 1].puntos.push(i)
  })

  return (
    <>
      {secciones.slice(desde, hasta).map((s) => (
        <div key={s.titulo ?? `s${s.puntos[0]}`} className="seccion-doc">
          {s.titulo !== null && (
            <div className={items[s.titulo].slice(TITULO.length).trim() ? claseTitulo : `${claseTitulo} vacio`}>
              <Editable {...linea(items, s.titulo, guardar, id, vars, TITULO)} placeholder={placeholderTitulo} />
            </div>
          )}
          {s.puntos.length > 0 && (
            <ul className={claseLista}>
              {s.puntos.map((i) => {
                const tipo = tipoLinea(items[i])
                const vacio = !items[i].replace(SUB, '').trim()
                return (
                  <li key={i} className={[tipo === 'sub' ? 'sub' : '', tipo === 'nota' ? 'nota' : '', vacio ? 'vacio' : ''].filter(Boolean).join(' ') || undefined}>
                    <Editable {...linea(items, i, guardar, id, vars, tipo === 'sub' ? SUB : '')} placeholder={placeholder} />
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      ))}
    </>
  )
}

/** Una línea de un texto multilínea, editable (Enter la parte, Retroceso en vacío la quita). */
export function LineaEditable({
  items,
  i,
  onCambio,
  id,
  vars,
  prefijo = '',
  placeholder,
}: {
  items: string[]
  i: number
  onCambio: (texto: string) => void
  id: string
  vars?: Record<string, string>
  prefijo?: string
  placeholder: string
}) {
  return <Editable {...linea(items, i, (l) => onCambio(l.join('\n')), id, vars, prefijo)} placeholder={placeholder} />
}
