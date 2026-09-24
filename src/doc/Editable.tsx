import { useLayoutEffect, useRef, type ClipboardEvent, type CSSProperties, type KeyboardEvent } from 'react'
import { flushSync } from 'react-dom'
import { cursorAl, enfocar, posicionCursor, type Ligado } from '../lib/edicion'
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
      id={id}
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

/**
 * Props de edición para la línea `i` de un texto multilínea: escribir la
 * actualiza, Enter la parte en dos y Retroceso en vacío la quita.
 * `prefijo` (p. ej. "## ") se guarda pero no se muestra.
 */
function linea(items: string[], i: number, guardar: (l: string[]) => void, id: string, vars?: Record<string, string>, prefijo = ''): Linea {
  const valor = items[i].slice(prefijo.length)
  return {
    id: `${id}-${i}`,
    valor,
    mostrar: vars ? rellenar(valor, vars) : undefined,
    onCambio: (v) => guardar(items.map((x, j) => (j === i ? prefijo + v : x))),
    onEnter: (pos, el) => {
      // Enter parte el punto en dos, como en un procesador de texto. En un título, abre un punto debajo.
      const antes = prefijo ? valor : valor.slice(0, pos)
      const despues = prefijo ? '' : valor.slice(pos)
      el.textContent = antes
      // Se renderiza en el acto para mover el cursor antes de la siguiente tecla.
      flushSync(() => guardar([...items.slice(0, i), prefijo + antes, despues, ...items.slice(i + 1)]))
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

/** Texto multilínea (un párrafo o un punto por línea), editable punto por punto. */
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

  const lista = items.map((l, i) => (
    <Tag key={i} className={l.trim() ? undefined : 'vacio'}>
      <Editable {...linea(items, i, guardar, id, vars)} placeholder={placeholder} />
    </Tag>
  ))

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

const TITULO = '## '

/**
 * Términos por secciones: las líneas que empiezan con "## " son títulos y las
 * demás, puntos. Muestra solo las secciones [desde, hasta) para repartirlas
 * entre hojas; todas editan el mismo texto.
 */
export function Secciones({
  valor,
  onCambio,
  id,
  vars,
  desde,
  hasta,
  placeholder,
  placeholderTitulo,
}: Ligado & {
  id: string
  vars?: Record<string, string>
  desde: number
  hasta?: number
  placeholder: string
  placeholderTitulo: string
}) {
  const items = valor.split('\n')
  const guardar = (nuevos: string[]) => onCambio(nuevos.join('\n'))
  const secciones: { titulo: number | null; puntos: number[] }[] = []
  items.forEach((l, i) => {
    if (l.startsWith(TITULO)) secciones.push({ titulo: i, puntos: [] })
    else if (secciones.length === 0) secciones.push({ titulo: null, puntos: [i] })
    else secciones[secciones.length - 1].puntos.push(i)
  })

  return (
    <>
      {secciones.slice(desde, hasta).map((s) => (
        <div key={s.titulo ?? `s${s.puntos[0]}`}>
          {s.titulo !== null && (
            <div className={items[s.titulo].slice(TITULO.length).trim() ? 'h-sec' : 'h-sec vacio'}>
              <Editable {...linea(items, s.titulo, guardar, id, vars, TITULO)} placeholder={placeholderTitulo} />
            </div>
          )}
          {s.puntos.length > 0 && (
            <ul className="terms">
              {s.puntos.map((i) => (
                <li key={i} className={items[i].trim() ? undefined : 'vacio'}>
                  <Editable {...linea(items, i, guardar, id, vars)} placeholder={placeholder} />
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}
    </>
  )
}
