import { useCallback, useDeferredValue, useEffect, useMemo, useState } from 'react'
import { CambiarPassword } from '../auth/CambiarPassword'
import { guardarArchivo } from '../lib/guardar'
import { IMG } from '../lib/imagenes'
import { registrar, supabase, type Perfil } from '../lib/supabase'
import {
  calcularBono,
  emparejar,
  leerTablaCorreo,
  nombrePropio,
  num,
  opcionesIniciales,
  sinBono,
  totales,
  type Empleado,
  type FilaBono,
  type OpcionesBonos,
  type ResultadoBono,
} from './calculo'
import { Plantilla33 } from './Plantilla33'
import { excelBonos, nombreArchivo, tablaCliente } from './reporte'

const CLAVE = 'bonos33:borrador'
type Pestana = 'bonos' | 'plantilla' | 'guardadas'

interface Borrador {
  /** Corrida guardada que se está editando (null = nueva). */
  id: string | null
  opciones: OpcionesBonos
  filas: FilaBono[]
}

interface Guardada {
  id: string
  titulo: string
  fecha_pago: string | null
  tipo_cambio: number | null
  datos: { opciones: OpcionesBonos; filas: FilaBono[] }
  resumen: { totalFactura?: number; usd?: number; calculados?: number }
  creado_por_email: string
  creado: string
  actualizado: string
}

const dinero = (x: number) => x.toLocaleString('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 2, maximumFractionDigits: 2 })
const dolares = (x: number) => x.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
const nuevoId = () => Math.random().toString(36).slice(2, 10)

function leerBorrador(): Borrador {
  try {
    const b = JSON.parse(localStorage.getItem(CLAVE) ?? 'null') as Borrador | null
    if (b?.opciones && Array.isArray(b.filas)) return { ...b, opciones: { ...opcionesIniciales(), ...b.opciones } }
  } catch {
    // Sin almacenamiento o borrador dañado: se empieza de cero.
  }
  return { id: null, opciones: opcionesIniciales(), filas: [] }
}

/** Bonos trimestrales de 33 Hilos: tabla del correo → corridas con bono → facturación para autorizar. */
export function Bonos33({ perfil, irAInicio, salir }: { perfil: Perfil; irAInicio: () => void; salir: () => void }) {
  const [pestana, setPestana] = useState<Pestana>('bonos')
  const [empleados, setEmpleados] = useState<Empleado[] | null>(null)
  const [falla, setFalla] = useState('')
  const [version, setVersion] = useState(0)
  const [borrador, setBorrador] = useState<Borrador>(leerBorrador)

  useEffect(() => {
    supabase
      .from('hilos33_empleados')
      .select('*')
      .order('nombre')
      .then(({ data, error }) => {
        if (error) setFalla(`No se pudo cargar la plantilla de 33 Hilos: ${error.message}`)
        else setFalla('')
        setEmpleados(((data ?? []) as Empleado[]).map((e) => ({ ...e, salario_diario: Number(e.salario_diario), sodexo: Number(e.sodexo) })))
      })
  }, [version])

  useEffect(() => {
    try {
      localStorage.setItem(CLAVE, JSON.stringify(borrador))
    } catch {
      // Sin almacenamiento: el borrador solo vive mientras la página esté abierta.
    }
  }, [borrador])

  const recargar = useCallback(() => setVersion((v) => v + 1), [])

  return (
    <div className="inicio admin salas bonos33">
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
        <div className="salas-titulo">
          <div>
            <h1>Bonos 33 Hilos</h1>
            <p className="admin-intro">
              Pega la tabla del correo, trae el tipo de cambio del DOF y la app corre la semana con bono de cada persona con la plantilla aprobada. Sale la
              tabla de facturación lista para autorizar.
            </p>
          </div>
        </div>
        <nav className="salas-pestanas" aria-label="Secciones de bonos">
          {(
            [
              ['bonos', 'Corrida de bonos'],
              ['plantilla', `Plantilla${empleados ? ` (${empleados.filter((e) => e.activo).length})` : ''}`],
              ['guardadas', 'Guardadas'],
            ] as const
          ).map(([id, texto]) => (
            <button key={id} type="button" className={pestana === id ? 'activo' : undefined} aria-current={pestana === id ? 'page' : undefined} onClick={() => setPestana(id)}>
              {texto}
            </button>
          ))}
        </nav>
        {falla && <div className="alerta" role="alert">{falla}</div>}
        {pestana === 'bonos' &&
          (empleados ? (
            <Corrida borrador={borrador} setBorrador={setBorrador} empleados={empleados} perfil={perfil} irAPlantilla={() => setPestana('plantilla')} />
          ) : (
            !falla && <p className="nota">Cargando plantilla…</p>
          ))}
        {pestana === 'plantilla' && <Plantilla33 empleados={empleados} alCambiar={recargar} />}
        {pestana === 'guardadas' && (
          <Guardadas
            abrir={(g) => {
              setBorrador({ id: g.id, opciones: { ...opcionesIniciales(), ...g.datos.opciones }, filas: g.datos.filas })
              setPestana('bonos')
            }}
            actual={borrador.id}
          />
        )}
      </div>
    </div>
  )
}

/* ───────── Corrida de bonos ───────── */

function Corrida({ borrador, setBorrador, empleados, perfil, irAPlantilla }: { borrador: Borrador; setBorrador: (f: (b: Borrador) => Borrador) => void; empleados: Empleado[]; perfil: Perfil; irAPlantilla: () => void }) {
  const { opciones: o, filas } = borrador
  const setO = (c: Partial<OpcionesBonos>) => setBorrador((b) => ({ ...b, opciones: { ...b.opciones, ...c } }))
  const setFilas = (f: (fs: FilaBono[]) => FilaBono[]) => setBorrador((b) => ({ ...b, filas: f(b.filas) }))
  const [pegado, setPegado] = useState('')
  const [aviso, setAviso] = useState<{ ok: boolean; texto: string } | null>(null)
  const [abierta, setAbierta] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState('')

  // El cálculo corre muchas corridas: se difiere para que escribir no se sienta lento.
  const filasD = useDeferredValue(filas)
  const oD = useDeferredValue(o)
  const porNum = useMemo(() => new Map(empleados.map((e) => [e.num, e])), [empleados])
  const resultados = useMemo(() => filasD.map((f) => calcularBono(f, f.num ? (porNum.get(f.num) ?? null) : null, oD)), [filasD, oD, porNum])
  const t = useMemo(() => totales(resultados), [resultados])
  const calculando = filasD !== filas || oD !== o
  const faltan = useMemo(() => sinBono(filas, empleados), [filas, empleados])
  const repetidos = useMemo(() => {
    const vistos = new Map<string, number>()
    for (const f of filas) if (f.num) vistos.set(f.num, (vistos.get(f.num) ?? 0) + 1)
    return [...vistos].filter(([, n]) => n > 1).map(([n]) => porNum.get(n)?.nombre ?? n)
  }, [filas, porNum])

  function leerPegado() {
    const leidas = leerTablaCorreo(pegado)
    if (!leidas.length) return setAviso({ ok: false, texto: 'No encontré renglones con nombre y monto. Copia la tabla completa del correo (con el encabezado) y pégala aquí.' })
    const activos = empleados.filter((e) => e.activo)
    const nuevas = leidas.map((f) => ({ ...f, id: nuevoId(), num: (emparejar(f.nombreCorreo, activos) ?? emparejar(f.nombreCorreo, empleados))?.num ?? null }))
    setFilas(() => nuevas)
    setPegado('')
    const sinPersona = nuevas.filter((f) => !f.num).length
    setAviso({ ok: !sinPersona, texto: `Leí ${nuevas.length} renglones${sinPersona ? `; ${sinPersona} sin persona en la plantilla (elígela en la tabla)` : ' y todos se emparejaron con la plantilla'}.` })
  }

  async function traerTC() {
    setOcupado('tc')
    setAviso(null)
    const fecha = o.fechaPago || new Date().toISOString().slice(0, 10)
    const { data, error } = await supabase.functions.invoke('tipo-cambio', { body: { fecha } })
    setOcupado('')
    if (error || !data?.valor) {
      let texto = 'No se pudo consultar el DOF. Escribe el tipo de cambio a mano.'
      try {
        texto = (await (error as { context?: Response })?.context?.json())?.error ?? texto
      } catch {
        // Se queda el texto general.
      }
      return setAviso({ ok: false, texto })
    }
    setO({ tipoCambio: String(data.valor), fuenteTC: `DOF, publicado el ${data.fecha}${data.fecha !== fecha ? ` (último antes del ${fecha})` : ''}` })
  }

  async function copiar() {
    const { html, texto } = tablaCliente(resultados, o)
    try {
      if (typeof ClipboardItem !== 'undefined' && navigator.clipboard?.write) {
        await navigator.clipboard.write([new ClipboardItem({ 'text/html': new Blob([html], { type: 'text/html' }), 'text/plain': new Blob([texto], { type: 'text/plain' }) })])
      } else await navigator.clipboard.writeText(texto)
      setAviso({ ok: true, texto: 'Tabla copiada. Pégala en el correo al cliente (Outlook la conserva con formato) o en Excel.' })
    } catch {
      setAviso({ ok: false, texto: 'El navegador no dejó copiar. Usa "Descargar Excel".' })
    }
  }

  async function descargar() {
    setOcupado('excel')
    try {
      const avisos = [...faltan.map((e) => `${nombrePropio(e.nombre)}: activa en la plantilla y sin renglón en el correo.`), ...repetidos.map((n) => `${n}: aparece más de una vez.`)]
      await guardarArchivo(await excelBonos(resultados, o, avisos), `${nombreArchivo(o)}.xlsx`)
      registrar('bonos33_excel', { plantilla: 'bonos33', documento: nombreArchivo(o), detalle: { opciones: o, filas } })
    } catch (e) {
      setAviso({ ok: false, texto: `No se pudo generar el Excel: ${e instanceof Error ? e.message : e}` })
    }
    setOcupado('')
  }

  async function guardar() {
    setOcupado('guardar')
    const fila = {
      titulo: o.titulo.trim() || 'Bonos 33 Hilos',
      fecha_pago: o.fechaPago || null,
      tipo_cambio: num(o.tipoCambio) || null,
      datos: { opciones: o, filas },
      resumen: { totalFactura: t.totalFactura, usd: t.usd, bonoBruto: t.bonoBruto, calculados: t.calculados, pendientes: t.pendientes },
      creado_por_email: perfil.email,
      actualizado: new Date().toISOString(),
    }
    const res = borrador.id ? await supabase.from('hilos33_bonos').update(fila).eq('id', borrador.id).select('id').single() : await supabase.from('hilos33_bonos').insert(fila).select('id').single()
    setOcupado('')
    if (res.error) return setAviso({ ok: false, texto: `No se pudo guardar: ${res.error.message}` })
    setBorrador((b) => ({ ...b, id: res.data.id }))
    registrar('bonos33_guardado', { plantilla: 'bonos33', documento: fila.titulo, detalle: fila.resumen })
    setAviso({ ok: true, texto: borrador.id ? 'Cambios guardados.' : 'Corrida guardada. La encuentras en "Guardadas".' })
  }

  function nueva() {
    if (filas.length && !confirm('¿Empezar una corrida nueva? La actual se queda en "Guardadas" solo si la guardaste.')) return
    setBorrador(() => ({ id: null, opciones: { ...opcionesIniciales(), servicio: o.servicio, cuotas: o.cuotas }, filas: [] }))
    setAviso(null)
  }

  const listo = t.calculados > 0 && num(o.tipoCambio) > 0
  const validaciones = [
    { ok: num(o.tipoCambio) > 0, texto: num(o.tipoCambio) > 0 ? `Tipo de cambio ${num(o.tipoCambio).toFixed(4)}${o.fuenteTC ? ` (${o.fuenteTC})` : ' (capturado a mano)'}` : 'Falta el tipo de cambio' },
    { ok: t.sinEmpleado === 0, texto: t.sinEmpleado ? `${t.sinEmpleado} ${t.sinEmpleado === 1 ? 'renglón' : 'renglones'} sin persona de la plantilla` : 'Todos los renglones tienen a su persona' },
    { ok: repetidos.length === 0, texto: repetidos.length ? `Repetidos: ${repetidos.map(nombrePropio).join(', ')}` : 'Nadie repetido' },
    ...(t.pendientes ? [{ ok: false, texto: `${t.pendientes} ${t.pendientes === 1 ? 'pendiente' : 'pendientes'} (TBD) fuera del total`, nivel: 'pendiente' }] : []),
    ...(faltan.length ? [{ ok: false, texto: `Activos sin renglón en el correo: ${faltan.map((e) => nombrePropio(e.nombre)).join(', ')}`, nivel: 'pendiente' }] : []),
    ...resultados.filter((r) => r.estado === 'ok' && r.avisos.length).map((r) => ({ ok: false, texto: `${nombrePropio(r.empleado!.nombre)}: ${r.avisos.join(' ')}`, nivel: 'pendiente' })),
  ]

  return (
    <>
      <section className="admin-caja">
        <div className="bonos-cab">
          <h2>1. Datos de la corrida</h2>
          <span className="bonos-acciones-sec">
            {borrador.id && <span className="salas-insignia">Guardada</span>}
            <button type="button" className="link" onClick={nueva}>
              Nueva corrida
            </button>
          </span>
        </div>
        <div className="bonos-datos">
          <div className="campo">
            <label htmlFor="b-titulo">Título</label>
            <input id="b-titulo" value={o.titulo} maxLength={200} onChange={(e) => setO({ titulo: e.target.value })} placeholder="Bonos Q4 2026" />
          </div>
          <div className="campo">
            <label htmlFor="b-fecha">Fecha de pago</label>
            <input id="b-fecha" type="date" value={o.fechaPago} onChange={(e) => setO({ fechaPago: e.target.value })} />
          </div>
          <div className="campo bonos-tc">
            <label htmlFor="b-tc">Tipo de cambio (MXN por USD)</label>
            <div className="bonos-tc-fila">
              <input id="b-tc" inputMode="decimal" value={o.tipoCambio} onChange={(e) => setO({ tipoCambio: e.target.value, fuenteTC: '' })} placeholder="18.1128" />
              <button type="button" className="btn secundario" onClick={traerTC} disabled={ocupado === 'tc'}>
                {ocupado === 'tc' ? 'Consultando…' : 'Traer del DOF'}
              </button>
            </div>
            <small>{o.fuenteTC || 'FIX publicado en el Diario Oficial para la fecha de pago (si no hay publicación ese día, el último anterior).'}</small>
          </div>
          <div className="campo">
            <label htmlFor="b-serv">Costo de servicio (%)</label>
            <input id="b-serv" inputMode="decimal" value={o.servicio} onChange={(e) => setO({ servicio: e.target.value })} />
          </div>
        </div>
        <fieldset className="bonos-cuotas">
          <legend>Cuotas patronales que se facturan</legend>
          <label className="casilla">
            <input type="radio" name="cuotas" checked={o.cuotas === 'semana'} onChange={() => setO({ cuotas: 'semana' })} />
            Toda la semana con bono <span className="nota">(como la tabla del Excel actual)</span>
          </label>
          <label className="casilla">
            <input type="radio" name="cuotas" checked={o.cuotas === 'incremento'} onChange={() => setO({ cuotas: 'incremento' })} />
            Solo lo que sube por el bono <span className="nota">(impuesto estatal; el IMSS no cambia)</span>
          </label>
        </fieldset>
      </section>

      <section className="admin-caja">
        <h2>2. Bonos del correo</h2>
        <div className="campo">
          <label htmlFor="b-pegar">Pega la tabla del correo (Name · Gross/Net · Bonus amount (USD) · Notes)</label>
          <textarea id="b-pegar" rows={4} value={pegado} onChange={(e) => setPegado(e.target.value)} placeholder={'Angeles, Regine\tGross\t$417.00\nCamarillo, Edgar\t\tTBD\tI will share as soon as I have it\nVargas, Francisco\tNet\t$1,250.00'} />
          <small>Selecciona la tabla en Outlook, cópiala y pégala aquí. La app reconoce Gross/Net, TBD y N/A y empareja cada nombre con la plantilla.</small>
        </div>
        <div className="admin-acciones">
          <button type="button" className="btn primario" onClick={leerPegado} disabled={!pegado.trim()}>
            Leer tabla{filas.length ? ' (reemplaza la actual)' : ''}
          </button>
          <button type="button" className="btn secundario" onClick={() => setFilas((fs) => [...fs, { id: nuevoId(), nombreCorreo: '', num: null, tipo: 'gross', usd: '', estado: 'monto', notas: '' }])}>
            Agregar renglón
          </button>
        </div>
        {aviso && (
          <div className={aviso.ok ? 'credenciales' : 'alerta'} role="status">
            {aviso.texto}
          </div>
        )}
        {filas.length > 0 && (
          <div className="bonos-tabla-caja">
            <table className="bonos-tabla bonos-captura">
              <thead>
                <tr>
                  <th>Nombre en el correo</th>
                  <th>Persona de la plantilla</th>
                  <th>Tipo</th>
                  <th>USD</th>
                  <th>Notas</th>
                  <th aria-label="Quitar" />
                </tr>
              </thead>
              <tbody>
                {filas.map((f) => {
                  const cambiar = (c: Partial<FilaBono>) => setFilas((fs) => fs.map((x) => (x.id === f.id ? { ...x, ...c } : x)))
                  return (
                    <tr key={f.id} className={f.num ? undefined : 'sin-persona'}>
                      <td>
                        <input aria-label="Nombre en el correo" value={f.nombreCorreo} onChange={(e) => cambiar({ nombreCorreo: e.target.value })} />
                      </td>
                      <td>
                        <select aria-label="Persona de la plantilla" value={f.num ?? ''} onChange={(e) => cambiar({ num: e.target.value || null })}>
                          <option value="">— Elige —</option>
                          {empleados.map((e) => (
                            <option key={e.num} value={e.num}>
                              {nombrePropio(e.nombre)}
                              {e.activo ? '' : ' (inactiva)'}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <select aria-label="Tipo" value={f.estado === 'monto' ? f.tipo : f.estado} onChange={(e) => (e.target.value === 'gross' || e.target.value === 'net' ? cambiar({ tipo: e.target.value, estado: 'monto' }) : cambiar({ estado: e.target.value as FilaBono['estado'] }))}>
                          <option value="gross">Gross</option>
                          <option value="net">Net</option>
                          <option value="tbd">TBD</option>
                          <option value="na">N/A</option>
                        </select>
                      </td>
                      <td>
                        <input aria-label="Monto en USD" inputMode="decimal" className="num" value={f.usd} disabled={f.estado !== 'monto'} onChange={(e) => cambiar({ usd: e.target.value })} />
                      </td>
                      <td>
                        <input aria-label="Notas" value={f.notas} onChange={(e) => cambiar({ notas: e.target.value })} />
                      </td>
                      <td>
                        <button type="button" className="link peligro" aria-label={`Quitar ${f.nombreCorreo}`} onClick={() => setFilas((fs) => fs.filter((x) => x.id !== f.id))}>
                          ✕
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
        {empleados.length === 0 && (
          <p className="nota">
            La plantilla está vacía. <button type="button" className="link" onClick={irAPlantilla}>Cárgala con el listado de nómina</button>.
          </p>
        )}
      </section>

      {filas.length > 0 && (
        <section className="admin-caja">
          <div className="bonos-cab">
            <h2>3. Facturación para autorizar</h2>
            {calculando && <span className="nota">Calculando…</span>}
          </div>
          <div className="bonos-kpis">
            <div>
              <span>Bonos (USD)</span>
              <strong>{dolares(t.usd)}</strong>
            </div>
            <div>
              <span>Bono bruto (MXN)</span>
              <strong>{dinero(t.bonoBruto)}</strong>
            </div>
            <div>
              <span>Neto que reciben</span>
              <strong>{dinero(t.netoBono)}</strong>
            </div>
            <div className="destacado">
              <span>Total a facturar</span>
              <strong>{dinero(t.totalFactura)}</strong>
            </div>
          </div>
          <p className="nota">
            {t.calculados} con bono · {t.pendientes} {t.pendientes === 1 ? 'pendiente' : 'pendientes'} (TBD) · {t.excluidos} sin bono (N/A){t.sinEmpleado ? ` · ${t.sinEmpleado} sin persona` : ''}. Da clic en un renglón para ver su corrida sin y con bono.
          </p>
          <div className="bonos-tabla-caja">
            <table className="bonos-tabla">
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Tipo</th>
                  <th className="num">USD</th>
                  <th className="num">Bono bruto</th>
                  <th className="num">Neto que recibe</th>
                  <th className="num">ISR del bono</th>
                  <th className="num">Cuotas patronales</th>
                  <th className="num">Total factura</th>
                </tr>
              </thead>
              <tbody>
                {resultados.map((r) => (
                  <FilaResultado key={r.fila.id} r={r} abierta={abierta === r.fila.id} alternar={() => setAbierta((a) => (a === r.fila.id ? null : r.fila.id))} />
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td>Total</td>
                  <td />
                  <td className="num">{dolares(t.usd)}</td>
                  <td className="num">{dinero(t.bonoBruto)}</td>
                  <td className="num">{dinero(t.netoBono)}</td>
                  <td className="num">{dinero(t.isrBono)}</td>
                  <td className="num">{dinero(t.patronalesFactura)}</td>
                  <td className="num">{dinero(t.totalFactura)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
          <ul className="bonos-validacion">
            {validaciones.map((v, i) => (
              <li key={i} className={v.ok ? 'ok' : 'nivel' in v ? 'pendiente' : 'error'}>
                {v.texto}
              </li>
            ))}
          </ul>
          <div className="admin-acciones bonos-salidas">
            <button type="button" className="btn primario" onClick={descargar} disabled={!listo || ocupado === 'excel'}>
              {ocupado === 'excel' ? 'Generando…' : 'Descargar Excel'}
            </button>
            <button type="button" className="btn secundario" onClick={copiar} disabled={!listo}>
              Copiar tabla para el cliente
            </button>
            <button type="button" className="btn secundario" onClick={guardar} disabled={ocupado === 'guardar'}>
              {ocupado === 'guardar' ? 'Guardando…' : borrador.id ? 'Guardar cambios' : 'Guardar corrida'}
            </button>
          </div>
        </section>
      )}
    </>
  )
}

const ETIQUETA_ESTADO: Record<ResultadoBono['estado'], string> = { ok: '', pendiente: 'Pendiente', excluido: 'N/A', sinEmpleado: 'Sin persona' }

function FilaResultado({ r, abierta, alternar }: { r: ResultadoBono; abierta: boolean; alternar: () => void }) {
  const nombre = r.empleado ? nombrePropio(r.empleado.nombre) : r.fila.nombreCorreo || '(sin nombre)'
  if (r.estado !== 'ok') {
    return (
      <tr className={`bonos-${r.estado}`}>
        <td>
          <strong>{nombre}</strong>
          {r.empleado?.puesto && <small>{r.empleado.puesto}</small>}
        </td>
        <td>
          <span className="salas-insignia">{ETIQUETA_ESTADO[r.estado]}</span>
        </td>
        <td colSpan={6} className="nota">
          {r.avisos.join(' ')}
        </td>
      </tr>
    )
  }
  return (
    <>
      <tr className={`clic${abierta ? ' abierta' : ''}${r.avisos.length ? ' con-aviso' : ''}`} onClick={alternar} tabIndex={0} onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), alternar())} aria-expanded={abierta}>
        <td>
          <strong>{nombre}</strong>
          <small>{r.empleado!.puesto}</small>
        </td>
        <td>{r.fila.tipo === 'net' ? 'Net' : 'Gross'}</td>
        <td className="num">{dolares(r.usd)}</td>
        <td className="num">{dinero(r.bonoBruto)}</td>
        <td className="num">{dinero(r.netoBono)}</td>
        <td className="num">{dinero(r.isrBono)}</td>
        <td className="num">{dinero(r.patronalesFactura)}</td>
        <td className="num">
          <strong>{dinero(r.totalFactura)}</strong>
        </td>
      </tr>
      {abierta && (
        <tr className="bonos-detalle">
          <td colSpan={8}>
            <Detalle r={r} />
          </td>
        </tr>
      )}
    </>
  )
}

function Detalle({ r }: { r: ResultadoBono }) {
  const b = r.base!
  const c = r.con!
  const renglones: [string, number, number, boolean?][] = [
    ['Sueldo ordinario', b.percepciones[0].monto, c.percepciones[0].monto],
    ['Séptimo día', b.percepciones[1].monto, c.percepciones[1].monto],
    ['Bono de puntualidad', b.percepciones[2].monto, c.percepciones[2].monto],
    ['Bono de asistencia', b.percepciones[3].monto, c.percepciones[3].monto],
    [r.fila.tipo === 'net' ? 'Bono (neto llevado a bruto)' : 'Bono', 0, r.bonoBruto],
    ['Bruto semanal', b.totalPercepciones.monto, c.totalPercepciones.monto, true],
    ['IMSS trabajador', b.deducciones[0].monto, c.deducciones[0].monto],
    ['ISR (ISPT)', b.deducciones[1].monto, c.deducciones[1].monto],
    ['Neto', b.neto.monto, c.neto.monto, true],
    ['Neto + Sodexo', b.netoSodexo.monto, c.netoSodexo.monto],
    ['IMSS patronal', b.patronales[0].monto, c.patronales[0].monto],
    ['Infonavit', b.patronales[1].monto, c.patronales[1].monto],
    ['Retiro', b.patronales[2].monto, c.patronales[2].monto],
    ['Impuesto estatal', b.patronales[3].monto, c.patronales[3].monto],
    ['Total cuotas patronales', b.totalPatronales.monto, c.totalPatronales.monto, true],
    ['Factura semanal (+ IVA)', b.total.monto, c.total.monto, true],
  ]
  return (
    <div className="bonos-detalle-caja">
      <p className="nota">
        No. {r.empleado!.num} · Salario diario {dinero(b.salarioDiario)} · {r.empleado!.fuente}
        {r.fila.tipo === 'net' && ` · Neto pedido ${dinero(r.montoMxn)} (${dolares(r.usd)} × TC)`}
      </p>
      <table className="bonos-comparativo">
        <thead>
          <tr>
            <th>Concepto</th>
            <th className="num">Semana sin bono</th>
            <th className="num">Semana con bono</th>
            <th className="num">Diferencia</th>
          </tr>
        </thead>
        <tbody>
          {renglones.map(([t, s, k, fuerte]) => (
            <tr key={t} className={fuerte ? 'fuerte' : undefined}>
              <td>{t}</td>
              <td className="num">{dinero(s)}</td>
              <td className="num">{dinero(k)}</td>
              <td className="num">{Math.abs(k - s) < 0.005 ? '—' : dinero(k - s)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {r.avisos.length > 0 && <div className="alerta">{r.avisos.join(' ')}</div>}
    </div>
  )
}

/* ───────── Guardadas ───────── */

function Guardadas({ abrir, actual }: { abrir: (g: Guardada) => void; actual: string | null }) {
  const [lista, setLista] = useState<Guardada[] | null>(null)
  const [falla, setFalla] = useState('')
  const [version, setVersion] = useState(0)
  useEffect(() => {
    supabase
      .from('hilos33_bonos')
      .select('*')
      .order('actualizado', { ascending: false })
      .limit(50)
      .then(({ data, error }) => {
        setFalla(error ? `No se pudieron cargar: ${error.message}` : '')
        setLista((data as Guardada[]) ?? [])
      })
  }, [version])
  return (
    <section className="admin-caja">
      <h2>Corridas de bonos guardadas</h2>
      {falla && <div className="alerta">{falla}</div>}
      {!lista ? (
        !falla && <p className="nota">Cargando…</p>
      ) : lista.length === 0 ? (
        <p className="nota">Todavía no hay corridas guardadas. En "Corrida de bonos" usa "Guardar corrida".</p>
      ) : (
        <ul className="admin-lista">
          {lista.map((g) => (
            <li key={g.id} className="admin-usuario">
              <div className="admin-quien">
                <strong>
                  {g.titulo} {g.id === actual && <em className="salas-insignia">Abierta</em>}
                </strong>
                <span>
                  {g.resumen.calculados ?? 0} personas · {dolares(g.resumen.usd ?? 0)} · facturación {dinero(g.resumen.totalFactura ?? 0)}
                  {g.tipo_cambio ? ` · TC ${Number(g.tipo_cambio).toFixed(4)}` : ''}
                  {g.fecha_pago ? ` · pago ${g.fecha_pago}` : ''}
                </span>
                <small>
                  {g.creado_por_email} · {new Date(g.actualizado).toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' })}
                </small>
              </div>
              <div className="admin-acciones">
                <button type="button" className="btn secundario" onClick={() => abrir(g)}>
                  Abrir
                </button>
                <button
                  type="button"
                  className="link peligro"
                  onClick={async () => {
                    if (!confirm(`¿Borrar "${g.titulo}"?`)) return
                    const { error } = await supabase.from('hilos33_bonos').delete().eq('id', g.id)
                    if (error) setFalla(`No se pudo borrar: ${error.message}`)
                    setVersion((v) => v + 1)
                  }}
                >
                  Borrar
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
