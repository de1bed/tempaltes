import type { ReactNode } from 'react'
import { dinero, fechaEn, fechaFeedbak, miles, num, pct, primerNombre } from '../lib/formato'
import { IMG, PORTADAS } from '../lib/imagenes'
import type { FeedbakData } from '../lib/modelo'
import { cotizarFeedbak } from '../lib/tabuladores'

function Hoja({ children }: { children: ReactNode }) {
  return (
    <section className="page fb">
      <img className="bg header" src={IMG.fbHeader} alt="" />
      <img className="bg footer" src={IMG.fbFooter} alt="" />
      <img className="bg mark" src={IMG.fbWatermark} alt="" />
      {children}
    </section>
  )
}

function Terminos({ titulo, items, mb }: { titulo: string; items: ReactNode[]; mb?: number }) {
  return (
    <>
      <div className="h-sec">{titulo}</div>
      <ul className="terms" style={mb === undefined ? undefined : { marginBottom: mb }}>
        {items.map((t, i) => (
          <li key={i}>{t}</li>
        ))}
      </ul>
    </>
  )
}

export function Feedbak({ d }: { d: FeedbakData }) {
  const es = d.idioma === 'es'
  const t = (textoEs: string, textoEn: string) => (es ? textoEs : textoEn)
  const c = cotizarFeedbak({
    producto: d.producto,
    colaboradores: num(d.colaboradores),
    administradores: num(d.administradores),
    moneda: d.moneda,
    tipoCambio: num(d.tipoCambio),
  })
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

  return (
    <>
      {d.portada !== 'ninguna' && (
        <section className="page">
          <img className="cover-img" src={PORTADAS[d.portada]} alt="" />
        </section>
      )}

      <Hoja>
        <div className="content letter" style={{ gap: 14 }}>
          <div className="muted" style={{ fontSize: 12.5 }}>
            {es ? `${d.ciudad} a ${fechaFeedbak(d.fecha)}` : `${d.ciudad}, ${fechaEn(d.fecha)}`}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1, fontSize: 13, lineHeight: 1.45 }}>
            <div className="accent" style={{ fontWeight: 600 }}>{d.contacto || t('Nombre del contacto', 'Contact name')}</div>
            {d.puesto && <div>{d.puesto}</div>}
            <div>{d.empresa || t('Empresa', 'Company')}</div>
            {es && <div className="muted">Presente</div>}
          </div>
          <div className="accent" style={{ fontSize: 13, fontWeight: 600, marginTop: 2 }}>
            {es ? `${d.tratamiento} ${nombre}:` : `Dear ${nombre},`}
          </div>
          <p>
            {t(
              `Sabemos que llevar la administración en empresas tan importantes como la suya, es todo un reto. Debido a esto, para Feedbak es un privilegio presentar las Plataformas Tecnológicas que permiten eficientizar tiempos de Administración y ahorrar importantes costos asociados con el personal; a través de ${plataformas}.`,
              `We know that managing administration in companies as important as yours is a real challenge. That is why Feedbak is proud to present the Technology Platforms that streamline administrative time and deliver significant savings in personnel-related costs through ${plataformas}.`,
            )}
          </p>
          <p>{t('Con esto en mente les presentamos la siguiente propuesta.', 'With this in mind, we are pleased to present the following proposal.')}</p>

          <div className="h-title" style={{ marginTop: 6 }}>
            {t('Cotización Licenciamiento de Plataforma Tecnológica', 'Technology Platform Licensing Quote')}
          </div>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#3D5257', marginTop: -4 }}>
            {t('Esta propuesta incluye:', 'This proposal includes:')}
          </div>
          <table>
            <tbody>
              {[
                [t('Plataformas Incluídas:', 'Included Platforms:'), plataformas],
                [t('Colaboradores:', 'Employees:'), miles(c.colaboradores)],
                [t('Usuarios Administradores:', 'Administrator Users:'), admins],
                [
                  t('Capacitación Personalizada:', 'Personalized Training:'),
                  t(`Incluida (${d.capacitacionHoras} hrs) + Material Virtual`, `Included (${d.capacitacionHoras} hrs) + Virtual Material`),
                ],
                [t('Configuración Inicial:', 'Initial Setup:'), c.setup > 0 ? dinero(c.setup) : t('Sin costo', 'No cost')],
                [t('Horas de soporte incluidas:', 'Support hours included:'), t(`${d.horasSoporte} horas`, `${d.horasSoporte} hours`)],
                [t('Costo por Hora de Soporte Adicional:', 'Cost per Additional Support Hour:'), d.costoHoraAdicional],
              ].map(([k, v]) => (
                <tr key={k}>
                  <td className="k">{k}</td>
                  <td className="v">{v}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Hoja>

      <Hoja>
        <div className="content" style={{ gap: 12 }}>
          <table style={{ marginTop: 4 }}>
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

          {(
            [
              [
                t('Descuento por pago Semestral', 'Semi-annual Payment Discount'),
                t('Precio Semestral', 'Semi-annual Price'),
                t(`Pago semestral (6 meses${conSetup})`, `Semi-annual payment (6 months${conSetup})`),
                c.semestralBase,
                c.descuentoSemestral,
                c.semestral,
              ],
              [
                t('Descuento por pago Anualizado', 'Annual Payment Discount'),
                t('Precio Anual', 'Annual Price'),
                t(`Pago anual (12 meses${conSetup})`, `Annual payment (12 months${conSetup})`),
                c.anualBase,
                c.descuentoAnual,
                c.anual,
              ],
            ] as const
          ).map(([titulo, col, fila, base, desc, total]) => (
            <table key={titulo}>
              <thead>
                <tr>
                  <th className="green">{titulo}</th>
                  <th className="green">{col}</th>
                  <th className="green">{t('Descuento (%)', 'Discount (%)')}</th>
                  <th className="green">{t('Monto', 'Amount')}</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>{fila}</td>
                  <td className="r">{dinero(base)}</td>
                  <td className="r">{pct(desc)}</td>
                  <td className="r strong">{dinero(total)}</td>
                </tr>
              </tbody>
            </table>
          ))}

          <div className="muted" style={{ fontSize: 10.5, fontStyle: 'italic' }}>
            {t(
              `Todos los montos están expresados en ${monedaLarga} y no incluyen IVA (donde aplique).`,
              `All amounts are expressed in ${monedaLarga} and do not include VAT (where applicable).`,
            )}
          </div>
          <div className="h-title" style={{ marginTop: 12, marginBottom: 10 }}>
            {t('Términos y Condiciones del Servicio (SaaS)', 'Service Terms and Conditions (SaaS)')}
          </div>
          <div>
            <Terminos
              titulo={t('1. Condiciones de Pago', '1. Payment Terms')}
              items={
                es
                  ? [
                      'El pago anual o semestral deberá realizarse en una sola exhibición antes del inicio del servicio.',
                      'En pagos mensuales, el setup inicial y la primera mensualidad deberán cubrirse al iniciar el proyecto.',
                      'Nuestros servicios son pre-pago: todas las mensualidades son por adelantado.',
                      `Los precios están expresados en ${monedaLarga.toLowerCase()}, más IVA (16%, donde aplique), y son válidos por 15 días naturales.`,
                      `El costo por cada Usuario Administrador adicional será de ${dinero(c.precioAdminExtra)} ${sufijo} más IVA (16%, donde aplique) de manera mensual. Dicho importe tendrá el carácter de no negociable y no estará sujeto a la aplicación de promociones, descuentos, bonificaciones ni cualquier otro beneficio comercial vigente o futuro.`,
                      'En el supuesto de que el monto total de la factura entregada y no objetada por “El cliente” o cualquier porción de dicha factura no sea pagada a “El Proveedor” dentro del terminó de 7 días naturales antes citado, conllevará un cargo de interés moratorio del 10% (diez por ciento) mensual sobre el saldo vencido pagadero por “El Cliente” a “El Proveedor” en conjunto con la suerte principal consignada en la factura respectiva.',
                    ]
                  : [
                      'Annual or semi-annual payments must be made in a single installment before the service starts.',
                      'For monthly payments, the initial setup and the first monthly fee must be paid at the start of the project.',
                      'Our services are prepaid: all monthly fees are paid in advance.',
                      `Prices are expressed in ${monedaLarga}, plus VAT (16%, where applicable), and are valid for 15 calendar days.`,
                      `The cost of each additional Administrator User will be ${dinero(c.precioAdminExtra)} ${sufijo} plus VAT (16%, where applicable) per month. This amount is non-negotiable and is not subject to any current or future promotions, discounts, credits or other commercial benefits.`,
                      'If the total amount of an invoice delivered and not disputed by “The Client”, or any portion of it, is not paid to “The Provider” within the 7 calendar days mentioned above, a late-payment interest of 10% (ten percent) per month will be charged on the past-due balance payable by “The Client” to “The Provider”, together with the principal amount stated on the respective invoice.',
                    ]
              }
            />
            <Terminos
              titulo={t('2. Vigencia y Ajustes de Precio', '2. Validity and Price Adjustments')}
              items={
                es
                  ? [
                      'Los precios podrán actualizarse anualmente conforme a inflación (Índice INPC) u otros factores de mercado.',
                      'El cliente será notificado con al menos 30 días de anticipación.',
                    ]
                  : [
                      'Prices may be updated annually based on inflation (Mexican INPC index) or other market factors.',
                      'The client will be notified at least 30 days in advance.',
                    ]
              }
            />
          </div>
        </div>
      </Hoja>

      <Hoja>
        <div className="content" style={{ display: 'block' }}>
          <Terminos
            titulo={t('3. Alcance de la Implementación y Soporte', '3. Implementation Scope and Support')}
            items={
              es
                ? [
                    'La propuesta incluye las horas de soporte indicadas durante la implementación. Para horas adicionales, favor de solicitar una cotización separada.',
                    'Toda configuración especial o requisito para la puesta en marcha y el correcto funcionamiento de la plataforma, es cubierto por el tiempo disponible de “Implementación”. En caso de agotar todas las horas y requerir horas adicionales, estas serán facturadas por paquetes por separado con un costo de $1,200.00 por hora (más IVA) y un tiempo de respuesta de hasta 24 horas en días hábiles. En caso de ser un soporte o servicio urgente este tendrá un costo de $1,900.00 pesos (más IVA) por hora en un tiempo no mayor a 3 horas, en caso de ser fuera de horario de oficina se agregará el 20% de costo sobre total de tiempo. Horarios de Lun-Jue 8am a 6pm y Vie 8am a 3pm PST. Sábados y Domingos no son días hábiles.',
                    'Gastos de viáticos fuera de la ciudad (cuando aplique y previa autorización del cliente) correrán por cuenta del cliente.',
                  ]
                : [
                    'This proposal includes the support hours indicated during implementation. For additional hours, please request a separate quote.',
                    'Any special configuration or requirement for the launch and proper operation of the platform is covered by the available “Implementation” time. If all hours are used and additional hours are required, they will be invoiced separately in packages at $1,200.00 MXN per hour (plus VAT), with a response time of up to 24 business hours. Urgent support or services will cost $1,900.00 MXN (plus VAT) per hour, with a response time of no more than 3 hours; outside office hours, a 20% surcharge will be added to the total time. Office hours: Mon–Thu 8am to 6pm and Fri 8am to 3pm PST. Saturdays and Sundays are not business days.',
                    'Out-of-town travel expenses (when applicable and with prior client authorization) will be covered by the client.',
                  ]
            }
          />
          <Terminos
            titulo={t('4. Hardware y Responsabilidades del Cliente', '4. Hardware and Client Responsibilities')}
            mb={14}
            items={
              es
                ? [
                    'La cotización no incluye ningún tipo de hardware (iPads, Tablets, accesorios, pedestales, arneses, etc.).',
                    'El cliente tiene la responsabilidad de: Adquirir y mantener los equipos necesarios. Instalar y configurar la aplicación en cada dispositivo; así como de proveer la información a la plataforma mediante archivos de texto o Excel, según se indique.',
                    'Feedbak puede cotizar y proveer hardware bajo solicitud expresa del cliente.',
                  ]
                : [
                    'This quote does not include any hardware (iPads, tablets, accessories, stands, harnesses, etc.).',
                    'The client is responsible for purchasing and maintaining the necessary equipment, installing and configuring the application on each device, and providing the information to the platform through text or Excel files, as indicated.',
                    'Feedbak can quote and provide hardware upon the client’s express request.',
                  ]
            }
          />
          <Terminos
            titulo={t('5. Capacitación', '5. Training')}
            mb={13}
            items={
              es
                ? [
                    'La cotización provista incluye una sesión inicial remota vía Zoom para administradores.',
                    'La sesión será grabada y entregada al cliente para consultas posteriores.',
                    'Cualquier capacitación adicional, podrá causar cargo por horas de soporte.',
                    'Material de soporte se proveerá vía video en plataformas.',
                  ]
                : [
                    'This quote includes one initial remote session via Zoom for administrators.',
                    'The session will be recorded and delivered to the client for future reference.',
                    'Any additional training may be charged as support hours.',
                    'Support material will be provided as videos within the platforms.',
                  ]
            }
          />
        </div>
      </Hoja>

      <Hoja>
        <div className="content" style={{ display: 'block' }}>
          <Terminos
            titulo={t('6. Privacidad y Protección de Datos', '6. Privacy and Data Protection')}
            mb={13}
            items={
              es
                ? [
                    'La información suministrada por el cliente será tratada conforme a la Ley Federal de Protección de Datos Personales.',
                    'El cliente declara contar con el consentimiento de sus empleados para el tratamiento de la información compartida.',
                    'Feedbak no modificará ni operará la información del cliente sin autorización.',
                    'Feedbak no tiene acceso a datos específicos de los empleados.',
                    'Feedbak no utiliza ni explota esos datos para fines distintos al servicio.',
                    'Los datos están encriptados y protegidos todo el tiempo.',
                    'El acceso a datos personales se concede solamente en casos estrictamente necesarios (soporte, mantenimiento, cumplimiento legal).',
                  ]
                : [
                    'Information provided by the client will be handled in accordance with the Mexican Federal Law on the Protection of Personal Data.',
                    'The client states that it has its employees’ consent to process the information shared.',
                    'Feedbak will not modify or operate the client’s information without authorization.',
                    'Feedbak does not have access to specific employee data.',
                    'Feedbak does not use or exploit this data for purposes other than the service.',
                    'Data is encrypted and protected at all times.',
                    'Access to personal data is granted only when strictly necessary (support, maintenance, legal compliance).',
                  ]
            }
          />
          <Terminos
            titulo={t('7. Soporte Técnico Posterior', '7. Ongoing Technical Support')}
            mb={13}
            items={
              es
                ? [
                    'El soporte técnico posterior requiere contar con póliza o paquete vigente de horas de soporte (Cotizadas por separado).',
                    'Tickets deben levantarse vía soporte@feedbakmx.com o en la plataforma correspondiente en el menú de “Soporte”.',
                    'Incidencias resueltas en menos de 5 minutos no generarán costo.',
                  ]
                : [
                    'Ongoing technical support requires an active support policy or package of support hours (quoted separately).',
                    'Tickets must be submitted to soporte@feedbakmx.com or through the “Support” menu in the corresponding platform.',
                    'Issues resolved in under 5 minutes will not be charged.',
                  ]
            }
          />
          <Terminos
            titulo={t('8. Facturación', '8. Invoicing')}
            mb={34}
            items={[
              t(
                'Contamos con Facturación en México y EEUU. En caso de requerir facturación vía Invoice, favor de notificarlo al área de servicio al cliente.',
                'We can invoice in Mexico and the United States. If you require a US invoice, please let our customer service team know.',
              ),
            ]}
          />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, fontSize: 12 }}>
            <div style={{ color: '#3D5257' }}>{t('Atentamente', 'Sincerely')}</div>
            <div style={{ height: 26 }} />
            <div className="accent" style={{ fontWeight: 600, borderTop: '1px solid #6FC08D', paddingTop: 6, width: 230 }}>
              {d.firmante}
            </div>
            <div className="muted" style={{ fontSize: 11 }}>{d.firmanteEmpresa}</div>
          </div>
        </div>
      </Hoja>
    </>
  )
}
