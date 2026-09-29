import { EnMedidor } from '../lib/edicion'
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'

export interface Bloque {
  key: string
  nodo: ReactNode
  /** No dejarlo solo al final de una hoja (títulos). */
  conSiguiente?: boolean
  /**
   * true: empezar siempre en hoja nueva.
   * 'primera': solo si aún está en la primera hoja (p. ej. los precios después de la
   * carta); si la carta ya ocupó más de una hoja, sigue ahí mismo sin dejar huecos.
   */
  salto?: boolean | 'primera'
  /** Sin espacio debajo (filas de una tabla partida, puntos de una lista). */
  pegado?: boolean
  /** Si este bloque abre una hoja, repetir antes el bloque con esta key (encabezado de tabla). */
  repite?: string
}

/**
 * Reparte bloques en hojas A4 midiendo su alto real. Se renderizan una vez
 * fuera de pantalla para medir y luego en las hojas; al cambiar el texto se
 * vuelve a medir. Un bloque más alto que una hoja completa se deja en su
 * propia hoja (la vista previa marcará el desborde).
 */
export function Paginado({
  bloques,
  clase,
  fondo,
  pie,
  claseContenido,
}: {
  bloques: Bloque[]
  clase: string
  fondo?: ReactNode
  pie?: (hoja: number, total: number) => ReactNode
  /** Clase extra del contenedor de contenido (p. ej. "letter"). */
  claseContenido?: string
}) {
  const medidor = useRef<HTMLElement>(null)
  const [cortes, setCortes] = useState<number[]>([])
  // Al terminar de cargar las fuentes cambian los altos: se vuelve a medir.
  const [fuentes, setFuentes] = useState(0)
  useEffect(() => {
    let vivo = true
    document.fonts?.ready.then(() => vivo && setFuentes((n) => n + 1))
    return () => {
      vivo = false
    }
  }, [])

  useLayoutEffect(() => {
    const hoja = medidor.current
    if (!hoja) return
    const estilo = getComputedStyle(hoja)
    // Margen de seguridad de 4 px contra redondeos entre la medición y la hoja real.
    const disponible = hoja.clientHeight - parseFloat(estilo.paddingTop) - parseFloat(estilo.paddingBottom) - 4
    // Altos con decimales (offsetHeight redondea); se corrige el zoom de la vista previa.
    const escala = hoja.getBoundingClientRect().height / hoja.offsetHeight || 1
    const altos = Array.from(hoja.querySelectorAll<HTMLElement>(':scope > .content > [data-bloque]'), (el) => el.getBoundingClientRect().height / escala)
    const indice = new Map(bloques.map((b, i) => [b.key, i]))
    const nuevos: number[] = []
    let usado = 0
    altos.forEach((alto, i) => {
      const siguiente = bloques[i]?.conSiguiente ? (altos[i + 1] ?? 0) : 0
      const salto = bloques[i]?.salto
      const forzar = salto === true || (salto === 'primera' && nuevos.length === 0)
      if (usado > 0 && (forzar || usado + alto + siguiente > disponible)) {
        nuevos.push(i)
        // La hoja nueva empieza con el encabezado repetido de la tabla, si lo hay.
        const repite = bloques[i]?.repite
        usado = repite !== undefined ? (altos[indice.get(repite) ?? -1] ?? 0) : 0
      }
      usado += alto
    })
    setCortes((prev) => (prev.join() === nuevos.join() ? prev : nuevos))
  }, [bloques, fuentes])

  const inicios = [0, ...cortes]
  const hojas = inicios.map((desde, n) => {
    const lista = bloques.slice(desde, inicios[n + 1] ?? bloques.length)
    const repite = n > 0 ? lista[0]?.repite : undefined
    const encabezado = repite !== undefined ? bloques.find((b) => b.key === repite) : undefined
    return encabezado ? [{ ...encabezado, key: `${encabezado.key}@${n}` }, ...lista] : lista
  })
  const contenido = (lista: Bloque[]) =>
    lista.map((b) => (
      <div key={b.key} data-bloque data-pegado={b.pegado || undefined}>
        {b.nodo}
      </div>
    ))

  return (
    <>
      {hojas.map((lista, n) => (
        <section key={n} className={`page ${clase}`}>
          {fondo}
          <div className={`content paginado ${claseContenido ?? ''}`}>{contenido(lista)}</div>
          {pie?.(n + 1, hojas.length)}
        </section>
      ))}
      {/* Copia invisible para medir: fuera de pantalla, sin foco ni lectores de pantalla. */}
      <section ref={medidor} className={`page ${clase} medidor`} aria-hidden inert>
        <EnMedidor.Provider value={true}>
          <div className={`content paginado ${claseContenido ?? ''}`}>{contenido(bloques)}</div>
        </EnMedidor.Provider>
      </section>
    </>
  )
}
