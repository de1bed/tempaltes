import { useDeferredValue, useMemo, useState } from 'react'
import { guardarArchivo } from '../lib/guardar'
import { registrar } from '../lib/supabase'
import { calcularBono, nombrePropio, type Empleado, type FilaBono, type OpcionesBonos } from './calculo'
import { listadoNominaPdf, nombreListado } from './listadoPdf'
import { bonosPorEmpleado, nominaSemanal, semanaDe, semanaNumero, totalesNomina } from './nomina'
import { excelNomina } from './reporte'

const dinero = (x: number) => x.toLocaleString('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 2, maximumFractionDigits: 2 })

/**
 * Nómina semanal de toda la plantilla con la corrida aprobada de 33 Hilos: lo que se paga a cada
 * persona y lo que se factura a 33 Threads. Sale el listado de nómina (PDF) y la base "Salary 33 Threads" (Excel).
 */
export function NominaSemanal({ empleados, bonos, irAPlantilla }: { empleados: Empleado[]; bonos: { opciones: OpcionesBonos; filas: FilaBono[] }; irAPlantilla: () => void }) {
  const hoy = useMemo(() => semanaDe(new Date()), [])
  const [anio, setAnio] = useState(() => Number(hoy.hasta.slice(0, 4)))
  const [numero, setNumero] = useState(hoy.numero)
  const [servicio, setServicio] = useState('7.25')
  const [conBonos, setConBonos] = useState(false)
  const [redondear, setRedondear] = useState(true)
  const [ocupado, setOcupado] = useState('')
  const [aviso, setAviso] = useState<{ ok: boolean; texto: string } | null>(null)

  const semana = useMemo(() => semanaNumero(anio, Math.min(53, Math.max(1, numero || 1))), [anio, numero])
  const activos = useMemo(() => empleados.filter((e) => e.activo), [empleados])
  const hayBonos = bonos.filas.some((f) => f.estado === 'monto' && Number(f.usd) > 0) && Number(bonos.opciones.tipoCambio) > 0
  const mapaBonos = useMemo(() => {
    if (!conBonos || !hayBonos) return new Map<string, number>()
    const porNum = new Map(empleados.map((e) => [e.num, e]))
    return bonosPorEmpleado(bonos.filas.map((f) => calcularBono(f, f.num ? (porNum.get(f.num) ?? null) : null, bonos.opciones)))
  }, [conBonos, hayBonos, bonos, empleados])
  const entradaActual = useMemo(() => ({ activos, servicio, mapaBonos, redondear }), [activos, servicio, mapaBonos, redondear])
  // Muchas corridas a la vez: se difiere para que escribir no se sienta lento.
  const entrada = useDeferredValue(entradaActual)
  const filas = useMemo(() => nominaSemanal(entrada.activos, entrada.servicio, entrada.mapaBonos, entrada.redondear), [entrada])
  const t = useMemo(() => totalesNomina(filas), [filas])
  const opcionesPdf = { semana, empresa: 'TREVE · 33 HILOS', bono: conBonos && mapaBonos.size ? bonos.opciones.titulo : undefined }

  async function pdf() {
    setOcupado('pdf')
    try {
      await guardarArchivo(await listadoNominaPdf(filas, opcionesPdf), `${nombreListado(opcionesPdf)}.pdf`)
      registrar('bonos33_listado', { plantilla: 'bonos33', documento: nombreListado(opcionesPdf), detalle: { semana, personas: filas.length, factura: t.factura } })
    } catch (e) {
      setAviso({ ok: false, texto: `No se pudo generar el PDF: ${e instanceof Error ? e.message : e}` })
    }
    setOcupado('')
  }

  async function excel() {
    setOcupado('excel')
    try {
      const titulo = opcionesPdf.bono ? `Includes ${opcionesPdf.bono}` : 'Regular week'
      await guardarArchivo(await excelNomina(filas, semana, servicio, titulo), `Salary 33 Threads - Semana ${semana.numero} (${semana.desde}).xlsx`)
      registrar('bonos33_nomina', { plantilla: 'bonos33', documento: `Nómina 33 Hilos semana ${semana.numero}`, detalle: { semana, personas: filas.length, factura: t.factura } })
    } catch (e) {
      setAviso({ ok: false, texto: `No se pudo generar el Excel: ${e instanceof Error ? e.message : e}` })
    }
    setOcupado('')
  }

  return (
    <section className="admin-caja">
      <h2>Nómina semanal de 33 Hilos</h2>
      <p className="nota">
        Corre la semana de cada persona activa de la plantilla con la corrida aprobada de 33 Hilos (la misma de Corridas). Sale el listado de nómina en PDF
        y el Excel con el formato de la base "Salary 33 Threads".
      </p>
      <div className="bonos-datos nomina-datos">
        <div className="campo">
          <label htmlFor="n-semana">Semana</label>
          <div className="bonos-tc-fila">
            <input id="n-semana" type="number" min={1} max={53} value={numero} onChange={(e) => setNumero(Number(e.target.value))} />
            <input aria-label="Año" type="number" min={2024} max={2100} value={anio} onChange={(e) => setAnio(Number(e.target.value))} />
          </div>
          <small>
            Del {semana.desde} al {semana.hasta} (lunes a domingo)
          </small>
        </div>
        <div className="campo">
          <label htmlFor="n-serv">Costo de servicio (%)</label>
          <input id="n-serv" inputMode="decimal" value={servicio} onChange={(e) => setServicio(e.target.value)} />
        </div>
        <div className="campo nomina-casillas">
          <label className="casilla">
            <input type="checkbox" checked={redondear} onChange={(e) => setRedondear(e.target.checked)} />
            Neto en múltiplos de 50 centavos (ajuste por diferencia de moneda, como el sistema)
          </label>
          <label className="casilla">
            <input type="checkbox" checked={conBonos && hayBonos} disabled={!hayBonos} onChange={(e) => setConBonos(e.target.checked)} />
            Incluir los bonos de la corrida de bonos abierta{hayBonos ? ` (${bonos.opciones.titulo})` : ' (no hay bonos calculados)'}
          </label>
        </div>
      </div>
      {activos.length === 0 ? (
        <p className="nota">
          La plantilla está vacía. <button type="button" className="link" onClick={irAPlantilla}>Cárgala con el listado de nómina</button>.
        </p>
      ) : (
        <>
          <div className="bonos-kpis">
            <div>
              <span>Personas</span>
              <strong>{t.personas}</strong>
            </div>
            <div>
              <span>Neto a pagar (+ Sodexo)</span>
              <strong>{dinero(t.netoSodexo)}</strong>
            </div>
            <div>
              <span>Impuestos patronales</span>
              <strong>{dinero(t.patronales)}</strong>
            </div>
            <div className="destacado">
              <span>Factura semanal</span>
              <strong>{dinero(t.factura)}</strong>
            </div>
          </div>
          <div className="bonos-tabla-caja">
            <table className="bonos-tabla">
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th className="num">Salario diario</th>
                  <th className="num">Bruto semanal</th>
                  {mapaBonos.size > 0 && <th className="num">Bono</th>}
                  <th className="num">ISR</th>
                  <th className="num">IMSS</th>
                  <th className="num">Neto + Sodexo</th>
                  <th className="num">Cuotas patronales</th>
                  <th className="num">Factura semanal</th>
                </tr>
              </thead>
              <tbody>
                {filas.map(({ empleado: e, r, bono }) => (
                  <tr key={e.num}>
                    <td>
                      <strong>{nombrePropio(e.nombre)}</strong>
                      <small>
                        {e.num} · {e.puesto}
                      </small>
                    </td>
                    <td className="num">{dinero(e.salario_diario)}</td>
                    <td className="num">{dinero(r.totalPercepciones.monto)}</td>
                    {mapaBonos.size > 0 && <td className="num">{bono ? dinero(bono) : '—'}</td>}
                    <td className="num">{dinero(r.deducciones[1].monto)}</td>
                    <td className="num">{dinero(r.deducciones[0].monto)}</td>
                    <td className="num">{dinero(r.netoSodexo.monto)}</td>
                    <td className="num">{dinero(r.totalPatronales.monto)}</td>
                    <td className="num">
                      <strong>{dinero(r.total.monto)}</strong>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td>Total ({t.personas})</td>
                  <td />
                  <td className="num">{dinero(t.bruto)}</td>
                  {mapaBonos.size > 0 && <td className="num">{dinero(t.bono)}</td>}
                  <td className="num">{dinero(t.isr)}</td>
                  <td className="num">{dinero(t.imss)}</td>
                  <td className="num">{dinero(t.netoSodexo)}</td>
                  <td className="num">{dinero(t.patronales)}</td>
                  <td className="num">{dinero(t.factura)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
          {aviso && (
            <div className={aviso.ok ? 'credenciales' : 'alerta'} role="status">
              {aviso.texto}
            </div>
          )}
          <div className="admin-acciones bonos-salidas">
            <button type="button" className="btn primario" onClick={pdf} disabled={ocupado === 'pdf'}>
              {ocupado === 'pdf' ? 'Generando…' : 'Listado de nómina (PDF)'}
            </button>
            <button type="button" className="btn secundario" onClick={excel} disabled={ocupado === 'excel'}>
              {ocupado === 'excel' ? 'Generando…' : 'Excel (formato Salary 33 Threads)'}
            </button>
          </div>
          <p className="nota">
            Semana tipo: 6 días + séptimo, bonos de puntualidad y asistencia y Sodexo. No incluye horas extra, retroactivos ni ausencias de esa semana; para eso
            está el listado real del sistema.
          </p>
        </>
      )}
    </section>
  )
}
