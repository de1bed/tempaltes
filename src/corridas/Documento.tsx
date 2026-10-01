import { Paginado, type Bloque } from '../doc/Paginado'
import { fechaEn, fechaEs } from '../lib/formato'
import { IMG } from '../lib/imagenes'
import { ARCHIVOS_APROBADOS, calcularCorrida, type Linea, type ResultadoCorrida } from './calculo'
import type { CorridaData, CorridaId, KofileData } from './tipos'

const TITULOS: Record<CorridaId, [es: string, en: string]> = {
  kofile: ['Simulación extendida Kofile', 'Kofile extended simulation'],
  general: ['Corrida salarial Treve', 'Treve payroll simulation'],
  hilos33: ['Corrida salarial 33 Hilos', '33 Hilos payroll simulation'],
}

const moneda = (x: number) => x.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
/** El salario diario se muestra con todos sus decimales (hasta 6), tal como se captura en el Excel. */
const salario = (x: number) => x.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 6 })

function Tabla({ titulo, lineas, total, clase }: { titulo: string; lineas: Linea[]; total?: Linea; clase?: string }) {
  return (
    <table className={['tabla-corrida', clase].filter(Boolean).join(' ')}>
      <thead>
        <tr>
          <th>{titulo}</th>
          <th className="r">MXN</th>
        </tr>
      </thead>
      <tbody>
        {lineas.map((l) => (
          <tr key={l.celda + l.concepto} className={l.monto === 0 ? 'cero' : undefined}>
            <td>{l.concepto}</td>
            <td className="r">{moneda(l.monto)}</td>
          </tr>
        ))}
      </tbody>
      {total && (
        <tfoot>
          <tr>
            <td>{total.concepto}</td>
            <td className="r">{moneda(total.monto)}</td>
          </tr>
        </tfoot>
      )}
    </table>
  )
}

/** Hoja de la corrida: resumen limpio para enviar en PDF; el detalle completo va en el Excel. */
export function Corrida({ id, d }: { id: CorridaId; d: CorridaData }) {
  const r: ResultadoCorrida = calcularCorrida(id, d)
  const es = d.idioma === 'es'
  const t = (a: string, b: string) => (es ? a : b)
  const asimilado = id === 'kofile' && (d as KofileData).esquema === 'asimilado'
  const listo = r.faltantes.length === 0
  // Conceptos pedidos que este formato no tiene (no se calcularon).
  const pendientes = r.validaciones.filter((v) => v.nivel === 'pendiente').map((v) => v.texto.split(':')[0])

  const datos: [string, string][] = [
    [t('Cliente / proyecto', 'Client / project'), d.empresa.trim() || '—'],
    [t('Puesto', 'Position'), d.puesto.trim() || '—'],
    [t('Fecha', 'Date'), es ? fechaEs(d.fecha) : fechaEn(d.fecha)],
    [t('Periodo de pago', 'Pay period'), `${r.periodo.nombre} (${r.periodo.dias} ${t('días', 'days')})`],
  ]
  if (id === 'kofile') datos.push([t('Esquema', 'Scheme'), asimilado ? t('Asimilado a salarios', 'Assimilated to salaries') : t('Nómina', 'Payroll')])
  datos.push([t('Objetivo', 'Target'), r.objetivo.tipo === 'salarioDiario' ? r.objetivo.etiqueta : `${r.objetivo.etiqueta}: $${moneda(r.objetivo.meta)}`])

  const destacados: [string, number][] = [
    [t('Salario diario', 'Daily salary'), r.salarioDiario],
    [r.totalPercepciones.concepto, r.totalPercepciones.monto],
    [r.sodexo.monto > 0 ? r.netoSodexo.concepto : r.neto.concepto, r.sodexo.monto > 0 ? r.netoSodexo.monto : r.neto.monto],
    [r.total.concepto, r.total.monto],
  ]

  const bloques: Bloque[] = [
    {
      key: 'encabezado',
      nodo: (
        <header className="corrida-cab">
          <img className="corrida-logo" src={IMG.treveLogo} alt="Treve" />
          <div className="corrida-titulo">
            <div className="corrida-kicker">{t('Simulación de corrida salarial', 'Payroll simulation')}</div>
            <h1>{es ? TITULOS[id][0] : TITULOS[id][1]}</h1>
          </div>
        </header>
      ),
    },
    {
      key: 'datos',
      nodo: (
        <dl className="corrida-datos">
          {datos.map(([k, v]) => (
            <div key={k}>
              <dt>{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
      ),
    },
    {
      key: 'destacados',
      nodo: listo ? (
        <div className="corrida-destacados">
          {destacados.map(([k, v], i) => (
            <div key={k} className={i === destacados.length - 1 ? 'principal' : undefined}>
              <span>{k}</span>
              <strong>${i === 0 ? salario(v) : moneda(v)}</strong>
            </div>
          ))}
        </div>
      ) : (
        <div className="corrida-faltan">
          <strong>{t('Faltan datos para generar la corrida:', 'Missing data to generate the payroll run:')}</strong> {r.faltantes.join(' · ')}
        </div>
      ),
    },
  ]

  if (listo) {
    bloques.push(
      { key: 'percepciones', nodo: <Tabla titulo={t('Percepciones', 'Income')} lineas={r.percepciones} total={r.totalPercepciones} /> },
      { key: 'deducciones', nodo: <Tabla titulo={t('Deducciones', 'Deductions')} lineas={r.deducciones} total={r.totalDeducciones} /> },
      {
        key: 'neto',
        nodo: <Tabla titulo={t('Neto', 'Net')} clase="neto" lineas={asimilado ? [] : [r.neto, r.sodexo]} total={asimilado ? r.neto : r.netoSodexo} />,
      },
    )
    if (r.patronales.length) bloques.push({ key: 'patronales', nodo: <Tabla titulo={t('Impuestos patronales', 'Employer contributions')} lineas={r.patronales} total={r.totalPatronales} /> })
    bloques.push({
      key: 'costos',
      nodo: <Tabla titulo={id === 'general' || (id === 'kofile' && !asimilado) ? t('Costo', 'Cost') : t('Facturación', 'Invoice')} clase="costo" lineas={r.costos} total={r.total} />,
    })
  }

  bloques.push({
    key: 'supuestos',
    nodo: (
      <section className="corrida-notas">
        <h2>{t('Supuestos', 'Assumptions')}</h2>
        <ul>
          {r.supuestos.map((s) => (
            <li key={s}>{s}</li>
          ))}
          {pendientes.length > 0 && (
            <li className="pendiente">
              {t('Pendiente de confirmar con Nóminas (no incluido en el cálculo): ', 'Pending confirmation with Payroll (not included in the calculation): ')}
              {pendientes.join(', ')}.
            </li>
          )}
        </ul>
        {d.observaciones.trim() && (
          <>
            <h2>{t('Observaciones', 'Notes')}</h2>
            <p>{d.observaciones}</p>
          </>
        )}
      </section>
    ),
  })

  return (
    <Paginado
      clase="corrida"
      bloques={bloques}
      fondo={<div className="corrida-franja" />}
      pie={(hoja, total) => (
        <div className="corrida-pie">
          <span>
            {t('Calculado con la plantilla aprobada', 'Calculated with the approved template')}: {ARCHIVOS_APROBADOS[id]}
            {d.elaboro.trim() && ` · ${t('Elaboró', 'Prepared by')}: ${d.elaboro.trim()}`}
          </span>
          <span>{`${hoja} / ${total}`}</span>
        </div>
      )}
    />
  )
}
