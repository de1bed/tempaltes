import { useState } from 'react'
import { registrar, supabase } from '../lib/supabase'
import { nombrePropio, num, type Empleado } from './calculo'
import { filasXlsx, lineasPdf } from './archivos'
import { leerBase, leerListado } from './listado'
import { aplicarCambios, compararBase, compararListado, ETIQUETA_CAMBIO, type CambioPlantilla } from './plantilla'

const dinero = (x: number) => x.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

type Edicion = Partial<Pick<Empleado, 'puesto' | 'activo'>> & { salario_diario?: string; sodexo?: string }

/** Plantilla de 33 Hilos: se actualiza con el listado de nómina (PDF) o la base Salary (Excel), y se corrige a mano. */
export function Plantilla33({ empleados, alCambiar }: { empleados: Empleado[] | null; alCambiar: () => void }) {
  const [revision, setRevision] = useState<{ archivo: string; fuente: string; cambios: CambioPlantilla[]; total: number } | null>(null)
  const [leyendo, setLeyendo] = useState(false)
  const [aviso, setAviso] = useState<{ ok: boolean; texto: string } | null>(null)
  const [ediciones, setEdiciones] = useState<Record<string, Edicion>>({})
  const [filtro, setFiltro] = useState('')
  const [verInactivos, setVerInactivos] = useState(false)
  const [alta, setAlta] = useState({ num: '', nombre: '', puesto: '', salario_diario: '' })

  async function cargar(archivo: File) {
    if (!empleados) return
    setAviso(null)
    setLeyendo(true)
    try {
      const datos = await archivo.arrayBuffer()
      if (/\.pdf$/i.test(archivo.name)) {
        const l = leerListado(await lineasPdf(datos))
        if (!l.personas.length) throw new Error('No encontré personas en el PDF. ¿Es el "Listado de Nómina" del sistema?')
        const fuente = `Listado de nómina ${l.periodo || archivo.name}`.slice(0, 200)
        const cambios = compararListado(empleados, l.personas, fuente)
        setRevision({ archivo: archivo.name, fuente, cambios, total: l.personas.length })
        if (l.totalEmpleados && l.totalEmpleados !== l.personas.length) setAviso({ ok: false, texto: `El PDF dice ${l.totalEmpleados} empleados y leí ${l.personas.length}. Revisa que esté completo.` })
      } else if (/\.xlsx$/i.test(archivo.name)) {
        const personas = leerBase(await filasXlsx(datos))
        if (!personas.length) throw new Error('No encontré la tabla (columnas Num, Name, Position, Gross Weekly Salary).')
        const fuente = `Base ${archivo.name.replace(/\.xlsx$/i, '')}`.slice(0, 200)
        setRevision({ archivo: archivo.name, fuente, cambios: compararBase(empleados, personas, fuente), total: personas.length })
      } else throw new Error('Sube el PDF del listado de nómina o el Excel de la base Salary.')
    } catch (e) {
      setAviso({ ok: false, texto: e instanceof Error ? e.message : String(e) })
    }
    setLeyendo(false)
  }

  async function aplicar() {
    if (!revision || !empleados) return
    const filas = aplicarCambios(empleados, revision.cambios, revision.fuente).map((f) => ({ ...f, actualizado: new Date().toISOString() }))
    if (!filas.length) return setRevision(null)
    const { error } = await supabase.from('hilos33_empleados').upsert(filas)
    if (error) return setAviso({ ok: false, texto: `No se pudo guardar: ${error.message}` })
    registrar('bonos33_plantilla', { plantilla: 'bonos33', documento: revision.archivo, detalle: { cambios: revision.cambios.filter((c) => c.marcado).length } })
    setAviso({ ok: true, texto: `Plantilla actualizada con ${revision.archivo}: ${filas.length} personas.` })
    setRevision(null)
    alCambiar()
  }

  async function guardarFila(e: Empleado) {
    const ed = ediciones[e.num]
    if (!ed) return
    const cambios: Partial<Empleado> & { actualizado: string } = { actualizado: new Date().toISOString() }
    if (ed.puesto !== undefined) cambios.puesto = ed.puesto.trim()
    if (ed.activo !== undefined) cambios.activo = ed.activo
    if (ed.sodexo !== undefined) cambios.sodexo = num(ed.sodexo)
    if (ed.salario_diario !== undefined) {
      cambios.salario_diario = num(ed.salario_diario)
      cambios.fuente = 'Captura manual'
    }
    const { error } = await supabase.from('hilos33_empleados').update(cambios).eq('num', e.num)
    if (error) return setAviso({ ok: false, texto: `No se pudo guardar a ${nombrePropio(e.nombre)}: ${error.message}` })
    setEdiciones((x) => {
      const resto = { ...x }
      delete resto[e.num]
      return resto
    })
    alCambiar()
  }

  async function agregar() {
    const fila = { num: alta.num.trim(), nombre: alta.nombre.trim().toUpperCase(), puesto: alta.puesto.trim(), salario_diario: num(alta.salario_diario), fuente: 'Captura manual' }
    if (!/^\d+$/.test(fila.num) || !fila.nombre || fila.salario_diario <= 0) return setAviso({ ok: false, texto: 'Para agregar: número de empleado, nombre y salario diario.' })
    const { error } = await supabase.from('hilos33_empleados').insert(fila)
    if (error) return setAviso({ ok: false, texto: error.code === '23505' ? 'Ese número de empleado ya existe.' : `No se pudo agregar: ${error.message}` })
    setAlta({ num: '', nombre: '', puesto: '', salario_diario: '' })
    alCambiar()
  }

  const q = filtro.trim().toLowerCase()
  const visibles = (empleados ?? []).filter((e) => (verInactivos || e.activo) && (!q || `${e.nombre} ${e.puesto} ${e.num}`.toLowerCase().includes(q)))

  return (
    <>
      <section className="admin-caja">
        <h2>Actualizar con el listado de nómina</h2>
        <p className="nota">
          Sube el PDF "Listado de Nómina" de la semana (trae el salario diario vigente) o el Excel de la base "Salary 33 Threads" (trae el puesto completo). Se
          lee en tu navegador; antes de guardar ves qué cambia.
        </p>
        <label className="btn primario bonos-subir">
          {leyendo ? 'Leyendo…' : 'Subir PDF o Excel'}
          <input type="file" accept=".pdf,.xlsx" hidden disabled={leyendo} onChange={(e) => (e.target.files?.[0] && void cargar(e.target.files[0]), (e.target.value = ''))} />
        </label>
        {aviso && (
          <div className={aviso.ok ? 'credenciales' : 'alerta'} role="status">
            {aviso.texto}
          </div>
        )}
        {revision && (
          <div className="bonos-revision">
            <h3>
              {revision.archivo}: {revision.total} personas
            </h3>
            {revision.cambios.length === 0 ? (
              <p className="nota">Todo coincide con la plantilla; no hay nada que cambiar.</p>
            ) : (
              <ul>
                {revision.cambios.map((c, i) => (
                  <li key={`${c.tipo}-${c.num}`}>
                    <label className="casilla">
                      <input type="checkbox" checked={c.marcado} onChange={(e) => setRevision({ ...revision, cambios: revision.cambios.map((x, j) => (j === i ? { ...x, marcado: e.target.checked } : x)) })} />
                      <span className={`bonos-cambio ${c.tipo}`}>{ETIQUETA_CAMBIO[c.tipo]}</span> <strong>{nombrePropio(c.nombre)}</strong>
                      <span className="nota">
                        {c.antes ? `${c.antes} → ` : ''}
                        {c.despues}
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            )}
            <div className="admin-acciones">
              <button type="button" className="btn primario" onClick={aplicar} disabled={!revision.cambios.some((c) => c.marcado)}>
                Aplicar {revision.cambios.filter((c) => c.marcado).length} cambios
              </button>
              <button type="button" className="btn secundario" onClick={() => setRevision(null)}>
                Descartar
              </button>
            </div>
          </div>
        )}
      </section>

      <section className="admin-caja">
        <div className="bitacora-cab">
          <h2>Plantilla de 33 Hilos</h2>
          <div className="campo bitacora-filtro">
            <label htmlFor="p-filtro">Buscar</label>
            <input id="p-filtro" type="search" value={filtro} onChange={(e) => setFiltro(e.target.value)} placeholder="Nombre, puesto o número" />
          </div>
        </div>
        <label className="casilla">
          <input type="checkbox" checked={verInactivos} onChange={(e) => setVerInactivos(e.target.checked)} />
          Ver también inactivos
        </label>
        {!empleados ? (
          <p className="nota">Cargando…</p>
        ) : (
          <div className="bonos-tabla-caja">
            <table className="bonos-tabla bonos-captura">
              <thead>
                <tr>
                  <th>No.</th>
                  <th>Nombre</th>
                  <th>Puesto</th>
                  <th className="num">Salario diario</th>
                  <th className="num">Sodexo</th>
                  <th>Activo</th>
                  <th>Fuente</th>
                  <th aria-label="Guardar" />
                </tr>
              </thead>
              <tbody>
                {visibles.map((e) => {
                  const ed = ediciones[e.num] ?? {}
                  const cambiar = (c: Edicion) => setEdiciones((x) => ({ ...x, [e.num]: { ...x[e.num], ...c } }))
                  return (
                    <tr key={e.num} className={e.activo ? undefined : 'inactivo'}>
                      <td>{e.num}</td>
                      <td>{nombrePropio(e.nombre)}</td>
                      <td>
                        <input aria-label={`Puesto de ${e.nombre}`} value={ed.puesto ?? e.puesto} onChange={(x) => cambiar({ puesto: x.target.value })} />
                      </td>
                      <td>
                        <input aria-label={`Salario diario de ${e.nombre}`} className="num" inputMode="decimal" value={ed.salario_diario ?? dinero(e.salario_diario)} onChange={(x) => cambiar({ salario_diario: x.target.value })} />
                      </td>
                      <td>
                        <input aria-label={`Sodexo de ${e.nombre}`} className="num corto" inputMode="decimal" value={ed.sodexo ?? String(e.sodexo)} onChange={(x) => cambiar({ sodexo: x.target.value })} />
                      </td>
                      <td>
                        <input type="checkbox" aria-label={`${e.nombre} activo`} checked={ed.activo ?? e.activo} onChange={(x) => cambiar({ activo: x.target.checked })} />
                      </td>
                      <td>
                        <small>{e.fuente}</small>
                      </td>
                      <td>
                        {ediciones[e.num] && (
                          <button type="button" className="btn primario chico" onClick={() => guardarFila(e)}>
                            Guardar
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
        <details className="bonos-alta">
          <summary>Agregar a alguien a mano</summary>
          <div className="bonos-datos">
            <div className="campo">
              <label htmlFor="a-num">No. de empleado</label>
              <input id="a-num" inputMode="numeric" value={alta.num} onChange={(e) => setAlta({ ...alta, num: e.target.value })} />
            </div>
            <div className="campo">
              <label htmlFor="a-nombre">Nombre (apellidos primero)</label>
              <input id="a-nombre" value={alta.nombre} onChange={(e) => setAlta({ ...alta, nombre: e.target.value })} />
            </div>
            <div className="campo">
              <label htmlFor="a-puesto">Puesto</label>
              <input id="a-puesto" value={alta.puesto} onChange={(e) => setAlta({ ...alta, puesto: e.target.value })} />
            </div>
            <div className="campo">
              <label htmlFor="a-sd">Salario diario</label>
              <input id="a-sd" inputMode="decimal" value={alta.salario_diario} onChange={(e) => setAlta({ ...alta, salario_diario: e.target.value })} />
            </div>
          </div>
          <button type="button" className="btn secundario" onClick={agregar}>
            Agregar
          </button>
        </details>
      </section>
    </>
  )
}
