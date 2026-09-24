import { EnMedidor } from '../lib/edicion'
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'

export interface Bloque {
  key: string
  nodo: ReactNode
  /** No dejarlo solo al final de una hoja (títulos). */
  conSiguiente?: boolean
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
}: {
  bloques: Bloque[]
  clase: string
  fondo?: ReactNode
  pie?: (hoja: number, total: number) => ReactNode
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
    const disponible = hoja.clientHeight - parseFloat(estilo.paddingTop) - parseFloat(estilo.paddingBottom)
    const altos = Array.from(hoja.querySelectorAll<HTMLElement>(':scope > .content > [data-bloque]'), (el) => el.offsetHeight)
    const nuevos: number[] = []
    let usado = 0
    altos.forEach((alto, i) => {
      const siguiente = bloques[i]?.conSiguiente ? (altos[i + 1] ?? 0) : 0
      if (usado > 0 && usado + alto + siguiente > disponible) {
        nuevos.push(i)
        usado = 0
      }
      usado += alto
    })
    setCortes((prev) => (prev.join() === nuevos.join() ? prev : nuevos))
  }, [bloques, fuentes])

  const inicios = [0, ...cortes]
  const hojas = inicios.map((desde, n) => bloques.slice(desde, inicios[n + 1] ?? bloques.length))
  const contenido = (lista: Bloque[]) =>
    lista.map((b) => (
      <div key={b.key} data-bloque>
        {b.nodo}
      </div>
    ))

  return (
    <>
      {hojas.map((lista, n) => (
        <section key={n} className={`page ${clase}`}>
          {fondo}
          <div className="content">{contenido(lista)}</div>
          {pie?.(n + 1, hojas.length)}
        </section>
      ))}
      {/* Copia invisible para medir: fuera de pantalla, sin foco ni lectores de pantalla. */}
      <section ref={medidor} className={`page ${clase} medidor`} aria-hidden inert>
        <EnMedidor.Provider value={true}>
          <div className="content">{contenido(bloques)}</div>
        </EnMedidor.Provider>
      </section>
    </>
  )
}
