import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Feedbak } from './doc/Feedbak'
import { Bonos, Gmm, Payroll, Servicios } from './doc/Staffvia'
import { hoyISO } from './lib/formato'
import { datosIniciales, PLANTILLAS, type Datos, type PlantillaId } from './lib/modelo'
import { PRODUCTOS } from './lib/tabuladores'
import { FormBonos, FormFeedbak, FormGmm, FormPayroll, FormServicios } from './ui/Formularios'

const CLAVE = 'cotizador:v1'

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
      datos[k] = { ...datos[k], ...(guardado.datos[k] ?? {}) } as never
    }
    return { plantilla: guardado.plantilla && guardado.plantilla in datos ? guardado.plantilla : 'feedbak', datos }
  } catch {
    return base
  }
}

function nombreArchivo(e: Estado): string {
  const d = e.datos[e.plantilla]
  const empresa = d.empresa.trim() || 'Cliente'
  const fecha = d.fecha || hoyISO()
  switch (e.plantilla) {
    case 'feedbak':
      return `Cotizacion Feedbak ${PRODUCTOS[e.datos.feedbak.producto].nombre} - ${empresa} - ${fecha}`
    case 'servicios':
      return `Cotizacion Staffvia ${e.datos.servicios.tituloPortada} - ${empresa} - ${fecha}`
    case 'payroll':
      return `Quote Staffvia Payroll ${e.datos.payroll.puesto} - ${empresa} - ${fecha}`
    case 'gmm':
      return `Quote Staffvia GMM - ${empresa} - ${fecha}`
    case 'bonos':
      return `Quote Staffvia ${e.datos.bonos.tituloPortada} - ${empresa} - ${fecha}`
  }
}

export default function App() {
  const [estado, setEstado] = useState<Estado>(cargar)
  const { plantilla, datos } = estado
  const vistaRef = useRef<HTMLDivElement>(null)
  const [desbordadas, setDesbordadas] = useState<number[]>([])
  const [zoom, setZoom] = useState(0.7)

  useEffect(() => {
    try {
      localStorage.setItem(CLAVE, JSON.stringify(estado))
    } catch {
      /* sin almacenamiento: el borrador simplemente no se recuerda */
    }
  }, [estado])

  // Marca las hojas cuyo contenido no cabe (se cortaría al imprimir).
  useLayoutEffect(() => {
    const hojas = vistaRef.current?.querySelectorAll<HTMLElement>('.page')
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
  }, [estado, zoom])

  function set<K extends PlantillaId>(k: K) {
    return (parcial: Partial<Datos[K]>) =>
      setEstado((e) => ({ ...e, datos: { ...e.datos, [k]: { ...e.datos[k], ...parcial } } }))
  }

  function imprimir() {
    const titulo = document.title
    document.title = nombreArchivo(estado)
    window.print()
    document.title = titulo
  }

  function reiniciar() {
    if (!confirm('¿Borrar los datos de esta plantilla y volver a los valores iniciales?')) return
    setEstado((e) => ({ ...e, datos: { ...e.datos, [e.plantilla]: datosIniciales()[e.plantilla] } }))
  }

  return (
    <div className="app">
      <aside className="panel">
        <header className="marca">
          <div className="marca-kicker">TREVE · FEEDBAK · STAFFVIA</div>
          <h1>Cotizador</h1>
        </header>

        <nav className="plantillas" aria-label="Plantilla">
          {PLANTILLAS.map((p) => (
            <button
              key={p.id}
              type="button"
              className={p.id === plantilla ? 'plantilla activa' : 'plantilla'}
              style={{ borderLeftColor: p.color }}
              onClick={() => setEstado((e) => ({ ...e, plantilla: p.id }))}
              aria-pressed={p.id === plantilla}
            >
              <span className="plantilla-meta">
                {p.marca} · {p.idioma}
              </span>
              <span>{p.nombre}</span>
            </button>
          ))}
        </nav>

        <form className="formulario" onSubmit={(e) => e.preventDefault()}>
          {plantilla === 'feedbak' && <FormFeedbak d={datos.feedbak} set={set('feedbak')} />}
          {plantilla === 'servicios' && <FormServicios d={datos.servicios} set={set('servicios')} />}
          {plantilla === 'payroll' && <FormPayroll d={datos.payroll} set={set('payroll')} />}
          {plantilla === 'gmm' && <FormGmm d={datos.gmm} set={set('gmm')} />}
          {plantilla === 'bonos' && <FormBonos d={datos.bonos} set={set('bonos')} />}
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
          {desbordadas.length > 0 && (
            <div className="alerta" role="status">
              El contenido no cabe en la hoja {desbordadas.join(', ')}: acorta textos o quita filas.
            </div>
          )}
          <div className="acciones">
            <button type="button" className="btn secundario" onClick={reiniciar}>
              Reiniciar
            </button>
            <button type="button" className="btn primario" onClick={imprimir}>
              Descargar PDF
            </button>
          </div>
        </div>
        <div className="hojas" ref={vistaRef} style={{ zoom }}>
          {plantilla === 'feedbak' && <Feedbak d={datos.feedbak} />}
          {plantilla === 'servicios' && <Servicios d={datos.servicios} />}
          {plantilla === 'payroll' && <Payroll d={datos.payroll} />}
          {plantilla === 'gmm' && <Gmm d={datos.gmm} />}
          {plantilla === 'bonos' && <Bonos d={datos.bonos} />}
        </div>
      </main>
    </div>
  )
}
