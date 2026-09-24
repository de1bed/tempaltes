import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Feedbak } from './doc/Feedbak'
import { ContratoLicencia, Nda } from './doc/Contratos'
import { HaatsHoras, HaatsMensual } from './doc/Haats'
import { Bonos, Gmm, Payroll, Reclutamiento, Servicios } from './doc/Staffvia'
import { hoyISO } from './lib/formato'
import { cambiarIdioma, datosIniciales, PLANTILLAS, type Datos, type Idioma, type PlantillaId } from './lib/modelo'
import { PRODUCTOS } from './lib/tabuladores'
import {
  FormBonos,
  FormFeedbak,
  FormGmm,
  FormHaatsHoras,
  FormHaatsMensual,
  FormLicencia,
  FormNda,
  FormPayroll,
  FormReclutamiento,
  FormServicios,
} from './ui/Formularios'

const CLAVE = 'cotizador:v1'

const GRUPOS = [
  { tipo: 'cotizacion', titulo: 'Cotizaciones' },
  { tipo: 'contrato', titulo: 'Contratos' },
] as const

interface Estado {
  plantilla: PlantillaId
  datos: Datos
}

function cargar(): Estado {
  const base: Estado = { plantilla: 'feedbak', datos: datosIniciales() }
  try {
    const guardado = JSON.parse(localStorage.getItem(CLAVE) ?? 'null') as Partial<Estado> | null
    if (!guardado?.datos) return base
    // Mezcla con los valores por defecto para tolerar borradores de versiones anteriores.
    const datos = { ...base.datos }
    for (const k of Object.keys(datos) as PlantillaId[]) {
      const previo = guardado.datos[k]
      // Los campos nuevos toman el texto por defecto en el idioma del borrador.
      const inicial = previo?.idioma ? cambiarIdioma(k, datos[k], previo.idioma) : datos[k]
      datos[k] = { ...inicial, ...(previo ?? {}) } as never
    }
    return { plantilla: guardado.plantilla && guardado.plantilla in datos ? guardado.plantilla : 'feedbak', datos }
  } catch {
    return base
  }
}

const PREFERENCIAS = 'cotizador:preferencias'

function leerPreferencia<T>(clave: string, porDefecto: T): T {
  try {
    const guardado = JSON.parse(localStorage.getItem(PREFERENCIAS) ?? '{}') as Record<string, unknown>
    return clave in guardado ? (guardado[clave] as T) : porDefecto
  } catch {
    return porDefecto
  }
}

function guardarPreferencia(clave: string, valor: unknown) {
  try {
    const guardado = JSON.parse(localStorage.getItem(PREFERENCIAS) ?? '{}') as Record<string, unknown>
    localStorage.setItem(PREFERENCIAS, JSON.stringify({ ...guardado, [clave]: valor }))
  } catch {
    /* sin almacenamiento: el menú vuelve a su estado inicial al recargar */
  }
}

function nombreArchivo(e: Estado): string {
  const d = e.datos[e.plantilla]
  const es = d.idioma === 'es'
  const empresa = d.empresa.trim() || (es ? 'Cliente' : 'Client')
  const fecha = d.fecha || hoyISO()
  const cot = es ? 'Cotizacion' : 'Quote'
  switch (e.plantilla) {
    case 'feedbak':
      return `${cot} Feedbak ${PRODUCTOS[e.datos.feedbak.producto].nombre} - ${empresa} - ${fecha}`
    case 'servicios':
      return `${cot} Staffvia ${e.datos.servicios.tituloPortada} - ${empresa} - ${fecha}`
    case 'payroll':
      return `${cot} Staffvia ${es ? 'Nomina' : 'Payroll'} ${e.datos.payroll.puesto} - ${empresa} - ${fecha}`
    case 'gmm':
      return `${cot} Staffvia GMM - ${empresa} - ${fecha}`
    case 'bonos':
      return `${cot} Staffvia ${e.datos.bonos.tituloPortada} - ${empresa} - ${fecha}`
    case 'estudios':
      return `${cot} Staffvia ${e.datos.estudios.tituloPortada} - ${empresa} - ${fecha}`
    case 'reclutamiento':
      return `${cot} Staffvia ${es ? 'Reclutamiento' : 'Recruitment'} ${e.datos.reclutamiento.tituloPortada} - ${empresa} - ${fecha}`
    case 'haatsMensual':
      return `${cot} HAATS ${e.datos.haatsMensual.tituloTabla} - ${empresa} - ${fecha}`
    case 'haatsHoras':
      return `${cot} HAATS ${e.datos.haatsHoras.tituloTabla} - ${empresa} - ${fecha}`
    case 'licencia':
      return `${es ? 'Contrato' : 'Agreement'} Feedbak ${e.datos.licencia.numero} - ${empresa} - ${fecha}`
    case 'nda':
      return `NDA Feedbak - ${empresa} - ${fecha}`
  }
}

export default function App() {
  const [estado, setEstado] = useState<Estado>(cargar)
  const { plantilla, datos } = estado
  const vistaRef = useRef<HTMLDivElement>(null)
  const [desbordadas, setDesbordadas] = useState<number[]>([])
  const [zoom, setZoom] = useState(0.7)
  const [confirmando, setConfirmando] = useState(false)
  const actual = PLANTILLAS.find((p) => p.id === plantilla) ?? PLANTILLAS[0]
  // Menú de plantillas plegable; se recuerda en este navegador.
  const [menuAbierto, setMenuAbierto] = useState<boolean>(() => leerPreferencia('menuAbierto', false))
  const [gruposCerrados, setGruposCerrados] = useState<string[]>(() => leerPreferencia('gruposCerrados', []))
  useEffect(() => guardarPreferencia('menuAbierto', menuAbierto), [menuAbierto])
  useEffect(() => guardarPreferencia('gruposCerrados', gruposCerrados), [gruposCerrados])

  useEffect(() => {
    try {
      localStorage.setItem(CLAVE, JSON.stringify(estado))
    } catch {
      /* sin almacenamiento: el borrador simplemente no se recuerda */
    }
  }, [estado])

  // Marca las hojas cuyo contenido no cabe (se cortaría al imprimir).
  const revisarDesbordes = useCallback(() => {
    const hojas = vistaRef.current?.querySelectorAll<HTMLElement>('.page:not(.medidor)')
    if (!hojas) return
    const malas: number[] = []
    hojas.forEach((hoja, i) => {
      const contenido = hoja.querySelector<HTMLElement>('.content')
      if (!contenido) return
      // Rectángulos en pantalla: funcionan igual con cualquier zoom de la vista previa.
      const r = hoja.getBoundingClientRect()
      const escala = r.height / hoja.offsetHeight || 1
      const limite = r.bottom - parseFloat(getComputedStyle(hoja).paddingBottom) * escala
      const excede = contenido.getBoundingClientRect().bottom > limite + 1
      hoja.classList.toggle('excede', excede)
      if (excede) malas.push(i + 1)
    })
    setDesbordadas((prev) => (prev.join() === malas.join() ? prev : malas))
  }, [])

  useLayoutEffect(revisarDesbordes, [estado, zoom, revisarDesbordes])

  // Los contratos se reparten en hojas después de medir; al cambiar las hojas se vuelve a revisar.
  useEffect(() => {
    const vista = vistaRef.current
    if (!vista) return
    let cuadro = 0
    const observador = new MutationObserver(() => {
      cancelAnimationFrame(cuadro)
      cuadro = requestAnimationFrame(revisarDesbordes)
    })
    observador.observe(vista, { childList: true, subtree: true })
    return () => {
      observador.disconnect()
      cancelAnimationFrame(cuadro)
    }
  }, [revisarDesbordes])

  function set<K extends PlantillaId>(k: K) {
    return (parcial: Partial<Datos[K]>) =>
      setEstado((e) => ({ ...e, datos: { ...e.datos, [k]: { ...e.datos[k], ...parcial } } }))
  }

  function idioma(nuevo: Idioma) {
    setEstado((e) => ({ ...e, datos: { ...e.datos, [e.plantilla]: cambiarIdioma(e.plantilla, e.datos[e.plantilla], nuevo) } }))
  }

  function imprimir() {
    const titulo = document.title
    document.title = nombreArchivo(estado)
    window.print()
    document.title = titulo
  }

  function reiniciar() {
    setEstado((e) => ({ ...e, datos: { ...e.datos, [e.plantilla]: datosIniciales()[e.plantilla] } }))
    setConfirmando(false)
  }

  return (
    <div className="app">
      <aside className="panel">
        <header className="marca">
          <div className="marca-kicker">TREVE · FEEDBAK · STAFFVIA · HAATS</div>
          <h1>Cotizador</h1>
        </header>

        <nav className="menu" aria-label="Plantillas">
          <button
            type="button"
            className="menu-actual"
            style={{ borderLeftColor: actual.color }}
            onClick={() => setMenuAbierto((v) => !v)}
            aria-expanded={menuAbierto}
            aria-controls="menu-plantillas"
          >
            <span className="menu-texto">
              <span className="plantilla-meta">
                {actual.tipo === 'contrato' ? 'Contrato' : 'Cotización'} · {actual.marca} · {datos[plantilla].idioma.toUpperCase()}
              </span>
              <span>{actual.nombre}</span>
            </span>
            <span className="menu-accion">{menuAbierto ? 'Ocultar' : 'Cambiar'}</span>
            <svg className={menuAbierto ? 'chevron abierto' : 'chevron'} viewBox="0 0 12 12" aria-hidden="true">
              <path d="M2.5 4.5 6 8l3.5-3.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>

          <div id="menu-plantillas" className="plantillas" hidden={!menuAbierto}>
            {GRUPOS.map((g) => {
              const lista = PLANTILLAS.filter((p) => p.tipo === g.tipo)
              return (
                <details
                  key={g.tipo}
                  className="grupo"
                  open={!gruposCerrados.includes(g.tipo)}
                  onToggle={(e) => {
                    const abierto = (e.currentTarget as HTMLDetailsElement).open
                    setGruposCerrados((prev) => (abierto ? prev.filter((x) => x !== g.tipo) : prev.includes(g.tipo) ? prev : [...prev, g.tipo]))
                  }}
                >
                  <summary className="grupo-titulo">
                    {g.titulo} <span className="grupo-cuenta">{lista.length}</span>
                  </summary>
                  <div className="grupo-lista">
                    {lista.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        className={p.id === plantilla ? 'plantilla activa' : 'plantilla'}
                        style={{ borderLeftColor: p.color }}
                        onClick={() => {
                          setEstado((e) => ({ ...e, plantilla: p.id }))
                          setMenuAbierto(false)
                        }}
                        aria-pressed={p.id === plantilla}
                      >
                        <span className="plantilla-meta">
                          {p.marca} · {datos[p.id].idioma.toUpperCase()}
                        </span>
                        <span>{p.nombre}</span>
                      </button>
                    ))}
                  </div>
                </details>
              )
            })}
          </div>
        </nav>

        <div className="idioma" role="group" aria-label="Idioma del documento">
          <span>Idioma del documento</span>
          {(
            [
              ['es', 'Español'],
              ['en', 'English'],
            ] as const
          ).map(([id, texto]) => (
            <button
              key={id}
              type="button"
              className={datos[plantilla].idioma === id ? 'activo' : undefined}
              aria-pressed={datos[plantilla].idioma === id}
              onClick={() => idioma(id)}
            >
              {texto}
            </button>
          ))}
        </div>

        <form className="formulario" onSubmit={(e) => e.preventDefault()}>
          {plantilla === 'feedbak' && <FormFeedbak d={datos.feedbak} set={set('feedbak')} />}
          {plantilla === 'servicios' && <FormServicios d={datos.servicios} set={set('servicios')} />}
          {plantilla === 'payroll' && <FormPayroll d={datos.payroll} set={set('payroll')} />}
          {plantilla === 'gmm' && <FormGmm d={datos.gmm} set={set('gmm')} />}
          {plantilla === 'bonos' && <FormBonos d={datos.bonos} set={set('bonos')} />}
          {plantilla === 'estudios' && <FormServicios d={datos.estudios} set={set('estudios')} />}
          {plantilla === 'reclutamiento' && <FormReclutamiento d={datos.reclutamiento} set={set('reclutamiento')} />}
          {plantilla === 'haatsMensual' && <FormHaatsMensual d={datos.haatsMensual} set={set('haatsMensual')} />}
          {plantilla === 'haatsHoras' && <FormHaatsHoras d={datos.haatsHoras} set={set('haatsHoras')} />}
          {plantilla === 'licencia' && <FormLicencia d={datos.licencia} set={set('licencia')} />}
          {plantilla === 'nda' && <FormNda d={datos.nda} set={set('nda')} />}
        </form>
      </aside>

      <main className="vista">
        <div className="barra">
          <div className="zoom">
            <button type="button" className="btn secundario" onClick={() => setZoom((z) => Math.max(0.3, +(z - 0.1).toFixed(1)))} aria-label="Alejar">
              −
            </button>
            <span>{Math.round(zoom * 100)}%</span>
            <button type="button" className="btn secundario" onClick={() => setZoom((z) => Math.min(1.5, +(z + 0.1).toFixed(1)))} aria-label="Acercar">
              +
            </button>
          </div>
          <span className="pista">Haz clic en cualquier texto resaltado de la hoja para editarlo.</span>
          {desbordadas.length > 0 && (
            <div className="alerta" role="status">
              El contenido no cabe en la hoja {desbordadas.join(', ')}: acorta textos o quita filas.
            </div>
          )}
          <div className="acciones">
            {confirmando ? (
              <>
                <span className="pregunta">¿Borrar los datos de esta plantilla?</span>
                <button type="button" className="btn secundario" onClick={() => setConfirmando(false)}>
                  Cancelar
                </button>
                <button type="button" className="btn peligro" onClick={reiniciar}>
                  Sí, reiniciar
                </button>
              </>
            ) : (
              <button type="button" className="btn secundario" onClick={() => setConfirmando(true)}>
                Reiniciar
              </button>
            )}
            {/* El visor de artifacts bloquea window.print(); ahí se ofrece la versión desplegada. */}
            {import.meta.env.MODE === 'artifact' ? (
              <span className="aviso-pdf" title="Clona el repo de1bed/tempaltes o usa la versión en Vercel para descargar PDF">
                Vista previa · el PDF se descarga desde la app desplegada
              </span>
            ) : (
              <button type="button" className="btn primario" onClick={imprimir}>
                Descargar PDF
              </button>
            )}
          </div>
        </div>
        <div className="hojas" ref={vistaRef} style={{ zoom }}>
          {plantilla === 'feedbak' && <Feedbak d={datos.feedbak} set={set('feedbak')} />}
          {plantilla === 'servicios' && <Servicios d={datos.servicios} set={set('servicios')} />}
          {plantilla === 'payroll' && <Payroll d={datos.payroll} set={set('payroll')} />}
          {plantilla === 'gmm' && <Gmm d={datos.gmm} set={set('gmm')} />}
          {plantilla === 'bonos' && <Bonos d={datos.bonos} set={set('bonos')} />}
          {plantilla === 'estudios' && <Servicios d={datos.estudios} set={set('estudios')} />}
          {plantilla === 'reclutamiento' && <Reclutamiento d={datos.reclutamiento} set={set('reclutamiento')} />}
          {plantilla === 'haatsMensual' && <HaatsMensual d={datos.haatsMensual} set={set('haatsMensual')} />}
          {plantilla === 'haatsHoras' && <HaatsHoras d={datos.haatsHoras} set={set('haatsHoras')} />}
          {plantilla === 'licencia' && <ContratoLicencia d={datos.licencia} set={set('licencia')} />}
          {plantilla === 'nda' && <Nda d={datos.nda} set={set('nda')} />}
        </div>
      </main>
    </div>
  )
}
