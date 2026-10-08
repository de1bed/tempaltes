import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { IMG } from '../lib/imagenes'
import { PLANTILLAS, type PlantillaId } from '../lib/modelo'
import { PERMISOS, type Permiso } from '../lib/secciones'
import { adminUsuarios, type Perfil, type Registro, type Usuario } from '../lib/supabase'
import { CambiarPassword } from './CambiarPassword'

/** Contraseña aleatoria fácil de dictar (sin 0/O, 1/l/I). */
function generarPassword(largo = 12): string {
  const letras = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'
  const azar = crypto.getRandomValues(new Uint32Array(largo))
  return Array.from(azar, (n) => letras[n % letras.length]).join('')
}

function fecha(iso: string | null): string {
  if (!iso) return 'Nunca'
  return new Date(iso).toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' })
}

function Casillas({ valor, onChange, deshabilitado }: { valor: Permiso[]; onChange: (v: Permiso[]) => void; deshabilitado?: boolean }) {
  return (
    <div className="casillas">
      {PERMISOS.map((s) => {
        const marcada = valor.includes(s.id)
        return (
          <label key={s.id} className={marcada ? 'casilla permiso marcada' : 'casilla permiso'}>
            <input
              type="checkbox"
              checked={marcada}
              disabled={deshabilitado}
              onChange={() => onChange(marcada ? valor.filter((t) => t !== s.id) : [...valor, s.id])}
            />
            {s.titulo}
          </label>
        )
      })}
    </div>
  )
}

/** Datos para entregar a la persona; la contraseña solo se ve aquí, una vez. */
function Credenciales({ email, password, cerrar }: { email: string; password: string; cerrar: () => void }) {
  const [copiado, setCopiado] = useState(false)
  const texto = `Correo: ${email}\nContraseña: ${password}\nEntra en: ${window.location.origin}`
  return (
    <div className="credenciales" role="status">
      <strong>Comparte estos datos con la persona</strong>
      <span>La contraseña no se vuelve a mostrar. Si se pierde, asigna una nueva.</span>
      <pre>{texto}</pre>
      <div className="admin-acciones">
        <button
          type="button"
          className="btn secundario"
          onClick={() => navigator.clipboard.writeText(texto).then(() => setCopiado(true), () => setCopiado(false))}
        >
          {copiado ? 'Copiado ✓' : 'Copiar'}
        </button>
        <button type="button" className="btn primario" onClick={cerrar}>
          Listo
        </button>
      </div>
    </div>
  )
}

function Alta({ alCrear }: { alCrear: (email: string, password: string) => void }) {
  const [email, setEmail] = useState('')
  const [nombre, setNombre] = useState('')
  const [password, setPassword] = useState(generarPassword)
  const [secciones, setSecciones] = useState<Permiso[]>([])
  const [error, setError] = useState('')
  const [enviando, setEnviando] = useState(false)

  async function crear(e: FormEvent) {
    e.preventDefault()
    setError('')
    setEnviando(true)
    try {
      await adminUsuarios('crear', { email, nombre, password, secciones })
      alCrear(email.trim().toLowerCase(), password)
      setEmail('')
      setNombre('')
      setSecciones([])
      setPassword(generarPassword())
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setEnviando(false)
    }
  }

  return (
    <form className="admin-caja" onSubmit={crear}>
      <h2>Dar de alta</h2>
      <div className="admin-alta">
        <div className="campo">
          <label htmlFor="alta-email">Correo</label>
          <input id="alta-email" type="email" required autoComplete="off" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="campo">
          <label htmlFor="alta-nombre">Nombre</label>
          <input id="alta-nombre" type="text" autoComplete="off" value={nombre} onChange={(e) => setNombre(e.target.value)} />
        </div>
        <div className="campo">
          <label htmlFor="alta-password">Contraseña</label>
          <div className="admin-password">
            <input id="alta-password" type="text" required minLength={8} autoComplete="off" spellCheck={false} value={password} onChange={(e) => setPassword(e.target.value)} />
            <button type="button" className="btn secundario" onClick={() => setPassword(generarPassword())}>
              Generar
            </button>
          </div>
        </div>
      </div>
      <div className="campo">
        <label>Puede entrar a</label>
        <Casillas valor={secciones} onChange={setSecciones} />
      </div>
      {error && <div className="alerta" role="alert">{error}</div>}
      <div className="admin-acciones">
        <button type="submit" className="btn primario" disabled={enviando}>
          {enviando ? 'Creando…' : 'Crear cuenta'}
        </button>
      </div>
    </form>
  )
}

function FilaUsuario({ u, yo, recargar, alCambiarPassword }: { u: Usuario; yo: boolean; recargar: () => Promise<void>; alCambiarPassword: (email: string, password: string) => void }) {
  const [ocupado, setOcupado] = useState(false)
  const [error, setError] = useState('')
  const [confirmando, setConfirmando] = useState(false)

  async function hacer(accion: string, datos: Record<string, unknown>) {
    setError('')
    setOcupado(true)
    try {
      await adminUsuarios(accion, { id: u.id, ...datos })
      await recargar()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setOcupado(false)
    }
  }

  async function nuevaPassword() {
    const password = generarPassword()
    setError('')
    setOcupado(true)
    try {
      await adminUsuarios('cambiar_password', { id: u.id, password })
      alCambiarPassword(u.email, password)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setOcupado(false)
    }
  }

  return (
    <li className={u.activo ? 'admin-usuario' : 'admin-usuario inactivo'}>
      <div className="admin-quien">
        <strong>{u.nombre || u.email}</strong>
        {u.nombre && <span>{u.email}</span>}
        <small>
          {yo ? 'Administrador · ' : !u.activo ? 'Desactivado · ' : ''}Último acceso: {fecha(u.ultimo_acceso)}
        </small>
      </div>
      {yo ? (
        <p className="nota">Acceso a todo.</p>
      ) : (
        <>
          <Casillas valor={u.secciones} deshabilitado={ocupado} onChange={(secciones) => hacer('actualizar', { secciones })} />
          <div className="admin-acciones">
            <button type="button" className="btn secundario" disabled={ocupado} onClick={() => hacer('actualizar', { activo: !u.activo })}>
              {u.activo ? 'Desactivar' : 'Activar'}
            </button>
            <button type="button" className="btn secundario" disabled={ocupado} onClick={nuevaPassword}>
              Nueva contraseña
            </button>
            {confirmando ? (
              <>
                <span className="pregunta">¿Eliminar la cuenta?</span>
                <button type="button" className="btn secundario" onClick={() => setConfirmando(false)}>
                  Cancelar
                </button>
                <button type="button" className="btn peligro" disabled={ocupado} onClick={() => hacer('eliminar', {})}>
                  Sí, eliminar
                </button>
              </>
            ) : (
              <button type="button" className="link peligro" disabled={ocupado} onClick={() => setConfirmando(true)}>
                Eliminar
              </button>
            )}
          </div>
        </>
      )}
      {error && <div className="alerta" role="alert">{error}</div>}
    </li>
  )
}

const ACCIONES: Record<string, string> = {
  pdf: 'Descargó PDF',
  excel: 'Descargó Excel',
  validacion: 'Descargó validación',
  inicio_sesion: 'Inició sesión',
  contrasena_cambiada: 'Cambió su contraseña',
  admin_configurado: 'Configuró la cuenta de administrador',
  cuenta_creada: 'Creó la cuenta',
  cuenta_actualizada: 'Cambió permisos de',
  contrasena_asignada: 'Asignó contraseña nueva a',
  cuenta_eliminada: 'Eliminó la cuenta',
  sala_reservada: 'Reservó sala',
  sala_movida: 'Movió reservación',
  sala_cancelada: 'Canceló reservación',
}

/** Qué hizo cada quien: documentos generados y cambios de cuentas. */
function Bitacora({ usuarios, abrirDocumento }: { usuarios: Usuario[] | null; abrirDocumento: (plantilla: PlantillaId, datos: unknown) => void }) {
  const [filtro, setFiltro] = useState('')
  const [registros, setRegistros] = useState<Registro[] | null>(null)
  const [hayMas, setHayMas] = useState(false)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')

  // Quien llama marca "cargando" antes (en el clic), para no cambiar estado dentro del efecto.
  const cargar = useCallback((usuarioId: string, antesId?: number) => {
    return adminUsuarios<{ registros: Registro[] }>('bitacora', { usuario_id: usuarioId || undefined, antes_id: antesId })
      .then(
        (r) => {
          setRegistros((previos) => (antesId && previos ? [...previos, ...r.registros] : r.registros))
          setHayMas(r.registros.length === 100)
          setError('')
        },
        (err: unknown) => setError(err instanceof Error ? err.message : String(err)),
      )
      .finally(() => setCargando(false))
  }, [])

  useEffect(() => {
    cargar(filtro)
  }, [cargar, filtro])

  return (
    <section className="admin-caja">
      <div className="bitacora-cab">
        <h2>Bitácora</h2>
        <div className="campo bitacora-filtro">
          <label htmlFor="bitacora-persona">Persona</label>
          <select
            id="bitacora-persona"
            value={filtro}
            onChange={(e) => {
              setCargando(true)
              setRegistros(null)
              setFiltro(e.target.value)
            }}
          >
            <option value="">Todas</option>
            {usuarios?.map((u) => (
              <option key={u.id} value={u.id}>
                {u.nombre || u.email}
              </option>
            ))}
          </select>
        </div>
      </div>
      <p className="nota">Cada PDF, Excel o validación que se descarga y cada reservación de sala queda aquí. "Abrir documento" lo carga en el formulario tal cual se generó.</p>
      {error && <div className="alerta" role="alert">{error}</div>}
      {registros?.length === 0 && <p className="nota">Todavía no hay movimientos.</p>}
      {registros && registros.length > 0 && (
        <ul className="bitacora">
          {registros.map((r) => {
            const plantilla = PLANTILLAS.find((p) => p.id === r.plantilla)
            const persona = usuarios?.find((u) => u.id === r.usuario_id)
            const esDocumento = !!plantilla && typeof r.detalle === 'object' && r.detalle !== null
            return (
              <li key={r.id}>
                <span className="bitacora-fecha">{fecha(r.creado)}</span>
                <div className="bitacora-que">
                  <span>
                    <strong>{persona?.nombre || r.email}</strong> · {ACCIONES[r.accion] ?? r.accion}
                    {plantilla && ` · ${plantilla.marca} ${plantilla.nombre}`}
                  </span>
                  {r.documento && <span className="bitacora-doc">{r.documento}</span>}
                  {r.detalle != null && !esDocumento && (
                    <details>
                      <summary>Ver detalle</summary>
                      <pre>{JSON.stringify(r.detalle, null, 2)}</pre>
                    </details>
                  )}
                </div>
                {plantilla && esDocumento && (
                  <button type="button" className="btn secundario" onClick={() => abrirDocumento(plantilla.id, r.detalle)}>
                    Abrir documento
                  </button>
                )}
              </li>
            )
          })}
        </ul>
      )}
      {(hayMas || (cargando && !registros)) && (
        <div className="admin-acciones">
          <button
            type="button"
            className="btn secundario"
            disabled={cargando}
            onClick={() => {
              if (!registros) return
              setCargando(true)
              cargar(filtro, registros[registros.length - 1].id)
            }}
          >
            {cargando ? 'Cargando…' : 'Ver más'}
          </button>
        </div>
      )}
    </section>
  )
}

/** Panel del administrador: alta de cuentas, permisos por sección y bitácora. */
export function Admin({
  perfil,
  irAInicio,
  salir,
  abrirDocumento,
}: {
  perfil: Perfil
  irAInicio: () => void
  salir: () => void
  abrirDocumento: (plantilla: PlantillaId, datos: unknown) => void
}) {
  const [usuarios, setUsuarios] = useState<Usuario[] | null>(null)
  const [error, setError] = useState('')
  const [credenciales, setCredenciales] = useState<{ email: string; password: string } | null>(null)

  const recargar = useCallback(
    () =>
      adminUsuarios<{ usuarios: Usuario[] }>('listar').then(
        (r) => {
          setUsuarios(r.usuarios)
          setError('')
        },
        (err: unknown) => setError(err instanceof Error ? err.message : String(err)),
      ),
    [],
  )

  useEffect(() => {
    recargar()
  }, [recargar])

  const mostrar = (email: string, password: string) => setCredenciales({ email, password })

  return (
    <div className="inicio admin">
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
        <h1>Administración</h1>
        <p className="admin-intro">Solo las personas que des de alta aquí pueden entrar, y solo a las secciones que marques.</p>

        {credenciales && <Credenciales {...credenciales} cerrar={() => setCredenciales(null)} />}
        <Alta
          alCrear={(email, password) => {
            mostrar(email, password)
            void recargar()
          }}
        />

        <section className="admin-caja">
          <h2>Cuentas {usuarios && `(${usuarios.length})`}</h2>
          {error && <div className="alerta" role="alert">{error}</div>}
          {!usuarios && !error && <p className="nota">Cargando…</p>}
          {usuarios && (
            <ul className="admin-lista">
              {usuarios.map((u) => (
                <FilaUsuario key={u.id} u={u} yo={u.id === perfil.id} recargar={recargar} alCambiarPassword={mostrar} />
              ))}
            </ul>
          )}
        </section>

        <Bitacora usuarios={usuarios} abrirDocumento={abrirDocumento} />
      </div>
    </div>
  )
}
