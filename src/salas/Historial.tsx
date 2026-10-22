import { useEffect, useMemo, useState } from 'react'
import { salasApi } from '../lib/supabase'
import { conMayuscula, error, textoReunion } from './util'
import { local, textoDia } from './tiempo'

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

type AvisoEnviado = { medio: 'outlook' | 'correo' | 'ninguno'; a: string[] }

/** A quién se avisó y por dónde (invitación, cambio o cancelación). */
function Aviso({ aviso }: { aviso?: AvisoEnviado }) {
  if (!aviso || !Array.isArray(aviso.a)) return null
  const quienes = aviso.a.join(', ')
  if (aviso.medio === 'ninguno') return <span className="bitacora-doc aviso-mal">No se pudo avisar por correo a {quienes || 'nadie'}</span>
  return (
    <span className="bitacora-doc aviso-ok">
      Aviso {aviso.medio === 'outlook' ? 'por Outlook' : 'por correo'} a {quienes}
    </span>
  )
}

function Detalle({ e }: { e: Entrada }) {
  return (
    <>
      <DetalleAccion e={e} />
      <Aviso aviso={(e.detalle as { aviso?: AvisoEnviado } | null)?.aviso} />
    </>
  )
}

function DetalleAccion({ e }: { e: Entrada }) {
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

const hora = (iso: string) => new Date(iso).toLocaleTimeString('es-MX', { hour: 'numeric', minute: '2-digit' })

/** Los últimos 12 meses (`YYYY-MM`), del actual hacia atrás. */
function ultimosMeses(): string[] {
  const [a, m] = local(new Date()).dia.split('-').map(Number)
  return Array.from({ length: 12 }, (_, i) => {
    const t = a * 12 + (m - 1) - i
    return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, '0')}`
  })
}

const textoMes = (mes: string) => conMayuscula(new Date(`${mes}-15T12:00:00Z`).toLocaleDateString('es-MX', { month: 'long', year: 'numeric', timeZone: 'UTC' }))

/** Historial de todas las salas (administradores de salas), por mes y agrupado por día. */
export function Historial({ nombreSala }: { nombreSala: (id: string) => string }) {
  const meses = useMemo(() => ultimosMeses(), [])
  const [mes, setMes] = useState(meses[0])
  const [datos, setDatos] = useState<{ mes: string; lista: Entrada[] } | null>(null)
  const [falla, setFalla] = useState('')
  const [filtro, setFiltro] = useState('')
  useEffect(() => {
    let vigente = true
    salasApi<{ historial: Entrada[] }>('historial', { mes }).then(
      (r) => vigente && (setDatos({ mes, lista: r.historial }), setFalla('')),
      (e: unknown) => vigente && setFalla(error(e)),
    )
    return () => {
      vigente = false
    }
  }, [mes])
  const lista = datos?.mes === mes ? datos.lista : null
  const q = filtro.trim().toLowerCase()
  const visibles = (lista ?? []).filter(
    (e) => !q || [e.quien_nombre, e.quien_email, e.reservaciones?.motivo, e.reservaciones?.codigo, e.reservaciones?.empresa].some((x) => x?.toLowerCase().includes(q)),
  )
  // Agrupado por día (hora de Tijuana), del más reciente al más antiguo.
  const dias: { dia: string; entradas: Entrada[] }[] = []
  for (const e of visibles) {
    const dia = local(new Date(e.creado)).dia
    if (dias.at(-1)?.dia === dia) dias.at(-1)!.entradas.push(e)
    else dias.push({ dia, entradas: [e] })
  }
  const iMes = meses.indexOf(mes)
  return (
    <section className="admin-caja">
      <div className="bitacora-cab">
        <h2>Historial de salas</h2>
        <div className="historial-filtros">
          <div className="campo historial-mes">
            <label htmlFor="hist-mes">Mes</label>
            <div className="historial-mes-control">
              <button type="button" className="btn secundario" aria-label="Mes anterior" disabled={iMes >= meses.length - 1} onClick={() => setMes(meses[iMes + 1])}>
                ‹
              </button>
              <select id="hist-mes" value={mes} onChange={(e) => setMes(e.target.value)}>
                {meses.map((m) => (
                  <option key={m} value={m}>
                    {textoMes(m)}
                  </option>
                ))}
              </select>
              <button type="button" className="btn secundario" aria-label="Mes siguiente" disabled={iMes <= 0} onClick={() => setMes(meses[iMes - 1])}>
                ›
              </button>
            </div>
          </div>
          <div className="campo bitacora-filtro">
            <label htmlFor="hist-filtro">Buscar</label>
            <input id="hist-filtro" type="search" value={filtro} onChange={(e) => setFiltro(e.target.value)} placeholder="Persona, motivo, código, empresa" />
          </div>
        </div>
      </div>
      <p className="nota">
        Quién reservó, cambió, cedió o canceló cada reunión. Nadie puede editarlo ni borrarlo.
        {lista && ` ${visibles.length} ${visibles.length === 1 ? 'movimiento' : 'movimientos'} en ${textoMes(mes).toLowerCase()}.`}
      </p>
      {falla && <div className="alerta" role="alert">{falla}</div>}
      {!lista ? (
        !falla && <p className="nota">Cargando…</p>
      ) : dias.length === 0 ? (
        <p className="nota">{q ? 'Nada coincide con la búsqueda.' : 'Sin movimientos este mes.'}</p>
      ) : (
        dias.map(({ dia, entradas }) => (
          <div key={dia} className="historial-dia">
            <h3 className="historial-dia-titulo">
              {conMayuscula(textoDia(dia))} <span>{entradas.length}</span>
            </h3>
            <ul className="bitacora">
              {entradas.map((e) => (
                <li key={e.id}>
                  <span className="bitacora-fecha">{hora(e.creado)}</span>
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
          </div>
        ))
      )}
    </section>
  )
}
