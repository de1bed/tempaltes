import type { ReactNode } from 'react'
import { dinero, fechaCorta, fechaEn, fechaFeedbak, miles, pct, primerNombre } from '../lib/formato'
import { IMG, PORTADAS } from '../lib/imagenes'
import { rellenar } from '../lib/modelo'
import type { FeedbakData, PlanPago } from '../lib/modelo'
import { contarSecciones, ligar } from '../lib/edicion'
import { Editable, LineaEditable, Secciones } from './Editable'
import { Paginado, type Bloque } from './Paginado'
import { cotizarFeedbak, type CotizacionFeedbak } from '../lib/tabuladores'
import { entradaFeedbak, pagosDelPlan, periodoPlan } from '../lib/pagos'

type FilaPlan = [string, string, string, number, number, number]
type PlanData = [...FilaPlan, PlanPago]

function planesVisibles(planes: PlanPago[], es: boolean, conSetup: string, c: CotizacionFeedbak): PlanData[] {
  const t = (textoEs: string, textoEn: string) => (es ? textoEs : textoEn)
  const todos: Record<PlanPago, FilaPlan> = {
    mensual: [
      t('Pago Mensual', 'Monthly Payment'),
      t('Precio Mensual', 'Monthly Price'),
      t(`Pago mensual (1 mes${conSetup})`, `Monthly payment (1 month${conSetup})`),
      c.primeraFactura,
      0,
      c.primeraFactura,
    ],
    trimestral: [
      t('Descuento por pago Trimestral', 'Quarterly Payment Discount'),
      t('Precio Trimestral', 'Quarterly Price'),
      t(`Pago trimestral (3 meses${conSetup})`, `Quarterly payment (3 months${conSetup})`),
      c.trimestralBase,
      c.descuentoTrimestral,
      c.trimestral,
    ],
    semestral: [
      t('Descuento por pago Semestral', 'Semi-annual Payment Discount'),
      t('Precio Semestral', 'Semi-annual Price'),
      t(`Pago semestral (6 meses${conSetup})`, `Semi-annual payment (6 months${conSetup})`),
      c.semestralBase,
      c.descuentoSemestral,
      c.semestral,
    ],
    anual: [
      t('Descuento por pago Anualizado', 'Annual Payment Discount'),
      t('Precio Anual', 'Annual Price'),
      t(`Pago anual (12 meses${conSetup})`, `Annual payment (12 months${conSetup})`),
      c.anualBase,
      c.descuentoAnual,
      c.anual,
    ],
  }
  const orden: PlanPago[] = ['mensual', 'trimestral', 'semestral', 'anual']
  return orden.filter((p) => planes.includes(p)).map((p): PlanData => [...todos[p], p])
}

/** Hoja membretada de Feedbak: encabezado, pie y marca de agua. */
const fondo = (
  <>
    <img className="bg header" src={IMG.fbHeader} alt="" />
    <img className="bg footer" src={IMG.fbFooter} alt="" />
    <img className="bg mark" src={IMG.fbWatermark} alt="" />
  </>
)

export function Feedbak({ d, set }: { d: FeedbakData; set: (p: Partial<FeedbakData>) => void }) {
  const es = d.idioma === 'es'
  const c$ = ligar(d, set)
  const t = (textoEs: string, textoEn: string) => (es ? textoEs : textoEn)
  const c = cotizarFeedbak(entradaFeedbak(d))
  const usd = d.moneda === 'USD'
  const plataformas = es ? c.producto.plataformas : c.producto.plataformasEn
  const monedaLarga = usd ? t('Dólares Americanos', 'US Dollars') : t('Pesos Mexicanos', 'Mexican Pesos')
  const sufijo = usd ? 'USD' : 'MXN'
  const extra = c.adminsExtra
  const admins = es
    ? `${c.adminsIncluidos} Administradores (sin costo adicional)` + (extra > 0 ? ` + ${extra} adicional${extra === 1 ? '' : 'es'}` : '')
    : `${c.adminsIncluidos} Administrators (no additional cost)` + (extra > 0 ? ` + ${extra} additional` : '')
  const conSetup = c.setup > 0 ? t(', incluye configuración inicial', ', includes initial setup') : ''
  const nombre = primerNombre(d.contacto) || t('[Nombre]', '[Name]')
  const horasIncluidas = d.horasSoporte.trim() || '8'
  const vars = {
    plataformas,
    Moneda: monedaLarga,
    moneda: es ? monedaLarga.toLowerCase() : monedaLarga,
    precioAdmin: `${dinero(c.precioAdminExtra)} ${sufijo}`,
    horasSoporte: horasIncluidas,
  }
  const terminos = {
    ...c$('terminos'),
    id: 'terminos',
    vars,
    placeholder: t('Nuevo punto', 'New item'),
    placeholderTitulo: t('Título de sección', 'Section title'),
  }

  const intro = d.intro.split('\n')
  const secciones = contarSecciones(d.terminos)
  const planes = planesVisibles(d.planesPago, es, conSetup, c)
  // Fechas de pago: desde la fecha del primer pago (o la de la cotización).
  const inicioPagos = d.inicioPagos || d.fecha
  const pagos = planes.map(([titulo, , , , , , plan]) => ({ titulo, plan, lista: pagosDelPlan(plan, c, inicioPagos) }))
  const fechasCalendario = [...new Set(pagos.flatMap((p) => p.lista.map((x) => x.fecha)))].sort()
  const cadaCuanto = (plan: PlanPago) => {
    const { meses } = periodoPlan(plan, c)
    if (meses === 12) return t('Renovación anual', 'Annual renewal')
    return meses === 1 ? t('cada mes', 'every month') : t(`cada ${meses} meses`, `every ${meses} months`)
  }

  const bloques: Bloque[] = [
    {
      key: 'encabezado',
      nodo: (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div className="muted" style={{ fontSize: 12.5 }}>
            <Editable {...c$('ciudad')} placeholder={t('Ciudad', 'City')} />
            {es ? ` a ${fechaFeedbak(d.fecha)}` : `, ${fechaEn(d.fecha)}`}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1, fontSize: 13, lineHeight: 1.45 }}>
            <div className="accent" style={{ fontWeight: 600 }}>
              <Editable {...c$('contacto')} placeholder={t('Nombre del contacto', 'Contact name')} />
            </div>
            <div className={d.puesto.trim() ? undefined : 'vacio'}>
              <Editable {...c$('puesto')} placeholder={t('Puesto (opcional)', 'Job title (optional)')} />
            </div>
            <div>
              <Editable {...c$('empresa')} placeholder={t('Empresa', 'Company')} />
            </div>
            {es && <div className="muted">Presente</div>}
          </div>
          <div className="accent" style={{ fontSize: 13, fontWeight: 600, marginTop: 2 }}>
            {es ? `${d.tratamiento} ${nombre}:` : `Dear ${nombre},`}
          </div>
        </div>
      ),
    },
    // Cada párrafo de la carta es un bloque: si la carta crece, pasa a la hoja siguiente.
    ...intro.map((l, i) => ({
      key: `intro-${i}`,
      nodo: (
        <p className={l.trim() ? undefined : 'vacio'}>
          <LineaEditable items={intro} i={i} onCambio={(v) => set({ intro: v })} id="intro" vars={vars} placeholder={t('Párrafo', 'Paragraph')} />
        </p>
      ),
    })),
    {
      key: 'titulo',
      conSiguiente: true,
      nodo: (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingTop: 2 }}>
          <div className="h-title">
            <Editable {...c$('titulo')} placeholder={t('Título', 'Title')} />
          </div>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#3D5257' }}>{t('Esta propuesta incluye:', 'This proposal includes:')}</div>
        </div>
      ),
    },
    {
      key: 'alcance',
      nodo: (
        <table>
          <tbody>
            {(
              [
                [t('Plataformas Incluídas:', 'Included Platforms:'), plataformas],
                [t('Colaboradores:', 'Employees:'), <Editable key="colaboradores" {...c$('colaboradores')} mostrar={miles(c.colaboradores)} placeholder="0" />],
                [t('Usuarios Administradores:', 'Administrator Users:'), admins],
                [
                  t('Capacitación Personalizada:', 'Personalized Training:'),
                  <>
                    {t('Incluida (', 'Included (')}
                    <Editable {...c$('capacitacionHoras')} placeholder="0" /> hrs){t(' + Material Virtual', ' + Virtual Material')}
                  </>,
                ],
                [t('Configuración Inicial:', 'Initial Setup:'), c.setup > 0 ? dinero(c.setup) : t('Sin costo', 'No cost')],
                [
                  t('Horas de soporte incluidas:', 'Support hours included:'),
                  <>
                    <Editable {...c$('horasSoporte')} mostrar={horasIncluidas} placeholder="0" /> {t('horas', 'hours')}
                  </>,
                ],
                ...(d.mostrarCostoHoraAdicional
                  ? [[t('Costo por Hora de Soporte Adicional:', 'Cost per Additional Support Hour:'), <Editable key="costo" {...c$('costoHoraAdicional')} placeholder="$0.00" />]]
                  : []),
              ] as [string, ReactNode][]
            ).map(([k, v]) => (
              <tr key={k}>
                <td className="k">{k}</td>
                <td className="v">{v}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ),
    },
    {
      key: 'precios',
      nodo: (
        <table>
          <thead>
            <tr>
              <th className="dark">{t('Concepto', 'Item')}</th>
              <th className="dark">{t('Precio Unitario', 'Unit Price')}</th>
              <th className="dark">{t('Cantidad', 'Quantity')}</th>
              <th className="dark">{t('Monto', 'Amount')}</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>{t('Precio mensual por usuario', 'Monthly price per user')}</td>
              <td className="r">{dinero(c.precioUsuario)}</td>
              <td className="r">{miles(c.colaboradores)}</td>
              <td className="r">{dinero(c.mensualUsuarios)}</td>
            </tr>
            <tr>
              <td>{t('Precio mensual por administrador', 'Monthly price per administrator')}</td>
              <td className="r">{dinero(0)}</td>
              <td className="r">{c.adminsIncluidos}</td>
              <td className="r">{dinero(0)}</td>
            </tr>
            {extra > 0 && (
              <tr>
                <td>{t('Administrador adicional (mensual)', 'Additional administrator (monthly)')}</td>
                <td className="r">{dinero(c.precioAdminExtra)}</td>
                <td className="r">{extra}</td>
                <td className="r">{dinero(c.mensualAdminsExtra)}</td>
              </tr>
            )}
            <tr className="total">
              <td style={{ fontWeight: 600 }}>{t('Total Mensual', 'Monthly Total')}</td>
              <td />
              <td />
              <td className="r strong">{dinero(c.totalMensual)}</td>
            </tr>
            {c.setup > 0 && (
              <tr>
                <td>{t('Primera factura (mensualidad + configuración inicial)', 'First invoice (monthly fee + initial setup)')}</td>
                <td />
                <td />
                <td className="r">{dinero(c.primeraFactura)}</td>
              </tr>
            )}
          </tbody>
        </table>
      ),
    },
    ...(planes.length > 0
      ? [
          {
            key: 'planes',
            nodo: (
              <table>
                <thead>
                  <tr>
                    <th className="green">{t('Plan de pago', 'Payment plan')}</th>
                    <th className="green">{t('Precio', 'Price')}</th>
                    <th className="green">{t('Descuento (%)', 'Discount (%)')}</th>
                    <th className="green">{t('Monto', 'Amount')}</th>
                    <th className="green" style={{ whiteSpace: 'nowrap' }}>
                      {t('Fecha de pago', 'Payment date')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {planes.map(([titulo, , fila, base, desc, total, plan], i) => {
                    const siguiente = pagos[i].lista[1]
                    return (
                      <tr key={titulo}>
                        <td>
                          {fila}
                          {siguiente && (
                            <div className="muted" style={{ fontSize: 9.5 }}>
                              {t('Después', 'Then')} {dinero(siguiente.monto)} {cadaCuanto(plan)}
                            </div>
                          )}
                        </td>
                        <td className="r">{dinero(base)}</td>
                        <td className="r">{pct(desc)}</td>
                        <td className="r strong">{dinero(total)}</td>
                        <td className="r" style={{ whiteSpace: 'nowrap' }}>
                          {fechaCorta(inicioPagos, es)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            ),
          },
        ]
      : []),
    ...(d.calendarioPagos && planes.length > 0
      ? [
          {
            key: 'calendario-pagos',
            nodo: (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#3D5257' }}>{t('Calendario de pagos (primeros 12 meses)', 'Payment schedule (first 12 months)')}</div>
                <table className="calendario-pagos">
                  <thead>
                    <tr>
                      <th className="dark">{t('Fecha', 'Date')}</th>
                      {pagos.map((p) => (
                        <th key={p.plan} className="dark">
                          {periodoPlan(p.plan, c).meses === 1
                            ? t('Mensual', 'Monthly')
                            : periodoPlan(p.plan, c).meses === 3
                              ? t('Trimestral', 'Quarterly')
                              : periodoPlan(p.plan, c).meses === 6
                                ? t('Semestral', 'Semi-annual')
                                : t('Anual', 'Annual')}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {fechasCalendario.map((f) => (
                      <tr key={f}>
                        <td>{fechaCorta(f, es)}</td>
                        {pagos.map((p) => {
                          const pago = p.lista.find((x) => x.fecha === f)
                          return (
                            <td key={p.plan} className={pago ? 'r' : 'r muted'}>
                              {pago ? dinero(pago.monto) : '—'}
                            </td>
                          )
                        })}
                      </tr>
                    ))}
                    <tr className="total">
                      <td style={{ fontWeight: 600 }}>{t('Total 12 meses', '12-month total')}</td>
                      {pagos.map((p) => (
                        <td key={p.plan} className="r strong">
                          {dinero(p.lista.reduce((s, x) => s + x.monto, 0))}
                        </td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>
            ),
          },
        ]
      : []),
    {
      key: 'nota',
      nodo: (
        <div className="muted" style={{ fontSize: 10.5, fontStyle: 'italic' }}>
          <Editable {...c$('notaMontos')} mostrar={rellenar(d.notaMontos, vars)} placeholder={t('Nota', 'Note')} />
        </div>
      ),
    },
    {
      key: 'terminos-titulo',
      conSiguiente: true,
      nodo: (
        <div className="h-title" style={{ paddingTop: 4 }}>
          {t('Términos y Condiciones del Servicio (SaaS)', 'Service Terms and Conditions (SaaS)')}
        </div>
      ),
    },
    // Cada sección de términos es un bloque: un título nunca queda separado de sus puntos.
    ...Array.from({ length: secciones }, (_, n) => ({
      key: `seccion-${n}`,
      // La última sección va junto con la firma: la firma nunca queda sola en una hoja.
      conSiguiente: n === secciones - 1,
      nodo: <Secciones {...terminos} desde={n} hasta={n + 1} />,
    })),
    {
      key: 'firma',
      nodo: (
        <div className="fb-contacto">
          <div style={{ color: '#3D5257' }}>{t('Atentamente', 'Sincerely')}</div>
          <div className="accent" style={{ fontWeight: 600 }}>
            <Editable {...c$('creadoPor')} placeholder={t('Nombre de la ejecutiva', 'Account executive name')} />
          </div>
          <div className={d.creadoPorEmail.trim() ? 'muted' : 'muted vacio'} style={{ fontSize: 11 }}>
            <Editable {...c$('creadoPorEmail')} placeholder={t('Correo', 'Email')} />
          </div>
          <div className={d.creadoPorTelefono.trim() ? 'muted' : 'muted vacio'} style={{ fontSize: 11 }}>
            <Editable {...c$('creadoPorTelefono')} placeholder={t('Teléfono', 'Phone')} />
          </div>
          <div className="muted" style={{ fontSize: 11 }}>
            <Editable {...c$('firmanteEmpresa')} placeholder={t('Empresa', 'Company')} />
          </div>
        </div>
      ),
    },
  ]

  return (
    <>
      {d.portada !== 'ninguna' && (
        <section className="page">
          <img className="cover-img" src={PORTADAS[d.portada]} alt="" />
        </section>
      )}

      <Paginado clase="fb" claseContenido="letter" fondo={fondo} bloques={bloques} />
    </>
  )
}
