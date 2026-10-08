import { useState, type FormEvent } from 'react'
import { registrar, supabase } from '../lib/supabase'

/**
 * Cada persona cambia su propia contraseña. Se pide la actual para que nadie pueda
 * cambiarla desde una computadora que se quedó con la sesión abierta.
 */
export function CambiarPassword({ email }: { email: string }) {
  const [abierto, setAbierto] = useState(false)
  const [actual, setActual] = useState('')
  const [nueva, setNueva] = useState('')
  const [repetir, setRepetir] = useState('')
  const [error, setError] = useState('')
  const [listo, setListo] = useState(false)
  const [enviando, setEnviando] = useState(false)

  function cerrar() {
    setAbierto(false)
    setActual('')
    setNueva('')
    setRepetir('')
    setError('')
    setListo(false)
  }

  async function guardar(e: FormEvent) {
    e.preventDefault()
    setError('')
    if (nueva.length < 8) return setError('La nueva contraseña debe tener al menos 8 caracteres.')
    if (nueva !== repetir) return setError('Las contraseñas nuevas no coinciden.')
    if (nueva === actual) return setError('La nueva contraseña debe ser distinta a la actual.')
    setEnviando(true)
    const { error: errActual } = await supabase.auth.signInWithPassword({ email, password: actual })
    if (errActual) {
      setEnviando(false)
      return setError('La contraseña actual no es correcta.')
    }
    const { error: errNueva } = await supabase.auth.updateUser({ password: nueva })
    setEnviando(false)
    if (errNueva) return setError('No se pudo cambiar la contraseña. Intenta de nuevo.')
    registrar('contrasena_cambiada')
    setListo(true)
  }

  return (
    <>
      <button type="button" className="link sesion-salir" onClick={() => setAbierto(true)}>
        Cambiar contraseña
      </button>
      {abierto && (
        <div className="modal-fondo" onClick={(e) => e.target === e.currentTarget && cerrar()} onKeyDown={(e) => e.key === 'Escape' && cerrar()}>
          <div className="modal acceso-caja" role="dialog" aria-modal="true" aria-labelledby="cambiar-titulo">
            <h1 id="cambiar-titulo">Cambiar contraseña</h1>
            {listo ? (
              <div className="acceso-form">
                <p className="acceso-nota">Listo, tu contraseña se cambió. Úsala la próxima vez que entres.</p>
                <button type="button" className="btn primario" onClick={cerrar}>
                  Cerrar
                </button>
              </div>
            ) : (
              <form className="acceso-form" onSubmit={guardar}>
                <input type="email" autoComplete="username" value={email} readOnly hidden />
                <div className="campo">
                  <label htmlFor="pw-actual">Contraseña actual</label>
                  <input id="pw-actual" type="password" autoComplete="current-password" required value={actual} onChange={(e) => setActual(e.target.value)} />
                </div>
                <div className="campo">
                  <label htmlFor="pw-nueva">Nueva contraseña</label>
                  <input id="pw-nueva" type="password" autoComplete="new-password" required minLength={8} value={nueva} onChange={(e) => setNueva(e.target.value)} />
                </div>
                <div className="campo">
                  <label htmlFor="pw-repetir">Repite la nueva contraseña</label>
                  <input id="pw-repetir" type="password" autoComplete="new-password" required value={repetir} onChange={(e) => setRepetir(e.target.value)} />
                </div>
                {error && <div className="alerta" role="alert">{error}</div>}
                <div className="admin-acciones">
                  <button type="button" className="btn secundario" onClick={cerrar}>
                    Cancelar
                  </button>
                  <button type="submit" className="btn primario" disabled={enviando}>
                    {enviando ? 'Guardando…' : 'Guardar'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  )
}
