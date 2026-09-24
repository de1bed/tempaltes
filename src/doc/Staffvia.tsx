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
  traductor,
} from '../lib/formato'
import { contarHojas, ligar, type Ligado } from '../lib/edicion'
import { Editable, Lineas, Secciones } from './Editable'
import { type BonosData,
  type ReclutamientoData, type GmmData, type Idioma, type PayrollData, type ServiciosData } from '../lib/modelo'


export function Portada(p: { kicker: string; titulo: ReactNode; cliente: ReactNode; sub?: ReactNode; mes: string; normal?: boolean }) {
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

type Campo = (k: 'contacto' | 'empresa') => Ligado

function Encabezado(p: {
  linea: ReactNode
  d: { idioma: Idioma; contacto: string; empresa: string; tratamiento: string }
  c$: Campo
  /** Puesto del contacto (opcional). */
  cargo?: Ligado
}) {
  const t = traductor(p.d.idioma)
  const nombre = primerNombre(p.d.contacto) || t('[Nombre]', '[Name]')
  return (
    <>
      <div className="muted" style={{ fontSize: 11.5 }}>{p.linea}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 1, fontSize: 12.5, lineHeight: 1.4 }}>
        <div className="accent" style={{ fontWeight: 600 }}>
          <Editable {...p.c$('contacto')} placeholder={t('Nombre del contacto', 'Contact name')} />
        </div>
        {p.cargo && (
          <div className={p.cargo.valor.trim() ? undefined : 'vacio'}>
            <Editable {...p.cargo} placeholder={t('Puesto (opcional)', 'Job title (optional)')} />
          </div>
        )}
        <div>
          <Editable {...p.c$('empresa')} placeholder={t('Empresa', 'Company')} />
        </div>
      </div>
      <div className="accent" style={{ fontSize: 12.5, fontWeight: 600 }}>
        {p.d.idioma === 'es' ? `${p.d.tratamiento} ${nombre}:` : `Dear ${nombre},`}
      </div>
    </>
  )
}

export function Aprobacion({ idioma }: { idioma: Idioma }) {
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

/** Línea de lugar y fecha: "Tijuana, Baja California a 26 de junio de 2026." / "Tijuana, Baja California, May 13, 2026" */
function LugarFecha({ idioma, ciudad, iso }: { idioma: Idioma; ciudad: Ligado; iso: string }) {
  return (
    <>
      <Editable {...ciudad} placeholder={idioma === 'es' ? 'Ciudad' : 'City'} />
      {idioma === 'es' ? ` a ${fechaEs(iso)}.` : `, ${fechaEn(iso)}`}
    </>
  )
}
const mesAnio = (idioma: Idioma, iso: string) => (idioma === 'es' ? mesAnioEs(iso) : mesAnioEn(iso))

/* ───────── Servicios y trámites ───────── */

export function Servicios({ d, set }: { d: ServiciosData; set: (p: Partial<ServiciosData>) => void }) {
  const t = traductor(d.idioma)
  const c$ = ligar(d, set)
  const fila$ = (i: number, k: 'cantidad' | 'descripcion' | 'precio' | 'precioEspecial'): Ligado => ({
    valor: d.servicios[i][k] ?? '',
    onCambio: (v) => set({ servicios: d.servicios.map((s, j) => (j === i ? { ...s, [k]: v } : s)) }),
  })
  const iva = num(d.iva) / 100
  // Precio especial por volumen: aplica cuando la cantidad llega al mínimo de solicitudes.
  const minimo = num(d.minimoEspecial ?? '')
  const conEspecial = minimo > 0
  const filas = d.servicios.map((s) => {
    const cantidad = num(s.cantidad)
    const precioLista = num(s.precio)
    const especial = num(s.precioEspecial ?? '')
    const aplicaEspecial = conEspecial && especial > 0 && cantidad >= minimo
    const precio = aplicaEspecial ? especial : precioLista
    const subtotal = cantidad * precio
    return { ...s, cantidad, precioLista, especial, aplicaEspecial, precio, subtotal, iva: subtotal * iva, total: subtotal * (1 + iva) }
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
              <td className="c">
                <Editable {...fila$(i, 'cantidad')} mostrar={miles(f.cantidad)} placeholder="0" />
              </td>
              <td>
                <Editable {...fila$(i, 'descripcion')} placeholder={t('Servicio', 'Service')} />
              </td>
              <td className="r">
                {f.aplicaEspecial ? dinero(f.precio) : <Editable {...fila$(i, 'precio')} mostrar={dinero(f.precio)} placeholder="$0.00" />}
              </td>
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
          <Lineas {...c$('detalle')} como="li" id="detalle" style={{ fontSize: 10.5, lineHeight: 1.55, color: '#3C4E5A', gap: 4 }} placeholder={t('Nuevo punto', 'New item')} />
        </>
      )}
      {lineas(d.notas).length > 0 && (
        <div className="muted" style={{ fontSize: 10, lineHeight: 1.5 }}>
          <Lineas {...c$('notas')} como="div" id="notas" placeholder={t('Nota', 'Note')} />
        </div>
      )}
    </>
  )

  return (
    <>
      {d.conPortada && (
        <Portada
          kicker={t('Cotización', 'Quote')}
          titulo={<Editable {...c$('tituloPortada')} placeholder={t('Título', 'Title')} />}
          cliente={<Editable {...c$('empresa')} placeholder={t('Empresa', 'Company')} />}
          mes={mesAnio(d.idioma, d.fecha)}
        />
      )}
      <Hoja>
        <Encabezado linea={<LugarFecha idioma={d.idioma} ciudad={c$('ciudad')} iso={d.fecha} />} d={d} c$={c$} />
        <Lineas {...c$('intro')} como="p" id="intro" className="letter" vars={{ empresa: d.empresa }} placeholder={t('Párrafo', 'Paragraph')} />
        <table>
          <thead>
            <tr>
              <th className="dark">{t('Servicio', 'Service')}</th>
              <th className="dark" style={{ width: conEspecial ? '20%' : '26%' }}>{t('Precio unitario', 'Unit price')}</th>
              {conEspecial && (
                <th className="dark" style={{ width: '26%' }}>
                  {t(`Precio especial unitario +${minimo} solicitudes`, `Special unit price (${minimo}+ requests)`)}
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {filas.map((f, i) => (
              <tr key={i}>
                <td>
                  <Editable {...fila$(i, 'descripcion')} placeholder={t('Servicio', 'Service')} />
                </td>
                <td className="r" style={{ fontWeight: 600 }}>
                  <Editable {...fila$(i, 'precio')} mostrar={dinero(f.precioLista)} placeholder="$0.00" />
                </td>
                {conEspecial && (
                  <td className="r" style={{ fontWeight: 600 }}>
                    <Editable {...fila$(i, 'precioEspecial')} mostrar={f.especial > 0 ? dinero(f.especial) : ''} placeholder="$0.00" />
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        <div className={d.notaPrecios.trim() ? 'note' : 'note vacio'}>
          <Editable {...c$('notaPrecios')} placeholder={t('Nota de precios (opcional)', 'Pricing note (optional)')} />
        </div>
        {juntos && desglose}
      </Hoja>
      {!juntos && <Hoja>{desglose}</Hoja>}
      <Hoja block>
        <div className="accent" style={{ fontSize: 12.5, fontWeight: 600, marginBottom: 8 }}>{t('Términos y condiciones:', 'Terms and conditions:')}</div>
        <Lineas {...c$('terminos')} como="li" id="terminos" className="terms" vars={{ minimo: String(minimo) }} placeholder={t('Nuevo punto', 'New item')} />
        <Aprobacion idioma={d.idioma} />
        <div className="small" style={{ lineHeight: 1.6 }}>
          {t('Quedo a sus órdenes para cualquier duda o aclaración.', 'Please let me know if you have any questions.')}
        </div>
        <div className="small" style={{ marginTop: 14 }}>{t('Atentamente,', 'Sincerely,')}</div>
        <div className="signature">
          <Editable {...c$('firmante')} placeholder={t('Nombre de quien firma', 'Signer name')} />
        </div>
      </Hoja>
    </>
  )
}

/* ───────── Nómina / payroll ───────── */

/** Semanas promedio por mes (52 / 12). */
const SEMANAS_MES = 52 / 12

export function Payroll({ d, set }: { d: PayrollData; set: (p: Partial<PayrollData>) => void }) {
  const t = traductor(d.idioma)
  const c$ = ligar(d, set)
  const fee = num(d.fee)
  const feeTxt = `${fee}%`
  const base: [string, number, 'salario' | 'impuestos' | 'prestaciones' | null][] = [
    [t('Sueldo bruto', 'Gross salary'), num(d.salario), 'salario'],
    [t('Cuotas patronales (IMSS, INFONAVIT, SAR, ISN)', 'Employer taxes (IMSS, INFONAVIT, SAR, state tax)'), num(d.impuestos), 'impuestos'],
    [t('Vacaciones, aguinaldo y prima vacacional', 'Vacation pay, Christmas bonus and vacation bonus'), num(d.prestaciones), 'prestaciones'],
  ]
  const subtotal = base.reduce((a, [, v]) => a + v, 0)
  const filas: [string, number, 'salario' | 'impuestos' | 'prestaciones' | null][] = [
    ...base,
    [t(`Cuota de servicio (${feeTxt})`, `Service fee (${feeTxt})`), (subtotal * fee) / 100, null],
  ]
  const total = subtotal * (1 + fee / 100)
  const vars = { empresa: d.empresa || t('su empresa', 'your company'), puesto: d.puesto, fee: feeTxt }

  return (
    <>
      {d.conPortada && (
        <Portada
          kicker={t('Cotización de servicios de nómina', 'Payroll services quote')}
          titulo={<Editable {...c$('tituloPortada')} placeholder={t('Puesto', 'Position')} />}
          cliente={<Editable {...c$('clientePortada')} placeholder={t('Cliente', 'Client')} />}
          mes={mesAnio(d.idioma, d.fecha)}
        />
      )}
      <Hoja>
        <Encabezado linea={<LugarFecha idioma={d.idioma} ciudad={c$('ciudad')} iso={d.fecha} />} d={d} c$={c$} />
        <Lineas {...c$('intro')} como="p" id="intro" className="letter" vars={vars} placeholder={t('Párrafo', 'Paragraph')} />
        <div className="h-title">{t('Cotización de servicios de nómina de empleados indirectos', 'Quote for payroll services of indirect employees')}</div>
        <table>
          <tbody>
            {(
              [
                [t('Puesto', 'Position'), <Editable key="puesto" {...c$('puesto')} placeholder={t('Puesto', 'Position')} />],
                [t('Número de personas', 'Headcount'), <Editable key="headcount" {...c$('headcount')} mostrar={miles(num(d.headcount))} placeholder="0" />],
                [t('Frecuencia de nómina', 'Payroll frequency'), <Editable key="frecuencia" {...c$('frecuencia')} placeholder={t('Semanal', 'Weekly')} />],
                [t('Cuota de servicio', 'Service fee'), <Editable key="fee" {...c$('fee')} mostrar={feeTxt} placeholder="0%" />],
              ] as const
            ).map(([k, v]) => (
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
            {filas.map(([k, v, campo]) => (
              <tr key={k}>
                <td>{k}</td>
                <td className="r">{campo ? <Editable {...c$(campo)} mostrar={dinero(v)} placeholder="$0.00" /> : dinero(v)}</td>
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
        <Lineas {...c$('terminos')} como="li" id="terminos" className="terms" vars={vars} placeholder={t('Nuevo punto', 'New item')} />
        <Aprobacion idioma={d.idioma} />
        <div className="small">{t('Muchas gracias por su confianza.', 'Thank you very much for your partnership.')}</div>
        <div className="small" style={{ marginTop: 10 }}>{t('Atentamente,', 'Sincerely,')}</div>
        <div className="signature">
          <Editable {...c$('firmante')} placeholder={t('Nombre de quien firma', 'Signer name')} />
        </div>
      </Hoja>
    </>
  )
}

/* ───────── Gastos médicos (GMM) ───────── */

export function Gmm({ d, set }: { d: GmmData; set: (p: Partial<GmmData>) => void }) {
  const t = traductor(d.idioma)
  const c$ = ligar(d, set)
  const emp$ = (i: number, k: keyof GmmData['empleados'][number]): Ligado => ({
    valor: d.empleados[i][k],
    onCambio: (v) => set({ empleados: d.empleados.map((e, j) => (j === i ? { ...e, [k]: v } : e)) }),
  })
  const es = d.idioma === 'es'
  const nombres = d.empleados.map((e) => e.nombre.trim()).filter(Boolean)
  const paginas = paginar(
    d.empleados.map((e, i) => ({ ...e, i })),
    2,
    5,
  )
  const fechaCorta = es ? fechaEs : fechaEn
  const monto = (i: number, k: 'menorMensual' | 'menorAnual' | 'mayorMensual' | 'mayorAnual') => (
    <Editable {...emp$(i, k)} mostrar={dinero(num(d.empleados[i][k]))} placeholder="$0.00" />
  )
  const tabla = ({ i }: { i: number }) => (
    <table key={i}>
      <thead>
        <tr>
          <th colSpan={3} className="dark">
            <Editable {...emp$(i, 'nombre')} placeholder={t('Nombre del empleado', 'Employee name')} />
          </th>
        </tr>
        <tr>
          <th className="olive">
            {t('Edad', 'Age')}: <Editable {...emp$(i, 'edad')} placeholder="0" />
          </th>
          <th className="olive" style={{ width: '24%' }}>{t('Costo mensual', 'Monthly Cost')}</th>
          <th className="olive" style={{ width: '24%' }}>{t('Costo anual', 'Annual Cost')}</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>{t('Seguro de Gastos Médicos Menores', 'Minor Medical Insurance')}</td>
          <td className="r">{monto(i, 'menorMensual')}</td>
          <td className="r">{monto(i, 'menorAnual')}</td>
        </tr>
        <tr>
          <td>{t('Seguro de Gastos Médicos Mayores', 'Major Medical Insurance')}</td>
          <td className="r">{monto(i, 'mayorMensual')}</td>
          <td className="r">{monto(i, 'mayorAnual')}</td>
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
      {d.conPortada && (
        <Portada
          kicker={t('Cotización', 'Quote')}
          titulo={t('Seguro de Gastos Médicos Mayores y Menores', 'Medical Major & Minor Insurance')}
          normal
          cliente={clientePortada}
          sub={<Editable {...c$('clientePortada')} placeholder={t('Cliente', 'Client')} />}
          mes={mesAnio(d.idioma, d.fecha)}
        />
      )}
      {paginas.map((grupo, p) => (
        <Hoja key={p}>
          {p === 0 && (
            <>
              <Encabezado linea={es ? fechaEsDia(d.fecha) : fechaEnDia(d.fecha)} d={d} c$={c$} />
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
          {grupo.map(tabla)}
          {p === paginas.length - 1 && <div className="note">{t('Precio por persona + IVA.', 'Price per person + TAX.')}</div>}
        </Hoja>
      ))}
      <Hoja block>
        <div className="h-sec">{t('TÉRMINOS Y CONDICIONES:', 'TERMS AND CONDITIONS:')}</div>
        <Lineas {...c$('terminos')} como="li" id="terminos" className="terms lg" placeholder={t('Nuevo punto', 'New item')} />
        <Aprobacion idioma={d.idioma} />
        <div className="small">{t('Muchas gracias por su confianza.', 'Thank you very much for your partnership.')}</div>
        <div className="small" style={{ marginTop: 10 }}>{t('Atentamente,', 'Sincerely,')}</div>
        <div className="signature">
          <Editable {...c$('firmante')} placeholder={t('Nombre de quien firma', 'Signer name')} />
        </div>
      </Hoja>
    </>
  )
}

/* ───────── Bonos ───────── */

export function Bonos({ d, set }: { d: BonosData; set: (p: Partial<BonosData>) => void }) {
  const t = traductor(d.idioma)
  const c$ = ligar(d, set)
  const emp$ = (i: number, k: keyof BonosData['empleados'][number]): Ligado => ({
    valor: d.empleados[i][k],
    onCambio: (v) => set({ empleados: d.empleados.map((e, j) => (j === i ? { ...e, [k]: v } : e)) }),
  })
  const filas = d.empleados.map((e, i) => {
    const bruto = num(e.bruto)
    const costo = num(e.costo)
    return { i, nombre: e.nombre, bruto, neto: num(e.neto), costo, total: bruto + costo }
  })
  const suma = (k: 'bruto' | 'neto' | 'costo' | 'total') => filas.reduce((a, f) => a + f[k], 0)
  const paginas = paginar(filas, 12, 24)

  return (
    <>
      {d.conPortada && (
        <Portada
          kicker={t('Cotización de servicios de nómina', 'Payroll services quotation')}
          titulo={<Editable {...c$('tituloPortada')} placeholder={t('Título', 'Title')} />}
          cliente={<Editable {...c$('clientePortada')} placeholder={t('Cliente', 'Client')} />}
          mes={mesAnio(d.idioma, d.fecha)}
        />
      )}
      {paginas.map((grupo, p) => {
        const ultima = p === paginas.length - 1
        return (
          <Hoja key={p}>
            {p === 0 && (
              <>
                <Encabezado linea={<LugarFecha idioma={d.idioma} ciudad={c$('ciudad')} iso={d.fecha} />} d={d} c$={c$} />
                <Lineas
                  {...c$('intro')}
                  como="p"
                  id="intro"
                  className="letter"
                  vars={{ empresa: d.empresa || t('su empresa', 'your company'), titulo: d.tituloPortada }}
                  placeholder={t('Párrafo', 'Paragraph')}
                />
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
                {grupo.map((f) => (
                  <tr key={f.i}>
                    <td>
                      <Editable {...emp$(f.i, 'nombre')} placeholder={t('Nombre del empleado', 'Employee name')} />
                    </td>
                    <td className="r">
                      <Editable {...emp$(f.i, 'bruto')} mostrar={dinero(f.bruto)} placeholder="$0.00" />
                    </td>
                    <td className="r">
                      <Editable {...emp$(f.i, 'neto')} mostrar={dinero(f.neto)} placeholder="$0.00" />
                    </td>
                    <td className="r">
                      <Editable {...emp$(f.i, 'costo')} mostrar={dinero(f.costo)} placeholder="$0.00" />
                    </td>
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
        <Lineas {...c$('terminos')} como="li" id="terminos" className="terms lg" placeholder={t('Nuevo punto', 'New item')} />
        <div className="small" style={{ marginBottom: 14 }}>{t('Muchas gracias por su confianza.', 'Thank you very much for your partnership.')}</div>
        <Aprobacion idioma={d.idioma} />
        <div className="small">{t('Atentamente,', 'Sincerely,')}</div>
        <div className="signature">
          <Editable {...c$('firmante')} placeholder={t('Nombre de quien firma', 'Signer name')} />
        </div>
      </Hoja>
    </>
  )
}

/* ───────── Reclutamiento ───────── */

export function Reclutamiento({ d, set }: { d: ReclutamientoData; set: (p: Partial<ReclutamientoData>) => void }) {
  const t = traductor(d.idioma)
  const c$ = ligar(d, set)
  const pos$ = (i: number, k: keyof ReclutamientoData['posiciones'][number]): Ligado => ({
    valor: d.posiciones[i][k],
    onCambio: (v) => set({ posiciones: d.posiciones.map((p, j) => (j === i ? { ...p, [k]: v } : p)) }),
  })
  const hojas = contarHojas(d.secciones)
  const vars = { posicion: (d.posiciones[0]?.posicion || t('[posición]', '[position]')).toLowerCase() }
  const secciones = {
    ...c$('secciones'),
    id: 'secciones',
    placeholder: t('Nuevo punto', 'New item'),
    placeholderTitulo: t('Título de sección', 'Section title'),
  }
  const cierre = (
    <div>
      <div className="small" style={{ lineHeight: 1.6, marginTop: 4 }}>
        {t('Quedo a sus órdenes para cualquier duda o aclaración.', 'Please let me know if you have any questions.')}
      </div>
      <div className="small" style={{ marginTop: 12 }}>{t('Atentamente,', 'Sincerely,')}</div>
      <div className="signature" style={{ marginBottom: 22 }}>
        <Editable {...c$('firmante')} placeholder={t('Nombre de quien firma', 'Signer name')} />
      </div>
      <Aprobacion idioma={d.idioma} />
    </div>
  )

  return (
    <>
      {d.conPortada && (
        <Portada
          kicker={t('Cotización de reclutamiento', 'Recruitment quote')}
          titulo={<Editable {...c$('tituloPortada')} placeholder={t('Posición', 'Position')} />}
          cliente={<Editable {...c$('empresa')} placeholder={t('Empresa', 'Company')} />}
          mes={mesAnio(d.idioma, d.fecha)}
        />
      )}
      <Hoja>
        <Encabezado linea={<LugarFecha idioma={d.idioma} ciudad={c$('ciudad')} iso={d.fecha} />} d={d} c$={c$} cargo={c$('cargo')} />
        <Lineas {...c$('intro')} como="p" id="intro" className="letter" vars={vars} placeholder={t('Párrafo', 'Paragraph')} />
        <table>
          <thead>
            <tr>
              <th className="dark">{t('Posición', 'Position')}</th>
              <th className="dark" style={{ width: '26%', textAlign: 'left' }}>{t('Modalidad', 'Modality')}</th>
              <th className="dark" style={{ width: '17%' }}>{t('Precio regular', 'Regular price')}</th>
              <th className="dark" style={{ width: '18%' }}>{t('Precio promoción', 'Promotional price')}</th>
            </tr>
          </thead>
          <tbody>
            {d.posiciones.map((p, i) => (
              <tr key={i}>
                <td>
                  <Editable {...pos$(i, 'posicion')} placeholder={t('Posición', 'Position')} />
                </td>
                <td>
                  <Editable {...pos$(i, 'modalidad')} placeholder={t('Modalidad', 'Modality')} />
                </td>
                <td className="r">
                  <Editable {...pos$(i, 'precioRegular')} mostrar={dinero(num(p.precioRegular))} placeholder="$0.00" />
                </td>
                <td className="r strong">
                  <Editable {...pos$(i, 'precioPromo')} mostrar={num(p.precioPromo) > 0 ? dinero(num(p.precioPromo)) : ''} placeholder="—" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className={d.notaPrecios.trim() ? 'note' : 'note vacio'} style={{ fontWeight: 600 }}>
          <Editable {...c$('notaPrecios')} placeholder={t('Nota de precios (opcional)', 'Pricing note (optional)')} />
        </div>
        <Secciones {...secciones} hoja={0} />
        {hojas === 1 && cierre}
      </Hoja>
      {Array.from({ length: hojas - 1 }, (_, n) => (
        <Hoja key={n}>
          <Secciones {...secciones} hoja={n + 1} />
          {n === hojas - 2 && cierre}
        </Hoja>
      ))}
    </>
  )
}

