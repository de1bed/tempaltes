import { useEffect, useState } from 'react'
import { salasApi, type Perfil } from '../lib/supabase'
import { error, responsableDe, textoReunion, urlApp, type Hecho } from './util'

interface Solicitud {
  id: string
  solicitante_email: string
  solicitante_nombre: string
  datos: { motivo: string; personas: number; invitados: string[]; notas: string; enlace_reunion?: string; responsable_nombre: string; responsable_email: string }
  mensaje: string
  estado: 'pendiente' | 'aceptada' | 'rechazada' | 'cancelada' | 'vencida'
  respuesta: string | null
  respondido_por: string | null
  creado: string
  reservaciones: {
    id: string
    codigo: string
    sala_id: string
    inicio: string
    fin: string
    motivo: string
    creado_por: string | null
    creado_por_email: string
    creado_por_nombre: string
    responsable_nombre: string | null
    responsable_email: string | null
  } | null
}

const ESTADOS: Record<Solicitud['estado'], string> = {
  pendiente: 'Esperando respuesta',
  aceptada: 'Aceptada: la sala es tuya',
  rechazada: 'No aceptada',
  cancelada: 'Cancelada',
  vencida: 'Venció sin respuesta',
}

/** Solicitudes de horario: las que te hacen (o todas, si administras salas) y las que tú hiciste. */
export function Solicitudes({ perfil, nombreSala, alCambiar }: { perfil: Perfil; nombreSala: (id: string) => string; alCambiar: (h: Hecho | null) => void }) {
  const [datos, setDatos] = useState<{ recibidas: Solicitud[]; enviadas: Solicitud[] } | null>(null)
  const [falla, setFalla] = useState('')
  const [version, setVersion] = useState(0)

  useEffect(() => {
    salasApi<{ recibidas: Solicitud[]; enviadas: Solicitud[] }>('solicitudes').then(
      (r) => (setDatos(r), setFalla('')),
      (e: unknown) => setFalla(error(e)),
    )
  }, [version])

  const recargar = (h: Hecho | null) => {
    setVersion((v) => v + 1)
    alCambiar(h)
  }

  return (
    <>
      <section className="admin-caja">
        <h2>Te piden tu horario</h2>
        <p className="nota">
          Si aceptas, tu reunión se cancela (tus invitados reciben la cancelación) y la sala queda para quien la pidió. Si nadie responde antes de la hora, la
          solicitud vence sola.
        </p>
        {falla && <div className="alerta" role="alert">{falla}</div>}
        {!datos ? (
          !falla && <p className="nota">Cargando…</p>
        ) : datos.recibidas.length === 0 ? (
          <p className="nota">No tienes solicitudes pendientes.</p>
        ) : (
          <ul className="admin-lista">
            {datos.recibidas.map((s) => (
              <Recibida key={s.id} s={s} perfil={perfil} nombreSala={nombreSala} alResponder={recargar} />
            ))}
          </ul>
        )}
      </section>

      <section className="admin-caja">
        <h2>Lo que tú pediste</h2>
        {!datos ? null : datos.enviadas.length === 0 ? (
          <p className="nota">No has pedido horarios en los últimos 30 días. Para pedir uno, en Reservar abre el día y da clic en “Pedir este horario”.</p>
        ) : (
          <ul className="admin-lista">
            {datos.enviadas.map((s) => (
              <Enviada key={s.id} s={s} nombreSala={nombreSala} alCancelar={() => recargar({ texto: 'Se canceló tu solicitud.' })} />
            ))}
          </ul>
        )}
      </section>
    </>
  )
}

function Recibida({ s, perfil, nombreSala, alResponder }: { s: Solicitud; perfil: Perfil; nombreSala: (id: string) => string; alResponder: (h: Hecho) => void }) {
  const [respuesta, setRespuesta] = useState('')
  const [enviando, setEnviando] = useState<'' | 'si' | 'no'>('')
  const [falla, setFalla] = useState('')
  const r = s.reservaciones!
  const dueno = responsableDe(r)
  const esMiReunion = r.creado_por === perfil.id || dueno.email.toLowerCase() === perfil.email.toLowerCase()

  async function responder(aceptar: boolean) {
    setFalla('')
    setEnviando(aceptar ? 'si' : 'no')
    try {
      await salasApi('responder', { id: s.id, aceptar, respuesta, app: urlApp() })
      alResponder(
        aceptar
          ? { texto: `Cediste el horario a ${s.solicitante_nombre || s.solicitante_email}.`, detalle: 'Tu reunión se canceló y la sala quedó a su nombre; a todos les llegó el aviso.' }
          : { texto: `Le avisamos a ${s.solicitante_nombre || s.solicitante_email} que el horario sigue siendo tuyo.` },
      )
    } catch (e) {
      setFalla(error(e))
      setEnviando('')
    }
  }

  return (
    <li className="admin-usuario salas-solicitud">
      <div className="admin-quien">
        <strong>
          {s.solicitante_nombre || s.solicitante_email} pide {esMiReunion ? 'tu' : 'el'} horario
        </strong>
        <span>
          {nombreSala(r.sala_id)} · {textoReunion(r.inicio, r.fin)} · «{r.motivo}»{!esMiReunion && ` de ${dueno.nombre || dueno.email}`}
        </span>
        <small>
          Para: «{s.datos.motivo}» · {s.datos.personas} personas{s.datos.invitados.length ? ` · ${s.datos.invitados.length} ${s.datos.invitados.length === 1 ? 'invitado' : 'invitados'}` : ''}
          {s.datos.enlace_reunion ? ` · ${s.datos.enlace_reunion}` : ''}
        </small>
        {s.mensaje && <p className="salas-mensaje">“{s.mensaje}”</p>}
      </div>
      <div className="campo">
        <input aria-label="Respuesta (opcional)" placeholder="Respuesta (opcional)" maxLength={500} value={respuesta} onChange={(e) => setRespuesta(e.target.value)} />
      </div>
      <div className="admin-acciones">
        <button type="button" className="btn primario" disabled={!!enviando} onClick={() => responder(true)}>
          {enviando === 'si' ? 'Cediendo…' : 'Ceder el horario'}
        </button>
        <button type="button" className="btn secundario" disabled={!!enviando} onClick={() => responder(false)}>
          {enviando === 'no' ? 'Enviando…' : 'No ceder'}
        </button>
      </div>
      {falla && <div className="alerta" role="alert">{falla}</div>}
    </li>
  )
}

function Enviada({ s, nombreSala, alCancelar }: { s: Solicitud; nombreSala: (id: string) => string; alCancelar: () => void }) {
  const [enviando, setEnviando] = useState(false)
  const [falla, setFalla] = useState('')
  const r = s.reservaciones
  return (
    <li className="admin-usuario">
      <div className="admin-quien">
        <strong>«{s.datos.motivo}»</strong>
        {r && (
          <span>
            {nombreSala(r.sala_id)} · {textoReunion(r.inicio, r.fin)} · de {responsableDe(r).nombre || responsableDe(r).email}
          </span>
        )}
        <small className={`salas-estado ${s.estado === 'aceptada' ? 'ok' : s.estado === 'pendiente' ? '' : 'error'}`}>
          {ESTADOS[s.estado]}
          {s.respuesta && ` · “${s.respuesta}”`}
        </small>
      </div>
      {s.estado === 'pendiente' && (
        <div className="admin-acciones">
          <button
            type="button"
            className="link peligro"
            disabled={enviando}
            onClick={async () => {
              setEnviando(true)
              try {
                await salasApi('cancelar_solicitud', { id: s.id })
                alCancelar()
              } catch (e) {
                setFalla(error(e))
                setEnviando(false)
              }
            }}
          >
            Cancelar solicitud
          </button>
        </div>
      )}
      {falla && <div className="alerta" role="alert">{falla}</div>}
    </li>
  )
}
