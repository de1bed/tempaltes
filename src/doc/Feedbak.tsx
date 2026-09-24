import type { ReactNode } from 'react'
import { dinero, fechaFeedbak, miles, num, pct, primerNombre } from '../lib/formato'
import type { FeedbakData } from '../lib/modelo'
import { cotizarFeedbak } from '../lib/tabuladores'

const PORTADAS = { '1': '/assets/portada-1.png', '2': '/assets/portada-2.png', '3': '/assets/portada-3.webp' }

function Hoja({ children }: { children: ReactNode }) {
  return (
    <section className="page fb">
      <img className="bg header" src="/assets/fb-header.png" alt="" />
      <img className="bg footer" src="/assets/fb-footer.png" alt="" />
      <img className="bg mark" src="/assets/fb-watermark.png" alt="" />
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
  const c = cotizarFeedbak({
    producto: d.producto,
    colaboradores: num(d.colaboradores),
    administradores: num(d.administradores),
    moneda: d.moneda,
    tipoCambio: num(d.tipoCambio),
  })
  const usd = d.moneda === 'USD'
  const monedaLarga = usd ? 'Dólares Americanos' : 'Pesos Mexicanos'
  const sufijo = usd ? 'USD' : 'MXN'
  const admins =
    `${c.adminsIncluidos} Administradores (sin costo adicional)` +
    (c.adminsExtra > 0 ? ` + ${c.adminsExtra} adicional${c.adminsExtra === 1 ? '' : 'es'}` : '')
  const conSetup = c.setup > 0 ? ', incluye configuración inicial' : ''

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
            {d.ciudad} a {fechaFeedbak(d.fecha)}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1, fontSize: 13, lineHeight: 1.45 }}>
            <div className="accent" style={{ fontWeight: 600 }}>{d.contacto || 'Nombre del contacto'}</div>
            {d.puesto && <div>{d.puesto}</div>}
            <div>{d.empresa || 'Empresa'}</div>
            <div className="muted">Presente</div>
          </div>
          <div className="accent" style={{ fontSize: 13, fontWeight: 600, marginTop: 2 }}>
            {d.tratamiento} {primerNombre(d.contacto) || '[Nombre]'}:
          </div>
          <p>
            Sabemos que llevar la administración en empresas tan importantes como la suya, es todo un reto. Debido a
            esto, para Feedbak es un privilegio presentar las Plataformas Tecnológicas que permiten eficientizar tiempos
            de Administración y ahorrar importantes costos asociados con el personal; a través de {c.producto.plataformas}.
          </p>
          <p>Con esto en mente les presentamos la siguiente propuesta.</p>

          <div className="h-title" style={{ marginTop: 6 }}>Cotización Licenciamiento de Plataforma Tecnológica</div>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#3D5257', marginTop: -4 }}>Esta propuesta incluye:</div>
          <table>
            <tbody>
              {[
                ['Plataformas Incluídas:', c.producto.plataformas],
                ['Colaboradores:', miles(c.colaboradores)],
                ['Usuarios Administradores:', admins],
                ['Capacitación Personalizada:', `Incluida (${d.capacitacionHoras} hrs) + Material Virtual`],
                ['Configuración Inicial:', c.setup > 0 ? dinero(c.setup) : 'Sin costo'],
                ['Horas de soporte incluidas:', `${d.horasSoporte} horas`],
                ['Costo por Hora de Soporte Adicional:', d.costoHoraAdicional],
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
                <th className="dark">Concepto</th>
                <th className="dark">Precio Unitario</th>
                <th className="dark">Cantidad</th>
                <th className="dark">Monto</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Precio mensual por usuario</td>
                <td className="r">{dinero(c.precioUsuario)}</td>
                <td className="r">{miles(c.colaboradores)}</td>
                <td className="r">{dinero(c.mensualUsuarios)}</td>
              </tr>
              <tr>
                <td>Precio mensual por administrador</td>
                <td className="r">{dinero(0)}</td>
                <td className="r">{c.adminsIncluidos}</td>
                <td className="r">{dinero(0)}</td>
              </tr>
              {c.adminsExtra > 0 && (
                <tr>
                  <td>Administrador adicional (mensual)</td>
                  <td className="r">{dinero(c.precioAdminExtra)}</td>
                  <td className="r">{c.adminsExtra}</td>
                  <td className="r">{dinero(c.mensualAdminsExtra)}</td>
                </tr>
              )}
              <tr className="total">
                <td style={{ fontWeight: 600 }}>Total Mensual</td>
                <td />
                <td />
                <td className="r strong">{dinero(c.totalMensual)}</td>
              </tr>
              {c.setup > 0 && (
                <tr>
                  <td>Primera factura (mensualidad + configuración inicial)</td>
                  <td />
                  <td />
                  <td className="r">{dinero(c.primeraFactura)}</td>
                </tr>
              )}
            </tbody>
          </table>

          {(
            [
              ['Descuento por pago Semestral', 'Precio Semestral', `Pago semestral (6 meses${conSetup})`, c.semestralBase, c.descuentoSemestral, c.semestral],
              ['Descuento por pago Anualizado', 'Precio Anual', `Pago anual (12 meses${conSetup})`, c.anualBase, c.descuentoAnual, c.anual],
            ] as const
          ).map(([titulo, col, fila, base, desc, total]) => (
            <table key={titulo}>
              <thead>
                <tr>
                  <th className="green">{titulo}</th>
                  <th className="green">{col}</th>
                  <th className="green">Descuento (%)</th>
                  <th className="green">Monto</th>
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
            Todos los montos están expresados en {monedaLarga} y no incluyen IVA (donde aplique).
          </div>
          <div className="h-title" style={{ marginTop: 12, marginBottom: 10 }}>Términos y Condiciones del Servicio (SaaS)</div>
          <div>
            <Terminos
              titulo="1. Condiciones de Pago"
              items={[
                'El pago anual o semestral deberá realizarse en una sola exhibición antes del inicio del servicio.',
                'En pagos mensuales, el setup inicial y la primera mensualidad deberán cubrirse al iniciar el proyecto.',
                'Nuestros servicios son pre-pago: todas las mensualidades son por adelantado.',
                `Los precios están expresados en ${monedaLarga.toLowerCase()}, más IVA (16%, donde aplique), y son válidos por 15 días naturales.`,
                `El costo por cada Usuario Administrador adicional será de ${dinero(c.precioAdminExtra)} ${sufijo} más IVA (16%, donde aplique) de manera mensual. Dicho importe tendrá el carácter de no negociable y no estará sujeto a la aplicación de promociones, descuentos, bonificaciones ni cualquier otro beneficio comercial vigente o futuro.`,
                'En el supuesto de que el monto total de la factura entregada y no objetada por “El cliente” o cualquier porción de dicha factura no sea pagada a “El Proveedor” dentro del terminó de 7 días naturales antes citado, conllevará un cargo de interés moratorio del 10% (diez por ciento) mensual sobre el saldo vencido pagadero por “El Cliente” a “El Proveedor” en conjunto con la suerte principal consignada en la factura respectiva.',
              ]}
            />
            <Terminos
              titulo="2. Vigencia y Ajustes de Precio"
              items={[
                'Los precios podrán actualizarse anualmente conforme a inflación (Índice INPC) u otros factores de mercado.',
                'El cliente será notificado con al menos 30 días de anticipación.',
              ]}
            />
          </div>
        </div>
      </Hoja>

      <Hoja>
        <div className="content" style={{ display: 'block' }}>
          <Terminos
            titulo="3. Alcance de la Implementación y Soporte"
            items={[
              'La propuesta incluye las horas de soporte indicadas durante la implementación. Para horas adicionales, favor de solicitar una cotización separada.',
              'Toda configuración especial o requisito para la puesta en marcha y el correcto funcionamiento de la plataforma, es cubierto por el tiempo disponible de “Implementación”. En caso de agotar todas las horas y requerir horas adicionales, estas serán facturadas por paquetes por separado con un costo de $1,200.00 por hora (más IVA) y un tiempo de respuesta de hasta 24 horas en días hábiles. En caso de ser un soporte o servicio urgente este tendrá́ un costo de $1,900.00 pesos (más IVA) por hora en un tiempo no mayor a 3 horas, en caso de ser fuera de horario de oficina se agregará el 20% de costo sobre total de tiempo. Horarios de Lun-Jue 8am a 6pm y Vie 8am a 3pm PST. Sábados y Domingos no son días hábiles.',
              'Gastos de viáticos fuera de la ciudad (cuando aplique y precia autorización del cliente) correrán por cuenta del cliente.',
            ]}
          />
          <Terminos
            titulo="4. Hardware y Responsabilidades del Cliente"
            mb={14}
            items={[
              'La cotización no incluye ningún tipo de hardware (iPads, Tablets, accesorios, pedestales, arneses, etc.).',
              'El cliente tiene la responsabilidad de: Adquirir y mantener los equipos necesarios. Instalar y configurar la aplicación en cada dispositivo; así como de proveer la información a la plataforma mediante archivos de texto o Excel, según se indique.',
              'Feedbak puede cotizar y proveer hardware bajo solicitud expresa del cliente.',
            ]}
          />
          <Terminos
            titulo="5. Capacitación"
            mb={13}
            items={[
              'La cotización provista incluye una sesión inicial remota vía Zoom para administradores.',
              'La sesión será grabada y entregada al cliente para consultas posteriores.',
              'Cualquier capacitación adicional, podrá causar cargo por horas de soporte.',
              'Material de soporte se proveerá vía video en plataformas.',
            ]}
          />
        </div>
      </Hoja>

      <Hoja>
        <div className="content" style={{ display: 'block' }}>
          <Terminos
            titulo="6. Privacidad y Protección de Datos"
            mb={13}
            items={[
              'La información suministrada por el cliente será tratada conforme a la Ley Federal de Protección de Datos Personales.',
              'El cliente declara contar con el consentimiento de sus empleados para el tratamiento de la información compartida.',
              'Feedbak no modificará ni operará la información del cliente sin autorización.',
              'Feedbak no tiene acceso a datos específicos de los empleados.',
              'Feedbak no utiliza ni explota esos datos para fines distintos al servicio.',
              'Los datos están encriptados y protegidos todo el tiempo.',
              'El acceso a datos personales se concede solamente en casos estrictamente necesarios (soporte, mantenimiento, cumplimiento legal).',
            ]}
          />
          <Terminos
            titulo="7. Soporte Técnico Posterior"
            mb={13}
            items={[
              'El soporte técnico posterior requiere contar con póliza o paquete vigente de horas de soporte (Cotizadas por separado).',
              'Tickets deben levantarse vía soporte@feedbakmx.com o en la plataforma correspondiente en el menú de “Soporte”.',
              'Incidencias resueltas en menos de 5 minutos no generarán costo.',
            ]}
          />
          <Terminos
            titulo="8. Facturación"
            mb={34}
            items={[
              'Contamos con Facturación en México y EEUU. En caso de requerir facturación vía Invoice, favor de notificarlo al área de servicio al cliente.',
            ]}
          />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, fontSize: 12 }}>
            <div style={{ color: '#3D5257' }}>Atentamente</div>
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
