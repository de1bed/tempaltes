import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { IMG } from '../lib/imagenes'
import { salasPublico, type EstadoOutlook } from '../lib/supabase'
import { CampoInvitados, Calendario, CintaDia, Flecha, HorariosLibres } from './componentes'
import { conMayuscula, conPendientes, DURACIONES, error, minutosDe, textoDuracion, textoReunion } from './util'
import { aFecha, diasHabiles, horariosLibres, local, textoDia, type Bloque } from './tiempo'

// Página pública (sin cuenta) para las personas del edificio que no son de Trevé.
// Se llega con el QR de la sala (#externo/<sala>) y se pide el código impreso en la hoja.
// El enlace de la invitación (#externo/gestion/<token>) permite cambiar el horario o cancelar;
// sin el enlace, se entra con el código de la reservación y el correo (#externo/reservacion).

const CLAVE_DATOS = 'salas-externo:datos'
const leer = <T,>(clave: string, base: T): T => {
  try {
    return { ...base, ...JSON.parse(localStorage.getItem(clave) ?? '{}') }
  } catch {
    return base
  }
}
const guardar = (clave: string, valor: unknown) => {
  try {
    localStorage.setItem(clave, JSON.stringify(valor))
  } catch {
    // Sin almacenamiento: solo no se recuerda.
  }
}
const codigoGuardado = (sala: string) => {
  try {
    return sessionStorage.getItem(`salas-externo:codigo:${sala}`) ?? ''
  } catch {
    return ''
  }
}
const enlacePagina = (ruta: string) => `${window.location.origin}${window.location.pathname}#${ruta}`

function Marco({ titulo, subtitulo, children }: { titulo: string; subtitulo?: string; children: React.ReactNode }) {
  return (
    <div className="inicio admin salas externo">
      <div className="inicio-centro admin-centro">
        <header className="externo-cab">
          <img src={IMG.treveLogo} alt="Trevé" />
          <span className="marca-kicker">SALAS DE JUNTAS</span>
        </header>
        <h1>{titulo}</h1>
        {subtitulo && <p className="admin-intro">{subtitulo}</p>}
        {children}
      </div>
    </div>
  )
}

export function Externo({ ruta: inicial }: { ruta: string }) {
  const [ruta, setRuta] = useState(inicial)
  useEffect(() => {
    const cambio = () => (setRuta(window.location.hash.slice(1)), window.scrollTo(0, 0))
    window.addEventListener('hashchange', cambio)
    return () => window.removeEventListener('hashchange', cambio)
  }, [])
  const gestion = ruta.match(/^externo\/gestion\/([0-9a-f-]{36})$/i)
  if (gestion) return <Gestion key={gestion[1]} token={gestion[1]} />
  if (ruta === 'externo/reservacion') return <Marco titulo="Tu reservación" subtitulo="Para cambiar el horario o cancelar, escribe el código de tu reservación y el correo con que reservaste.">{<EntrarReservacion />}</Marco>
  const salaId = ruta.match(/^externo\/([a-z0-9-]{1,30})$/)?.[1]
  if (!salaId) return <Marco titulo="Enlace no válido" subtitulo="Escanea de nuevo el código QR de la sala." >{null}</Marco>
  return <ReservarExterno salaId={salaId} />
}

function ReservarExterno({ salaId }: { salaId: string }) {
  const [codigo, setCodigo] = useState(() => codigoGuardado(salaId))
  const [sala, setSala] = useState<{ id: string; nombre: string } | null>(null)
  const [revisando, setRevisando] = useState(Boolean(codigoGuardado(salaId)))
  const [falla, setFalla] = useState('')

  async function entrar(valor: string) {
    setFalla('')
    setRevisando(true)
    try {
      const r = await salasPublico<{ sala: { id: string; nombre: string } }>('externo_sala', { sala_id: salaId, codigo: valor })
      try {
        sessionStorage.setItem(`salas-externo:codigo:${salaId}`, valor)
      } catch {
        // Sin almacenamiento: se pide el código al recargar.
      }
      setSala(r.sala)
    } catch (e) {
      setFalla(error(e))
    }
    setRevisando(false)
  }

  useEffect(() => {
    const guardado = codigoGuardado(salaId)
    if (guardado) void entrar(guardado)
    // Solo al abrir la página.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [salaId])

  if (!sala) {
    return (
      <Marco titulo="Reserva de sala" subtitulo="Escribe el código de acceso que está impreso junto al QR de la sala.">
        <form
          className="admin-caja externo-codigo"
          onSubmit={(e) => {
            e.preventDefault()
            void entrar(codigo)
          }}
        >
          <div className="campo">
            <label htmlFor="ext-codigo">Código de acceso</label>
            <input id="ext-codigo" required autoFocus autoComplete="off" autoCapitalize="characters" spellCheck={false} value={codigo} onChange={(e) => setCodigo(e.target.value.toUpperCase())} placeholder="ABCD-EFGH" />
          </div>
          {falla && <div className="alerta" role="alert">{falla}</div>}
          <button type="submit" className="btn primario" disabled={revisando}>
            {revisando ? 'Revisando…' : 'Continuar'}
          </button>
        </form>
        <YaReservaste />
      </Marco>
    )
  }
  return <Agenda sala={sala} codigo={codigoGuardado(salaId) || codigo} />
}

function Agenda({ sala, codigo }: { sala: { id: string; nombre: string }; codigo: string }) {
  const dias = useMemo(() => diasHabiles(), [])
  const [dia, setDia] = useState(dias[0])
  const [duracion, setDuracion] = useState(60)
  const [ocupado, setOcupado] = useState<{ clave: string; bloques: Bloque[]; error?: string } | null>(null)
  const [elegido, setElegido] = useState<number | null>(null)
  const [listo, setListo] = useState<{ codigo: string; inicio: string; fin: string; motivo: string; outlook: EstadoOutlook; gestion: string | null; email: string } | null>(null)
  const [version, setVersion] = useState(0)
  const clave = `${dia}|${version}`

  useEffect(() => {
    let vigente = true
    salasPublico<{ ocupado: Bloque[] }>('externo_disponibilidad', { sala_id: sala.id, codigo, fecha: dia }).then(
      (r) => vigente && setOcupado({ clave, bloques: r.ocupado }),
      (e: unknown) => vigente && setOcupado({ clave, bloques: [], error: error(e) }),
    )
    return () => {
      vigente = false
    }
  }, [sala.id, codigo, dia, clave])

  const cargando = ocupado?.clave !== clave
  const libres = cargando ? [] : horariosLibres(dia, duracion, ocupado!.bloques)
  const iDia = dias.indexOf(dia)

  if (listo) {
    return (
      <Marco titulo="¡Sala reservada!" subtitulo={`${sala.nombre} · ${textoReunion(listo.inicio, listo.fin)}`}>
        <section className="admin-caja">
          <p>
            <strong>«{listo.motivo}»</strong> · Código {listo.codigo}
          </p>
          <p className="nota">
            {listo.outlook === 'ok'
              ? `Te llegó la invitación a ${listo.email} (y a tus invitados). Acéptala para agregarla a tu calendario.`
              : 'Quedó reservada. La invitación por correo no se pudo enviar en este momento; guarda este código.'}
          </p>
          {listo.gestion && (
            <p className="nota">
              Para cambiar el horario o cancelarla usa el enlace de la invitación o este: <a href={listo.gestion}>{listo.gestion}</a>
            </p>
          )}
          <div className="admin-acciones">
            <button type="button" className="btn secundario" onClick={() => (setListo(null), setElegido(null), setVersion((v) => v + 1))}>
              Hacer otra reservación
            </button>
          </div>
        </section>
      </Marco>
    )
  }

  return (
    <Marco titulo={`Reservar ${sala.nombre}`} subtitulo="Lunes a viernes de 7:00 a.m. a 9:00 p.m. Elige día, duración y horario libre.">
      <section className="admin-caja">
        <div className="salas-controles">
          <div className="campo salas-duracion">
            <label htmlFor="ext-duracion">Duración</label>
            <select id="ext-duracion" value={duracion} onChange={(e) => (setDuracion(Number(e.target.value)), setElegido(null))}>
              {DURACIONES.map((d) => (
                <option key={d} value={d}>
                  {textoDuracion(d)}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="salas-panel">
          <Calendario dias={dias} dia={dia} ocupados={new Set()} onElegir={(d) => (setDia(d), setElegido(null))} />
          <div className="salas-dia-panel">
            <div className="salas-dia-cab">
              <Flecha dir="izq" label="Día anterior" disabled={iDia <= 0} onClick={() => (setDia(dias[iDia - 1]), setElegido(null))} />
              <div className="salas-dia-titulo">
                <h2>{sala.nombre}</h2>
                <p>{conMayuscula(textoDia(dia))}</p>
              </div>
              <Flecha dir="der" label="Día siguiente" disabled={iDia < 0 || iDia >= dias.length - 1} onClick={() => (setDia(dias[iDia + 1]), setElegido(null))} />
            </div>
            {!cargando && <CintaDia dia={dia} agenda={ocupado!.bloques.map((b) => ({ ...b, propia: false }))} elegido={elegido} duracion={duracion} />}
            {!cargando && ocupado?.error && <div className="alerta" role="alert">{ocupado.error}</div>}
            <h3 className="salas-sub">Horarios libres ({textoDuracion(duracion)})</h3>
            {cargando ? (
              <p className="nota">Cargando…</p>
            ) : libres.length === 0 ? (
              <p className="nota">No hay horarios libres ese día para esa duración.</p>
            ) : (
              <HorariosLibres libres={libres} elegido={elegido} onElegir={setElegido} />
            )}
          </div>
        </div>
        {elegido !== null && (
          <FormExterno
            key={`${dia}-${elegido}-${duracion}`}
            sala={sala}
            codigo={codigo}
            inicio={aFecha(dia, elegido)}
            fin={new Date(aFecha(dia, elegido).getTime() + duracion * 60_000)}
            alTerminar={setListo}
            alCerrar={() => setElegido(null)}
          />
        )}
      </section>
      <YaReservaste />
    </Marco>
  )
}

/** Acceso a "Tu reservación" desde las páginas de reservar. */
function YaReservaste() {
  return (
    <p className="nota externo-ya">
      ¿Ya reservaste? <a href="#externo/reservacion">Cambia el horario o cancela tu reservación</a> con el código que te llegó por correo.
    </p>
  )
}

/** Código de la reservación + correo → enlace para administrarla. */
function EntrarReservacion() {
  const [codigo, setCodigo] = useState('')
  const [email, setEmail] = useState(() => leer(CLAVE_DATOS, { email: '' }).email)
  const [enviando, setEnviando] = useState(false)
  const [falla, setFalla] = useState('')
  return (
    <form
      className="admin-caja externo-codigo"
      onSubmit={async (e) => {
        e.preventDefault()
        setFalla('')
        setEnviando(true)
        try {
          const r = await salasPublico<{ token: string }>('externo_entrar', { codigo, email })
          window.location.hash = `externo/gestion/${r.token}`
        } catch (err) {
          setFalla(error(err))
          setEnviando(false)
        }
      }}
    >
      <div className="campo">
        <label htmlFor="ext-res-codigo">Código de la reservación</label>
        <input id="ext-res-codigo" required autoFocus autoComplete="off" autoCapitalize="characters" spellCheck={false} value={codigo} onChange={(e) => setCodigo(e.target.value.toUpperCase())} placeholder="SALA-1A2B3C" />
      </div>
      <div className="campo">
        <label htmlFor="ext-res-email">Correo con que reservaste</label>
        <input id="ext-res-email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      {falla && <div className="alerta" role="alert">{falla}</div>}
      <button type="submit" className="btn primario" disabled={enviando}>
        {enviando ? 'Buscando…' : 'Ver mi reservación'}
      </button>
    </form>
  )
}

function FormExterno({
  sala,
  codigo,
  inicio,
  fin,
  alTerminar,
  alCerrar,
}: {
  sala: { id: string; nombre: string }
  codigo: string
  inicio: Date
  fin: Date
  alTerminar: (r: { codigo: string; inicio: string; fin: string; motivo: string; outlook: EstadoOutlook; gestion: string | null; email: string }) => void
  alCerrar: () => void
}) {
  const [datos, setDatos] = useState(() => leer(CLAVE_DATOS, { nombre: '', empresa: '', email: '' }))
  const [motivo, setMotivo] = useState('')
  const [personas, setPersonas] = useState('2')
  const [invitados, setInvitados] = useState<string[]>([])
  const [notas, setNotas] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [falla, setFalla] = useState('')

  async function enviar(e: FormEvent) {
    e.preventDefault()
    setFalla('')
    setEnviando(true)
    guardar(CLAVE_DATOS, datos)
    try {
      const r = await salasPublico<{ reservacion: { codigo: string; inicio: string; fin: string; motivo: string }; outlook: EstadoOutlook; gestion: string | null }>('externo_reservar', {
        sala_id: sala.id,
        codigo,
        inicio: inicio.toISOString(),
        fin: fin.toISOString(),
        motivo,
        personas: Number(personas),
        invitados: conPendientes('ext-invitados', invitados),
        notas,
        ...datos,
        app: enlacePagina(`externo/${sala.id}`),
      })
      alTerminar({ ...r.reservacion, outlook: r.outlook, gestion: r.gestion, email: datos.email })
    } catch (err) {
      setFalla(error(err))
      setEnviando(false)
    }
  }

  return (
    <form className="salas-form" onSubmit={enviar}>
      <div className="salas-form-cab">
        <h3 className="salas-sub">
          Reservar <strong>{sala.nombre}</strong> · {textoReunion(inicio.toISOString(), fin.toISOString())}
        </h3>
        <button type="button" className="link" onClick={alCerrar}>
          Cancelar
        </button>
      </div>
      <div className="admin-alta">
        <div className="campo">
          <label htmlFor="ext-nombre">Tu nombre</label>
          <input id="ext-nombre" required maxLength={120} value={datos.nombre} onChange={(e) => setDatos({ ...datos, nombre: e.target.value })} autoComplete="name" />
        </div>
        <div className="campo">
          <label htmlFor="ext-empresa">Empresa</label>
          <input id="ext-empresa" required maxLength={120} value={datos.empresa} onChange={(e) => setDatos({ ...datos, empresa: e.target.value })} autoComplete="organization" />
        </div>
        <div className="campo">
          <label htmlFor="ext-email">Tu correo</label>
          <input id="ext-email" type="email" required maxLength={200} value={datos.email} onChange={(e) => setDatos({ ...datos, email: e.target.value })} autoComplete="email" />
        </div>
      </div>
      <div className="admin-alta">
        <div className="campo">
          <label htmlFor="ext-motivo">Motivo de la reunión</label>
          <input id="ext-motivo" required maxLength={200} value={motivo} onChange={(e) => setMotivo(e.target.value)} />
        </div>
        <div className="campo">
          <label htmlFor="ext-personas">Personas</label>
          <input id="ext-personas" type="number" min={1} max={100} required value={personas} onChange={(e) => setPersonas(e.target.value)} />
        </div>
      </div>
      <div className="campo">
        <label htmlFor="ext-invitados">Invitados (opcional)</label>
        <CampoInvitados id="ext-invitados" valor={invitados} onChange={setInvitados} />
        <small>Les llega la invitación para aceptarla y agregarla a su calendario. A ti también.</small>
      </div>
      <div className="campo">
        <label htmlFor="ext-notas">Notas (opcional)</label>
        <textarea id="ext-notas" rows={2} maxLength={1000} value={notas} onChange={(e) => setNotas(e.target.value)} />
      </div>
      {falla && <div className="alerta" role="alert">{falla}</div>}
      <div className="admin-acciones">
        <button type="submit" className="btn primario" disabled={enviando}>
          {enviando ? 'Reservando…' : 'Reservar y enviar invitaciones'}
        </button>
      </div>
    </form>
  )
}

interface ReservaExterna {
  codigo: string
  sala_id: string
  sala: string
  inicio: string
  fin: string
  motivo: string
  estado: string
  responsable: { nombre: string; email: string }
  empresa: string | null
  invitados: string[]
}

/** Desde el enlace de la invitación (o con código y correo): ver, cambiar de horario o cancelar, sin cuenta. */
function Gestion({ token }: { token: string }) {
  const [r, setR] = useState<ReservaExterna | null>(null)
  const [maxHoras, setMaxHoras] = useState(4)
  const [falla, setFalla] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [moviendo, setMoviendo] = useState(false)
  const [hecho, setHecho] = useState('')
  const [version, setVersion] = useState(0)
  const [ahora] = useState(() => Date.now())

  useEffect(() => {
    salasPublico<{ reservacion: ReservaExterna; max_horas: number }>('externo_ver', { token }).then(
      (x) => (setR(x.reservacion), setMaxHoras(x.max_horas)),
      (e: unknown) => setFalla(error(e)),
    )
  }, [token, version])

  const vigente = r && r.estado === 'activa' && Date.parse(r.fin) >= ahora

  return (
    <Marco titulo="Tu reservación" subtitulo={r ? `${r.sala} · ${textoReunion(r.inicio, r.fin)}` : undefined}>
      {hecho && (
        <div className="credenciales" role="status">
          <strong>{hecho}</strong>
        </div>
      )}
      <section className="admin-caja">
        {falla && <div className="alerta" role="alert">{falla}</div>}
        {!r ? (
          !falla && <p className="nota">Cargando…</p>
        ) : (
          <>
            <p>
              <strong>«{r.motivo}»</strong> · Código {r.codigo}
            </p>
            <p className="nota">
              A nombre de {r.responsable.nombre} ({r.responsable.email}){r.empresa ? ` · ${r.empresa}` : ''}
              {r.invitados.length ? ` · ${r.invitados.length} ${r.invitados.length === 1 ? 'invitado' : 'invitados'}` : ''}
            </p>
            {r.estado !== 'activa' ? (
              <div className="credenciales">
                <strong>Esta reservación está cancelada.</strong>
              </div>
            ) : !vigente ? (
              <p className="nota">Esta reunión ya pasó.</p>
            ) : (
              !moviendo && (
                <div className="admin-acciones">
                  <button type="button" className="btn primario" disabled={enviando} onClick={() => (setMoviendo(true), setHecho(''))}>
                    Cambiar horario
                  </button>
                  <button
                    type="button"
                    className="btn peligro"
                    disabled={enviando}
                    onClick={async () => {
                      if (!confirm('¿Cancelar la reservación? Tus invitados reciben la cancelación.')) return
                      setEnviando(true)
                      setHecho('')
                      try {
                        await salasPublico('externo_cancelar', { token })
                        setVersion((v) => v + 1)
                      } catch (e) {
                        setFalla(error(e))
                      }
                      setEnviando(false)
                    }}
                  >
                    {enviando ? 'Cancelando…' : 'Cancelar reservación'}
                  </button>
                </div>
              )
            )}
          </>
        )}
      </section>
      {r && vigente && moviendo && (
        <MoverExterno
          r={r}
          token={token}
          maxHoras={maxHoras}
          alCerrar={() => setMoviendo(false)}
          alTerminar={(texto) => (setMoviendo(false), setHecho(texto), setVersion((v) => v + 1))}
        />
      )}
    </Marco>
  )
}

/** Elegir otro día u hora en la misma sala; los invitados reciben la actualización. */
function MoverExterno({ r, token, maxHoras, alCerrar, alTerminar }: { r: ReservaExterna; token: string; maxHoras: number; alCerrar: () => void; alTerminar: (texto: string) => void }) {
  const dias = useMemo(() => diasHabiles(), [])
  const actual = local(new Date(r.inicio)).dia
  const [dia, setDia] = useState(dias.includes(actual) ? actual : dias[0])
  const opciones = useMemo(() => [...new Set([...DURACIONES, minutosDe(r)])].filter((d) => d <= maxHoras * 60).sort((a, b) => a - b), [r, maxHoras])
  const [duracion, setDuracion] = useState(() => (opciones.includes(minutosDe(r)) ? minutosDe(r) : 60))
  const [ocupado, setOcupado] = useState<{ clave: string; bloques: Bloque[]; error?: string } | null>(null)
  const [elegido, setElegido] = useState<number | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [falla, setFalla] = useState('')
  const clave = dia

  useEffect(() => {
    let vigente = true
    salasPublico<{ ocupado: Bloque[] }>('externo_horarios', { token, fecha: dia }).then(
      (x) => vigente && setOcupado({ clave, bloques: x.ocupado }),
      (e: unknown) => vigente && setOcupado({ clave, bloques: [], error: error(e) }),
    )
    return () => {
      vigente = false
    }
  }, [token, dia, clave])

  const cargando = ocupado?.clave !== clave
  const libres = cargando ? [] : horariosLibres(dia, duracion, ocupado!.bloques)
  const iDia = dias.indexOf(dia)
  const nuevoInicio = elegido !== null ? aFecha(dia, elegido) : null
  const nuevoFin = nuevoInicio ? new Date(nuevoInicio.getTime() + duracion * 60_000) : null
  // La reunión actual se dibuja aparte para ubicarla en la cinta.
  const propia = local(new Date(r.inicio)).dia === dia ? [{ inicio: r.inicio, fin: r.fin, propia: true, moviendo: true }] : []

  async function confirmar() {
    if (!nuevoInicio || !nuevoFin) return
    setFalla('')
    setEnviando(true)
    try {
      const x = await salasPublico<{ reservacion: { inicio: string; fin: string }; outlook: EstadoOutlook }>('externo_mover', {
        token,
        inicio: nuevoInicio.toISOString(),
        fin: nuevoFin.toISOString(),
        app: enlacePagina(`externo/${r.sala_id}`),
      })
      alTerminar(
        `Listo: quedó el ${textoReunion(x.reservacion.inicio, x.reservacion.fin).replace(/\.$/, '')}. ` +
          (x.outlook === 'ok' ? 'Tú y tus invitados reciben la actualización por correo.' : 'No se pudo avisar por correo; avisa tú a tus invitados.'),
      )
    } catch (e) {
      setFalla(error(e))
      setEnviando(false)
    }
  }

  return (
    <section className="admin-caja">
      <section className="salas-mover" aria-live="polite">
        <div className="salas-mover-cab">
          <strong>Cambiar horario de «{r.motivo}»</strong>
          <button type="button" className="link" onClick={alCerrar}>
            No cambiar
          </button>
        </div>
        <div className="salas-mover-filas">
          <div>
            <span className="salas-mover-etiqueta">Ahora</span>
            <span className="salas-mover-actual">
              {r.sala} · {textoReunion(r.inicio, r.fin)}
            </span>
          </div>
          <span className="salas-mover-flecha" aria-hidden="true">
            →
          </span>
          <div>
            <span className="salas-mover-etiqueta">Nuevo</span>
            {nuevoInicio && nuevoFin ? (
              <span className="salas-mover-nuevo">
                {r.sala} · {textoReunion(nuevoInicio.toISOString(), nuevoFin.toISOString())}
              </span>
            ) : (
              <span className="nota">Elige abajo el día y la hora.</span>
            )}
          </div>
        </div>
        {falla && <div className="alerta" role="alert">{falla}</div>}
        <div className="admin-acciones">
          <button type="button" className="btn primario" disabled={!nuevoInicio || enviando} onClick={confirmar}>
            {enviando ? 'Cambiando…' : 'Confirmar cambio'}
          </button>
        </div>
      </section>
      <div className="salas-controles">
        <div className="campo salas-duracion">
          <label htmlFor="ext-mov-duracion">Duración</label>
          <select id="ext-mov-duracion" value={duracion} onChange={(e) => (setDuracion(Number(e.target.value)), setElegido(null))}>
            {opciones.map((d) => (
              <option key={d} value={d}>
                {textoDuracion(d)}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="salas-panel">
        <Calendario dias={dias} dia={dia} ocupados={new Set()} onElegir={(d) => (setDia(d), setElegido(null))} />
        <div className="salas-dia-panel">
          <div className="salas-dia-cab">
            <Flecha dir="izq" label="Día anterior" disabled={iDia <= 0} onClick={() => (setDia(dias[iDia - 1]), setElegido(null))} />
            <div className="salas-dia-titulo">
              <h2>{r.sala}</h2>
              <p>{conMayuscula(textoDia(dia))}</p>
            </div>
            <Flecha dir="der" label="Día siguiente" disabled={iDia < 0 || iDia >= dias.length - 1} onClick={() => (setDia(dias[iDia + 1]), setElegido(null))} />
          </div>
          {!cargando && <CintaDia dia={dia} agenda={[...ocupado!.bloques.map((b) => ({ ...b, propia: false })), ...propia]} elegido={elegido} duracion={duracion} />}
          {!cargando && ocupado?.error && <div className="alerta" role="alert">{ocupado.error}</div>}
          <h3 className="salas-sub">Horarios libres ({textoDuracion(duracion)})</h3>
          {cargando ? (
            <p className="nota">Cargando…</p>
          ) : libres.length === 0 ? (
            <p className="nota">No hay horarios libres ese día para esa duración.</p>
          ) : (
            <HorariosLibres libres={libres} elegido={elegido} onElegir={setElegido} />
          )}
        </div>
      </div>
    </section>
  )
}
