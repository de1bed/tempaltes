import { useEffect, useState } from 'react'
import { salasApi } from '../lib/supabase'

interface Estado {
  configurado: boolean
  conexion: { cuenta: string; actualizado: string } | null
  calendarios: { id: string; nombre: string }[]
  salas: { id: string; nombre: string; calendario_id: string | null; calendario_nombre: string | null }[]
  aviso: string | null
}

const RESULTADOS: Record<string, string> = {
  conectado: 'Outlook quedó conectado. Ahora elige qué calendario es cada sala.',
  cancelado: 'Se canceló la conexión con Outlook.',
  error: 'No se pudo conectar Outlook. Intenta de nuevo.',
}

/** Solo administrador: conectar la cuenta de Outlook y elegir el calendario de cada sala. */
export function ConexionOutlook({ alCambiar }: { alCambiar: () => void }) {
  const [estado, setEstado] = useState<Estado | null>(null)
  const [error, setError] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const [version, setVersion] = useState(0)
  // Resultado al regresar de Microsoft (?outlook=conectado); se quita de la dirección.
  const [resultado] = useState(() => {
    const params = new URLSearchParams(window.location.search)
    const valor = params.get('outlook')
    if (valor) {
      params.delete('outlook')
      const busqueda = params.toString()
      history.replaceState(null, '', window.location.pathname + (busqueda ? `?${busqueda}` : '') + window.location.hash)
    }
    return valor ? (RESULTADOS[valor] ?? '') : ''
  })

  useEffect(() => {
    salasApi<Estado>('outlook_estado').then(
      (r) => (setEstado(r), setError('')),
      (e: unknown) => setError(e instanceof Error ? e.message : String(e)),
    )
  }, [version])

  async function hacer(accion: string, datos: Record<string, unknown> = {}) {
    setError('')
    setOcupado(true)
    try {
      const r = await salasApi<{ url?: string }>(accion, datos)
      if (r.url) {
        window.location.assign(r.url)
        return
      }
      setVersion((v) => v + 1)
      alCambiar()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setOcupado(false)
    }
  }

  const conectar = () => hacer('outlook_iniciar', { volver: window.location.origin + window.location.pathname })

  return (
    <section className="admin-caja">
      <h2>Conexión con Outlook</h2>
      {resultado && <div className="credenciales" role="status"><strong>{resultado}</strong></div>}
      {error && <div className="alerta" role="alert">{error}</div>}
      {!estado ? (
        !error && <p className="nota">Cargando…</p>
      ) : !estado.configurado ? (
        <p className="nota">
          Falta registrar la app en Microsoft y agregar <code>MS_CLIENT_ID</code> y <code>MS_CLIENT_SECRET</code> en los secretos de Supabase. Mientras tanto las
          reservaciones se guardan solo en la app.
        </p>
      ) : !estado.conexion ? (
        <>
          <p className="nota">Conecta la cuenta de Outlook donde están los calendarios de las salas. Se hace una sola vez.</p>
          <div className="admin-acciones">
            <button type="button" className="btn primario" disabled={ocupado} onClick={conectar}>
              Conectar Outlook
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="nota">
            Conectado con <strong>{estado.conexion.cuenta}</strong>. Cada reservación se copia al calendario de su sala.
          </p>
          {estado.aviso && <div className="alerta" role="alert">{estado.aviso}</div>}
          <div className="admin-alta">
            {estado.salas.map((s) => (
              <div className="campo" key={s.id}>
                <label htmlFor={`cal-${s.id}`}>Calendario de {s.nombre}</label>
                <select
                  id={`cal-${s.id}`}
                  value={s.calendario_id ?? ''}
                  disabled={ocupado}
                  onChange={(e) => {
                    const cal = estado.calendarios.find((c) => c.id === e.target.value)
                    hacer('outlook_asignar', { sala_id: s.id, calendario_id: cal?.id ?? null, calendario_nombre: cal?.nombre ?? null })
                  }}
                >
                  <option value="">Sin calendario (solo en la app)</option>
                  {s.calendario_id && !estado.calendarios.some((c) => c.id === s.calendario_id) && <option value={s.calendario_id}>{s.calendario_nombre ?? 'Calendario actual'}</option>}
                  {estado.calendarios.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nombre}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
          <div className="admin-acciones">
            <button type="button" className="btn secundario" disabled={ocupado} onClick={conectar}>
              Volver a conectar
            </button>
            <button type="button" className="link peligro" disabled={ocupado} onClick={() => hacer('outlook_desconectar')}>
              Desconectar
            </button>
          </div>
        </>
      )}
    </section>
  )
}
