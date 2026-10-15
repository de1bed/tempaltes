import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type RefObject } from 'react'
import { CambiarPassword } from '../auth/CambiarPassword'
import { hoyISO } from '../lib/formato'
import { IMG } from '../lib/imagenes'
import { registrar, supabase, type Colaborador, type Perfil } from '../lib/supabase'
import { Avatar, CampoFoto, Directorio } from './Directorio'
import { aniosEsteAnio, MAX_ANIOS, proximas, textoCuando, type Efemeride } from './fechas'
import { capturar, compartir, copiar, descargar, puedeCompartir } from './imagen'
import { Tarjeta } from './plantillas'
import { coincide, FONDOS_CUMPLE, MEDIDAS, TIPOS, type DatosTarjeta, type Tipo } from './tipos'

const CLAVE = 'felicitaciones:v1'
const error = (e: unknown) => (e instanceof Error ? e.message : String(e))

/** Lo que se recuerda entre visitas (en este navegador): último tipo y a quién contactar en despedidas. */
function recordado(): Partial<DatosTarjeta> {
  try {
    return JSON.parse(localStorage.getItem(CLAVE) ?? '{}')
  } catch {
    return {}
  }
}

function datosIniciales(): DatosTarjeta {
  const r = recordado()
  return {
    tipo: r.tipo ?? 'cumpleanos',
    nombre: '',
    puesto: '',
    area: '',
    foto: null,
    fecha: hoyISO(),
    contacto: r.contacto ?? '',
    anios: 1,
    fondo: 0,
    genero: 'o',
  }
}

const TITULO: Record<Tipo, string> = { cumpleanos: 'Cumpleaños', aniversario: 'Aniversario', bienvenida: 'Bienvenida', despedida: 'Despedida' }
const nombreArchivo = (d: DatosTarjeta) => `${TITULO[d.tipo]}${d.tipo === 'aniversario' ? ` ${d.anios}` : ''} - ${d.nombre.trim() || 'Treve'}`

/** Fondo de cumpleaños distinto para cada persona (siempre el mismo para la misma persona). */
const fondoDe = (id: string) => [...id].reduce((s, c) => s + c.charCodeAt(0), 0) % FONDOS_CUMPLE.length

function Buscador({ personas, elegida, onElegir }: { personas: Colaborador[] | null; elegida: Colaborador | null; onElegir: (p: Colaborador | null) => void }) {
  const [texto, setTexto] = useState('')
  const [abierto, setAbierto] = useState(false)
  const [marcado, setMarcado] = useState(0)
  const activas = useMemo(() => (personas ?? []).filter((p) => p.activo), [personas])
  const opciones = useMemo(() => activas.filter((p) => coincide(p, texto)).slice(0, 8), [activas, texto])

  function elegir(p: Colaborador) {
    onElegir(p)
    setTexto('')
    setAbierto(false)
  }

  if (elegida) {
    return (
      <div className="fel-elegida">
        <Avatar foto={elegida.foto} tamano={40} />
        <div className="admin-quien">
          <strong>{elegida.nombre}</strong>
          <span>{[elegida.puesto, elegida.area].filter(Boolean).join(' · ')}</span>
        </div>
        <button type="button" className="btn secundario" onClick={() => onElegir(null)}>
          Cambiar
        </button>
      </div>
    )
  }
  return (
    <div className="fel-buscador">
      <input
        id="fel-persona"
        type="search"
        autoComplete="off"
        role="combobox"
        aria-expanded={abierto}
        aria-controls="fel-opciones"
        placeholder={personas === null ? 'Cargando directorio…' : activas.length ? `Busca entre ${activas.length} personas…` : 'El directorio está vacío'}
        value={texto}
        onChange={(e) => (setTexto(e.target.value), setAbierto(true), setMarcado(0))}
        onFocus={() => setAbierto(true)}
        onBlur={() => setTimeout(() => setAbierto(false), 150)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault()
            setMarcado((m) => Math.min(m + 1, opciones.length - 1))
          } else if (e.key === 'ArrowUp') {
            e.preventDefault()
            setMarcado((m) => Math.max(m - 1, 0))
          } else if (e.key === 'Enter' && opciones[marcado]) {
            e.preventDefault()
            elegir(opciones[marcado])
          } else if (e.key === 'Escape') setAbierto(false)
        }}
      />
      {abierto && opciones.length > 0 && (
        <ul id="fel-opciones" className="fel-opciones" role="listbox">
          {opciones.map((p, i) => (
            <li key={p.id} role="option" aria-selected={i === marcado}>
              <button type="button" className={i === marcado ? 'marcada' : undefined} onMouseDown={(e) => e.preventDefault()} onClick={() => elegir(p)}>
                <Avatar foto={p.foto} tamano={32} />
                <span>
                  <strong>{p.nombre}</strong>
                  <small>{[p.puesto, p.area].filter(Boolean).join(' · ')}</small>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/** Vista previa escalada al ancho disponible (la tarjeta se dibuja a tamaño real). */
function Vista({ datos, tarjeta }: { datos: DatosTarjeta; tarjeta: RefObject<HTMLDivElement | null> }) {
  const caja = useRef<HTMLDivElement>(null)
  const [ancho, setAncho] = useState(420)
  useEffect(() => {
    const el = caja.current
    if (!el) return
    const obs = new ResizeObserver(([e]) => setAncho(e.contentRect.width))
    obs.observe(el)
    return () => obs.disconnect()
  }, [])
  const { ancho: w, alto: h } = MEDIDAS[datos.tipo]
  const escala = Math.min(ancho / w, 640 / h)
  return (
    <div ref={caja} className="fel-vista">
      <div className="fel-vista-hoja" style={{ width: w * escala, height: h * escala }}>
        <div style={{ transform: `scale(${escala})`, transformOrigin: '0 0' }}>
          <Tarjeta ref={tarjeta} datos={datos} />
        </div>
      </div>
    </div>
  )
}

function Proximas({ lista, usar }: { lista: Efemeride<Colaborador>[]; usar: (e: Efemeride<Colaborador>) => void }) {
  if (lista.length === 0) return null
  return (
    <div className="fel-proximas">
      <h3 className="salas-sub">Próximas fechas (30 días)</h3>
      <ul>
        {lista.map((e) => (
          <li key={`${e.tipo}-${e.persona.id}`}>
            <button type="button" onClick={() => usar(e)} className={e.dias === 0 ? 'hoy' : undefined}>
              <Avatar foto={e.persona.foto} tamano={32} />
              <span>
                <strong>{e.persona.nombre}</strong>
                <small>
                  {e.tipo === 'cumpleanos' ? 'Cumpleaños' : `${e.anios} ${e.anios === 1 ? 'año' : 'años'} en Treve`}
                  {e.tipo === 'aniversario' && e.anios! > MAX_ANIOS && ' (sin diseño)'}
                </small>
              </span>
              <em>{textoCuando(e.fecha, e.dias)}</em>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

/** Felicitaciones: cumpleaños, aniversarios, bienvenidas y despedidas con las plantillas de Treve. */
export function Felicitaciones({ perfil, irAInicio, salir }: { perfil: Perfil; irAInicio: () => void; salir: () => void }) {
  const [vista, setVista] = useState<'crear' | 'directorio'>('crear')
  const [personas, setPersonas] = useState<Colaborador[] | null>(null)
  const [problemaCarga, setProblemaCarga] = useState('')
  const [version, setVersion] = useState(0)
  const [datos, setDatos] = useState<DatosTarjeta>(datosIniciales)
  const [elegida, setElegida] = useState<Colaborador | null>(null)
  const [ocupado, setOcupado] = useState('')
  const [aviso, setAviso] = useState<{ ok: boolean; texto: string } | null>(null)
  const tarjeta = useRef<HTMLDivElement>(null)
  const compartible = useMemo(() => puedeCompartir(), [])

  useEffect(() => {
    supabase
      .from('colaboradores')
      .select('id, nombre, puesto, area, foto, nacimiento, ingreso, activo')
      .order('nombre')
      .then(({ data, error: err }) => {
        if (err) setProblemaCarga(`No se pudo cargar el directorio: ${err.message}`)
        setPersonas((data as Colaborador[]) ?? [])
      })
  }, [version])

  const recargar = useCallback(() => setVersion((v) => v + 1), [])
  const hoy = hoyISO()
  const efemerides = useMemo(() => proximas((personas ?? []).filter((p) => p.activo), hoy), [personas, hoy])

  const cambiar = (c: Partial<DatosTarjeta>) => {
    setAviso(null)
    setDatos((d) => {
      const nuevo = { ...d, ...c }
      try {
        localStorage.setItem(CLAVE, JSON.stringify({ tipo: nuevo.tipo, contacto: nuevo.contacto }))
      } catch {
        // Sin almacenamiento (ventana privada): solo no se recuerda.
      }
      return nuevo
    })
  }

  /** Llena la tarjeta con los datos de la persona del directorio. */
  function elegir(p: Colaborador | null, extra: Partial<DatosTarjeta> = {}) {
    setElegida(p)
    if (!p) return cambiar({ nombre: '', puesto: '', area: '', foto: null, ...extra })
    cambiar({
      nombre: p.nombre,
      puesto: p.puesto,
      area: p.area,
      foto: p.foto,
      fondo: fondoDe(p.id),
      anios: p.ingreso ? Math.min(MAX_ANIOS, aniosEsteAnio(p.ingreso, hoy)) : datos.anios,
      ...extra,
    })
  }

  async function guardarFotoEnDirectorio() {
    if (!elegida) return
    const { error: err } = await supabase.from('colaboradores').update({ foto: datos.foto }).eq('id', elegida.id)
    if (err) return setAviso({ ok: false, texto: `No se pudo guardar la foto: ${err.message}` })
    setElegida({ ...elegida, foto: datos.foto })
    setAviso({ ok: true, texto: 'La foto quedó guardada en el directorio.' })
    recargar()
  }

  async function generar(accion: 'descargar' | 'copiar' | 'compartir') {
    if (!tarjeta.current) return
    setOcupado(accion)
    setAviso(null)
    try {
      const blob = await capturar(tarjeta.current, MEDIDAS[datos.tipo].escala)
      const nombre = nombreArchivo(datos)
      if (accion === 'descargar') descargar(blob, nombre)
      if (accion === 'copiar') await copiar(blob)
      if (accion === 'compartir') await compartir(blob, nombre)
      registrar('felicitacion', {
        plantilla: datos.tipo,
        documento: nombre,
        detalle: { tipo: datos.tipo, nombre: datos.nombre, puesto: datos.puesto, area: datos.area, anios: datos.anios, fecha: datos.fecha, contacto: datos.contacto },
      })
      if (accion === 'copiar') setAviso({ ok: true, texto: 'Imagen copiada. Pégala en el chat o correo.' })
    } catch (e) {
      // Cerrar el menú de compartir no es un error.
      if (!(e instanceof DOMException && e.name === 'AbortError')) {
        setAviso({ ok: false, texto: accion === 'copiar' ? 'Este navegador no deja copiar imágenes. Usa "Descargar imagen".' : `No se pudo generar la imagen: ${error(e)}` })
      }
    }
    setOcupado('')
  }

  const faltaNombre = !datos.nombre.trim()
  const fotoCambiada = elegida && datos.foto && datos.foto !== elegida.foto

  return (
    <div className="inicio admin salas fel">
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
        <div className="fel-titulo">
          <div>
            <h1>Felicitaciones</h1>
            <p className="admin-intro">Cumpleaños, aniversarios, bienvenidas y despedidas con las plantillas de Treve.</p>
          </div>
          <div className="vista-toggle" role="group" aria-label="Vista">
            <button type="button" className={vista === 'crear' ? 'activo' : undefined} aria-pressed={vista === 'crear'} onClick={() => setVista('crear')}>
              Crear
            </button>
            <button type="button" className={vista === 'directorio' ? 'activo' : undefined} aria-pressed={vista === 'directorio'} onClick={() => setVista('directorio')}>
              Directorio{personas ? ` (${personas.filter((p) => p.activo).length})` : ''}
            </button>
          </div>
        </div>
        {problemaCarga && <div className="alerta" role="alert">{problemaCarga}</div>}

        {vista === 'directorio' ? (
          <Directorio personas={personas} recargar={recargar} usar={(p) => (elegir(p), setVista('crear'))} />
        ) : (
          <section className="admin-caja">
            <div className="fel-panel">
              <div className="fel-form">
                <Proximas
                  lista={efemerides}
                  usar={(e) => elegir(e.persona, e.tipo === 'aniversario' ? { tipo: 'aniversario', anios: Math.min(MAX_ANIOS, e.anios!) } : { tipo: 'cumpleanos' })}
                />

                <div className="fel-tipos" role="group" aria-label="Tipo">
                  {TIPOS.map((t) => (
                    <button key={t.id} type="button" className={datos.tipo === t.id ? 'activo' : undefined} aria-pressed={datos.tipo === t.id} onClick={() => cambiar({ tipo: t.id })} style={{ '--tipo': t.color } as CSSProperties}>
                      {t.titulo}
                    </button>
                  ))}
                </div>

                <div className="campo">
                  <label htmlFor="fel-persona">¿Para quién?</label>
                  <Buscador personas={personas} elegida={elegida} onElegir={(p) => elegir(p)} />
                  {personas?.length === 0 && (
                    <small>
                      Agrega personas en{' '}
                      <button type="button" className="link" onClick={() => setVista('directorio')}>
                        Directorio
                      </button>{' '}
                      o escribe los datos aquí abajo.
                    </small>
                  )}
                </div>

                <div className="fel-campos">
                  <div className="campo fel-ancho">
                    <label htmlFor="fel-nombre">Nombre</label>
                    <input id="fel-nombre" value={datos.nombre} onChange={(e) => cambiar({ nombre: e.target.value })} placeholder="Nombre Apellido Apellido" />
                  </div>
                  <div className="campo">
                    <label htmlFor="fel-puesto">Puesto</label>
                    <input id="fel-puesto" value={datos.puesto} onChange={(e) => cambiar({ puesto: e.target.value })} />
                  </div>
                  <div className="campo">
                    <label htmlFor="fel-area">{datos.tipo === 'bienvenida' ? 'Equipo' : 'Área o unidad'}</label>
                    <input id="fel-area" value={datos.area} onChange={(e) => cambiar({ area: e.target.value })} />
                  </div>

                  {datos.tipo === 'aniversario' && (
                    <div className="campo">
                      <label htmlFor="fel-anios">Años</label>
                      <select id="fel-anios" value={datos.anios} onChange={(e) => cambiar({ anios: Number(e.target.value) })}>
                        {Array.from({ length: MAX_ANIOS }, (_, i) => i + 1).map((n) => (
                          <option key={n} value={n}>
                            {n} {n === 1 ? 'año' : 'años'}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                  {datos.tipo === 'bienvenida' && (
                    <div className="campo">
                      <span className="fel-etiqueta">Texto vertical</span>
                      <div className="vista-toggle" role="group" aria-label="Texto vertical">
                        {(['o', 'a'] as const).map((g) => (
                          <button key={g} type="button" className={datos.genero === g ? 'activo' : undefined} aria-pressed={datos.genero === g} onClick={() => cambiar({ genero: g })}>
                            Bienvenid{g}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  {datos.tipo === 'despedida' && (
                    <>
                      <div className="campo">
                        <label htmlFor="fel-fecha">A partir del</label>
                        <input id="fel-fecha" type="date" value={datos.fecha} onChange={(e) => cambiar({ fecha: e.target.value })} />
                      </div>
                      <div className="campo">
                        <label htmlFor="fel-contacto">Pendientes con</label>
                        <input id="fel-contacto" value={datos.contacto} onChange={(e) => cambiar({ contacto: e.target.value })} placeholder="Nombre de quien atiende" list="fel-contactos" />
                        <datalist id="fel-contactos">
                          {(personas ?? []).filter((p) => p.activo).map((p) => (
                            <option key={p.id} value={p.nombre} />
                          ))}
                        </datalist>
                      </div>
                    </>
                  )}
                </div>

                {datos.tipo === 'cumpleanos' && (
                  <div className="campo">
                    <span className="fel-etiqueta">Diseño</span>
                    <div className="fel-fondos">
                      {FONDOS_CUMPLE.map((f, i) => (
                        <button key={f} type="button" className={datos.fondo === i ? 'activo' : undefined} aria-pressed={datos.fondo === i} aria-label={`Diseño ${i + 1}`} onClick={() => cambiar({ fondo: i })}>
                          <img src={f} alt="" />
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="campo">
                  <span className="fel-etiqueta">Foto</span>
                  <CampoFoto id="fel-foto" foto={datos.foto} onFoto={(foto) => cambiar({ foto })} />
                  {fotoCambiada && (
                    <button type="button" className="link fel-guardar-foto" onClick={guardarFotoEnDirectorio}>
                      Guardar esta foto en el directorio para {elegida.nombre.split(' ')[0]}
                    </button>
                  )}
                </div>
              </div>

              <div className="fel-derecha">
                <Vista datos={datos} tarjeta={tarjeta} />
                <div className="fel-acciones">
                  <button type="button" className="btn primario" disabled={!!ocupado || faltaNombre} onClick={() => generar('descargar')}>
                    {ocupado === 'descargar' ? 'Generando…' : 'Descargar imagen'}
                  </button>
                  <button type="button" className="btn secundario" disabled={!!ocupado || faltaNombre} onClick={() => generar('copiar')}>
                    {ocupado === 'copiar' ? 'Copiando…' : 'Copiar'}
                  </button>
                  {compartible && (
                    <button type="button" className="btn secundario" disabled={!!ocupado || faltaNombre} onClick={() => generar('compartir')}>
                      Compartir
                    </button>
                  )}
                </div>
                {faltaNombre && <p className="nota">Elige a la persona o escribe su nombre para descargar.</p>}
                {aviso && (
                  <div className={aviso.ok ? 'credenciales fel-aviso' : 'alerta'} role="status">
                    {aviso.texto}
                  </div>
                )}
              </div>
            </div>
          </section>
        )}
      </div>
    </div>
  )
}
