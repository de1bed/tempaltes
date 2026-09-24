import { useId, type ReactNode } from 'react'

export function Seccion({ titulo, children, abierta = true }: { titulo: string; children: ReactNode; abierta?: boolean }) {
  return (
    <details className="seccion" open={abierta}>
      <summary>{titulo}</summary>
      <div className="seccion-body">{children}</div>
    </details>
  )
}

export function Fila({ children }: { children: ReactNode }) {
  return <div className="fila">{children}</div>
}

interface BaseProps {
  label: string
  ayuda?: string
}

export function Texto(p: BaseProps & { value: string; onChange: (v: string) => void; placeholder?: string; type?: 'text' | 'date' }) {
  const id = useId()
  return (
    <div className="campo">
      <label htmlFor={id}>{p.label}</label>
      <input id={id} type={p.type ?? 'text'} value={p.value} placeholder={p.placeholder} onChange={(e) => p.onChange(e.target.value)} />
      {p.ayuda && <small>{p.ayuda}</small>}
    </div>
  )
}

export function Numero(p: BaseProps & { value: string; onChange: (v: string) => void; step?: string; min?: number; prefijo?: string }) {
  const id = useId()
  return (
    <div className="campo">
      <label htmlFor={id}>{p.label}</label>
      <div className={p.prefijo ? 'con-prefijo' : undefined}>
        {p.prefijo && <span>{p.prefijo}</span>}
        <input
          id={id}
          type="number"
          inputMode="decimal"
          step={p.step ?? 'any'}
          min={p.min ?? 0}
          value={p.value}
          onChange={(e) => p.onChange(e.target.value)}
        />
      </div>
      {p.ayuda && <small>{p.ayuda}</small>}
    </div>
  )
}

export function Fecha(p: BaseProps & { value: string; onChange: (v: string) => void }) {
  return <Texto {...p} type="date" />
}

export function Opciones<T extends string>(
  p: BaseProps & { value: T; onChange: (v: T) => void; opciones: readonly (readonly [T, string])[] },
) {
  const id = useId()
  return (
    <div className="campo">
      <label htmlFor={id}>{p.label}</label>
      <select id={id} value={p.value} onChange={(e) => p.onChange(e.target.value as T)}>
        {p.opciones.map(([v, t]) => (
          <option key={v} value={v}>
            {t}
          </option>
        ))}
      </select>
      {p.ayuda && <small>{p.ayuda}</small>}
    </div>
  )
}

export function Area(p: BaseProps & { value: string; onChange: (v: string) => void; filas?: number }) {
  const id = useId()
  return (
    <div className="campo">
      <label htmlFor={id}>{p.label}</label>
      <textarea id={id} rows={p.filas ?? 4} value={p.value} onChange={(e) => p.onChange(e.target.value)} />
      {p.ayuda && <small>{p.ayuda}</small>}
    </div>
  )
}

/** Editor de filas (servicios, empleados…). */
export function Lista<T>(p: {
  items: T[]
  onChange: (items: T[]) => void
  nuevo: () => T
  etiqueta: string
  render: (item: T, cambiar: (parcial: Partial<T>) => void, i: number) => ReactNode
}) {
  const set = (i: number, parcial: Partial<T>) => p.onChange(p.items.map((it, j) => (j === i ? { ...it, ...parcial } : it)))
  return (
    <div className="lista">
      {p.items.map((it, i) => (
        <div className="lista-item" key={i}>
          <div className="lista-cab">
            <span>
              {p.etiqueta} {i + 1}
            </span>
            {p.items.length > 1 && (
              <button type="button" className="link peligro" onClick={() => p.onChange(p.items.filter((_, j) => j !== i))}>
                Quitar
              </button>
            )}
          </div>
          {p.render(it, (parcial) => set(i, parcial), i)}
        </div>
      ))}
      <button type="button" className="btn secundario" onClick={() => p.onChange([...p.items, p.nuevo()])}>
        + Agregar {p.etiqueta.toLowerCase()}
      </button>
    </div>
  )
}
