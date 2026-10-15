import { useEffect, useState } from 'react'
import { salasApi } from '../lib/supabase'
import { error, textoReunion } from './util'

interface Entrada {
  id: number
  reservacion_id: string
  accion: string
  quien_email: string
  quien_nombre: string
  externo: boolean
  detalle: Record<string, unknown> | null
  creado: string
  reservaciones?: { codigo: string; sala_id: string; motivo: string; inicio: string; fin: string; estado: string; origen: string; empresa: string | null } | null
}

const ACCIONES: Record<string, string> = {
  creada: 'Reservó',
  movida: 'Cambió el horario',
  cancelada: 'Canceló',
  cedida: 'Cedió el horario',
  solicitud: 'Pidió el horario',
  solicitud_rechazada: 'No cedió el horario',
  reintento_outlook: 'Reintentó copiar a Outlook',
}

const cuando = (iso: string) => new Date(iso).toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' })

type Resumen = { sala?: string; inicio?: string; fin?: string }

function Detalle({ e }: { e: Entrada }) {
  const d = e.detalle ?? {}
  if (e.accion === 'movida') {
    const antes = d.antes as Resumen | undefined
    const despues = d.despues as Resumen | undefined
    if (antes?.inicio && despues?.inicio)
      return (
        <span className="bitacora-doc">
          <s>
            {antes.sala} · {textoReunion(antes.inicio, antes.fin!)}
          </s>{' '}
          → {despues.sala} · {textoReunion(despues.inicio, despues.fin!)}
          {d.por_admin ? ' · por administración de salas' : ''}
        </span>
      )
  }
  const partes = [
    typeof d.razon === 'string' && d.razon,
    typeof d.motivo === 'string' && e.accion === 'solicitud' && `para «${d.motivo}»`,
    typeof d.mensaje === 'string' && d.mensaje && `“${d.mensaje}”`,
    typeof d.a === 'string' && `a ${d.a}`,
    typeof d.de === 'string' && `de ${d.de}`,
    typeof d.respuesta === 'string' && d.respuesta && `“${d.respuesta}”`,
    typeof d.resultado === 'string' && d.resultado,
  ].filter(Boolean)
  return partes.length ? <span className="bitacora-doc">{partes.join(' · ')}</span> : null
}

/** Historial de una reservación (quién la creó, cambió o canceló). */
export function HistorialReservacion({ id }: { id: string }) {
  const [lista, setLista] = useState<Entrada[] | null>(null)
  const [falla, setFalla] = useState('')
  useEffect(() => {
    salasApi<{ historial: Entrada[] }>('historial', { reservacion_id: id }).then(
      (r) => setLista(r.historial),
      (e: unknown) => setFalla(error(e)),
    )
  }, [id])
  if (falla) return <div className="alerta">{falla}</div>
  if (!lista) return <p className="nota">Cargando historial…</p>
  if (!lista.length) return <p className="nota">Sin movimientos registrados (es anterior al historial).</p>
  return (
    <ol className="salas-historial">
      {lista.map((e) => (
        <li key={e.id}>
          <span className="bitacora-fecha">{cuando(e.creado)}</span>
          <span>
            <strong>{e.quien_nombre || e.quien_email}</strong> {e.externo && <em className="salas-insignia">Externo</em>} · {ACCIONES[e.accion] ?? e.accion}
          </span>
          <Detalle e={e} />
        </li>
      ))}
    </ol>
  )
}

/** Historial de todas las salas (administradores de salas). */
export function Historial({ nombreSala }: { nombreSala: (id: string) => string }) {
  const [lista, setLista] = useState<Entrada[] | null>(null)
  const [falla, setFalla] = useState('')
  const [filtro, setFiltro] = useState('')
  useEffect(() => {
    salasApi<{ historial: Entrada[] }>('historial').then(
      (r) => setLista(r.historial),
      (e: unknown) => setFalla(error(e)),
    )
  }, [])
  const q = filtro.trim().toLowerCase()
  const visibles = (lista ?? []).filter(
    (e) => !q || [e.quien_nombre, e.quien_email, e.reservaciones?.motivo, e.reservaciones?.codigo, e.reservaciones?.empresa].some((x) => x?.toLowerCase().includes(q)),
  )
  return (
    <section className="admin-caja">
      <div className="bitacora-cab">
        <h2>Historial de salas</h2>
        <div className="campo bitacora-filtro">
          <label htmlFor="hist-filtro">Buscar</label>
          <input id="hist-filtro" type="search" value={filtro} onChange={(e) => setFiltro(e.target.value)} placeholder="Persona, motivo, código, empresa" />
        </div>
      </div>
      <p className="nota">Quién reservó, cambió, cedió o canceló cada reunión (las últimas 150 acciones). Nadie puede editarlo ni borrarlo.</p>
      {falla && <div className="alerta" role="alert">{falla}</div>}
      {!lista ? (
        !falla && <p className="nota">Cargando…</p>
      ) : visibles.length === 0 ? (
        <p className="nota">Sin movimientos.</p>
      ) : (
        <ul className="bitacora">
          {visibles.map((e) => (
            <li key={e.id}>
              <span className="bitacora-fecha">{cuando(e.creado)}</span>
              <div className="bitacora-que">
                <span>
                  <strong>{e.quien_nombre || e.quien_email}</strong> {e.externo && <em className="salas-insignia">Externo</em>} · {ACCIONES[e.accion] ?? e.accion}
                </span>
                {e.reservaciones && (
                  <span className="bitacora-doc">
                    «{e.reservaciones.motivo}» · {nombreSala(e.reservaciones.sala_id)} · {textoReunion(e.reservaciones.inicio, e.reservaciones.fin)} · {e.reservaciones.codigo}
                    {e.reservaciones.empresa ? ` · ${e.reservaciones.empresa}` : ''}
                  </span>
                )}
                <Detalle e={e} />
              </div>
              <span />
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
