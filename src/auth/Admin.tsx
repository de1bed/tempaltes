import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { IMG } from '../lib/imagenes'
import type { TipoDocumento } from '../lib/modelo'
import { SECCIONES } from '../lib/secciones'
import { adminUsuarios, type Perfil, type Usuario } from '../lib/supabase'

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

function Casillas({ valor, onChange, deshabilitado }: { valor: TipoDocumento[]; onChange: (v: TipoDocumento[]) => void; deshabilitado?: boolean }) {
  return (
    <div className="casillas">
      {SECCIONES.map((s) => {
        const marcada = valor.includes(s.tipo)
        return (
          <label key={s.tipo} className={marcada ? 'casilla permiso marcada' : 'casilla permiso'}>
            <input
              type="checkbox"
              checked={marcada}
              disabled={deshabilitado}
              onChange={() => onChange(marcada ? valor.filter((t) => t !== s.tipo) : [...valor, s.tipo])}
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
  const [secciones, setSecciones] = useState<TipoDocumento[]>([])
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

/** Panel del administrador: alta de cuentas y permisos por sección. */
export function Admin({ perfil, irAInicio, salir }: { perfil: Perfil; irAInicio: () => void; salir: () => void }) {
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
          <button type="button" className="link sesion-salir" onClick={salir}>
            Cerrar sesión
          </button>
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
      </div>
    </div>
  )
}
