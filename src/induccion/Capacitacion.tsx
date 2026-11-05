import { useCallback, useEffect, useState } from 'react'
import { CambiarPassword } from '../auth/CambiarPassword'
import { IMG } from '../lib/imagenes'
import type { Perfil } from '../lib/supabase'
import { leerCurso, leerPresentaciones, mensaje, type Curso, type Presentacion } from './api'
import { Contenido } from './Contenido'
import { EditorCuestionario } from './EditorCuestionario'
import { Presentar } from './Presentar'
import { Resultados } from './Resultados'
import { Sesiones } from './Sesiones'
import './induccion.css'

type Pestana = 'sesiones' | 'resultados' | 'contenido' | 'cuestionario'

/** Recursos Humanos: sesiones de inducción, resultados, contenido del curso y cuestionario. */
export function Capacitacion({ perfil, irAInicio, salir }: { perfil: Perfil; irAInicio: () => void; salir: () => void }) {
  const [pestana, setPestana] = useState<Pestana>('sesiones')
  const [curso, setCurso] = useState<Curso | null>(null)
  const [presentaciones, setPresentaciones] = useState<Presentacion[]>([])
  const [falla, setFalla] = useState('')
  const [cargando, setCargando] = useState(true)
  const [presentar, setPresentar] = useState<{ codigo?: string } | null>(null)

  const recargar = useCallback(
    () =>
      Promise.all([leerCurso(), leerPresentaciones()]).then(
        ([c, p]) => {
          setCurso(c)
          setPresentaciones(p)
          setFalla(c ? '' : 'No hay curso de inducción. Revisa que la migración de la base de datos esté aplicada.')
          setCargando(false)
        },
        (e: unknown) => {
          setFalla(mensaje(e))
          setCargando(false)
        },
      ),
    [],
  )

  useEffect(() => {
    void recargar()
  }, [recargar])

  const pestanas: { id: Pestana; texto: string }[] = [
    { id: 'sesiones', texto: 'Sesiones' },
    { id: 'resultados', texto: 'Resultados' },
    { id: 'contenido', texto: 'Contenido' },
    { id: 'cuestionario', texto: curso ? `Cuestionario (${curso.preguntas.length})` : 'Cuestionario' },
  ]

  return (
    <div className="inicio admin capacitacion">
      <div className="inicio-centro admin-centro ind-admin" inert={presentar !== null}>
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
        <h1>Capacitación</h1>
        <p className="admin-intro">Inducción para nuevos ingresos: presentación, videos y cuestionario, en el celular de cada persona o proyectada para un grupo.</p>

        <nav className="salas-pestanas" aria-label="Secciones de capacitación">
          {pestanas.map((p) => (
            <button key={p.id} type="button" className={pestana === p.id ? 'activo' : undefined} aria-current={pestana === p.id ? 'page' : undefined} onClick={() => setPestana(p.id)}>
              {p.texto}
            </button>
          ))}
        </nav>

        {falla && <div className="alerta" role="alert">{falla}</div>}
        {cargando && <p className="nota">Cargando…</p>}
        {curso && (
          <>
            {pestana === 'sesiones' && <Sesiones perfil={perfil} curso={curso} presentaciones={presentaciones} presentar={(codigo) => setPresentar({ codigo })} />}
            {pestana === 'resultados' && <Resultados curso={curso} />}
            {pestana === 'contenido' && <Contenido curso={curso} presentaciones={presentaciones} recargar={recargar} vistaPrevia={() => setPresentar({})} />}
            {pestana === 'cuestionario' && <EditorCuestionario curso={curso} recargar={recargar} />}
          </>
        )}
      </div>
      {presentar && curso && <Presentar curso={curso} presentaciones={presentaciones} codigo={presentar.codigo} cerrar={() => setPresentar(null)} />}
    </div>
  )
}
