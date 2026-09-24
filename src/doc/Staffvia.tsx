import type { ReactNode } from 'react'
import {
  dinero,
  fechaEn,
  fechaEnDia,
  fechaEs,
  fechaEsDia,
  lineas,
  mesAnioEn,
  mesAnioEs,
  miles,
  num,
  paginar,
  primerNombre,
} from '../lib/formato'
import { rellenar, type BonosData, type GmmData, type Idioma, type PayrollData, type ServiciosData } from '../lib/modelo'

/** Devuelve el texto en el idioma de la plantilla. */
const traductor = (idioma: Idioma) => (es: string, en: string) => (idioma === 'es' ? es : en)

function Portada(p: { kicker: string; titulo: string; cliente: string; sub?: string; mes: string; normal?: boolean }) {
  return (
    <section className="page sv-cover">
      <div className="box">
        <div className="kicker">{p.kicker}</div>
        <div className={p.normal ? 'title normal' : 'title'}>{p.titulo}</div>
        <div className="rule" />
        <div className={p.sub ? 'client sm' : 'client'}>{p.cliente}</div>
        {p.sub && <div className="sub">{p.sub}</div>}
        <div className="month">{p.mes}</div>
      </div>
    </section>
  )
}

function Hoja({ children, block }: { children: ReactNode; block?: boolean }) {
  return (
    <section className="page sv">
      <div className={block ? 'content block' : 'content'}>{children}</div>
    </section>
  )
}

function Encabezado(p: { linea: string; d: { idioma: Idioma; contacto: string; empresa: string; tratamiento: string } }) {
  const t = traductor(p.d.idioma)
  const nombre = primerNombre(p.d.contacto) || t('[Nombre]', '[Name]')
  return (
    <>
      <div className="muted" style={{ fontSize: 11.5 }}>{p.linea}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 1, fontSize: 12.5, lineHeight: 1.4 }}>
        <div className="accent" style={{ fontWeight: 600 }}>{p.d.contacto || t('Nombre del contacto', 'Contact name')}</div>
        <div>{p.d.empresa || t('Empresa', 'Company')}</div>
      </div>
      <div className="accent" style={{ fontSize: 12.5, fontWeight: 600 }}>
        {p.d.idioma === 'es' ? `${p.d.tratamiento} ${nombre}:` : `Dear ${nombre},`}
      </div>
    </>
  )
}

function Parrafos({ texto }: { texto: string }) {
  return (
    <div className="letter" style={{ display: 'contents' }}>
      {lineas(texto).map((l, i) => (
        <p key={i}>{l}</p>
      ))}
    </div>
  )
}

function Aprobacion({ idioma }: { idioma: Idioma }) {
  const t = traductor(idioma)
  const f = idioma === 'es' ? ['Nombre:', 'Puesto:', 'Fecha:', 'Firma:'] : ['Name:', 'Position:', 'Date:', 'Signature:']
  return (
    <>
      <div className="accent" style={{ fontSize: 11.5, fontWeight: 600, letterSpacing: 0.5, marginBottom: 8 }}>
        {t('ACEPTO ESTA COTIZACIÓN', 'I APPROVE THIS QUOTE')}
      </div>
      <table className="sign">
        <tbody>
          {f.map((k, i) => (
            <tr key={k}>
              <td>{k}</td>
              <td style={i === 3 ? { height: 34 } : undefined} />
            </tr>
          ))}
        </tbody>
      </table>
    </>
  )
}

function ListaTerminos({ texto, lg }: { texto: string; lg?: boolean }) {
  return (
    <ul className={lg ? 'terms lg' : 'terms'}>
      {lineas(texto).map((t, i) => (
        <li key={i}>{t}</li>
      ))}
    </ul>
  )
}

/** Línea de lugar y fecha: "Tijuana, Baja California a 26 de junio de 2026." / "Tijuana, Baja California, May 13, 2026" */
const lugarFecha = (idioma: Idioma, ciudad: string, iso: string) =>
  idioma === 'es' ? `${ciudad} a ${fechaEs(iso)}.` : `${ciudad}, ${fechaEn(iso)}`
const mesAnio = (idioma: Idioma, iso: string) => (idioma === 'es' ? mesAnioEs(iso) : mesAnioEn(iso))

/* ───────── Servicios y trámites ───────── */

export function Servicios({ d }: { d: ServiciosData }) {
  const t = traductor(d.idioma)
  const iva = num(d.iva) / 100
  const filas = d.servicios.map((s) => {
    const cantidad = num(s.cantidad)
    const precio = num(s.precio)
    const subtotal = cantidad * precio
    return { ...s, cantidad, precio, subtotal, iva: subtotal * iva, total: subtotal * (1 + iva) }
  })
  const suma = (k: 'subtotal' | 'iva' | 'total') => filas.reduce((a, f) => a + f[k], 0)
  // Con pocos servicios todo cabe en una hoja; si no, el desglose pasa a la siguiente.
  const juntos = filas.length <= 5

  const desglose = (
    <>
      <table className="sm">
        <thead>
          <tr>
            <th className="olive c" style={{ width: '9%', textAlign: 'center' }}>{t('Cantidad', 'Qty')}</th>
            <th className="olive" style={{ textAlign: 'left' }}>{t('Servicio', 'Service')}</th>
            <th className="olive" style={{ width: '15%' }}>{t('Precio unitario', 'Unit price')}</th>
            <th className="olive" style={{ width: '14%' }}>Subtotal</th>
            <th className="olive" style={{ width: '12%' }}>{t('IVA', 'VAT')}</th>
            <th className="olive" style={{ width: '14%' }}>Total</th>
          </tr>
        </thead>
        <tbody>
          {filas.map((f, i) => (
            <tr key={i}>
              <td className="c">{miles(f.cantidad)}</td>
              <td>{f.descripcion}</td>
              <td className="r">{dinero(f.precio)}</td>
              <td className="r">{dinero(f.subtotal)}</td>
              <td className="r">{dinero(f.iva)}</td>
              <td className="r strong">{dinero(f.total)}</td>
            </tr>
          ))}
          {filas.length > 1 && (
            <tr className="total">
              <td />
              <td>Total</td>
              <td />
              <td className="r">{dinero(suma('subtotal'))}</td>
              <td className="r">{dinero(suma('iva'))}</td>
              <td className="r strong">{dinero(suma('total'))}</td>
            </tr>
          )}
        </tbody>
      </table>
      {lineas(d.detalle).length > 0 && (
        <>
          <div className="accent" style={{ fontSize: 12, fontWeight: 600, marginTop: 4 }}>
            {t('Detalle de la propuesta:', 'Proposal details:')}
          </div>
          <ul style={{ fontSize: 10.5, lineHeight: 1.55, color: '#3C4E5A', gap: 4 }}>
            {lineas(d.detalle).map((l, i) => (
              <li key={i}>{l}</li>
            ))}
          </ul>
        </>
      )}
      {lineas(d.notas).length > 0 && (
        <div className="muted" style={{ fontSize: 10, lineHeight: 1.5 }}>
          {lineas(d.notas).map((l, i) => (
            <div key={i}>{l}</div>
          ))}
        </div>
      )}
    </>
  )

  return (
    <>
      <Portada kicker={t('Cotización', 'Quote')} titulo={d.tituloPortada} cliente={d.empresa || t('Empresa', 'Company')} mes={mesAnio(d.idioma, d.fecha)} />
      <Hoja>
        <Encabezado linea={lugarFecha(d.idioma, d.ciudad, d.fecha)} d={d} />
        <Parrafos texto={rellenar(d.intro, { empresa: d.empresa })} />
        <table>
          <thead>
            <tr>
              <th className="dark">{t('Servicio', 'Service')}</th>
              <th className="dark" style={{ width: '26%' }}>{t('Precio unitario', 'Unit price')}</th>
            </tr>
          </thead>
          <tbody>
            {filas.map((f, i) => (
              <tr key={i}>
                <td>{f.descripcion}</td>
                <td className="r" style={{ fontWeight: 600 }}>{dinero(f.precio)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {d.notaPrecios && <div className="note">{d.notaPrecios}</div>}
        {juntos && desglose}
      </Hoja>
      {!juntos && <Hoja>{desglose}</Hoja>}
      <Hoja block>
        <div className="accent" style={{ fontSize: 12.5, fontWeight: 600, marginBottom: 8 }}>{t('Términos y condiciones:', 'Terms and conditions:')}</div>
        <ListaTerminos texto={d.terminos} />
        <Aprobacion idioma={d.idioma} />
        <div className="small" style={{ lineHeight: 1.6 }}>
          {t('Quedo a sus órdenes para cualquier duda o aclaración.', 'Please let me know if you have any questions.')}
        </div>
        <div className="small" style={{ marginTop: 14 }}>{t('Atentamente,', 'Sincerely,')}</div>
        <div className="signature">{d.firmante}</div>
      </Hoja>
    </>
  )
}

/* ───────── Nómina / payroll ───────── */

/** Semanas promedio por mes (52 / 12). */
const SEMANAS_MES = 52 / 12

export function Payroll({ d }: { d: PayrollData }) {
  const t = traductor(d.idioma)
  const fee = num(d.fee)
  const feeTxt = `${fee}%`
  const base: [string, number][] = [
    [t('Sueldo bruto', 'Gross salary'), num(d.salario)],
    [t('Cuotas patronales (IMSS, INFONAVIT, SAR, ISN)', 'Employer taxes (IMSS, INFONAVIT, SAR, state tax)'), num(d.impuestos)],
    [t('Vacaciones, aguinaldo y prima vacacional', 'Vacation pay, Christmas bonus and vacation bonus'), num(d.prestaciones)],
  ]
  const subtotal = base.reduce((a, [, v]) => a + v, 0)
  const filas: [string, number][] = [...base, [t(`Cuota de servicio (${feeTxt})`, `Service fee (${feeTxt})`), (subtotal * fee) / 100]]
  const total = subtotal * (1 + fee / 100)
  const vars = { empresa: d.empresa || t('su empresa', 'your company'), puesto: d.puesto, fee: feeTxt }

  return (
    <>
      <Portada
        kicker={t('Cotización de servicios de nómina', 'Payroll services quote')}
        titulo={d.tituloPortada}
        cliente={d.clientePortada}
        mes={mesAnio(d.idioma, d.fecha)}
      />
      <Hoja>
        <Encabezado linea={lugarFecha(d.idioma, d.ciudad, d.fecha)} d={d} />
        <Parrafos texto={rellenar(d.intro, vars)} />
        <div className="h-title">{t('Cotización de servicios de nómina de empleados indirectos', 'Quote for payroll services of indirect employees')}</div>
        <table>
          <tbody>
            {[
              [t('Puesto', 'Position'), d.puesto],
              [t('Número de personas', 'Headcount'), miles(num(d.headcount))],
              [t('Frecuencia de nómina', 'Payroll frequency'), d.frecuencia],
              [t('Cuota de servicio', 'Service fee'), feeTxt],
            ].map(([k, v]) => (
              <tr key={k}>
                <td className="k">{k}</td>
                <td className="v">{v}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <table>
          <thead>
            <tr>
              <th className="dark">{t('Estructura salarial', 'Salary structure')}</th>
              <th className="dark" style={{ width: '22%' }}>{t('Semanal', 'Weekly')}</th>
              <th className="dark" style={{ width: '22%' }}>{t('Mensual', 'Monthly')}</th>
            </tr>
          </thead>
          <tbody>
            {filas.map(([k, v]) => (
              <tr key={k}>
                <td>{k}</td>
                <td className="r">{dinero(v)}</td>
                <td className="r">{dinero(v * SEMANAS_MES)}</td>
              </tr>
            ))}
            <tr className="total">
              <td>{t('Total por persona', 'Total per person')}</td>
              <td className="r strong">{dinero(total)}</td>
              <td className="r strong">{dinero(total * SEMANAS_MES)}</td>
            </tr>
          </tbody>
        </table>
        <div className="note">{t('Precio por persona + IVA.', 'Price per person + TAX.')}</div>
      </Hoja>
      <Hoja block>
        <div className="h-sec">{t('TÉRMINOS Y CONDICIONES:', 'TERMS AND CONDITIONS:')}</div>
        <ListaTerminos texto={rellenar(d.terminos, vars)} />
        <Aprobacion idioma={d.idioma} />
        <div className="small">{t('Muchas gracias por su confianza.', 'Thank you very much for your partnership.')}</div>
        <div className="small" style={{ marginTop: 10 }}>{t('Atentamente,', 'Sincerely,')}</div>
        <div className="signature">{d.firmante}</div>
      </Hoja>
    </>
  )
}

/* ───────── Gastos médicos (GMM) ───────── */

export function Gmm({ d }: { d: GmmData }) {
  const t = traductor(d.idioma)
  const es = d.idioma === 'es'
  const nombres = d.empleados.map((e) => e.nombre.trim()).filter(Boolean)
  const paginas = paginar(d.empleados, 2, 5)
  const fechaCorta = es ? fechaEs : fechaEn
  const tabla = (e: GmmData['empleados'][number], i: number) => (
    <table key={i}>
      <thead>
        <tr>
          <th colSpan={3} className="dark">{e.nombre || t('Nombre del empleado', 'Employee name')}</th>
        </tr>
        <tr>
          <th className="olive">{t('Edad', 'Age')}: {e.edad}</th>
          <th className="olive" style={{ width: '24%' }}>{t('Costo mensual', 'Monthly Cost')}</th>
          <th className="olive" style={{ width: '24%' }}>{t('Costo anual', 'Annual Cost')}</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>{t('Seguro de Gastos Médicos Menores', 'Minor Medical Insurance')}</td>
          <td className="r">{dinero(num(e.menorMensual))}</td>
          <td className="r">{dinero(num(e.menorAnual))}</td>
        </tr>
        <tr>
          <td>{t('Seguro de Gastos Médicos Mayores', 'Major Medical Insurance')}</td>
          <td className="r">{dinero(num(e.mayorMensual))}</td>
          <td className="r">{dinero(num(e.mayorAnual))}</td>
        </tr>
      </tbody>
    </table>
  )
  const clientePortada =
    nombres.length === 1
      ? nombres[0]
      : nombres.length > 1
        ? t(`${nombres.length} empleados`, `${nombres.length} employees`)
        : t('Nombre del empleado', 'Employee name')

  return (
    <>
      <Portada
        kicker={t('Cotización', 'Quote')}
        titulo={t('Seguro de Gastos Médicos Mayores y Menores', 'Medical Major & Minor Insurance')}
        normal
        cliente={clientePortada}
        sub={d.clientePortada}
        mes={mesAnio(d.idioma, d.fecha)}
      />
      {paginas.map((grupo, p) => (
        <Hoja key={p}>
          {p === 0 && (
            <>
              <Encabezado linea={es ? fechaEsDia(d.fecha) : fechaEnDia(d.fecha)} d={d} />
              <div className="letter" style={{ display: 'contents' }}>
                <p>
                  {es
                    ? `Gracias por su confianza y colaboración continua. A continuación encontrará la cotización de la Póliza de Gastos Médicos Mayores para ${nombres.length === 1 ? 'el siguiente empleado' : 'los siguientes empleados'}:`
                    : `Thank you for your continued trust and partnership. Please find below the quote for the Major Medical Policy for the following employee${nombres.length === 1 ? '' : 's'}:`}
                </p>
                <div className="accent" style={{ fontSize: 11.5, fontWeight: 600 }}>
                  {nombres.join(', ') || t('Nombre del empleado', 'Employee name')}
                </div>
                <p>
                  {es
                    ? `Esta cotización refleja la cobertura y los precios aplicables para su alta, con una vigencia del ${fechaCorta(d.inicio)} al ${fechaCorta(d.fin)}.`
                    : `This quotation reflects the applicable coverage and pricing for their enrollment, with an effective period from ${fechaCorta(d.inicio)}, through ${fechaCorta(d.fin)}.`}
                </p>
                <p>
                  {t(
                    'Seguimos comprometidos en brindarle un servicio confiable, atención oportuna y opciones de cobertura competitivas.',
                    'We remain committed to providing reliable service, timely support, and competitive coverage options.',
                  )}
                </p>
              </div>
              <div className="h-title">{t('Seguro médico privado', 'Private medical insurance')}</div>
            </>
          )}
          {grupo.map((e, i) => tabla(e, i))}
          {p === paginas.length - 1 && <div className="note">{t('Precio por persona + IVA.', 'Price per person + TAX.')}</div>}
        </Hoja>
      ))}
      <Hoja block>
        <div className="h-sec">{t('TÉRMINOS Y CONDICIONES:', 'TERMS AND CONDITIONS:')}</div>
        <ListaTerminos texto={d.terminos} lg />
        <Aprobacion idioma={d.idioma} />
        <div className="small">{t('Muchas gracias por su confianza.', 'Thank you very much for your partnership.')}</div>
        <div className="small" style={{ marginTop: 10 }}>{t('Atentamente,', 'Sincerely,')}</div>
        <div className="signature">{d.firmante}</div>
      </Hoja>
    </>
  )
}

/* ───────── Bonos ───────── */

export function Bonos({ d }: { d: BonosData }) {
  const t = traductor(d.idioma)
  const filas = d.empleados.map((e) => {
    const bruto = num(e.bruto)
    const costo = num(e.costo)
    return { nombre: e.nombre, bruto, neto: num(e.neto), costo, total: bruto + costo }
  })
  const suma = (k: 'bruto' | 'neto' | 'costo' | 'total') => filas.reduce((a, f) => a + f[k], 0)
  const paginas = paginar(filas, 12, 24)

  return (
    <>
      <Portada
        kicker={t('Cotización de servicios de nómina', 'Payroll services quotation')}
        titulo={d.tituloPortada}
        cliente={d.clientePortada}
        mes={mesAnio(d.idioma, d.fecha)}
      />
      {paginas.map((grupo, p) => {
        const ultima = p === paginas.length - 1
        return (
          <Hoja key={p}>
            {p === 0 && (
              <>
                <Encabezado linea={lugarFecha(d.idioma, d.ciudad, d.fecha)} d={d} />
                <Parrafos texto={rellenar(d.intro, { empresa: d.empresa || t('su empresa', 'your company'), titulo: d.tituloPortada })} />
                <div className="h-title">{t('Cotización de servicios de nómina de empleados indirectos', 'Quote for payroll services of indirect employees')}</div>
              </>
            )}
            <table className="sm">
              <thead>
                <tr>
                  <th className="dark">{t('Empleado', 'Employee')}</th>
                  <th className="dark" style={{ width: '16%' }}>{t('Bono bruto', 'Gross Bonus')}</th>
                  <th className="dark" style={{ width: '16%' }}>{t('Bono neto', 'Net Bonus')}</th>
                  <th className="dark" style={{ width: '18%' }}>{t('Costo de nómina', 'Payroll Cost')}</th>
                  <th className="dark" style={{ width: '16%' }}>Total</th>
                </tr>
              </thead>
              <tbody>
                {grupo.map((f, i) => (
                  <tr key={i}>
                    <td>{f.nombre || t('Nombre del empleado', 'Employee name')}</td>
                    <td className="r">{dinero(f.bruto)}</td>
                    <td className="r">{dinero(f.neto)}</td>
                    <td className="r">{dinero(f.costo)}</td>
                    <td className="r">{dinero(f.total)}</td>
                  </tr>
                ))}
                {ultima && (
                  <tr className="total">
                    <td>{t('Gran total', 'Grand total')}</td>
                    <td className="r">{dinero(suma('bruto'))}</td>
                    <td className="r">{dinero(suma('neto'))}</td>
                    <td className="r">{dinero(suma('costo'))}</td>
                    <td className="r strong">{dinero(suma('total'))}</td>
                  </tr>
                )}
              </tbody>
            </table>
            {ultima && <div className="note">{t('Precio por persona + IVA.', 'Price per person + TAX.')}</div>}
          </Hoja>
        )
      })}
      <Hoja block>
        <div className="h-sec">{t('TÉRMINOS Y CONDICIONES:', 'TERMS AND CONDITIONS:')}</div>
        <ListaTerminos texto={d.terminos} lg />
        <div className="small" style={{ marginBottom: 14 }}>{t('Muchas gracias por su confianza.', 'Thank you very much for your partnership.')}</div>
        <Aprobacion idioma={d.idioma} />
        <div className="small">{t('Atentamente,', 'Sincerely,')}</div>
        <div className="signature">{d.firmante}</div>
      </Hoja>
    </>
  )
}
