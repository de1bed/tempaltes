import { PLANTILLAS, type PlantillaId, type TipoDocumento } from '../lib/modelo'
import { IMG } from '../lib/imagenes'
import { SECCIONES, type Seccion } from '../lib/secciones'

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

/** Pantalla de inicio: elegir qué hacer (cotizaciones, contratos o corridas). */
export function Inicio({ abrir }: { abrir: (tipo: TipoDocumento, plantilla?: PlantillaId) => void }) {
  return (
    <div className="inicio">
      <div className="inicio-centro">
        <header className="inicio-cab">
          <img className="inicio-logo" src={IMG.treveLogo} alt="Treve · Better people, better business." />
          <div className="marca-kicker">FEEDBAK · STAFFVIA · HAATS</div>
          <h1>¿Qué quieres hacer hoy?</h1>
        </header>

        <div className="inicio-tarjetas">
          {SECCIONES.map((s) => {
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
        </div>
      </div>
    </div>
  )
}
