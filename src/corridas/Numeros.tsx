import { useEffect, useState } from 'react'
import { calcularCorrida, type Linea } from './calculo'
import type { CorridaData, CorridaId, KofileData } from './tipos'

/**
 * Vista de solo números: cada monto de la corrida con su botón de copiar, por sección
 * o todo junto (se pega en Excel como dos columnas: concepto y monto).
 */

type Formato = 'simple' | 'moneda'

interface Fila {
  concepto: string
  monto: number
  celda: string
  /** Decimales a mostrar/copiar (el salario diario puede llevar hasta 6). */
  decimales?: number
  total?: boolean
}

const mostrar = (x: number, dec = 2) => `$${x.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: dec })}`
const plano = (x: number, dec = 2) => {
  // Sin comas ni signo: listo para pegar en Excel o en el sistema de nómina.
  const t = x.toFixed(dec)
  return dec > 2 ? t.replace(/(\.\d\d\d*?)0+$/, '$1') : t
}

async function copiar(texto: string) {
  try {
    await navigator.clipboard.writeText(texto)
    return
  } catch {
    // Navegadores sin permiso de portapapeles: copia con una caja de texto temporal.
    const area = document.createElement('textarea')
    area.value = texto
    area.style.position = 'fixed'
    area.style.opacity = '0'
    document.body.appendChild(area)
    area.select()
    document.execCommand('copy')
    area.remove()
  }
}

export function NumerosCorrida({ id, d }: { id: CorridaId; d: CorridaData }) {
  const r = calcularCorrida(id, d)
  const [formato, setFormato] = useState<Formato>('simple')
  const [copiado, setCopiado] = useState('')
  useEffect(() => {
    if (!copiado) return
    const t = setTimeout(() => setCopiado(''), 1600)
    return () => clearTimeout(t)
  }, [copiado])

  if (r.faltantes.length) {
    return (
      <div className="numeros">
        <div className="numeros-falta">
          <strong>Faltan datos para calcular la corrida:</strong> {r.faltantes.join(' · ')}
        </div>
      </div>
    )
  }

  const pendientes = r.validaciones.filter((v) => v.nivel === 'pendiente').map((v) => v.texto)
  const valor = (f: Fila) => (formato === 'simple' ? plano(f.monto, f.decimales) : mostrar(f.monto, f.decimales))
  const asimilado = id === 'kofile' && (d as KofileData).esquema === 'asimilado'
  const desdeLineas = (ls: Linea[], total?: Linea): Fila[] => [...ls.map((l) => ({ ...l })), ...(total ? [{ ...total, total: true }] : [])]

  const grupos: { titulo: string; filas: Fila[] }[] = [
    {
      titulo: 'Resultado',
      filas: [
        { concepto: 'Salario diario', monto: r.salarioDiario, celda: 'Calculo!D19', decimales: 6 },
        ...(r.objetivo.tipo !== 'salarioDiario' && r.objetivo.tipo !== 'brutoMensual'
          ? [{ concepto: `${r.objetivo.etiqueta} (resultado)`, monto: r.objetivo.obtenido, celda: r.objetivo.celda }]
          : []),
      ],
    },
    { titulo: 'Percepciones', filas: desdeLineas(r.percepciones, r.totalPercepciones) },
    { titulo: 'Deducciones', filas: desdeLineas(r.deducciones, r.totalDeducciones) },
    { titulo: 'Neto', filas: asimilado ? desdeLineas([], r.neto) : desdeLineas([r.neto, r.sodexo], r.netoSodexo) },
    ...(r.patronales.length ? [{ titulo: 'Impuestos patronales', filas: desdeLineas(r.patronales, r.totalPatronales) }] : []),
    { titulo: id === 'general' || (id === 'kofile' && !asimilado) ? 'Costo' : 'Facturación', filas: desdeLineas(r.costos, r.total) },
  ]

  const tsv = (gs: typeof grupos) => gs.map((g) => [g.titulo, ...g.filas.map((f) => `${f.concepto}\t${valor(f)}`)].join('\n')).join('\n\n')
  const accion = (clave: string, texto: string) => {
    void copiar(texto)
    setCopiado(clave)
  }

  return (
    <div className="numeros">
      <div className="numeros-cab">
        <div>
          <h2>Números de la corrida</h2>
          <p>
            {d.puesto.trim() || 'Sin puesto'} · {r.periodo.nombre} · {r.objetivo.etiqueta}
            {r.objetivo.tipo !== 'salarioDiario' && `: ${mostrar(r.objetivo.meta)}`}
          </p>
        </div>
        <div className="numeros-acciones">
          <div className="numeros-formato" role="group" aria-label="Formato al copiar">
            <span>Copiar como</span>
            <button type="button" className={formato === 'simple' ? 'activo' : undefined} aria-pressed={formato === 'simple'} onClick={() => setFormato('simple')}>
              1234.56
            </button>
            <button type="button" className={formato === 'moneda' ? 'activo' : undefined} aria-pressed={formato === 'moneda'} onClick={() => setFormato('moneda')}>
              $1,234.56
            </button>
          </div>
          <button type="button" className="btn primario" onClick={() => accion('todo', tsv(grupos))}>
            {copiado === 'todo' ? '✓ Copiado' : 'Copiar todo'}
          </button>
        </div>
      </div>
      <p className="numeros-ayuda">"Copiar todo" y "Copiar sección" se pegan en Excel como dos columnas (concepto y monto).</p>
      {pendientes.length > 0 && (
        <div className="numeros-pendientes" role="status">
          <strong>No incluidos en el cálculo (pendientes):</strong>
          <ul>
            {pendientes.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="numeros-grupos">
        {grupos.map((g) => (
          <section key={g.titulo} className="numeros-grupo">
            <header>
              <h3>{g.titulo}</h3>
              <button type="button" className="link" onClick={() => accion(`g:${g.titulo}`, tsv([g]))}>
                {copiado === `g:${g.titulo}` ? '✓ Copiado' : 'Copiar sección'}
              </button>
            </header>
            <ul>
              {g.filas.map((f, i) => {
                const clave = `${g.titulo}:${i}`
                return (
                  <li key={clave} className={f.total ? 'total' : undefined}>
                    <span className="numeros-concepto">
                      {f.concepto}
                      <small>{f.celda}</small>
                    </span>
                    <span className="numeros-valor">{mostrar(f.monto, f.decimales)}</span>
                    <button type="button" className={copiado === clave ? 'copiar hecho' : 'copiar'} onClick={() => accion(clave, valor(f))} aria-label={`Copiar ${f.concepto}`}>
                      {copiado === clave ? '✓' : 'Copiar'}
                    </button>
                  </li>
                )
              })}
            </ul>
          </section>
        ))}
      </div>
    </div>
  )
}
