import { useState } from 'react'
import { validarPreguntas } from '../../supabase/functions/induccion/logica'
import { registrar } from '../lib/supabase'
import { guardarCurso, mensaje, type Curso, type Pregunta } from './api'

const nuevoId = () => `q-${crypto.randomUUID().slice(0, 8)}`
const LETRAS = 'ABCDEF'

export function EditorCuestionario({ curso, recargar }: { curso: Curso; recargar: () => Promise<void> }) {
  const [preguntas, setPreguntas] = useState<Pregunta[]>(curso.preguntas)
  const [guardando, setGuardando] = useState(false)
  const [aviso, setAviso] = useState<{ ok: boolean; texto: string } | null>(null)
  const cambiado = JSON.stringify(preguntas) !== JSON.stringify(curso.preguntas)

  const cambiar = (id: string, cambio: Partial<Pregunta>) => setPreguntas((ps) => ps.map((q) => (q.id === id ? { ...q, ...cambio } : q)))
  const mover = (i: number, d: -1 | 1) =>
    setPreguntas((ps) => {
      const copia = [...ps]
      ;[copia[i], copia[i + d]] = [copia[i + d], copia[i]]
      return copia
    })

  async function guardar() {
    setAviso(null)
    const limpias = preguntas.map((q) => ({ ...q, texto: q.texto.trim(), opciones: q.opciones.map((o) => o.trim()) }))
    const problema = validarPreguntas(limpias)
    if (problema) return setAviso({ ok: false, texto: problema })
    setGuardando(true)
    try {
      await guardarCurso(curso.id, { preguntas: limpias })
      registrar('induccion_cuestionario', { documento: `${limpias.length} preguntas`, detalle: limpias })
      await recargar()
      setPreguntas(limpias)
      setAviso({ ok: true, texto: 'Cuestionario guardado. Los resultados anteriores conservan las preguntas con que se contestaron.' })
    } catch (e) {
      setAviso({ ok: false, texto: mensaje(e) })
    }
    setGuardando(false)
  }

  return (
    <>
      <p className="nota ind-nota-cuestionario">
        Marca con el círculo la respuesta correcta de cada pregunta. La persona ve las preguntas en este orden; nunca le llegan las respuestas correctas. Se aprueba con{' '}
        {curso.calificacion_minima} de 100 (se cambia en Contenido).
      </p>
      <ol className="ind-editor-preguntas">
        {preguntas.map((q, i) => (
          <li key={q.id} className="admin-caja">
            <div className="ind-paso-fila">
              <span className="ind-num">{i + 1}</span>
              <textarea className="ind-pregunta-texto" rows={2} value={q.texto} onChange={(e) => cambiar(q.id, { texto: e.target.value })} aria-label={`Pregunta ${i + 1}`} maxLength={400} />
              <span className="ind-mover">
                <button type="button" className="link" onClick={() => mover(i, -1)} disabled={i === 0} aria-label="Subir">
                  ↑
                </button>
                <button type="button" className="link" onClick={() => mover(i, 1)} disabled={i === preguntas.length - 1} aria-label="Bajar">
                  ↓
                </button>
              </span>
            </div>
            <ul className="ind-opciones-editor">
              {q.opciones.map((o, j) => (
                <li key={j} className={q.correcta === j ? 'correcta' : undefined}>
                  <input type="radio" name={`correcta-${q.id}`} checked={q.correcta === j} onChange={() => cambiar(q.id, { correcta: j })} aria-label={`Opción ${LETRAS[j]} es la correcta`} />
                  <span className="ind-letra">{LETRAS[j]}</span>
                  <input value={o} onChange={(e) => cambiar(q.id, { opciones: q.opciones.map((x, k) => (k === j ? e.target.value : x)) })} aria-label={`Opción ${LETRAS[j]}`} maxLength={200} />
                  <button
                    type="button"
                    className="link"
                    disabled={q.opciones.length <= 2}
                    onClick={() =>
                      cambiar(q.id, {
                        opciones: q.opciones.filter((_, k) => k !== j),
                        correcta: q.correcta === j ? 0 : q.correcta > j ? q.correcta - 1 : q.correcta,
                      })
                    }
                    aria-label={`Quitar opción ${LETRAS[j]}`}
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ul>
            <div className="admin-acciones">
              <button type="button" className="btn secundario chico" disabled={q.opciones.length >= 6} onClick={() => cambiar(q.id, { opciones: [...q.opciones, ''] })}>
                + Opción
              </button>
              <button type="button" className="link" onClick={() => setPreguntas((ps) => ps.filter((x) => x.id !== q.id))}>
                Quitar pregunta
              </button>
            </div>
          </li>
        ))}
      </ol>
      <div className="admin-acciones">
        <button type="button" className="btn secundario" onClick={() => setPreguntas((ps) => [...ps, { id: nuevoId(), texto: '', opciones: ['', ''], correcta: 0 }])}>
          + Agregar pregunta
        </button>
      </div>
      <div className={cambiado || aviso ? 'ind-guardar fija' : 'ind-guardar'}>
        {aviso && (
          <div className={aviso.ok ? 'credenciales' : 'alerta'} role="status">
            {aviso.texto}
          </div>
        )}
        <div className="admin-acciones">
          <button type="button" className="btn secundario" disabled={!cambiado || guardando} onClick={() => setPreguntas(curso.preguntas)}>
            Descartar
          </button>
          <button type="button" className="btn primario" disabled={!cambiado || guardando} onClick={guardar}>
            {guardando ? 'Guardando…' : 'Guardar cuestionario'}
          </button>
        </div>
      </div>
    </>
  )
}
