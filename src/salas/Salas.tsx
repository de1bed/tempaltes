import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { CambiarPassword } from '../auth/CambiarPassword'
import { IMG } from '../lib/imagenes'
import { salasApi, supabase, type EstadoOutlook, type Perfil, type Reservacion, type Sala } from '../lib/supabase'
import { AccesoExternos } from './AccesoExternos'
import { AgregarCalendario } from './AgregarCalendario'
import { CampoInvitados, CintaDia, Calendario, Flecha, HorariosLibres, type BloqueAgenda } from './componentes'
import { ConexionOutlook } from './ConexionOutlook'
import { EditarDetalles } from './EditarDetalles'
import { Historial, HistorialReservacion } from './Historial'
import { Solicitudes } from './Solicitudes'
import { aFecha, diasHabiles, horaDe, horariosLibres, local, sumarDias, textoDia, type Bloque } from './tiempo'
import { conMayuscula, conPendientes, DURACIONES, error, esMia, minutosDe, responsableDe, textoDuracion, textoReunion, urlApp, type Hecho } from './util'

interface Disponibilidad {
  clave: string
  reservaciones: Reservacion[]
  outlook: (Bloque & { titulo: string })[]
  outlook_activo: boolean
  aviso: string | null
  error?: string
}

type Pestana = 'reservar' | 'reservaciones' | 'solicitudes' | 'historial' | 'externos' | 'outlook'


/** Reservación de salas: se elige sala, día, duración y horario libre. */
export function Salas({ perfil, irAInicio, salir }: { perfil: Perfil; irAInicio: () => void; salir: () => void }) {
  const adminSalas = perfil.es_admin || perfil.secciones.includes('salas_admin')
  const dias = useMemo(() => diasHabiles(), [])
  const [pestana, setPestana] = useState<Pestana>('reservar')
  const [salas, setSalas] = useState<Sala[] | null>(null)
  const [salaId, setSalaId] = useState('')
  const [dia, setDia] = useState(dias[0])
  const [duracion, setDuracion] = useState(60)
  const [disp, setDisp] = useState<Disponibilidad | null>(null)
  const [elegido, setElegido] = useState<number | null>(null)
  const [moviendo, setMoviendo] = useState<Reservacion | null>(null)
  const [solicitando, setSolicitando] = useState<Reservacion | null>(null)
  const [hecho, setHecho] = useState<Hecho | null>(null)
  const [version, setVersion] = useState(0)
  const [marcas, setMarcas] = useState<{ clave: string; dias: string[] } | null>(null)
  const [pendientes, setPendientes] = useState(0)
  const arriba = useRef<HTMLDivElement>(null)
  // Momento de la última carga (para saber qué reuniones ya empezaron).
  const [ahora, setAhora] = useState(() => Date.now())
  const formulario = useRef<HTMLDivElement>(null)

  useEffect(() => {
    supabase
      .from('salas')
      .select('id, nombre, calendario_id, calendario_nombre, capacidad')
      .eq('activa', true)
      .order('orden')
      .then(({ data }) => {
        setSalas(data ?? [])
        if (data?.[0]) setSalaId((actual) => actual || data[0].id)
      })
  }, [version])

  // Solicitudes que esperan respuesta (para el número de la pestaña).
  useEffect(() => {
    salasApi<{ recibidas: unknown[] }>('solicitudes').then(
      (r) => setPendientes(r.recibidas.length),
      () => setPendientes(0),
    )
  }, [version])

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

  // Días con reservación en esta sala, para el punto del calendario.
  const claveMarcas = `${salaId}|${version}`
  useEffect(() => {
    if (!salaId || dias.length === 0) return
    let vigente = true
    const desde = aFecha(dias[0], 0).toISOString()
    const hasta = aFecha(sumarDias(dias[dias.length - 1], 1), 0).toISOString()
    supabase
      .from('reservaciones')
      .select('inicio')
      .eq('sala_id', salaId)
      .eq('estado', 'activa')
      .gte('inicio', desde)
      .lt('inicio', hasta)
      .then(({ data }) => {
        if (!vigente) return
        setMarcas({ clave: claveMarcas, dias: [...new Set((data ?? []).map((r) => local(new Date(r.inicio)).dia))] })
      })
    return () => {
      vigente = false
    }
  }, [salaId, dias, version, claveMarcas])

  const cargando = disp?.clave !== clave
  const sala = salas?.find((s) => s.id === salaId)
  const nombreSala = useCallback((id: string) => salas?.find((s) => s.id === id)?.nombre ?? id, [salas])
  const iDia = dias.indexOf(dia)
  const ocupados = useMemo(() => {
    const puntos = new Set(marcas?.clave === claveMarcas ? marcas.dias : [])
    if (disp?.clave === clave && (disp.reservaciones.length > 0 || disp.outlook.length > 0)) puntos.add(dia)
    return puntos
  }, [marcas, claveMarcas, disp, clave, dia])
  const delDia = cargando ? [] : disp!.reservaciones.filter((r) => r.id !== moviendo?.id)
  const ocupado: Bloque[] = cargando ? [] : [...delDia, ...disp!.outlook]
  const libres = cargando ? [] : horariosLibres(dia, duracion, ocupado)
  const agenda = cargando
    ? []
    : [
        ...disp!.reservaciones.map((r) => ({ inicio: r.inicio, fin: r.fin, titulo: r.motivo, quien: responsableDe(r).nombre || responsableDe(r).email, propia: esMia(r, perfil), moviendo: r.id === moviendo?.id, r })),
        ...disp!.outlook.map((b) => ({ ...b, quien: '', propia: false, moviendo: false, r: null as Reservacion | null })),
      ].sort((a, b) => Date.parse(a.inicio) - Date.parse(b.inicio))

  function recargar(nuevo: Hecho | null = null) {
    setElegido(null)
    setSolicitando(null)
    setHecho(nuevo)
    setVersion((v) => v + 1)
    setAhora(Date.now())
    if (nuevo) arriba.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  function cambiarSala(id: string) {
    setSalaId(id)
    setElegido(null)
    setSolicitando(null)
  }

  function cambiarDia(d: string) {
    setDia(d)
    setElegido(null)
    setSolicitando(null)
  }

  function empezarAMover(r: Reservacion) {
    setMoviendo(r)
    setSolicitando(null)
    setSalaId(r.sala_id)
    setDia(local(new Date(r.inicio)).dia)
    setDuracion(minutosDe(r))
    setElegido(null)
    setHecho(null)
    setPestana('reservar')
    requestAnimationFrame(() => arriba.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
  }

  function elegirHora(m: number) {
    setElegido(m)
    setSolicitando(null)
    setHecho(null)
    if (!moviendo) requestAnimationFrame(() => formulario.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }))
  }

  function pedirHorario(r: Reservacion) {
    setSolicitando(r)
    setElegido(null)
    setHecho(null)
    requestAnimationFrame(() => formulario.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }))
  }

  const pestanas: { id: Pestana; texto: string }[] = [
    { id: 'reservar', texto: moviendo ? 'Cambiando horario…' : 'Reservar' },
    { id: 'reservaciones', texto: adminSalas ? 'Reservaciones' : 'Mis reservaciones' },
    { id: 'solicitudes', texto: pendientes ? `Solicitudes (${pendientes})` : 'Solicitudes' },
    ...(adminSalas
      ? [
          { id: 'historial' as const, texto: 'Historial' },
          { id: 'externos' as const, texto: 'Externos' },
        ]
      : []),
    ...(perfil.es_admin ? [{ id: 'outlook' as const, texto: 'Outlook' }] : []),
  ]

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
        <div ref={arriba} className="salas-titulo">
          <div>
            <h1>Salas</h1>
            <p className="admin-intro">Lunes a viernes de 7:00 a.m. a 9:00 p.m., hasta 30 días adelante, hora de Tijuana.</p>
          </div>
        </div>

        <nav className="salas-pestanas" aria-label="Secciones de salas">
          {pestanas.map((p) => (
            <button key={p.id} type="button" className={pestana === p.id ? 'activo' : undefined} aria-current={pestana === p.id ? 'page' : undefined} onClick={() => setPestana(p.id)}>
              {p.texto}
            </button>
          ))}
        </nav>

        {hecho && (
          <div className={hecho.alerta ? 'credenciales salas-moviendo' : 'credenciales'} role="status">
            <strong>{hecho.texto}</strong>
            {hecho.detalle && <span>{hecho.detalle}</span>}
            {hecho.r && !hecho.r.outlook_event_id && <AgregarCalendario r={hecho.r} sala={nombreSala(hecho.r.sala_id)} />}
            <div className="admin-acciones">
              <button type="button" className="link" onClick={() => setHecho(null)}>
                Cerrar
              </button>
            </div>
          </div>
        )}

        {pendientes > 0 && pestana === 'reservar' && !moviendo && (
          <button type="button" className="salas-aviso-solicitudes" onClick={() => setPestana('solicitudes')}>
            <strong>{pendientes === 1 ? 'Te piden 1 horario' : `Te piden ${pendientes} horarios`}</strong> · Responde en Solicitudes →
          </button>
        )}

        {pestana === 'reservar' && (
          <>
            {moviendo && (
              <PanelMover
                r={moviendo}
                salaActual={nombreSala(moviendo.sala_id)}
                sala={sala}
                dia={dia}
                elegido={elegido}
                duracion={duracion}
                alTerminar={(h) => {
                  setMoviendo(null)
                  recargar(h)
                }}
                alCancelar={() => (setMoviendo(null), setElegido(null))}
              />
            )}

            <section className="admin-caja">
              <div className="salas-controles">
                <div className="vista-toggle" role="group" aria-label="Sala">
                  {salas?.map((s) => (
                    <button key={s.id} type="button" className={s.id === salaId ? 'activo' : undefined} aria-pressed={s.id === salaId} onClick={() => cambiarSala(s.id)}>
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

              <div className="salas-panel">
                <Calendario dias={dias} dia={dia} ocupados={ocupados} onElegir={cambiarDia} />
                <div className="salas-dia-panel">
                  <div className="salas-dia-cab">
                    <Flecha dir="izq" label="Día anterior" disabled={iDia <= 0} onClick={() => cambiarDia(dias[iDia - 1])} />
                    <div className="salas-dia-titulo">
                      <h2>{sala?.nombre ?? 'Sala'}</h2>
                      <p>{conMayuscula(textoDia(dia))}</p>
                    </div>
                    <Flecha dir="der" label="Día siguiente" disabled={iDia < 0 || iDia >= dias.length - 1} onClick={() => cambiarDia(dias[iDia + 1])} />
                  </div>
                  {!cargando && <CintaDia dia={dia} agenda={agenda as BloqueAgenda[]} elegido={elegido} duracion={duracion} />}
                  {!cargando && disp?.error && <div className="alerta" role="alert">{disp.error}</div>}
                  {!cargando && disp?.aviso && <div className="alerta" role="status">{disp.aviso}</div>}

                  <div className="salas-cuerpo">
                    <div>
                      <h3 className="salas-sub">{moviendo ? 'Elige el horario nuevo' : 'Horarios libres'} ({textoDuracion(duracion)})</h3>
                      {cargando ? (
                        <p className="nota">Cargando…</p>
                      ) : libres.length === 0 ? (
                        <p className="nota">No hay horarios libres ese día para esa duración. Prueba otro día o una duración más corta.</p>
                      ) : (
                        <HorariosLibres libres={libres} elegido={elegido} onElegir={elegirHora} />
                      )}
                    </div>
                    <div>
                      <h3 className="salas-sub">Ocupado ese día</h3>
                      {cargando ? null : agenda.length === 0 ? (
                        <p className="nota">Todo el día libre.</p>
                      ) : (
                        <ul className="salas-agenda">
                          {agenda.map((a, i) => {
                            const puedePedir = a.r && !a.propia && !moviendo && Date.parse(a.r.inicio) > ahora
                            return (
                              <li key={i} className={[a.propia ? 'propia' : '', a.moviendo ? 'moviendo' : ''].filter(Boolean).join(' ') || undefined}>
                                <span className="salas-agenda-hora">
                                  {horaDe(a.inicio)} – {horaDe(a.fin)}
                                  {a.moviendo && ' · la que estás cambiando'}
                                </span>
                                <span>
                                  {a.titulo}
                                  {a.quien && <small> · {a.quien}</small>}
                                  {a.r?.origen === 'externo' && <small> · Externo{a.r.empresa ? ` (${a.r.empresa})` : ''}</small>}
                                </span>
                                {puedePedir && (
                                  <button type="button" className="link salas-pedir" onClick={() => pedirHorario(a.r!)}>
                                    Pedir este horario
                                  </button>
                                )}
                              </li>
                            )
                          })}
                        </ul>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div ref={formulario}>
                {!moviendo && sala && elegido !== null && (
                  <FormReunion
                    key={`r-${salaId}-${dia}-${elegido}-${duracion}`}
                    perfil={perfil}
                    modo={{ tipo: 'reservar', sala, inicio: aFecha(dia, elegido), fin: new Date(aFecha(dia, elegido).getTime() + duracion * 60_000) }}
                    alTerminar={recargar}
                    alCerrar={() => setElegido(null)}
                  />
                )}
                {!moviendo && solicitando && (
                  <FormReunion key={`s-${solicitando.id}`} perfil={perfil} modo={{ tipo: 'solicitar', objetivo: solicitando, sala: nombreSala(solicitando.sala_id) }} alTerminar={recargar} alCerrar={() => setSolicitando(null)} />
                )}
              </div>
            </section>
          </>
        )}

        {pestana === 'reservaciones' && (
          <Reservaciones perfil={perfil} adminSalas={adminSalas} salas={salas} version={version} nombreSala={nombreSala} mover={empezarAMover} alCambiar={recargar} />
        )}
        {pestana === 'solicitudes' && <Solicitudes perfil={perfil} nombreSala={nombreSala} alCambiar={recargar} />}
        {pestana === 'historial' && adminSalas && <Historial nombreSala={nombreSala} />}
        {pestana === 'externos' && adminSalas && <AccesoExternos salas={salas ?? []} />}
        {pestana === 'outlook' && perfil.es_admin && <ConexionOutlook alCambiar={() => recargar()} />}
      </div>
    </div>
  )
}

/** Barra clara para cambiar el horario: lo actual, lo nuevo y confirmar. */
function PanelMover({ r, salaActual, sala, dia, elegido, duracion, alTerminar, alCancelar }: { r: Reservacion; salaActual: string; sala?: Sala; dia: string; elegido: number | null; duracion: number; alTerminar: (h: Hecho) => void; alCancelar: () => void }) {
  const [enviando, setEnviando] = useState(false)
  const [falla, setFalla] = useState('')
  const nuevoInicio = elegido !== null ? aFecha(dia, elegido) : null
  const nuevoFin = nuevoInicio ? new Date(nuevoInicio.getTime() + duracion * 60_000) : null

  async function confirmar() {
    if (!sala || !nuevoInicio || !nuevoFin) return
    setFalla('')
    setEnviando(true)
    try {
      const res = await salasApi<{ reservacion: Reservacion; outlook: EstadoOutlook }>('mover', { id: r.id, sala_id: sala.id, inicio: nuevoInicio.toISOString(), fin: nuevoFin.toISOString(), app: urlApp() })
      alTerminar({
        texto: `Listo: «${r.motivo}» quedó el ${textoReunion(res.reservacion.inicio, res.reservacion.fin)} en ${sala.nombre}.`,
        detalle:
          res.outlook === 'ok'
            ? 'Outlook ya avisó del cambio a los invitados.'
            : res.outlook === 'error'
              ? '⚠ No se pudo actualizar en Outlook; avisa a los invitados o pide a un administrador que lo reintente.'
              : `Antes: ${salaActual}, ${textoReunion(r.inicio, r.fin)}.`,
        r: res.reservacion,
        alerta: res.outlook === 'error',
      })
    } catch (e) {
      setFalla(error(e))
      setEnviando(false)
    }
  }

  return (
    <section className="salas-mover" aria-live="polite">
      <div className="salas-mover-cab">
        <strong>Cambiar horario de «{r.motivo}»</strong>
        <button type="button" className="link" onClick={alCancelar}>
          No cambiar
        </button>
      </div>
      <div className="salas-mover-filas">
        <div>
          <span className="salas-mover-etiqueta">Ahora</span>
          <span className="salas-mover-actual">
            {salaActual} · {textoReunion(r.inicio, r.fin)}
          </span>
        </div>
        <span className="salas-mover-flecha" aria-hidden="true">
          →
        </span>
        <div>
          <span className="salas-mover-etiqueta">Nuevo</span>
          {nuevoInicio && nuevoFin && sala ? (
            <span className="salas-mover-nuevo">
              {sala.nombre} · {textoReunion(nuevoInicio.toISOString(), nuevoFin.toISOString())}
            </span>
          ) : (
            <span className="nota">Elige abajo el día y la hora (puedes cambiar de sala y de duración).</span>
          )}
        </div>
      </div>
      {falla && <div className="alerta" role="alert">{falla}</div>}
      <div className="admin-acciones">
        <button type="button" className="btn primario" disabled={!nuevoInicio || enviando} onClick={confirmar}>
          {enviando ? 'Cambiando…' : 'Confirmar cambio'}
        </button>
        <span className="nota">Los invitados reciben la actualización con el horario anterior y el nuevo.</span>
      </div>
    </section>
  )
}

type Modo = { tipo: 'reservar'; sala: Sala; inicio: Date; fin: Date } | { tipo: 'solicitar'; objetivo: Reservacion; sala: string }

/** Datos de la reunión: para reservar un horario libre o para pedir uno ocupado. */
function FormReunion({ perfil, modo, alTerminar, alCerrar }: { perfil: Perfil; modo: Modo; alTerminar: (h: Hecho) => void; alCerrar: () => void }) {
  const [motivo, setMotivo] = useState('')
  const [personas, setPersonas] = useState('2')
  const [invitados, setInvitados] = useState<string[]>([])
  const [enlaceReunion, setEnlaceReunion] = useState('')
  const [notas, setNotas] = useState('')
  const [mensaje, setMensaje] = useState('')
  const [otro, setOtro] = useState(false)
  const [respNombre, setRespNombre] = useState(perfil.nombre)
  const [respEmail, setRespEmail] = useState(perfil.email)
  const [enviando, setEnviando] = useState(false)
  const [falla, setFalla] = useState('')
  const solicitud = modo.tipo === 'solicitar'
  const conOutlook = modo.tipo === 'reservar' ? Boolean(modo.sala.calendario_id) : true
  const horario = modo.tipo === 'reservar' ? textoReunion(modo.inicio.toISOString(), modo.fin.toISOString()) : textoReunion(modo.objetivo.inicio, modo.objetivo.fin)
  const due = modo.tipo === 'solicitar' ? responsableDe(modo.objetivo) : null

  async function enviar(e: FormEvent) {
    e.preventDefault()
    setFalla('')
    setEnviando(true)
    const datos = {
      motivo,
      personas: Number(personas),
      invitados: conPendientes('res-invitados', invitados),
      enlace_reunion: enlaceReunion.trim(),
      notas,
      responsable_nombre: otro ? respNombre : perfil.nombre,
      responsable_email: otro ? respEmail : perfil.email,
      app: urlApp(),
    }
    try {
      if (modo.tipo === 'reservar') {
        const res = await salasApi<{ reservacion: Reservacion; outlook: EstadoOutlook; invitados: number }>('reservar', {
          ...datos,
          sala_id: modo.sala.id,
          inicio: modo.inicio.toISOString(),
          fin: modo.fin.toISOString(),
        })
        alTerminar({
          texto: `Listo: ${modo.sala.nombre}, ${horario} · Código ${res.reservacion.codigo}`,
          detalle:
            res.outlook === 'ok'
              ? `Outlook mandó la invitación a ${res.invitados} ${res.invitados === 1 ? 'persona' : 'personas'} y quedó en el calendario de la sala.`
              : res.outlook === 'error'
                ? '⚠ La sala quedó reservada, pero no se pudo copiar a Outlook. Usa los botones de abajo para invitar o pide a un administrador que lo reintente.'
                : 'Agrégala a tu calendario e invita desde ahí:',
          r: res.reservacion,
          alerta: res.outlook === 'error',
        })
      } else {
        const res = await salasApi<{ avisado: boolean }>('solicitar', { ...datos, reservacion_id: modo.objetivo.id, mensaje })
        alTerminar({
          texto: `Solicitud enviada a ${due!.nombre || due!.email}.`,
          detalle: `${res.avisado ? 'Le llegó un correo y' : 'Le'} aparece en la app para aceptar o no. Te avisamos con la respuesta; mira el estado en Solicitudes.`,
        })
      }
    } catch (err) {
      setFalla(error(err))
      setEnviando(false)
    }
  }

  return (
    <form className="salas-form" onSubmit={enviar}>
      <div className="salas-form-cab">
        <h3 className="salas-sub">
          {solicitud ? (
            <>
              Pedir el horario de <strong>{due!.nombre || due!.email}</strong> · {modo.sala}, {horario}
            </>
          ) : (
            <>
              Reservar <strong>{modo.sala.nombre}</strong> · {horario}
            </>
          )}
        </h3>
        <button type="button" className="link" onClick={alCerrar}>
          Cancelar
        </button>
      </div>
      {solicitud && (
        <p className="nota salas-nota-solicitud">
          Ese horario es para «{modo.objetivo.motivo}». Si {due!.nombre || 'la persona'} acepta, su reunión se cancela y la sala queda a tu nombre con estos datos.
        </p>
      )}
      <div className="admin-alta">
        <div className="campo">
          <label htmlFor="res-motivo">Motivo de la reunión</label>
          <input id="res-motivo" type="text" required maxLength={200} value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Junta con cliente ACME" autoFocus />
        </div>
        <div className="campo">
          <label htmlFor="res-personas">Personas</label>
          <input id="res-personas" type="number" min={1} max={100} required value={personas} onChange={(e) => setPersonas(e.target.value)} />
        </div>
      </div>
      <div className="campo">
        <span className="fel-etiqueta">A nombre de</span>
        {otro ? (
          <div className="admin-alta">
            <input aria-label="Nombre" required maxLength={120} value={respNombre} onChange={(e) => setRespNombre(e.target.value)} placeholder="Nombre" />
            <input aria-label="Correo" type="email" required maxLength={200} value={respEmail} onChange={(e) => setRespEmail(e.target.value)} placeholder="correo@empresa.com" />
          </div>
        ) : (
          <div className="salas-a-nombre">
            <span>
              {perfil.nombre || perfil.email} <small>{perfil.email}</small>
            </span>
            <button type="button" className="link" onClick={() => setOtro(true)}>
              Reservo para otra persona
            </button>
          </div>
        )}
        {otro && <small>Esa persona aparece como responsable y recibe la invitación; tú también la recibes.</small>}
      </div>
      <div className="campo">
        <label htmlFor="res-invitados">Invitados (opcional)</label>
        <CampoInvitados id="res-invitados" valor={invitados} onChange={setInvitados} />
        <small>{conOutlook ? 'Escríbelos una sola vez: Outlook les manda la invitación para aceptarla y agregarla a su calendario.' : 'Esta sala no está conectada a Outlook: al reservar podrás agregarla a tu calendario e invitar desde ahí.'}</small>
      </div>
      <div className="campo">
        <label htmlFor="res-enlace">Link de reunión (Meet, Zoom, etc.)</label>
        <input
          id="res-enlace"
          type="url"
          inputMode="url"
          maxLength={500}
          value={enlaceReunion}
          onChange={(e) => setEnlaceReunion(e.target.value)}
          placeholder="https://meet.google.com/… o https://zoom.us/j/…"
        />
        <small>Opcional. Sale en la invitación (ubicación y descripción) y en el detalle de la reservación.</small>
      </div>
      <div className="campo">
        <label htmlFor="res-notas">Notas (opcional)</label>
        <textarea id="res-notas" rows={2} maxLength={1000} value={notas} onChange={(e) => setNotas(e.target.value)} placeholder="Equipo que se necesita, etc." />
      </div>
      {solicitud && (
        <div className="campo">
          <label htmlFor="res-mensaje">Mensaje para {due!.nombre || 'la persona'} (opcional)</label>
          <textarea id="res-mensaje" rows={2} maxLength={500} value={mensaje} onChange={(e) => setMensaje(e.target.value)} placeholder="¿Por qué necesitas ese horario?" />
        </div>
      )}
      {falla && <div className="alerta" role="alert">{falla}</div>}
      <div className="admin-acciones">
        <button type="submit" className="btn primario" disabled={enviando}>
          {enviando ? 'Enviando…' : solicitud ? 'Enviar solicitud' : conOutlook ? 'Reservar y enviar invitaciones' : 'Reservar'}
        </button>
      </div>
    </form>
  )
}

/** Próximas reservaciones: las propias (los administradores de salas ven todas). */
function Reservaciones({ perfil, adminSalas, salas, version, nombreSala, mover, alCambiar }: { perfil: Perfil; adminSalas: boolean; salas: Sala[] | null; version: number; nombreSala: (id: string) => string; mover: (r: Reservacion) => void; alCambiar: (h: Hecho | null) => void }) {
  const [lista, setLista] = useState<Reservacion[] | null>(null)
  const [todas, setTodas] = useState(adminSalas)
  const [salaFiltro, setSalaFiltro] = useState('')

  useEffect(() => {
    let consulta = supabase.from('reservaciones').select('*').eq('estado', 'activa').gte('fin', new Date().toISOString()).order('inicio').limit(200)
    if (!todas) consulta = consulta.or(`creado_por.eq.${perfil.id},responsable_email.eq.${perfil.email}`)
    consulta.then(({ data }) => setLista((data as Reservacion[]) ?? []))
  }, [perfil, todas, version])

  const visibles = (lista ?? []).filter((r) => !salaFiltro || r.sala_id === salaFiltro)
  return (
    <section className="admin-caja">
      <div className="bitacora-cab">
        <h2>{todas ? 'Próximas reservaciones (todas)' : 'Mis próximas reservaciones'}</h2>
        <div className="salas-filtros">
          {(salas?.length ?? 0) > 1 && (
            <select aria-label="Sala" value={salaFiltro} onChange={(e) => setSalaFiltro(e.target.value)}>
              <option value="">Todas las salas</option>
              {salas!.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nombre}
                </option>
              ))}
            </select>
          )}
          {adminSalas && (
            <div className="vista-toggle" role="group" aria-label="Qué reservaciones">
              <button type="button" className={todas ? 'activo' : undefined} aria-pressed={todas} onClick={() => setTodas(true)}>
                Todas
              </button>
              <button type="button" className={!todas ? 'activo' : undefined} aria-pressed={!todas} onClick={() => setTodas(false)}>
                Mías
              </button>
            </div>
          )}
        </div>
      </div>
      {!lista ? (
        <p className="nota">Cargando…</p>
      ) : visibles.length === 0 ? (
        <p className="nota">No hay reservaciones próximas.</p>
      ) : (
        <ul className="admin-lista">
          {visibles.map((r) => (
            <Proxima
              key={r.id}
              r={r}
              perfil={perfil}
              adminSalas={adminSalas}
              sala={nombreSala(r.sala_id)}
              conOutlook={Boolean(salas?.find((s) => s.id === r.sala_id)?.calendario_id)}
              mover={() => mover(r)}
              alCambiar={alCambiar}
            />
          ))}
        </ul>
      )}
    </section>
  )
}

function Proxima({ r, perfil, adminSalas, sala, conOutlook, mover, alCambiar }: { r: Reservacion; perfil: Perfil; adminSalas: boolean; sala: string; conOutlook: boolean; mover: () => void; alCambiar: (h: Hecho | null) => void }) {
  const [confirmando, setConfirmando] = useState(false)
  const [razon, setRazon] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [falla, setFalla] = useState('')
  const [verHistorial, setVerHistorial] = useState(false)
  const [editando, setEditando] = useState(false)
  const resp = responsableDe(r)
  const mia = esMia(r, perfil)
  const puede = mia || adminSalas
  const enOutlook = Boolean(r.outlook_event_id) && !r.sync_error

  async function hacer(accion: 'cancelar' | 'reintentar_outlook') {
    setFalla('')
    setEnviando(true)
    try {
      await salasApi(accion, { id: r.id, razon, app: urlApp() })
      alCambiar(accion === 'cancelar' ? { texto: `Se canceló «${r.motivo}».`, detalle: enOutlook ? 'Outlook avisó a los invitados.' : undefined } : { texto: `«${r.motivo}» ya quedó en Outlook y se mandaron las invitaciones.` })
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
          {sala} · {textoReunion(r.inicio, r.fin)}
        </span>
        <small>
          {[
            r.codigo,
            `${r.personas} ${r.personas === 1 ? 'persona' : 'personas'}`,
            `A nombre de ${resp.nombre || resp.email}`,
            r.origen === 'externo' ? `Externo${r.empresa ? ` · ${r.empresa}` : ''}` : r.creado_por_email.toLowerCase() !== resp.email.toLowerCase() ? `registró ${r.creado_por_nombre || r.creado_por_email}` : '',
            r.invitados.length ? `${r.invitados.length} ${r.invitados.length === 1 ? 'invitado' : 'invitados'}` : '',
          ]
            .filter(Boolean)
            .join(' · ')}
        </small>
        {conOutlook && (
          <small className={enOutlook ? 'salas-estado ok' : 'salas-estado error'}>
            {enOutlook ? '✓ En Outlook, invitaciones enviadas' : '⚠ No se copió a Outlook'}
            {!enOutlook && puede && (
              <button type="button" className="link" disabled={enviando} onClick={() => hacer('reintentar_outlook')}>
                Reintentar
              </button>
            )}
          </small>
        )}
        {!enOutlook && mia && <AgregarCalendario r={r} sala={sala} compacto />}
      </div>
      {puede && (
        <div className="admin-acciones">
          <button type="button" className="btn secundario" disabled={enviando} onClick={mover}>
            Cambiar horario
          </button>
          <button type="button" className="btn secundario" disabled={enviando} onClick={() => setEditando((v) => !v)} aria-expanded={editando}>
            Editar detalles
          </button>
          {confirmando ? (
            <span className="salas-cancelar">
              <input aria-label="Razón (opcional)" placeholder={mia ? 'Razón (opcional)' : 'Razón para el responsable (opcional)'} maxLength={300} value={razon} onChange={(e) => setRazon(e.target.value)} />
              <button type="button" className="btn secundario" onClick={() => setConfirmando(false)}>
                No
              </button>
              <button type="button" className="btn peligro" disabled={enviando} onClick={() => hacer('cancelar')}>
                {enviando ? 'Cancelando…' : 'Sí, cancelar'}
              </button>
            </span>
          ) : (
            <button type="button" className="link peligro" onClick={() => setConfirmando(true)}>
              Cancelar
            </button>
          )}
          <button type="button" className="link" onClick={() => setVerHistorial((v) => !v)}>
            {verHistorial ? 'Ocultar historial' : 'Historial'}
          </button>
        </div>
      )}
      {falla && <div className="alerta" role="alert">{falla}</div>}
      {editando && (
        <EditarDetalles
          inicial={{ motivo: r.motivo, personas: r.personas, invitados: r.invitados, notas: r.notas ?? '', enlace_reunion: r.enlace_reunion ?? '' }}
          guardar={async (cambios) => (await salasApi<{ outlook: EstadoOutlook }>('editar', { id: r.id, ...cambios, app: urlApp() })).outlook}
          alCerrar={() => setEditando(false)}
          alTerminar={(texto, detalle) => {
            setEditando(false)
            alCambiar({ texto, detalle })
          }}
        />
      )}
      {verHistorial && <HistorialReservacion id={r.id} />}
      {!mia && adminSalas && <small className="nota">Como administrador de salas puedes cambiarla o cancelarla; el responsable recibe el aviso.</small>}
      {r.enlace_reunion && (
        <small className="nota">
          Link de reunión:{' '}
          <a href={r.enlace_reunion} target="_blank" rel="noopener noreferrer">
            {r.enlace_reunion}
          </a>
        </small>
      )}
      {r.notas && <small className="nota">Notas: {r.notas}</small>}
    </li>
  )
}
