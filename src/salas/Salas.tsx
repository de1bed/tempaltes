import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { CambiarPassword } from '../auth/CambiarPassword'
import { IMG } from '../lib/imagenes'
import { salasApi, supabase, type Perfil, type Reservacion, type Sala } from '../lib/supabase'
import { aFecha, diasHabiles, horaDe, horariosLibres, local, textoDia, textoHora, type Bloque } from './tiempo'

const DURACIONES = [30, 60, 90, 120, 180, 240]

interface Disponibilidad {
  clave: string
  reservaciones: Reservacion[]
  outlook: (Bloque & { titulo: string })[]
  outlook_activo: boolean
  aviso: string | null
  error?: string
}

const textoDuracion = (min: number) => (min < 60 ? `${min} min` : `${min / 60} h`.replace('.5 h', ' h 30 min'))
const minutosDe = (r: Reservacion) => (Date.parse(r.fin) - Date.parse(r.inicio)) / 60_000
const error = (e: unknown) => (e instanceof Error ? e.message : String(e))

/** Reservación de salas: se elige sala, día, duración y horario libre. */
export function Salas({ perfil, irAInicio, salir }: { perfil: Perfil; irAInicio: () => void; salir: () => void }) {
  const dias = useMemo(() => diasHabiles(), [])
  const [salas, setSalas] = useState<Sala[] | null>(null)
  const [salaId, setSalaId] = useState('')
  const [dia, setDia] = useState(dias[0])
  const [duracion, setDuracion] = useState(60)
  const [disp, setDisp] = useState<Disponibilidad | null>(null)
  const [elegido, setElegido] = useState<number | null>(null)
  const [moviendo, setMoviendo] = useState<Reservacion | null>(null)
  const [hecho, setHecho] = useState('')
  const [version, setVersion] = useState(0)
  const [proximas, setProximas] = useState<Reservacion[] | null>(null)

  useEffect(() => {
    supabase
      .from('salas')
      .select('id, nombre, buzon, capacidad')
      .eq('activa', true)
      .order('orden')
      .then(({ data }) => {
        setSalas(data ?? [])
        if (data?.[0]) setSalaId((actual) => actual || data[0].id)
      })
  }, [])

  const clave = `${salaId}|${dia}|${version}`
  useEffect(() => {
    if (!salaId) return
    let vigente = true
    salasApi<Omit<Disponibilidad, 'clave'>>('disponibilidad', { sala_id: salaId, fecha: dia }).then(
      (r) => vigente && setDisp({ ...r, clave }),
      (e: unknown) => vigente && setDisp({ clave, reservaciones: [], outlook: [], outlook_activo: false, aviso: null, error: error(e) }),
    )
    return () => {
      vigente = false
    }
  }, [salaId, dia, clave])

  // Próximas reservaciones: las propias (el administrador ve todas).
  useEffect(() => {
    let consulta = supabase.from('reservaciones').select('*').eq('estado', 'activa').gte('fin', new Date().toISOString()).order('inicio').limit(100)
    if (!perfil.es_admin) consulta = consulta.eq('creado_por', perfil.id)
    consulta.then(({ data }) => setProximas((data as Reservacion[]) ?? []))
  }, [perfil, version])

  const cargando = disp?.clave !== clave
  const sala = salas?.find((s) => s.id === salaId)
  const delDia = cargando ? [] : disp!.reservaciones.filter((r) => r.id !== moviendo?.id)
  const ocupado: Bloque[] = cargando ? [] : [...delDia, ...disp!.outlook]
  const libres = cargando ? [] : horariosLibres(dia, duracion, ocupado)
  const agenda = cargando
    ? []
    : [
        ...disp!.reservaciones.map((r) => ({ inicio: r.inicio, fin: r.fin, titulo: r.motivo, quien: r.creado_por_nombre || r.creado_por_email, propia: r.creado_por === perfil.id })),
        ...disp!.outlook.map((b) => ({ ...b, quien: '', propia: false })),
      ].sort((a, b) => Date.parse(a.inicio) - Date.parse(b.inicio))

  function recargar(mensaje = '') {
    setElegido(null)
    setHecho(mensaje)
    setVersion((v) => v + 1)
  }

  function empezarAMover(r: Reservacion) {
    setMoviendo(r)
    setSalaId(r.sala_id)
    setDia(local(new Date(r.inicio)).dia)
    setDuracion(minutosDe(r))
    setElegido(null)
    setHecho('')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const nombreSala = (id: string) => salas?.find((s) => s.id === id)?.nombre ?? id

  return (
    <div className="inicio admin salas">
      <div className="inicio-centro admin-centro">
        <header className="admin-cab">
          <button type="button" className="marca-logo" onClick={irAInicio} aria-label="Ir al inicio">
            <img src={IMG.treveLogo} alt="" />
          </button>
          <button type="button" className="volver" onClick={irAInicio}>
            <svg viewBox="0 0 12 12" aria-hidden="true">
              <path d="M7.5 2.5 4 6l3.5 3.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Inicio
          </button>
          <span className="admin-sesion">
            <CambiarPassword email={perfil.email} />
            <button type="button" className="link sesion-salir" onClick={salir}>
              Cerrar sesión
            </button>
          </span>
        </header>
        <h1>Salas</h1>
        <p className="admin-intro">Lunes a viernes de 7:00 a.m. a 9:00 p.m., hasta 30 días adelante.</p>

        {moviendo && (
          <div className="credenciales salas-moviendo" role="status">
            <strong>Moviendo: {moviendo.motivo}</strong>
            <span>
              Ahora: {nombreSala(moviendo.sala_id)}, {textoDia(local(new Date(moviendo.inicio)).dia, { weekday: 'short', day: 'numeric', month: 'short' })}{' '}
              {horaDe(moviendo.inicio)}. Elige el nuevo horario (puedes cambiar de sala o de día).
            </span>
            <div className="admin-acciones">
              <button type="button" className="btn secundario" onClick={() => (setMoviendo(null), setElegido(null))}>
                No mover
              </button>
            </div>
          </div>
        )}
        {hecho && (
          <div className="credenciales" role="status">
            <strong>{hecho}</strong>
          </div>
        )}

        <section className="admin-caja">
          <div className="salas-controles">
            <div className="vista-toggle" role="group" aria-label="Sala">
              {salas?.map((s) => (
                <button key={s.id} type="button" className={s.id === salaId ? 'activo' : undefined} aria-pressed={s.id === salaId} onClick={() => (setSalaId(s.id), setElegido(null))}>
                  {s.nombre}
                </button>
              ))}
            </div>
            <div className="campo salas-duracion">
              <label htmlFor="salas-duracion">Duración</label>
              <select id="salas-duracion" value={duracion} onChange={(e) => (setDuracion(Number(e.target.value)), setElegido(null))}>
                {[...new Set([...DURACIONES, duracion])].sort((a, b) => a - b).map((d) => (
                  <option key={d} value={d}>
                    {textoDuracion(d)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="salas-dias" role="group" aria-label="Día">
            {dias.map((d) => {
              const f = aFecha(d, 12 * 60)
              return (
                <button key={d} type="button" className={d === dia ? 'salas-dia activo' : 'salas-dia'} aria-pressed={d === dia} onClick={() => (setDia(d), setElegido(null))}>
                  <span>{f.toLocaleDateString('es-MX', { timeZone: 'America/Mexico_City', weekday: 'short' })}</span>
                  <strong>{f.toLocaleDateString('es-MX', { timeZone: 'America/Mexico_City', day: 'numeric' })}</strong>
                  <span>{f.toLocaleDateString('es-MX', { timeZone: 'America/Mexico_City', month: 'short' })}</span>
                </button>
              )
            })}
          </div>

          <h2 className="salas-titulo">
            {sala?.nombre} · {textoDia(dia)}
          </h2>
          {!cargando && disp?.error && <div className="alerta" role="alert">{disp.error}</div>}
          {!cargando && disp?.aviso && <div className="alerta" role="status">{disp.aviso}</div>}

          <div className="salas-cuerpo">
            <div>
              <h3 className="salas-sub">Horarios libres ({textoDuracion(duracion)})</h3>
              {cargando ? (
                <p className="nota">Cargando…</p>
              ) : libres.length === 0 ? (
                <p className="nota">No hay horarios libres ese día para esa duración.</p>
              ) : (
                <div className="salas-horas">
                  {libres.map((m) => (
                    <button key={m} type="button" className={m === elegido ? 'salas-hora activo' : 'salas-hora'} aria-pressed={m === elegido} onClick={() => (setElegido(m), setHecho(''))}>
                      {textoHora(m)}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div>
              <h3 className="salas-sub">Ocupado ese día</h3>
              {cargando ? null : agenda.length === 0 ? (
                <p className="nota">Todo el día libre.</p>
              ) : (
                <ul className="salas-agenda">
                  {agenda.map((a, i) => (
                    <li key={i} className={a.propia ? 'propia' : undefined}>
                      <span className="salas-agenda-hora">
                        {horaDe(a.inicio)} – {horaDe(a.fin)}
                      </span>
                      <span>
                        {a.titulo}
                        {a.quien && <small> · {a.quien}</small>}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {elegido !== null && sala && (
            moviendo ? (
              <ConfirmarMover
                r={moviendo}
                sala={sala}
                dia={dia}
                minutos={elegido}
                duracion={duracion}
                alTerminar={(msg) => {
                  setMoviendo(null)
                  recargar(msg)
                }}
              />
            ) : (
              <Reservar sala={sala} dia={dia} minutos={elegido} duracion={duracion} alTerminar={recargar} />
            )
          )}
        </section>

        <section className="admin-caja">
          <h2>{perfil.es_admin ? 'Próximas reservaciones (todas)' : 'Mis próximas reservaciones'}</h2>
          {!proximas ? (
            <p className="nota">Cargando…</p>
          ) : proximas.length === 0 ? (
            <p className="nota">No hay reservaciones próximas.</p>
          ) : (
            <ul className="admin-lista">
              {proximas.map((r) => (
                <Proxima
                  key={r.id}
                  r={r}
                  sala={nombreSala(r.sala_id)}
                  mostrarQuien={perfil.es_admin}
                  verSync={perfil.es_admin && Boolean(salas?.find((s) => s.id === r.sala_id)?.buzon)}
                  mover={() => empezarAMover(r)}
                  alCancelar={() => recargar('Reservación cancelada.')}
                />
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  )
}

function Reservar({ sala, dia, minutos, duracion, alTerminar }: { sala: Sala; dia: string; minutos: number; duracion: number; alTerminar: (msg: string) => void }) {
  const [motivo, setMotivo] = useState('')
  const [personas, setPersonas] = useState('2')
  const [invitados, setInvitados] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [falla, setFalla] = useState('')

  async function enviar(e: FormEvent) {
    e.preventDefault()
    setFalla('')
    setEnviando(true)
    try {
      const inicio = aFecha(dia, minutos)
      const { reservacion } = await salasApi<{ reservacion: Reservacion }>('reservar', {
        sala_id: sala.id,
        inicio: inicio.toISOString(),
        fin: new Date(inicio.getTime() + duracion * 60_000).toISOString(),
        motivo,
        personas: Number(personas),
        invitados: invitados.split(/[\s,;]+/).filter(Boolean),
      })
      alTerminar(`Listo: ${sala.nombre}, ${textoDia(dia, { weekday: 'short', day: 'numeric', month: 'short' })} a las ${textoHora(minutos)} · Código ${reservacion.codigo}`)
    } catch (err) {
      setFalla(error(err))
      setEnviando(false)
    }
  }

  return (
    <form className="salas-form" onSubmit={enviar}>
      <h3 className="salas-sub">
        Reservar {sala.nombre} · {textoHora(minutos)} – {textoHora(minutos + duracion)}
      </h3>
      <div className="admin-alta">
        <div className="campo">
          <label htmlFor="res-motivo">Motivo</label>
          <input id="res-motivo" type="text" required maxLength={200} value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Junta con cliente…" />
        </div>
        <div className="campo">
          <label htmlFor="res-personas">Personas</label>
          <input id="res-personas" type="number" min={1} max={100} required value={personas} onChange={(e) => setPersonas(e.target.value)} />
        </div>
      </div>
      <div className="campo">
        <label htmlFor="res-invitados">Invitados (opcional)</label>
        <textarea id="res-invitados" rows={2} value={invitados} onChange={(e) => setInvitados(e.target.value)} placeholder="correo@empresa.com, otro@empresa.com" />
        <small>Reciben la invitación de Outlook. Tú también la recibes.</small>
      </div>
      {falla && <div className="alerta" role="alert">{falla}</div>}
      <div className="admin-acciones">
        <button type="submit" className="btn primario" disabled={enviando}>
          {enviando ? 'Reservando…' : 'Reservar'}
        </button>
      </div>
    </form>
  )
}

function ConfirmarMover({ r, sala, dia, minutos, duracion, alTerminar }: { r: Reservacion; sala: Sala; dia: string; minutos: number; duracion: number; alTerminar: (msg: string) => void }) {
  const [enviando, setEnviando] = useState(false)
  const [falla, setFalla] = useState('')

  async function mover() {
    setFalla('')
    setEnviando(true)
    try {
      const inicio = aFecha(dia, minutos)
      await salasApi('mover', { id: r.id, sala_id: sala.id, inicio: inicio.toISOString(), fin: new Date(inicio.getTime() + duracion * 60_000).toISOString() })
      alTerminar(`Reservación movida a ${sala.nombre}, ${textoDia(dia, { weekday: 'short', day: 'numeric', month: 'short' })} a las ${textoHora(minutos)}`)
    } catch (err) {
      setFalla(error(err))
      setEnviando(false)
    }
  }

  return (
    <div className="salas-form">
      <h3 className="salas-sub">
        Mover "{r.motivo}" a {sala.nombre} · {textoHora(minutos)} – {textoHora(minutos + duracion)}
      </h3>
      {falla && <div className="alerta" role="alert">{falla}</div>}
      <div className="admin-acciones">
        <button type="button" className="btn primario" disabled={enviando} onClick={mover}>
          {enviando ? 'Moviendo…' : 'Confirmar cambio'}
        </button>
      </div>
    </div>
  )
}

function Proxima({ r, sala, mostrarQuien, verSync, mover, alCancelar }: { r: Reservacion; sala: string; mostrarQuien: boolean; verSync: boolean; mover: () => void; alCancelar: () => void }) {
  const [confirmando, setConfirmando] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [falla, setFalla] = useState('')
  const dia = local(new Date(r.inicio)).dia

  async function cancelar() {
    setFalla('')
    setEnviando(true)
    try {
      await salasApi('cancelar', { id: r.id })
      alCancelar()
    } catch (err) {
      setFalla(error(err))
      setEnviando(false)
    }
  }

  return (
    <li className="admin-usuario">
      <div className="admin-quien">
        <strong>{r.motivo}</strong>
        <span>
          {sala} · {textoDia(dia, { weekday: 'short', day: 'numeric', month: 'short' })} · {horaDe(r.inicio)} – {horaDe(r.fin)}
        </span>
        <small>
          {r.codigo} · {r.personas} {r.personas === 1 ? 'persona' : 'personas'}
          {mostrarQuien && ` · ${r.creado_por_nombre || r.creado_por_email}`}
          {verSync && (r.sync_error || !r.outlook_event_id ? ' · ⚠ no se copió a Outlook' : ' · en Outlook')}
        </small>
      </div>
      <div className="admin-acciones">
        <button type="button" className="btn secundario" disabled={enviando} onClick={mover}>
          Mover
        </button>
        {confirmando ? (
          <>
            <span className="pregunta">¿Cancelar la reservación?</span>
            <button type="button" className="btn secundario" onClick={() => setConfirmando(false)}>
              No
            </button>
            <button type="button" className="btn peligro" disabled={enviando} onClick={cancelar}>
              {enviando ? 'Cancelando…' : 'Sí, cancelar'}
            </button>
          </>
        ) : (
          <button type="button" className="link peligro" onClick={() => setConfirmando(true)}>
            Cancelar
          </button>
        )}
      </div>
      {falla && <div className="alerta" role="alert">{falla}</div>}
    </li>
  )
}
