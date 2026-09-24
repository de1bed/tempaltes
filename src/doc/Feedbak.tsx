import type { ReactNode } from 'react'
import { dinero, fechaEn, fechaFeedbak, miles, num, pct, primerNombre } from '../lib/formato'
import { IMG, PORTADAS } from '../lib/imagenes'
import { rellenar } from '../lib/modelo'
import type { FeedbakData } from '../lib/modelo'
import { ligar } from '../lib/edicion'
import { Editable, Lineas, Secciones } from './Editable'
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

export function Feedbak({ d, set }: { d: FeedbakData; set: (p: Partial<FeedbakData>) => void }) {
  const es = d.idioma === 'es'
  const c$ = ligar(d, set)
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
  const vars = {
    plataformas,
    Moneda: monedaLarga,
    moneda: es ? monedaLarga.toLowerCase() : monedaLarga,
    precioAdmin: `${dinero(c.precioAdminExtra)} ${sufijo}`,
  }
  const terminos = {
    ...c$('terminos'),
    id: 'terminos',
    vars,
    placeholder: t('Nuevo punto', 'New item'),
    placeholderTitulo: t('Título de sección', 'Section title'),
  }

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
          <Lineas {...c$('intro')} como="p" id="intro" vars={vars} placeholder={t('Párrafo', 'Paragraph')} />

          <div className="h-title" style={{ marginTop: 6 }}>
            <Editable {...c$('titulo')} placeholder={t('Título', 'Title')} />
          </div>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#3D5257', marginTop: -4 }}>
            {t('Esta propuesta incluye:', 'This proposal includes:')}
          </div>
          <table>
            <tbody>
              {[
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
                    <Editable {...c$('horasSoporte')} placeholder="0" /> {t('horas', 'hours')}
                  </>,
                ],
                [t('Costo por Hora de Soporte Adicional:', 'Cost per Additional Support Hour:'), <Editable key="costo" {...c$('costoHoraAdicional')} placeholder="$0.00" />],
              ].map(([k, v]) => (
                <tr key={k as string}>
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
            <Editable {...c$('notaMontos')} mostrar={rellenar(d.notaMontos, vars)} placeholder={t('Nota', 'Note')} />
          </div>
          <div className="h-title" style={{ marginTop: 12, marginBottom: 10 }}>
            {t('Términos y Condiciones del Servicio (SaaS)', 'Service Terms and Conditions (SaaS)')}
          </div>
          <div>
            <Secciones {...terminos} desde={0} hasta={2} />
          </div>
        </div>
      </Hoja>

      <Hoja>
        <div className="content" style={{ display: 'block' }}>
          <Secciones {...terminos} desde={2} hasta={5} />
        </div>
      </Hoja>

      <Hoja>
        <div className="content" style={{ display: 'block' }}>
          <Secciones {...terminos} desde={5} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, fontSize: 12, marginTop: 20 }}>
            <div style={{ color: '#3D5257' }}>{t('Atentamente', 'Sincerely')}</div>
            <div style={{ height: 26 }} />
            <div className="accent" style={{ fontWeight: 600, borderTop: '1px solid #6FC08D', paddingTop: 6, width: 230 }}>
              <Editable {...c$('firmante')} placeholder={t('Nombre de quien firma', 'Signer name')} />
            </div>
            <div className="muted" style={{ fontSize: 11 }}>
              <Editable {...c$('firmanteEmpresa')} placeholder={t('Empresa', 'Company')} />
            </div>
          </div>
        </div>
      </Hoja>
    </>
  )
}
