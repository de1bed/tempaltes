import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { IMG } from '../lib/imagenes'
import { salasPublico, type EstadoOutlook } from '../lib/supabase'
import { CampoInvitados, Calendario, CintaDia, Flecha, HorariosLibres } from './componentes'
import { conMayuscula, conPendientes, DURACIONES, error, textoDuracion, textoReunion } from './util'
import { aFecha, diasHabiles, horariosLibres, textoDia, type Bloque } from './tiempo'

// Página pública (sin cuenta) para las personas del edificio que no son de Trevé.
// Se llega con el QR de la sala (#externo/<sala>) y se pide el código impreso en la hoja.
// El enlace de la invitación (#externo/gestion/<token>) permite cancelar.

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

export function Externo({ ruta }: { ruta: string }) {
  const gestion = ruta.match(/^externo\/gestion\/([0-9a-f-]{36})$/i)
  if (gestion) return <Gestion token={gestion[1]} />
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
              Para cancelarla usa el enlace de la invitación o este: <a href={listo.gestion}>{listo.gestion}</a>
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
    </Marco>
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

/** Desde el enlace de la invitación: ver y cancelar la reservación, sin cuenta. */
function Gestion({ token }: { token: string }) {
  const [r, setR] = useState<{ codigo: string; sala: string; inicio: string; fin: string; motivo: string; estado: string; responsable: { nombre: string; email: string }; empresa: string | null; invitados: string[] } | null>(null)
  const [falla, setFalla] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [version, setVersion] = useState(0)
  const [ahora] = useState(() => Date.now())

  useEffect(() => {
    salasPublico<{ reservacion: NonNullable<typeof r> }>('externo_ver', { token }).then(
      (x) => setR(x.reservacion),
      (e: unknown) => setFalla(error(e)),
    )
  }, [token, version])

  return (
    <Marco titulo="Tu reservación" subtitulo={r ? `${r.sala} · ${textoReunion(r.inicio, r.fin)}` : undefined}>
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
            ) : Date.parse(r.fin) < ahora ? (
              <p className="nota">Esta reunión ya pasó.</p>
            ) : (
              <div className="admin-acciones">
                <button
                  type="button"
                  className="btn peligro"
                  disabled={enviando}
                  onClick={async () => {
                    if (!confirm('¿Cancelar la reservación? Tus invitados reciben la cancelación.')) return
                    setEnviando(true)
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
                <span className="nota">Para cambiar de horario, cancela y vuelve a reservar con el QR de la sala.</span>
              </div>
            )}
          </>
        )}
      </section>
    </Marco>
  )
}
