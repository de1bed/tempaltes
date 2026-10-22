import { useEffect, useState } from 'react'
import { dinero } from '../lib/formato'
import type { Perfil } from '../lib/supabase'
import { leerEnvios, marcarEnvio, NOMBRES_CORRIDA, type EnvioCorrida } from '../corridas/envios'

const cuando = (iso: string) => new Date(iso).toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' })

/** Inicio de quien hace cotizaciones: corridas que le mandaron, para convertirlas en cotización. */
export function BandejaCorridas({ perfil, convertir, mostrarVacia }: { perfil: Perfil; convertir: (e: EnvioCorrida) => Promise<void>; mostrarVacia?: boolean }) {
  const [envios, setEnvios] = useState<EnvioCorrida[] | null>(null)
  const [error, setError] = useState('')
  const [verHistorial, setVerHistorial] = useState(false)
  const [ocupado, setOcupado] = useState('')
  const [version, setVersion] = useState(0)

  useEffect(() => {
    leerEnvios().then(setEnvios, (e: unknown) => setError(e instanceof Error ? e.message : String(e)))
  }, [version])

  async function hacer(e: EnvioCorrida, accion: 'convertir' | 'descartar') {
    setError('')
    setOcupado(e.id)
    try {
      if (accion === 'convertir') await convertir(e)
      else {
        await marcarEnvio(e.id, 'descartada', perfil)
        setVersion((v) => v + 1)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setOcupado('')
    }
  }

  if (!envios && !error) return mostrarVacia ? <p className="nota">Cargando…</p> : null
  const pendientes = envios?.filter((e) => e.estado === 'pendiente') ?? []
  const atendidas = envios?.filter((e) => e.estado !== 'pendiente') ?? []
  if (!error && pendientes.length === 0 && atendidas.length === 0)
    return mostrarVacia ? <section className="bandeja"><p className="nota">Todavía no han mandado corridas. Cuando alguien use "Mandar a cotizaciones" en una corrida, aparece aquí.</p></section> : null

  return (
    <section className="bandeja">
      <div className="bandeja-cab">
        <h2>
          Corridas recibidas
          {pendientes.length > 0 && <span className="bandeja-num">{pendientes.length}</span>}
        </h2>
        {atendidas.length > 0 && (
          <button type="button" className="link sesion-salir" onClick={() => setVerHistorial((v) => !v)}>
            {verHistorial ? 'Ocultar historial' : `Ver historial (${atendidas.length})`}
          </button>
        )}
      </div>
      {error && <div className="alerta" role="alert">{error}</div>}
      {pendientes.length === 0 && !verHistorial && <p className="nota">No hay corridas pendientes.</p>}
      <ul className="bandeja-lista">
        {[...pendientes, ...(verHistorial ? atendidas : [])].map((e) => (
          <li key={e.id} className={e.estado === 'pendiente' ? undefined : 'atendida'}>
            <div className="bandeja-info">
              <strong>
                {e.puesto || 'Sin puesto'} · {e.empresa || 'Sin cliente'}
              </strong>
              <span>
                {NOMBRES_CORRIDA[e.corrida]} · bruto semanal {dinero(e.resumen.brutoSemanal)} · patronales {dinero(e.resumen.patronalesSemanal)}
              </span>
              <small>
                Envió {e.enviado_por_nombre || e.enviado_por_email} · {cuando(e.creado)}
                {e.estado !== 'pendiente' && e.atendido_en && ` · ${e.estado === 'convertida' ? 'Convertida' : 'Descartada'} por ${e.atendido_por_nombre} · ${cuando(e.atendido_en)}`}
              </small>
              {e.nota && <span className="bandeja-nota">"{e.nota}"</span>}
            </div>
            <div className="admin-acciones">
              {e.estado === 'pendiente' ? (
                <>
                  <button type="button" className="btn primario" disabled={ocupado === e.id} onClick={() => hacer(e, 'convertir')}>
                    {ocupado === e.id ? 'Abriendo…' : 'Convertir en cotización'}
                  </button>
                  <button type="button" className="link peligro" disabled={ocupado === e.id} onClick={() => hacer(e, 'descartar')}>
                    Descartar
                  </button>
                </>
              ) : (
                <button type="button" className="btn secundario" disabled={ocupado === e.id} onClick={() => hacer(e, 'convertir')} title="Vuelve a cargar los montos de esta corrida en la cotización de nómina">
                  Abrir otra vez
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}

/** Aviso en el inicio de quien hace cotizaciones: cuántas corridas esperan, con acceso al Historial. */
export function AvisoCorridas({ abrir }: { abrir: () => void }) {
  const [pendientes, setPendientes] = useState(0)
  useEffect(() => {
    leerEnvios().then(
      (r) => setPendientes(r.filter((e) => e.estado === 'pendiente').length),
      () => setPendientes(0),
    )
  }, [])
  if (pendientes === 0) return null
  return (
    <section className="bandeja bandeja-aviso">
      <h2>
        Corridas recibidas <span className="bandeja-num">{pendientes}</span>
      </h2>
      <span className="nota">{pendientes === 1 ? 'Hay 1 corrida esperando cotización.' : `Hay ${pendientes} corridas esperando cotización.`}</span>
      <button type="button" className="btn primario" onClick={abrir}>
        Ver en Historial
      </button>
    </section>
  )
}
