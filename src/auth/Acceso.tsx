import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { IMG } from '../lib/imagenes'
import { adminUsuarios, supabase, type Perfil } from '../lib/supabase'

/** Correo del administrador (el mismo que valida la Edge Function). */
const ADMIN_EMAIL = 'davidrocha0520@gmail.com'

type Resultado = { usuarioId: string; perfil: Perfil | null; aviso?: string }

/**
 * Puerta de entrada: sin sesión muestra el login (no hay registro); con sesión carga el perfil
 * y solo deja pasar cuentas dadas de alta y activas.
 */
export function Acceso({ children }: { children: (perfil: Perfil, salir: () => void) => ReactNode }) {
  const [sesion, setSesion] = useState<Session | null | undefined>(undefined)
  const [resultado, setResultado] = useState<Resultado | null>(null)
  // Aviso que se queda en el login después de sacar a alguien sin acceso.
  const [aviso, setAviso] = useState<string>()

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSesion(data.session))
    const { data } = supabase.auth.onAuthStateChange((_evento, s) => setSesion(s))
    return () => data.subscription.unsubscribe()
  }, [])

  // Se carga el perfil solo al cambiar de usuario, no en cada renovación del token.
  const usuarioId = sesion?.user.id
  useEffect(() => {
    if (!usuarioId) return
    let vigente = true
    supabase
      .from('perfiles')
      .select('*')
      .eq('id', usuarioId)
      .maybeSingle()
      .then(async ({ data, error }) => {
        if (!vigente) return
        const sinAcceso = error
          ? 'No se pudo cargar tu cuenta. Intenta de nuevo.'
          : !data || !data.activo
            ? 'Tu cuenta no tiene acceso. Pide al administrador que te dé de alta.'
            : undefined
        if (sinAcceso) {
          setAviso(sinAcceso)
          await supabase.auth.signOut()
        } else {
          setAviso(undefined)
          setResultado({ usuarioId, perfil: data as Perfil })
        }
      })
    return () => {
      vigente = false
    }
  }, [usuarioId])

  if (sesion === undefined) return <Pantalla><p className="acceso-nota">Cargando…</p></Pantalla>
  if (!usuarioId) return <Login aviso={aviso} />
  if (resultado?.usuarioId !== usuarioId || !resultado.perfil) return <Pantalla><p className="acceso-nota">Cargando…</p></Pantalla>
  return <>{children(resultado.perfil, () => void supabase.auth.signOut())}</>
}

function Pantalla({ titulo, children }: { titulo?: string; children: ReactNode }) {
  return (
    <div className="acceso">
      <div className="acceso-caja">
        <img className="acceso-logo" src={IMG.treveLogo} alt="Treve · Better people, better business." />
        {titulo && <h1>{titulo}</h1>}
        {children}
      </div>
    </div>
  )
}

function Login({ aviso }: { aviso?: string }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [enviando, setEnviando] = useState(false)
  // El enlace para configurar al administrador solo aparece mientras no exista.
  const [sinAdmin, setSinAdmin] = useState(false)
  const [configurando, setConfigurando] = useState(false)

  useEffect(() => {
    adminUsuarios<{ admin_configurado: boolean }>('estado')
      .then((r) => setSinAdmin(!r.admin_configurado))
      .catch(() => setSinAdmin(false))
  }, [])

  async function entrar(e: FormEvent) {
    e.preventDefault()
    setError('')
    setEnviando(true)
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    setEnviando(false)
    if (error) setError(error.message.toLowerCase().includes('invalid') ? 'Correo o contraseña incorrectos.' : 'No se pudo iniciar sesión. Intenta de nuevo.')
  }

  if (configurando) return <ConfigurarAdmin volver={() => setConfigurando(false)} />

  return (
    <Pantalla titulo="Iniciar sesión">
      <form className="acceso-form" onSubmit={entrar}>
        {aviso && <div className="alerta" role="alert">{aviso}</div>}
        <div className="campo">
          <label htmlFor="login-email">Correo</label>
          <input id="login-email" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="campo">
          <label htmlFor="login-password">Contraseña</label>
          <input id="login-password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        {error && <div className="alerta" role="alert">{error}</div>}
        <button type="submit" className="btn primario" disabled={enviando}>
          {enviando ? 'Entrando…' : 'Entrar'}
        </button>
        <p className="acceso-nota">¿No tienes cuenta o olvidaste tu contraseña? Pídela al administrador.</p>
        {sinAdmin && (
          <button type="button" className="link acceso-link" onClick={() => setConfigurando(true)}>
            Configurar la cuenta de administrador
          </button>
        )}
      </form>
    </Pantalla>
  )
}

/** Primera vez: crea la cuenta del administrador (solo funciona mientras no exista). */
function ConfigurarAdmin({ volver }: { volver: () => void }) {
  const [nombre, setNombre] = useState('')
  const [password, setPassword] = useState('')
  const [repetir, setRepetir] = useState('')
  const [error, setError] = useState('')
  const [enviando, setEnviando] = useState(false)

  async function crear(e: FormEvent) {
    e.preventDefault()
    setError('')
    if (password.length < 8) return setError('La contraseña debe tener al menos 8 caracteres.')
    if (password !== repetir) return setError('Las contraseñas no coinciden.')
    setEnviando(true)
    try {
      await adminUsuarios('configurar_admin', { nombre, password })
      const { error } = await supabase.auth.signInWithPassword({ email: ADMIN_EMAIL, password })
      if (error) throw new Error('La cuenta se creó, pero no se pudo iniciar sesión. Entra desde el login.')
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setEnviando(false)
    }
  }

  return (
    <Pantalla titulo="Cuenta de administrador">
      <form className="acceso-form" onSubmit={crear}>
        <p className="acceso-nota">
          Se crea una sola vez. El administrador entra a todas las secciones y da de alta a las demás personas.
        </p>
        <div className="campo">
          <label htmlFor="admin-email">Correo</label>
          <input id="admin-email" type="email" value={ADMIN_EMAIL} readOnly />
        </div>
        <div className="campo">
          <label htmlFor="admin-nombre">Nombre</label>
          <input id="admin-nombre" type="text" autoComplete="name" value={nombre} onChange={(e) => setNombre(e.target.value)} />
        </div>
        <div className="campo">
          <label htmlFor="admin-password">Contraseña</label>
          <input id="admin-password" type="password" autoComplete="new-password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        <div className="campo">
          <label htmlFor="admin-repetir">Repite la contraseña</label>
          <input id="admin-repetir" type="password" autoComplete="new-password" required value={repetir} onChange={(e) => setRepetir(e.target.value)} />
        </div>
        {error && <div className="alerta" role="alert">{error}</div>}
        <button type="submit" className="btn primario" disabled={enviando}>
          {enviando ? 'Creando…' : 'Crear cuenta de administrador'}
        </button>
        <button type="button" className="link acceso-link" onClick={volver}>
          ‹ Volver al login
        </button>
      </form>
    </Pantalla>
  )
}
