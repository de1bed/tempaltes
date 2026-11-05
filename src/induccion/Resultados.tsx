import { useEffect, useMemo, useState } from 'react'
import { guardarArchivo } from '../lib/guardar'
import { supabase } from '../lib/supabase'
import { duracion, fechaHora, mensaje, type Curso, type Intento, type Participante, type Sesion } from './api'
import { descargarConstancia } from './constancia'

type Fila = Participante & { sesion: Pick<Sesion, 'nombre' | 'tipo' | 'incluye_contenido'> | null }
type Filtro = 'todos' | 'aprobados' | 'pendientes'

/** Tiempo total: de que entró a que aprobó (o a su último movimiento si no ha terminado). */
const tiempo = (p: Participante) => duracion(p.inicio, p.aprobado_en ?? p.ultimo_avance)

function estadoCorto(p: Fila) {
  if (p.aprobado_en) return 'Aprobó'
  if (p.intentos > 0) return 'No ha aprobado'
  return 'En curso'
}

/** CSV que abre directo en Excel (con acentos). */
function csv(filas: Fila[]): Blob {
  const celda = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`
  const encabezado = ['Nombre', 'Correo', 'Sesión', 'Tipo', 'Entró', 'Terminó la presentación', 'Intentos', 'Mejor calificación', 'Aprobó', 'Tiempo total']
  const renglones = filas.map((p) => [
    p.nombre,
    p.correo ?? '',
    p.sesion?.nombre ?? '',
    p.sesion?.tipo === 'grupo' ? 'Grupo' : 'Individual',
    fechaHora(p.inicio),
    p.contenido_terminado ? fechaHora(p.contenido_terminado) : '',
    p.intentos,
    p.mejor_calificacion ?? '',
    p.aprobado_en ? fechaHora(p.aprobado_en) : 'No',
    tiempo(p),
  ])
  return new Blob(['﻿' + [encabezado, ...renglones].map((r) => r.map(celda).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' })
}

function DetallePersona({ p, curso, cerrar, borrada }: { p: Fila; curso: Curso; cerrar: () => void; borrada: () => void }) {
  const [intentos, setIntentos] = useState<Intento[] | null>(null)
  const [falla, setFalla] = useState('')
  useEffect(() => {
    supabase
      .from('induccion_intentos')
      .select('*')
      .eq('participante_id', p.id)
      .order('fin')
      .then(({ data, error }) => (error ? setFalla(mensaje(error)) : setIntentos(data as Intento[])))
  }, [p.id])

  async function borrar() {
    if (!confirm(`¿Borrar a ${p.nombre} y sus respuestas? Úsalo solo para pruebas o registros duplicados.`)) return
    const { error } = await supabase.from('induccion_participantes').delete().eq('id', p.id)
    if (error) setFalla(mensaje(error))
    else borrada()
  }

  return (
    <section className="admin-caja ind-detalle">
      <div className="ind-detalle-cab">
        <div className="admin-quien">
          <strong>{p.nombre}</strong>
          <span>
            {p.sesion?.nombre ?? 'Sesión borrada'} · {estadoCorto(p)} {p.mejor_calificacion != null && `· mejor calificación ${p.mejor_calificacion}`}
          </span>
          <small>
            Entró {fechaHora(p.inicio)}
            {p.contenido_terminado && ` · terminó la presentación ${fechaHora(p.contenido_terminado)}`} · tiempo total {tiempo(p)}
            {p.correo && ` · ${p.correo}`}
          </small>
        </div>
        <button type="button" className="link" onClick={cerrar}>
          Cerrar
        </button>
      </div>
      <div className="admin-acciones">
        {p.aprobado_en && (
          <button
            type="button"
            className="btn primario"
            onClick={() => descargarConstancia({ nombre: p.nombre, curso: curso.titulo, calificacion: p.mejor_calificacion ?? 0, fecha: p.aprobado_en! }).catch((e) => setFalla(mensaje(e)))}
          >
            Constancia (PDF)
          </button>
        )}
        <button type="button" className="btn secundario" onClick={borrar}>
          Borrar registro
        </button>
      </div>
      {falla && <div className="alerta" role="alert">{falla}</div>}
      {intentos?.length === 0 && <p className="nota">Todavía no contesta el cuestionario.</p>}
      {intentos?.map((it, n) => (
        <details key={it.id} className="ind-intento" open={n === intentos.length - 1}>
          <summary>
            Intento {n + 1}: <strong>{it.calificacion}</strong> ({it.aciertos} de {it.total}) · {it.aprobado ? 'aprobado' : 'no aprobado'} · {fechaHora(it.fin)} · tardó {duracion(it.inicio, it.fin)}
          </summary>
          <ol className="ind-revision">
            {it.detalle.map((d) => (
              <li key={d.id} className={d.respuesta === d.correcta ? 'bien' : 'mal'}>
                <span>{d.texto}</span>
                <small>
                  {d.respuesta === d.correcta ? '✓ ' : '✗ '}
                  {d.respuesta >= 0 ? d.opciones[d.respuesta] : 'Sin contestar'}
                  {d.respuesta !== d.correcta && ` · correcta: ${d.opciones[d.correcta]}`}
                </small>
              </li>
            ))}
          </ol>
        </details>
      ))}
    </section>
  )
}

export function Resultados({ curso }: { curso: Curso }) {
  const [filas, setFilas] = useState<Fila[] | null>(null)
  const [falla, setFalla] = useState('')
  const [buscar, setBuscar] = useState('')
  const [filtro, setFiltro] = useState<Filtro>('todos')
  const [elegida, setElegida] = useState<string | null>(null)
  const [version, setVersion] = useState(0)

  useEffect(() => {
    supabase
      .from('induccion_participantes')
      .select('*, sesion:induccion_sesiones(nombre, tipo, incluye_contenido)')
      .order('inicio', { ascending: false })
      .limit(1000)
      .then(({ data, error }) => (error ? setFalla(mensaje(error)) : setFilas(data as Fila[])))
  }, [version])

  const visibles = useMemo(() => {
    const q = buscar.trim().toLowerCase()
    return (filas ?? []).filter((p) => {
      if (filtro === 'aprobados' && !p.aprobado_en) return false
      if (filtro === 'pendientes' && p.aprobado_en) return false
      return !q || `${p.nombre} ${p.correo ?? ''} ${p.sesion?.nombre ?? ''}`.toLowerCase().includes(q)
    })
  }, [filas, buscar, filtro])

  const detalle = filas?.find((p) => p.id === elegida)
  const aprobados = filas?.filter((p) => p.aprobado_en).length ?? 0

  return (
    <>
      {detalle && <DetallePersona key={detalle.id} p={detalle} curso={curso} cerrar={() => setElegida(null)} borrada={() => (setElegida(null), setVersion((v) => v + 1))} />}
      <section className="admin-caja">
        <div className="ind-detalle-cab">
          <h2>{filas ? `${filas.length} ${filas.length === 1 ? 'persona' : 'personas'} · ${aprobados} aprobada${aprobados === 1 ? '' : 's'}` : 'Resultados'}</h2>
          <div className="admin-acciones">
            <button type="button" className="btn secundario chico" onClick={() => setVersion((v) => v + 1)}>
              Actualizar
            </button>
            <button type="button" className="btn secundario chico" disabled={!visibles.length} onClick={() => guardarArchivo(csv(visibles), `Resultados induccion ${new Date().toISOString().slice(0, 10)}.csv`)}>
              Descargar Excel (CSV)
            </button>
          </div>
        </div>
        <div className="ind-filtros">
          <input type="search" placeholder="Buscar por nombre, correo o sesión…" value={buscar} onChange={(e) => setBuscar(e.target.value)} aria-label="Buscar" />
          <div className="vista-toggle" role="group" aria-label="Filtro">
            {(
              [
                ['todos', 'Todos'],
                ['aprobados', 'Aprobados'],
                ['pendientes', 'Pendientes'],
              ] as const
            ).map(([id, texto]) => (
              <button key={id} type="button" className={filtro === id ? 'activo' : undefined} aria-pressed={filtro === id} onClick={() => setFiltro(id)}>
                {texto}
              </button>
            ))}
          </div>
        </div>
        {falla && <div className="alerta" role="alert">{falla}</div>}
        {filas === null ? (
          !falla && <p className="nota">Cargando…</p>
        ) : visibles.length === 0 ? (
          <p className="nota">{filas.length ? 'Nadie coincide con la búsqueda.' : 'Todavía nadie ha tomado la inducción.'}</p>
        ) : (
          <div className="ind-tabla-caja">
            <table className="ind-tabla">
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Sesión</th>
                  <th>Entró</th>
                  <th>Tiempo</th>
                  <th>Intentos</th>
                  <th>Calificación</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {visibles.map((p) => (
                  <tr key={p.id} className={elegida === p.id ? 'elegida' : undefined} onClick={() => setElegida(p.id)}>
                    <td>
                      <button type="button" className="link" onClick={() => setElegida(p.id)}>
                        {p.nombre}
                      </button>
                    </td>
                    <td>{p.sesion?.nombre ?? '—'}</td>
                    <td>{fechaHora(p.inicio)}</td>
                    <td>{tiempo(p)}</td>
                    <td>{p.intentos}</td>
                    <td>{p.mejor_calificacion ?? '—'}</td>
                    <td>
                      <span className={`ind-tono ${p.aprobado_en ? 'ok' : p.intentos ? 'mal' : 'curso'}`}>{estadoCorto(p)}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  )
}
