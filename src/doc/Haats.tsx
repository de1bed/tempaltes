import type { ReactNode } from 'react'
import { contarHojas, ligar, type Ligado } from '../lib/edicion'
import { dinero, fechaEs, fechaEn, miles, num, primerNombre, traductor } from '../lib/formato'
import { IMG } from '../lib/imagenes'
import type { HaatsHorasData, HaatsMensualData, Idioma } from '../lib/modelo'
import { Editable, Lineas, Secciones } from './Editable'
import { Aprobacion } from './Staffvia'

type Datos = HaatsMensualData | HaatsHorasData

function Hoja({ children }: { children: ReactNode }) {
  return (
    <section className="page haats">
      <img className="logo" src={IMG.haatsLogo} alt="HAATS" />
      <div className="content">{children}</div>
    </section>
  )
}

/**
 * Cotizaciones HAATS (servicio especializado de enfermería): mensualidades por
 * periodo o tiempo extra por horas. Misma carta, términos y cierre.
 */
function Haats<T extends Datos>({ d, set, tabla }: { d: T; set: (p: Partial<T>) => void; tabla: ReactNode }) {
  const t = traductor(d.idioma)
  const c$ = ligar(d as Datos, set as (p: Partial<Datos>) => void)
  const hojas = contarHojas(d.secciones)
  const nombre = primerNombre(d.contacto) || t('[Nombre]', '[Name]')
  const secciones = {
    ...c$('secciones'),
    id: 'secciones',
    placeholder: t('Nuevo punto', 'New item'),
    placeholderTitulo: t('Título de sección', 'Section title'),
  }
  const cierre = (
    <div className="cierre">
      <div>{t('Quedo a sus órdenes para cualquier duda o aclaración.', 'Please let me know if you have any questions.')}</div>
      <div style={{ marginTop: 10 }}>{t('Atentamente,', 'Sincerely,')}</div>
      <div className="firma">
        <Editable {...c$('firmante')} placeholder={t('Nombre de quien firma', 'Signer name')} />
      </div>
      <div className="firma-puesto">
        <Editable {...c$('firmantePuesto')} placeholder={t('Puesto', 'Title')} />
      </div>
      <div style={{ marginTop: 20 }}>
        <Aprobacion idioma={d.idioma} />
      </div>
    </div>
  )

  return (
    <>
      <Hoja>
        <div className="fecha">
          <Editable {...c$('ciudad')} placeholder={t('Ciudad', 'City')} />
          {d.idioma === 'es' ? ` a ${fechaEs(d.fecha)}` : `, ${fechaEn(d.fecha)}`}
        </div>
        <div className="destinatario">
          <div>
            <Editable {...c$('contacto')} placeholder={t('Nombre del contacto', 'Contact name')} />
          </div>
          <div className={d.cargo.trim() ? undefined : 'vacio'}>
            <Editable {...c$('cargo')} placeholder={t('Puesto (opcional)', 'Job title (optional)')} />
          </div>
          <div>
            <Editable {...c$('empresa')} placeholder={t('Empresa', 'Company')} />
          </div>
        </div>
        <div className="saludo">{d.idioma === 'es' ? `${d.tratamiento} ${nombre}:` : `Dear ${nombre},`}</div>
        <Lineas {...c$('intro')} como="p" id="intro" className="letter" placeholder={t('Párrafo', 'Paragraph')} />
        {tabla}
        <div className={d.notaPrecios.trim() ? 'note' : 'note vacio'}>
          <Editable {...c$('notaPrecios')} placeholder={t('Nota de precios (opcional)', 'Pricing note (optional)')} />
        </div>
        <Secciones {...secciones} hoja={0} claseTitulo="h-sec" />
        {hojas === 1 && cierre}
      </Hoja>
      {Array.from({ length: hojas - 1 }, (_, n) => (
        <Hoja key={n}>
          <Secciones {...secciones} hoja={n + 1} claseTitulo="h-sec" />
          {n === hojas - 2 && cierre}
        </Hoja>
      ))}
    </>
  )
}

function Titulo({ ligado, columnas, idioma }: { ligado: Ligado; columnas: number; idioma: Idioma }) {
  return (
    <tr>
      <th colSpan={columnas} className="titulo">
        <Editable {...ligado} placeholder={traductor(idioma)('Nombre del servicio', 'Service name')} />
      </th>
    </tr>
  )
}

export function HaatsMensual({ d, set }: { d: HaatsMensualData; set: (p: Partial<HaatsMensualData>) => void }) {
  const t = traductor(d.idioma)
  const per$ = (i: number, k: keyof HaatsMensualData['periodos'][number]): Ligado => ({
    valor: d.periodos[i][k],
    onCambio: (v) => set({ periodos: d.periodos.map((p, j) => (j === i ? { ...p, [k]: v } : p)) }),
  })
  const tabla = (
    <table>
      <thead>
        <Titulo ligado={ligar(d, set)('tituloTabla')} columnas={4} idioma={d.idioma} />
        <tr>
          <th className="cab">{t('Fecha de servicio', 'Service period')}</th>
          <th className="cab" style={{ width: '22%' }}>{t('Mensualidad', 'Monthly fee')}</th>
          <th className="cab" style={{ width: '24%' }}>{t('Precio por hora festivo laborado', 'Hourly price, worked holiday')}</th>
          <th className="cab" style={{ width: '16%' }}>{t('Días de crédito', 'Credit days')}</th>
        </tr>
      </thead>
      <tbody>
        {d.periodos.map((p, i) => (
          <tr key={i}>
            <td>
              <Editable {...per$(i, 'periodo')} placeholder={t('Periodo', 'Period')} />
            </td>
            <td className="strong">
              <Editable {...per$(i, 'mensualidad')} mostrar={dinero(num(p.mensualidad))} placeholder="$0.00" />
            </td>
            <td>
              <Editable {...per$(i, 'precioHora')} mostrar={dinero(num(p.precioHora))} placeholder="$0.00" />
            </td>
            <td>
              <Editable {...per$(i, 'credito')} placeholder={t('30 días', '30 days')} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
  return <Haats d={d} set={set} tabla={tabla} />
}

export function HaatsHoras({ d, set }: { d: HaatsHorasData; set: (p: Partial<HaatsHorasData>) => void }) {
  const t = traductor(d.idioma)
  const fila$ = (i: number, k: keyof HaatsHorasData['filas'][number]): Ligado => ({
    valor: d.filas[i][k],
    onCambio: (v) => set({ filas: d.filas.map((f, j) => (j === i ? { ...f, [k]: v } : f)) }),
  })
  const filas = d.filas.map((f) => ({ horas: num(f.horas), precio: num(f.precioHora), costo: num(f.horas) * num(f.precioHora) }))
  const total = filas.reduce((a, f) => a + f.costo, 0)
  const tabla = (
    <table>
      <thead>
        <Titulo ligado={ligar(d, set)('tituloTabla')} columnas={4} idioma={d.idioma} />
        <tr>
          <th className="cab" style={{ width: '16%' }}>{t('Horas', 'Hours')}</th>
          <th className="cab">{t('Turno', 'Shift')}</th>
          <th className="cab" style={{ width: '22%' }}>{t('Precio por hora', 'Hourly price')}</th>
          <th className="cab" style={{ width: '26%' }}>{t('Costo', 'Cost')}</th>
        </tr>
      </thead>
      <tbody>
        {d.filas.map((_, i) => (
          <tr key={i}>
            <td>
              <Editable {...fila$(i, 'horas')} mostrar={miles(filas[i].horas)} placeholder="0" />
            </td>
            <td>
              <Editable {...fila$(i, 'turno')} placeholder={t('Turno', 'Shift')} />
            </td>
            <td>
              <Editable {...fila$(i, 'precioHora')} mostrar={dinero(filas[i].precio)} placeholder="$0.00" />
            </td>
            <td className="strong">{dinero(filas[i].costo)} MXN</td>
          </tr>
        ))}
        {filas.length > 1 && (
          <tr className="total">
            <td>{miles(filas.reduce((a, f) => a + f.horas, 0))}</td>
            <td>Total</td>
            <td />
            <td className="strong">{dinero(total)} MXN</td>
          </tr>
        )}
      </tbody>
    </table>
  )
  return <Haats d={d} set={set} tabla={tabla} />
}
