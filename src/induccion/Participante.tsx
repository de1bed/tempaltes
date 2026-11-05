import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { IMG } from '../lib/imagenes'
import { limpiarCodigo } from '../../supabase/functions/induccion/logica'
import { codigoLegible, induccionPublico, type EstadoParticipante, type ResumenIntento } from './api'
import { descargarConstancia } from './constancia'
import { Reproductor } from './Reproductor'
import './induccion.css'

// Página pública (sin cuenta) para tomar la inducción: se llega con el QR o el enlace de la sesión
// (#induccion/<CODIGO>) o se escribe el código en #induccion. El avance se guarda en el servidor y
// el navegador recuerda a la persona para retomar donde se quedó.

const claveToken = (codigo: string) => `induccion:${codigo}`
function leerToken(codigo: string): string | null {
  try {
    return localStorage.getItem(claveToken(codigo))
  } catch {
    return null
  }
}
function guardarToken(codigo: string, token: string) {
  try {
    localStorage.setItem(claveToken(codigo), token)
  } catch {
    // Sin almacenamiento: para retomar hay que volver a escribir el nombre (grupo) o el código (individual).
  }
}

const error = (e: unknown) => (e instanceof Error ? e.message : String(e))

function Marco({ ancho, children }: { ancho?: boolean; children: ReactNode }) {
  return (
    <div className="inicio admin induccion-publica">
      <div className={ancho ? 'inicio-centro ind-centro-ancho' : 'inicio-centro admin-centro ind-centro'}>
        <header className="externo-cab">
          <img src={IMG.treveLogo} alt="Trevé" />
          <span className="marca-kicker">INDUCCIÓN</span>
        </header>
        {children}
      </div>
    </div>
  )
}

type Respuesta = EstadoParticipante | { pedir_nombre: { grupo: string; titulo: string; incluye_contenido: boolean } }

export function Participante({ ruta }: { ruta: string }) {
  const deRuta = limpiarCodigo(ruta.split('/')[1] ?? '')
  const [codigo, setCodigo] = useState(deRuta)
  const [estado, setEstado] = useState<EstadoParticipante | null>(null)
  const [pedir, setPedir] = useState<{ grupo: string; titulo: string; incluye_contenido: boolean } | null>(null)
  const [nombre, setNombre] = useState('')
  const [correo, setCorreo] = useState('')
  const [falla, setFalla] = useState('')
  const [ocupado, setOcupado] = useState(deRuta.length === 6)

  async function entrar(cod: string, datos: Record<string, unknown> = {}) {
    setFalla('')
    setOcupado(true)
    try {
      const r = await induccionPublico<Respuesta>('entrar', { codigo: cod, token: leerToken(cod), ...datos })
      if ('pedir_nombre' in r) setPedir(r.pedir_nombre)
      else {
        guardarToken(cod, r.participante.token)
        setEstado(r)
        if (window.location.hash !== `#induccion/${cod}`) history.replaceState(null, '', `#induccion/${cod}`)
      }
    } catch (e) {
      setFalla(error(e))
    }
    setOcupado(false)
  }

  // Con el código en la dirección (QR o enlace) se entra solo.
  const inicial = useRef(deRuta)
  useEffect(() => {
    if (inicial.current.length === 6) void entrar(inicial.current)
  }, [])

  if (estado) return <Curso estado={estado} setEstado={setEstado} />

  if (pedir)
    return (
      <Marco>
        <h1>{pedir.titulo}</h1>
        <p className="admin-intro">
          Sesión: <strong>{pedir.grupo}</strong>. {pedir.incluye_contenido ? 'Verás la presentación y los videos y al final contestarás un cuestionario.' : 'Contesta el cuestionario de lo que se presentó.'}
        </p>
        <form
          className="admin-caja"
          onSubmit={(e: FormEvent) => {
            e.preventDefault()
            void entrar(codigo, { nombre, correo })
          }}
        >
          <div className="campo">
            <label htmlFor="ind-nombre">Tu nombre completo</label>
            <input id="ind-nombre" autoComplete="name" value={nombre} onChange={(e) => setNombre(e.target.value)} required minLength={3} maxLength={120} autoFocus />
          </div>
          <div className="campo">
            <label htmlFor="ind-correo">Tu correo (opcional)</label>
            <input id="ind-correo" type="email" autoComplete="email" value={correo} onChange={(e) => setCorreo(e.target.value)} maxLength={200} />
          </div>
          {falla && <div className="alerta" role="alert">{falla}</div>}
          <div className="admin-acciones">
            <button type="submit" className="btn primario" disabled={ocupado}>
              {ocupado ? 'Entrando…' : 'Comenzar'}
            </button>
          </div>
        </form>
      </Marco>
    )

  return (
    <Marco>
      <h1>Inducción TREVÉ</h1>
      <p className="admin-intro">Escribe el código que te dio Recursos Humanos para comenzar tu inducción.</p>
      <form
        className="admin-caja"
        onSubmit={(e: FormEvent) => {
          e.preventDefault()
          const c = limpiarCodigo(codigo)
          if (c.length !== 6) return setFalla('El código tiene 6 caracteres.')
          setCodigo(c)
          void entrar(c)
        }}
      >
        <div className="campo">
          <label htmlFor="ind-codigo">Código</label>
          <input
            id="ind-codigo"
            className="ind-codigo-campo"
            value={codigo.length === 6 ? codigoLegible(codigo) : codigo}
            onChange={(e) => setCodigo(limpiarCodigo(e.target.value).slice(0, 6))}
            autoCapitalize="characters"
            autoComplete="off"
            spellCheck={false}
            placeholder="ABC-234"
            autoFocus
          />
        </div>
        {falla && <div className="alerta" role="alert">{falla}</div>}
        <div className="admin-acciones">
          <button type="submit" className="btn primario" disabled={ocupado}>
            {ocupado ? 'Revisando…' : 'Entrar'}
          </button>
        </div>
      </form>
    </Marco>
  )
}

type Vista = 'contenido' | 'cuestionario' | 'resultado'

function vistaInicial(e: EstadoParticipante): Vista {
  if (e.participante.aprobado_en) return 'resultado'
  if (e.sesion.incluye_contenido && !e.participante.contenido_terminado) return 'contenido'
  if (e.ultimo) return 'resultado'
  return 'cuestionario'
}

function Curso({ estado, setEstado }: { estado: EstadoParticipante; setEstado: (e: EstadoParticipante) => void }) {
  const { participante: yo, curso, sesion } = estado
  const [vista, setVista] = useState<Vista>(() => vistaInicial(estado))
  const pasos = curso.pasos
  const [pos, setPos] = useState(() => {
    const paso = Math.min(yo.paso, Math.max(0, pasos.length - 1))
    return { paso, pagina: yo.paso === paso ? yo.pagina : 0 }
  })
  const [vistos, setVistos] = useState(yo.videos_vistos)
  const [falla, setFalla] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const arriba = useRef<HTMLDivElement>(null)

  // Guarda dónde va (con una pausa, para no mandar una llamada por cada diapositiva).
  const pendiente = useRef<number | undefined>(undefined)
  useEffect(() => {
    if (vista !== 'contenido' || !sesion.vigente) return
    clearTimeout(pendiente.current)
    pendiente.current = window.setTimeout(() => {
      induccionPublico('avance', { token: yo.token, paso: pos.paso, pagina: pos.pagina }).catch(() => {})
    }, 1500)
    return () => clearTimeout(pendiente.current)
  }, [pos, vista, yo.token, sesion.vigente])

  function mover(paso: number, pagina: number) {
    setFalla('')
    setPos({ paso, pagina })
    if (paso !== pos.paso) arriba.current?.scrollIntoView({ block: 'start' })
  }

  function videoVisto(id: string) {
    setVistos((v) => (v.includes(id) ? v : [...v, id]))
    induccionPublico('avance', { token: yo.token, paso: pos.paso, pagina: 0, video: id }).catch(() => {})
  }

  async function terminarContenido() {
    setFalla('')
    if (yo.contenido_terminado) return (setVista('cuestionario'), window.scrollTo(0, 0))
    setOcupado(true)
    try {
      clearTimeout(pendiente.current)
      const r = await induccionPublico<{ contenido_terminado: string | null }>('avance', { token: yo.token, paso: pasos.length, pagina: 0 })
      setEstado({ ...estado, participante: { ...yo, contenido_terminado: r.contenido_terminado ?? new Date().toISOString(), videos_vistos: vistos } })
      setVista('cuestionario')
      window.scrollTo(0, 0)
    } catch (e) {
      setFalla(error(e))
    }
    setOcupado(false)
  }

  if (!sesion.vigente && !yo.aprobado_en)
    return (
      <Marco>
        <h1>La sesión se cerró</h1>
        <p className="admin-intro">Esta sesión de inducción ya no está abierta. Pide un código nuevo a Recursos Humanos para terminar.</p>
      </Marco>
    )

  if (vista === 'contenido')
    return (
      <Marco ancho>
        <div ref={arriba} className="ind-titulo">
          <h1>{curso.titulo}</h1>
          <span className="ind-hola">Hola, {yo.nombre}</span>
        </div>
        {pasos.length === 0 ? (
          <div className="admin-caja">
            <p className="nota">La presentación todavía no está lista. Puedes pasar al cuestionario.</p>
            <div className="admin-acciones">
              <button type="button" className="btn primario" onClick={terminarContenido} disabled={ocupado}>
                Ir al cuestionario →
              </button>
            </div>
          </div>
        ) : (
          <Reproductor pasos={pasos} paso={pos.paso} pagina={pos.pagina} vistos={vistos} exigirVideos mover={mover} videoVisto={videoVisto} alTerminar={terminarContenido} textoFinal="Ir al cuestionario" />
        )}
        {falla && <div className="alerta ind-falla" role="alert">{falla}</div>}
      </Marco>
    )

  if (vista === 'cuestionario')
    return (
      <Marco>
        <Cuestionario
          estado={estado}
          alTerminar={(r) => {
            setEstado({
              ...estado,
              participante: { ...yo, intentos: yo.intentos + 1, mejor_calificacion: Math.max(yo.mejor_calificacion ?? 0, r.calificacion), aprobado_en: r.aprobado ? r.fin : null },
              ultimo: r,
            })
            setVista('resultado')
            window.scrollTo(0, 0)
          }}
          repasar={sesion.incluye_contenido && pasos.length > 0 ? () => (setPos({ paso: 0, pagina: 0 }), setVista('contenido')) : undefined}
        />
      </Marco>
    )

  return (
    <Marco>
      <Resultado
        estado={estado}
        repetir={() => (setVista('cuestionario'), window.scrollTo(0, 0))}
        repasar={sesion.incluye_contenido && pasos.length > 0 ? () => (setPos({ paso: 0, pagina: 0 }), setVista('contenido'), window.scrollTo(0, 0)) : undefined}
      />
    </Marco>
  )
}

function Cuestionario({ estado, alTerminar, repasar }: { estado: EstadoParticipante; alTerminar: (r: ResumenIntento) => void; repasar?: () => void }) {
  const { curso, participante } = estado
  const [respuestas, setRespuestas] = useState<Record<string, number>>({})
  const [inicio] = useState(() => new Date().toISOString())
  const [falla, setFalla] = useState('')
  const [enviando, setEnviando] = useState(false)
  const contestadas = curso.preguntas.filter((q) => respuestas[q.id] !== undefined).length
  const completo = contestadas === curso.preguntas.length

  async function enviar(e: FormEvent) {
    e.preventDefault()
    if (!completo) {
      const falta = curso.preguntas.findIndex((q) => respuestas[q.id] === undefined)
      setFalla(`Te falta contestar la pregunta ${falta + 1}.`)
      document.getElementById(`ind-q-${curso.preguntas[falta].id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      return
    }
    setFalla('')
    setEnviando(true)
    try {
      const r = await induccionPublico<{ resultado: ResumenIntento }>('responder', { token: participante.token, respuestas, inicio })
      alTerminar(r.resultado)
    } catch (err) {
      setFalla(error(err))
    }
    setEnviando(false)
  }

  if (curso.preguntas.length === 0)
    return (
      <>
        <h1>¡Terminaste!</h1>
        <p className="admin-intro">El cuestionario todavía no tiene preguntas. Avísale a Recursos Humanos.</p>
      </>
    )

  return (
    <form onSubmit={enviar} noValidate>
      <h1>Cuestionario</h1>
      <p className="admin-intro">
        {participante.nombre}, contesta las {curso.preguntas.length} preguntas. Necesitas {curso.calificacion_minima} de 100 para aprobar.
        {participante.intentos > 0 && ` Este es tu intento ${participante.intentos + 1}.`}
      </p>
      <ol className="ind-preguntas">
        {curso.preguntas.map((q, i) => (
          <li key={q.id} id={`ind-q-${q.id}`} className="admin-caja">
            <fieldset>
              <legend>
                <span className="ind-num">{i + 1}</span> {q.texto}
              </legend>
              {q.opciones.map((o, j) => (
                <label key={j} className={respuestas[q.id] === j ? 'ind-opcion elegida' : 'ind-opcion'}>
                  <input type="radio" name={q.id} checked={respuestas[q.id] === j} onChange={() => setRespuestas((r) => ({ ...r, [q.id]: j }))} />
                  <span>{o}</span>
                </label>
              ))}
            </fieldset>
          </li>
        ))}
      </ol>
      <div className="ind-enviar">
        <span className="nota">
          Contestadas: {contestadas} de {curso.preguntas.length}
        </span>
        {falla && <div className="alerta" role="alert">{falla}</div>}
        <div className="admin-acciones">
          {repasar && (
            <button type="button" className="btn secundario" onClick={repasar}>
              Repasar la presentación
            </button>
          )}
          <button type="submit" className="btn primario" disabled={enviando}>
            {enviando ? 'Calificando…' : 'Enviar respuestas'}
          </button>
        </div>
      </div>
    </form>
  )
}

function Resultado({ estado, repetir, repasar }: { estado: EstadoParticipante; repetir: () => void; repasar?: () => void }) {
  const { participante: yo, curso, ultimo, sesion } = estado
  const [falla, setFalla] = useState('')
  const aprobado = Boolean(yo.aprobado_en)
  const calificacion = aprobado ? (yo.mejor_calificacion ?? ultimo?.calificacion ?? 0) : (ultimo?.calificacion ?? 0)
  const puedeRepetir = !aprobado && curso.permite_repetir && sesion.vigente

  return (
    <>
      <div className={aprobado ? 'ind-resultado aprobado' : 'ind-resultado'}>
        <div className="ind-calif">
          <strong>{calificacion}</strong>
          <span>de 100</span>
        </div>
        <div>
          <h1>{aprobado ? `¡Felicidades, ${yo.nombre.split(' ')[0]}!` : 'Todavía no apruebas'}</h1>
          <p className="admin-intro">
            {aprobado
              ? `Aprobaste “${curso.titulo}”. ¡Te damos la bienvenida a TREVÉ!`
              : ultimo
                ? `Acertaste ${ultimo.aciertos} de ${ultimo.total}. Necesitas ${curso.calificacion_minima} de 100.`
                : ''}
          </p>
        </div>
      </div>
      {aprobado && (
        <div className="admin-caja">
          <p className="nota">Descarga tu constancia y guárdala. Recursos Humanos también tiene registrado tu resultado.</p>
          {falla && <div className="alerta" role="alert">{falla}</div>}
          <div className="admin-acciones">
            <button
              type="button"
              className="btn primario"
              onClick={() => descargarConstancia({ nombre: yo.nombre, curso: curso.titulo, calificacion, fecha: yo.aprobado_en! }).catch((e) => setFalla(error(e)))}
            >
              Descargar constancia (PDF)
            </button>
          </div>
        </div>
      )}
      {!aprobado && ultimo && ultimo.incorrectas.length > 0 && (
        <div className="admin-caja">
          <h2>Repasa estos temas</h2>
          <ul className="ind-fallas">
            {ultimo.incorrectas.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        </div>
      )}
      {!aprobado && (
        <div className="admin-acciones">
          {repasar && (
            <button type="button" className="btn secundario" onClick={repasar}>
              Repasar la presentación
            </button>
          )}
          {puedeRepetir ? (
            <button type="button" className="btn primario" onClick={repetir}>
              Volver a intentar
            </button>
          ) : (
            <p className="nota">Avísale a Recursos Humanos para revisar tu resultado.</p>
          )}
        </div>
      )}
    </>
  )
}
