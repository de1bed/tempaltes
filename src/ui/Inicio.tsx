import { PLANTILLAS, type PlantillaId, type TipoDocumento } from '../lib/modelo'
import { IMG } from '../lib/imagenes'
import { SECCIONES, type Seccion } from '../lib/secciones'
import type { Perfil } from '../lib/supabase'
import { CambiarPassword } from '../auth/CambiarPassword'

function Icono({ tipo }: { tipo: Seccion['tipo'] }) {
  const comun = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round', strokeLinejoin: 'round' } as const
  return (
    <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true">
      {tipo === 'cotizacion' && (
        <>
          <path {...comun} d="M6 3h9l4 4v14H6z" />
          <path {...comun} d="M15 3v4h4M9 12h7M9 16h4" />
        </>
      )}
      {tipo === 'contrato' && (
        <>
          <path {...comun} d="M6 3h12v18H6z" />
          <path {...comun} d="M9 8h6M9 11.5h6M9 17c1-1.5 2-1.5 2.5 0s1.5 1 3.5-1" />
        </>
      )}
      {tipo === 'corrida' && (
        <>
          <path {...comun} d="M4 4v16h16" />
          <path {...comun} d="M7 15l4-4 3 3 5-6" />
        </>
      )}
    </svg>
  )
}

interface Props {
  abrir: (tipo: TipoDocumento, plantilla?: PlantillaId) => void
  permitidas: TipoDocumento[]
  perfil: Perfil
  abrirAdmin: () => void
  /** Solo si la persona tiene permiso de Salas. */
  abrirSalas?: () => void
  salir: () => void
}

/** Pantalla de inicio: elegir qué hacer entre las secciones a las que tiene acceso la persona. */
export function Inicio({ abrir, permitidas, perfil, abrirAdmin, abrirSalas, salir }: Props) {
  const secciones = SECCIONES.filter((s) => permitidas.includes(s.tipo))
  return (
    <div className="inicio">
      <div className="inicio-centro">
        <div className="sesion">
          <span>{perfil.nombre || perfil.email}</span>
          <CambiarPassword email={perfil.email} />
          <button type="button" className="link sesion-salir" onClick={salir}>
            Cerrar sesión
          </button>
        </div>
        <header className="inicio-cab">
          <img className="inicio-logo" src={IMG.treveLogo} alt="Treve · Better people, better business." />
          <div className="marca-kicker">FEEDBAK · STAFFVIA · HAATS</div>
          <h1>¿Qué quieres hacer hoy?</h1>
        </header>

        <div className="inicio-tarjetas">
          {secciones.length === 0 && !abrirSalas && !perfil.es_admin && (
            <p className="inicio-vacio">Todavía no tienes acceso a ninguna sección. Pídele al administrador que te lo active.</p>
          )}
          {secciones.map((s) => {
            const lista = PLANTILLAS.filter((p) => p.tipo === s.tipo)
            const disponible = lista.length > 0
            return (
              <section key={s.tipo} className={disponible ? 'tarjeta' : 'tarjeta pronto'} style={{ borderTopColor: s.color }}>
                <button
                  type="button"
                  className="tarjeta-cab"
                  disabled={!disponible}
                  onClick={() => disponible && abrir(s.tipo)}
                >
                  <span className="tarjeta-icono" style={{ color: s.color }}>
                    <Icono tipo={s.tipo} />
                  </span>
                  <span className="tarjeta-titulo">{s.titulo}</span>
                  <span className="tarjeta-desc">{s.descripcion}</span>
                  <span className="tarjeta-pie">{disponible ? `${lista.length} formatos →` : 'Próximamente'}</span>
                </button>
                {disponible && (
                  <ul className="tarjeta-lista" aria-label={`Formatos de ${s.titulo.toLowerCase()}`}>
                    {lista.map((p) => (
                      <li key={p.id}>
                        <button type="button" onClick={() => abrir(s.tipo, p.id)}>
                          <span className="punto" style={{ background: p.color }} />
                          <span className="tarjeta-marca">{p.marca}</span>
                          {p.nombre}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            )
          })}
          {abrirSalas && (
            <section className="tarjeta" style={{ borderTopColor: '#7A5AA6' }}>
              <button type="button" className="tarjeta-cab" onClick={abrirSalas}>
                <span className="tarjeta-icono" style={{ color: '#7A5AA6' }}>
                  <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true">
                    <g fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3.5" y="5" width="17" height="15" rx="2" />
                      <path d="M3.5 10h17M8 3v4M16 3v4M8 14h3" />
                    </g>
                  </svg>
                </span>
                <span className="tarjeta-titulo">Salas</span>
                <span className="tarjeta-desc">Reserva la Sala principal o la Salita 2. Se copia al calendario de Outlook de la sala.</span>
                <span className="tarjeta-pie">Reservar →</span>
              </button>
            </section>
          )}
          {perfil.es_admin && (
            <section className="tarjeta" style={{ borderTopColor: '#13294b' }}>
              <button type="button" className="tarjeta-cab" onClick={abrirAdmin}>
                <span className="tarjeta-icono" style={{ color: '#13294b' }}>
                  <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true">
                    <g fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="9" cy="8" r="3.5" />
                      <path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6M16 4.5a3.5 3.5 0 0 1 0 7M18 14c2 .7 3 2.9 3 6" />
                    </g>
                  </svg>
                </span>
                <span className="tarjeta-titulo">Administración</span>
                <span className="tarjeta-desc">Da de alta a las personas y decide a qué secciones puede entrar cada una.</span>
                <span className="tarjeta-pie">Cuentas y permisos →</span>
              </button>
            </section>
          )}
        </div>
      </div>
    </div>
  )
}
