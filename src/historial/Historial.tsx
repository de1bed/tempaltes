import { useEffect, useMemo, useState } from 'react'
import { CambiarPassword } from '../auth/CambiarPassword'
import { calcularCorrida } from '../corridas/calculo'
import { NOMBRES_CORRIDA, resumenCorrida, type EnvioCorrida, type ResumenCorrida } from '../corridas/envios'
import type { CorridaData, CorridaId } from '../corridas/tipos'
import { dinero } from '../lib/formato'
import { leerHistorial, type EntradaHistorial } from '../lib/historial'
import { IMG } from '../lib/imagenes'
import { PLANTILLAS, type PlantillaId, type TipoDocumento } from '../lib/modelo'
import type { Perfil } from '../lib/supabase'
import { BandejaCorridas } from '../ui/BandejaCorridas'

type Pestana = 'recibidas' | 'todo' | TipoDocumento

const TITULOS: Record<TipoDocumento, string> = { cotizacion: 'Cotizaciones', contrato: 'Contratos', corrida: 'Corridas' }
const cuando = (iso: string) => new Date(iso).toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' })
const sinAcentos = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

function resumenDe(e: EntradaHistorial): ResumenCorrida | null {
  try {
    return resumenCorrida(calcularCorrida(e.plantilla as CorridaId, e.datos as unknown as CorridaData))
  } catch {
    return null
  }
}

/** Una corrida del historial, lista para convertirse en cotización de nómina. */
function comoEnvio(e: EntradaHistorial, resumen: ResumenCorrida): EnvioCorrida {
  return {
    id: `historial-${e.id}`,
    creado: e.creado,
    enviado_por: e.creado_por,
    enviado_por_email: e.creado_por_email,
    enviado_por_nombre: e.creado_por_nombre,
    corrida: e.plantilla as CorridaId,
    empresa: String(e.datos.empresa ?? ''),
    puesto: String(e.datos.puesto ?? ''),
    nota: '',
    resumen,
    datos: e.datos as unknown as CorridaData,
    // No viene de la bandeja: no hay nada que marcar.
    estado: 'convertida',
    atendido_por: null,
    atendido_por_nombre: null,
    atendido_en: null,
  }
}

function Fila({
  e,
  puedeAbrir,
  puedeConvertir,
  abrir,
  convertir,
}: {
  e: EntradaHistorial
  puedeAbrir: boolean
  puedeConvertir: boolean
  abrir: () => void
  convertir: (r: ResumenCorrida) => Promise<void>
}) {
  const [verMontos, setVerMontos] = useState(false)
  const [error, setError] = useState('')
  const p = PLANTILLAS.find((x) => x.id === e.plantilla)
  const esCorrida = e.tipo === 'corrida'
  // Calcular una corrida es pesado: solo al ver sus montos o al convertirla.
  const resumen = useMemo(() => (esCorrida && verMontos ? resumenDe(e) : null), [e, esCorrida, verMontos])

  return (
    <li>
      <span className="punto" style={{ background: p?.color ?? '#8a98a2' }} />
      <div className="historial-info">
        <strong>{e.documento || p?.nombre || e.plantilla}</strong>
        <span>
          {p ? `${p.marca} · ${p.nombre}` : e.plantilla} · {e.formato === 'excel' ? 'Excel' : 'PDF'}
        </span>
        <small>
          {e.creado_por_nombre || e.creado_por_email} · {cuando(e.creado)}
        </small>
        {verMontos &&
          (resumen ? (
            <dl className="resumen historial-montos">
              <dt>Salario diario</dt>
              <dd>{dinero(resumen.salarioDiario)}</dd>
              <dt>Bruto semanal</dt>
              <dd>{dinero(resumen.brutoSemanal)}</dd>
              <dt>Patronales semanal</dt>
              <dd>{dinero(resumen.patronalesSemanal)}</dd>
              <dt>Neto ({resumen.periodo.toLowerCase()})</dt>
              <dd>{dinero(resumen.netoPeriodo)}</dd>
              <dt>{resumen.totalEtiqueta}</dt>
              <dd>{dinero(resumen.totalPeriodo)}</dd>
            </dl>
          ) : (
            <small className="nota">No se pudieron calcular los montos de esta corrida.</small>
          ))}
        {error && <div className="alerta" role="alert">{error}</div>}
      </div>
      <div className="admin-acciones">
        {esCorrida && (
          <button type="button" className="link sesion-salir" onClick={() => setVerMontos((v) => !v)}>
            {verMontos ? 'Ocultar montos' : 'Ver montos'}
          </button>
        )}
        {puedeConvertir && (
          <button
            type="button"
            className="btn primario"
            onClick={() => {
              const r = resumen ?? resumenDe(e)
              if (!r) return setError('No se pudieron calcular los montos de esta corrida.')
              convertir(r).catch((err: unknown) => setError(err instanceof Error ? err.message : String(err)))
            }}
          >
            Convertir en cotización
          </button>
        )}
        {puedeAbrir && (
          <button type="button" className="btn secundario" onClick={abrir} title="Carga el documento tal como se generó (reemplaza tu borrador de esa plantilla)">
            Abrir
          </button>
        )}
      </div>
    </li>
  )
}

/** Historial: todo lo que se ha generado, quién lo hizo, y las corridas que mandan a cotizaciones. */
export function Historial({
  perfil,
  irAInicio,
  salir,
  abrirDocumento,
  convertirCorrida,
}: {
  perfil: Perfil
  irAInicio: () => void
  salir: () => void
  abrirDocumento: (plantilla: PlantillaId, datos: unknown) => void
  convertirCorrida: (e: EnvioCorrida) => Promise<void>
}) {
  const tiene = (t: TipoDocumento) => perfil.es_admin || perfil.secciones.includes(t)
  const puedeCotizar = tiene('cotizacion')
  // Quien hace cotizaciones también ve las corridas.
  const visibles = (['cotizacion', 'contrato', 'corrida'] as TipoDocumento[]).filter((t) => tiene(t) || (t === 'corrida' && puedeCotizar))
  const [pestana, setPestana] = useState<Pestana>(() => (puedeCotizar ? 'recibidas' : 'todo'))
  const [entradas, setEntradas] = useState<EntradaHistorial[] | null>(null)
  const [hayMas, setHayMas] = useState(false)
  const [error, setError] = useState('')
  const [persona, setPersona] = useState('')
  const [buscar, setBuscar] = useState('')

  useEffect(() => {
    leerHistorial().then(
      (r) => {
        setEntradas(r)
        setHayMas(r.length === 200)
      },
      (e: unknown) => setError(e instanceof Error ? e.message : String(e)),
    )
  }, [])

  function verMas() {
    if (!entradas?.length) return
    leerHistorial(entradas[entradas.length - 1].id).then(
      (r) => {
        setEntradas([...entradas, ...r])
        setHayMas(r.length === 200)
      },
      (e: unknown) => setError(e instanceof Error ? e.message : String(e)),
    )
  }

  const personas = useMemo(() => [...new Set((entradas ?? []).map((e) => e.creado_por_nombre || e.creado_por_email))].sort(), [entradas])
  const texto = sinAcentos(buscar.trim())
  const lista = (entradas ?? []).filter(
    (e) =>
      (pestana === 'todo' || pestana === e.tipo) &&
      (!persona || (e.creado_por_nombre || e.creado_por_email) === persona) &&
      (!texto || sinAcentos(`${e.documento} ${e.empresa} ${e.plantilla} ${NOMBRES_CORRIDA[e.plantilla as CorridaId] ?? ''}`).includes(texto)),
  )

  const pestanas: [Pestana, string][] = [
    ...(puedeCotizar ? [['recibidas', 'Corridas recibidas'] as [Pestana, string]] : []),
    ['todo', 'Todo'],
    ...visibles.map((t) => [t, TITULOS[t]] as [Pestana, string]),
  ]

  return (
    <div className="inicio admin">
      <div className="inicio-centro admin-centro historial">
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
        <h1>Historial</h1>
        <p className="admin-intro">Todo lo que se genera queda aquí: quién lo hizo, cuándo y con qué datos. "Abrir" lo carga tal como se generó.</p>

        <div className="vista-toggle historial-pestanas" role="tablist" aria-label="Qué ver">
          {pestanas.map(([id, titulo]) => (
            <button key={id} type="button" role="tab" className={pestana === id ? 'activo' : undefined} aria-selected={pestana === id} onClick={() => setPestana(id)}>
              {titulo}
            </button>
          ))}
        </div>

        {pestana === 'recibidas' ? (
          <BandejaCorridas perfil={perfil} convertir={convertirCorrida} mostrarVacia />
        ) : (
          <section className="admin-caja">
            <div className="historial-filtros">
              <div className="campo">
                <label htmlFor="historial-buscar">Buscar</label>
                <input id="historial-buscar" type="search" value={buscar} onChange={(e) => setBuscar(e.target.value)} placeholder="Cliente, puesto, documento…" />
              </div>
              <div className="campo">
                <label htmlFor="historial-persona">Hecho por</label>
                <select id="historial-persona" value={persona} onChange={(e) => setPersona(e.target.value)}>
                  <option value="">Todas las personas</option>
                  {personas.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            {error && <div className="alerta" role="alert">{error}</div>}
            {!entradas && !error && <p className="nota">Cargando…</p>}
            {entradas && lista.length === 0 && <p className="nota">No hay documentos con esos filtros.</p>}
            {lista.length > 0 && (
              <ul className="historial-lista">
                {lista.map((e) => (
                  <Fila
                    key={e.id}
                    e={e}
                    puedeAbrir={tiene(e.tipo) && PLANTILLAS.some((p) => p.id === e.plantilla)}
                    puedeConvertir={e.tipo === 'corrida' && puedeCotizar}
                    abrir={() => abrirDocumento(e.plantilla as PlantillaId, e.datos)}
                    convertir={(r) => convertirCorrida(comoEnvio(e, r))}
                  />
                ))}
              </ul>
            )}
            {hayMas && (
              <div className="admin-acciones">
                <button type="button" className="btn secundario" onClick={verMas}>
                  Ver más
                </button>
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  )
}
