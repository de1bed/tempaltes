import type { ReactNode } from 'react'
import {
  dinero,
  fechaEn,
  fechaEnDia,
  fechaEs,
  lineas,
  mesAnioEn,
  mesAnioEs,
  miles,
  num,
  paginar,
  primerNombre,
} from '../lib/formato'
import { rellenar, type BonosData, type GmmData, type PayrollData, type ServiciosData } from '../lib/modelo'

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

function Encabezado(p: { linea: string; contacto: string; empresa: string; saludo: string; es?: boolean }) {
  return (
    <>
      <div className="muted" style={{ fontSize: 11.5 }}>{p.linea}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 1, fontSize: 12.5, lineHeight: 1.4 }}>
        <div className="accent" style={{ fontWeight: 600 }}>{p.contacto || (p.es ? 'Nombre del contacto' : 'Contact name')}</div>
        <div>{p.empresa || (p.es ? 'Empresa' : 'Company')}</div>
      </div>
      <div className="accent" style={{ fontSize: 12.5, fontWeight: 600 }}>{p.saludo}</div>
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

function Firma({ es }: { es?: boolean }) {
  const f = es
    ? ['Nombre:', 'Posición:', 'Fecha:', 'Firma:']
    : ['Name:', 'Position:', 'Date:', 'Signature:']
  return (
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

/* ───────── Servicios y trámites (ES) ───────── */

export function Servicios({ d }: { d: ServiciosData }) {
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
            <th className="olive c" style={{ width: '9%', textAlign: 'center' }}>Cantidad</th>
            <th className="olive" style={{ textAlign: 'left' }}>Servicio</th>
            <th className="olive" style={{ width: '15%' }}>Precio unitario</th>
            <th className="olive" style={{ width: '14%' }}>Subtotal</th>
            <th className="olive" style={{ width: '12%' }}>IVA</th>
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
          <div className="accent" style={{ fontSize: 12, fontWeight: 600, marginTop: 4 }}>Detalle de la propuesta:</div>
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
      <Portada kicker="Cotización" titulo={d.tituloPortada} cliente={d.empresa || 'Empresa'} mes={mesAnioEs(d.fecha)} />
      <Hoja>
        <Encabezado
          linea={`${d.ciudad} a ${fechaEs(d.fecha)}.`}
          contacto={d.contacto}
          empresa={d.empresa}
          saludo={`${d.tratamiento} ${primerNombre(d.contacto) || '[Nombre]'}:`}
          es
        />
        <Parrafos texto={rellenar(d.intro, { empresa: d.empresa })} />
        <table>
          <thead>
            <tr>
              <th className="dark">Servicio</th>
              <th className="dark" style={{ width: '26%' }}>Precio unitario</th>
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
        <div className="accent" style={{ fontSize: 12.5, fontWeight: 600, marginBottom: 8 }}>Términos y condiciones:</div>
        <ListaTerminos texto={d.terminos} />
        <div className="accent" style={{ fontSize: 11.5, fontWeight: 600, letterSpacing: 0.5, marginBottom: 8 }}>Acepto cotización</div>
        <Firma es />
        <div className="small" style={{ lineHeight: 1.6 }}>Quedo a sus órdenes para cualquier duda o aclaración.</div>
        <div className="small" style={{ marginTop: 14 }}>Atentamente,</div>
        <div className="signature">{d.firmante}</div>
      </Hoja>
    </>
  )
}

/* ───────── Payroll services (EN) ───────── */

/** Semanas promedio por mes (52 / 12). */
const SEMANAS_MES = 52 / 12

export function Payroll({ d }: { d: PayrollData }) {
  const fee = num(d.fee)
  const feeTxt = `${fee}%`
  const base: [string, number][] = [
    ['Gross salary', num(d.salario)],
    ['Employer taxes (IMSS, INFONAVIT, SAR, state tax)', num(d.impuestos)],
    ['Vacation pay, Christmas bonus and vacation bonus', num(d.prestaciones)],
  ]
  const subtotal = base.reduce((a, [, v]) => a + v, 0)
  const filas: [string, number][] = [...base, [`Service fee (${feeTxt})`, (subtotal * fee) / 100]]
  const total = subtotal * (1 + fee / 100)
  const vars = { empresa: d.empresa || 'your company', puesto: d.puesto, fee: feeTxt }

  return (
    <>
      <Portada kicker="Payroll services quote" titulo={d.tituloPortada} cliente={d.clientePortada} mes={mesAnioEn(d.fecha)} />
      <Hoja>
        <Encabezado
          linea={`${d.ciudad}, ${fechaEn(d.fecha)}`}
          contacto={d.contacto}
          empresa={d.empresa}
          saludo={`Dear ${primerNombre(d.contacto) || '[Name]'},`}
        />
        <Parrafos texto={rellenar(d.intro, vars)} />
        <div className="h-title">Quote for payroll services of indirect employees</div>
        <table>
          <tbody>
            {[
              ['Position', d.puesto],
              ['Headcount', miles(num(d.headcount))],
              ['Payroll frequency', d.frecuencia],
              ['Service fee', feeTxt],
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
              <th className="dark">Salary structure</th>
              <th className="dark" style={{ width: '22%' }}>Weekly</th>
              <th className="dark" style={{ width: '22%' }}>Monthly</th>
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
              <td>Total per person</td>
              <td className="r strong">{dinero(total)}</td>
              <td className="r strong">{dinero(total * SEMANAS_MES)}</td>
            </tr>
          </tbody>
        </table>
        <div className="note">Price per person + TAX.</div>
      </Hoja>
      <Hoja block>
        <div className="h-sec">TERMS AND CONDITIONS:</div>
        <ListaTerminos texto={rellenar(d.terminos, vars)} />
        <div className="accent" style={{ fontSize: 11.5, fontWeight: 600, letterSpacing: 0.5, marginBottom: 8 }}>I APPROVE THIS QUOTE</div>
        <Firma />
        <div className="small">Thank you very much for your partnership.</div>
        <div className="small" style={{ marginTop: 10 }}>Sincerely,</div>
        <div className="signature">{d.firmante}</div>
      </Hoja>
    </>
  )
}

/* ───────── Medical insurance GMM (EN) ───────── */

export function Gmm({ d }: { d: GmmData }) {
  const nombres = d.empleados.map((e) => e.nombre.trim()).filter(Boolean)
  const paginas = paginar(d.empleados, 2, 5)
  const tabla = (e: GmmData['empleados'][number], i: number) => (
    <table key={i}>
      <thead>
        <tr>
          <th colSpan={3} className="dark">{e.nombre || 'Employee name'}</th>
        </tr>
        <tr>
          <th className="olive">Age: {e.edad}</th>
          <th className="olive" style={{ width: '24%' }}>Monthly Cost</th>
          <th className="olive" style={{ width: '24%' }}>Annual Cost</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>Minor Medical Insurance</td>
          <td className="r">{dinero(num(e.menorMensual))}</td>
          <td className="r">{dinero(num(e.menorAnual))}</td>
        </tr>
        <tr>
          <td>Major Medical Insurance</td>
          <td className="r">{dinero(num(e.mayorMensual))}</td>
          <td className="r">{dinero(num(e.mayorAnual))}</td>
        </tr>
      </tbody>
    </table>
  )

  return (
    <>
      <Portada
        kicker="Quote"
        titulo="Medical Major & Minor Insurance"
        normal
        cliente={nombres.length === 1 ? nombres[0] : nombres.length > 1 ? `${nombres.length} employees` : 'Employee name'}
        sub={d.clientePortada}
        mes={mesAnioEn(d.fecha)}
      />
      {paginas.map((grupo, p) => (
        <Hoja key={p}>
          {p === 0 && (
            <>
              <Encabezado
                linea={fechaEnDia(d.fecha)}
                contacto={d.contacto}
                empresa={d.empresa}
                saludo={`Dear ${primerNombre(d.contacto) || '[Name]'},`}
              />
              <div className="letter" style={{ display: 'contents' }}>
                <p>
                  Thank you for your continued trust and partnership. Please find below the quote for the Major Medical
                  Policy for the following employee{nombres.length === 1 ? '' : 's'}:
                </p>
                <div className="accent" style={{ fontSize: 11.5, fontWeight: 600 }}>{nombres.join(', ') || 'Employee name'}</div>
                <p>
                  This quotation reflects the applicable coverage and pricing for their enrollment, with an effective
                  period from {fechaEn(d.inicio)}, through {fechaEn(d.fin)}.
                </p>
                <p>We remain committed to providing reliable service, timely support, and competitive coverage options.</p>
              </div>
              <div className="h-title">Private medical insurance</div>
            </>
          )}
          {grupo.map((e, i) => tabla(e, i))}
          {p === paginas.length - 1 && <div className="note">Price per person + TAX.</div>}
        </Hoja>
      ))}
      <Hoja block>
        <div className="h-sec">TERMS AND CONDITIONS:</div>
        <ListaTerminos texto={d.terminos} lg />
        <div className="accent" style={{ fontSize: 11.5, fontWeight: 600, letterSpacing: 0.5, marginBottom: 8 }}>I APPROVE THIS QUOTE</div>
        <Firma />
        <div className="small">Thank you very much for your partnership.</div>
        <div className="small" style={{ marginTop: 10 }}>Sincerely,</div>
        <div className="signature">{d.firmante}</div>
      </Hoja>
    </>
  )
}

/* ───────── Bonuses (EN) ───────── */

export function Bonos({ d }: { d: BonosData }) {
  const filas = d.empleados.map((e) => {
    const bruto = num(e.bruto)
    const costo = num(e.costo)
    return { nombre: e.nombre, bruto, neto: num(e.neto), costo, total: bruto + costo }
  })
  const suma = (k: 'bruto' | 'neto' | 'costo' | 'total') => filas.reduce((a, f) => a + f[k], 0)
  const paginas = paginar(filas, 12, 24)

  return (
    <>
      <Portada kicker="Payroll services quotation" titulo={d.tituloPortada} cliente={d.clientePortada} mes={mesAnioEn(d.fecha)} />
      {paginas.map((grupo, p) => {
        const ultima = p === paginas.length - 1
        return (
          <Hoja key={p}>
            {p === 0 && (
              <>
                <Encabezado
                  linea={`${d.ciudad}, ${fechaEn(d.fecha)}`}
                  contacto={d.contacto}
                  empresa={d.empresa}
                  saludo={`Dear ${primerNombre(d.contacto) || '[Name]'},`}
                />
                <Parrafos texto={rellenar(d.intro, { empresa: d.empresa || 'your company', titulo: d.tituloPortada })} />
                <div className="h-title">Quote for payroll services of indirect employees</div>
              </>
            )}
            <table className="sm">
              <thead>
                <tr>
                  <th className="dark">Employee</th>
                  <th className="dark" style={{ width: '16%' }}>Gross Bonus</th>
                  <th className="dark" style={{ width: '16%' }}>Net Bonus</th>
                  <th className="dark" style={{ width: '18%' }}>Payroll Cost</th>
                  <th className="dark" style={{ width: '16%' }}>Total</th>
                </tr>
              </thead>
              <tbody>
                {grupo.map((f, i) => (
                  <tr key={i}>
                    <td>{f.nombre || 'Employee name'}</td>
                    <td className="r">{dinero(f.bruto)}</td>
                    <td className="r">{dinero(f.neto)}</td>
                    <td className="r">{dinero(f.costo)}</td>
                    <td className="r">{dinero(f.total)}</td>
                  </tr>
                ))}
                {ultima && (
                  <tr className="total">
                    <td>Grand total</td>
                    <td className="r">{dinero(suma('bruto'))}</td>
                    <td className="r">{dinero(suma('neto'))}</td>
                    <td className="r">{dinero(suma('costo'))}</td>
                    <td className="r strong">{dinero(suma('total'))}</td>
                  </tr>
                )}
              </tbody>
            </table>
            {ultima && <div className="note">Price per person + TAX.</div>}
          </Hoja>
        )
      })}
      <Hoja block>
        <div className="h-sec">TERMS AND CONDITIONS:</div>
        <ListaTerminos texto={d.terminos} lg />
        <div className="small" style={{ marginBottom: 14 }}>Thank you very much for your partnership.</div>
        <div className="accent" style={{ fontSize: 11.5, fontWeight: 600, letterSpacing: 0.5, marginBottom: 8 }}>I APPROVE THIS QUOTE</div>
        <Firma />
        <div className="small">Sincerely,</div>
        <div className="signature">{d.firmante}</div>
      </Hoja>
    </>
  )
}
