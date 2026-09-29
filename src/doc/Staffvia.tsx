import type { ReactNode } from 'react'
import {
  dinero,
  fechaEn,
  fechaEnDia,
  fechaEs,
  fechaEsDia,
  mesAnioEn,
  mesAnioEs,
  miles,
  num,
  primerNombre,
  traductor,
} from '../lib/formato'
import { ligar, type Ligado } from '../lib/edicion'
import { bloquesLineas, bloquesSecciones, bloquesTabla } from './bloques'
import { Editable } from './Editable'
import { Paginado, type Bloque } from './Paginado'
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

/** Hojas membretadas de Staffvia que se reparten solas. */
function Hojas({ bloques }: { bloques: Bloque[] }) {
  return <Paginado clase="sv" claseContenido="letter" bloques={bloques} />
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
    <div className="pila">
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
    </div>
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

/** Firma de cierre: agradecimiento, "Atentamente" y nombre. */
function Cierre({ idioma, firmante, gracias }: { idioma: Idioma; firmante: Ligado; gracias?: boolean }) {
  const t = traductor(idioma)
  return (
    <div>
      <div className="small" style={{ lineHeight: 1.6 }}>
        {gracias
          ? t('Muchas gracias por su confianza.', 'Thank you very much for your partnership.')
          : t('Quedo a sus órdenes para cualquier duda o aclaración.', 'Please let me know if you have any questions.')}
      </div>
      <div className="small" style={{ marginTop: 12 }}>{t('Atentamente,', 'Sincerely,')}</div>
      <div className="signature">
        <Editable {...firmante} placeholder={t('Nombre de quien firma', 'Signer name')} />
      </div>
    </div>
  )
}

/** Título de términos + un punto por bloque. */
function bloquesTerminos(p: { titulo: string; clase: string; terminos: Ligado; vars?: Record<string, string>; idioma: Idioma; salto?: Bloque['salto']; tituloClase?: string }): Bloque[] {
  const t = traductor(p.idioma)
  return [
    {
      key: 'terminos-titulo',
      salto: p.salto,
      conSiguiente: true,
      pegado: true,
      nodo: <div className={`${p.tituloClase ?? 'h-sec'} titulo-bloque`}>{p.titulo}</div>,
    },
    ...bloquesLineas({ ...p.terminos, id: 'terminos', vars: p.vars, placeholder: t('Nuevo punto', 'New item'), como: 'li', clase: p.clase }),
  ]
}

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
  const tieneDetalle = d.detalle.trim() !== ''
  const tieneNotas = d.notas.trim() !== ''

  const bloques: Bloque[] = [
    { key: 'encabezado', nodo: <Encabezado linea={<LugarFecha idioma={d.idioma} ciudad={c$('ciudad')} iso={d.fecha} />} d={d} c$={c$} /> },
    ...bloquesLineas({ ...c$('intro'), id: 'intro', vars: { empresa: d.empresa }, placeholder: t('Párrafo', 'Paragraph'), como: 'p' }),
    ...bloquesTabla({
      key: 'precios',
      anchos: conEspecial ? [undefined, '20%', '26%'] : [undefined, '26%'],
      encabezado: (
        <tr>
          <th className="dark">{t('Servicio', 'Service')}</th>
          <th className="dark">{t('Precio unitario', 'Unit price')}</th>
          {conEspecial && <th className="dark">{t(`Precio especial unitario +${minimo} solicitudes`, `Special unit price (${minimo}+ requests)`)}</th>}
        </tr>
      ),
      filas: filas.map((f, i) => ({
        key: String(i),
        nodo: (
          <tr>
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
        ),
      })),
    }),
    {
      key: 'nota-precios',
      nodo: (
        <div className={d.notaPrecios.trim() ? 'note' : 'note vacio'} style={{ marginTop: -4 }}>
          <Editable {...c$('notaPrecios')} placeholder={t('Nota de precios (opcional)', 'Pricing note (optional)')} />
        </div>
      ),
    },
    ...bloquesTabla({
      key: 'desglose',
      clase: 'sm',
      anchos: ['9%', undefined, '15%', '14%', '12%', '14%'],
      encabezado: (
        <tr>
          <th className="olive" style={{ textAlign: 'center' }}>{t('Cantidad', 'Qty')}</th>
          <th className="olive" style={{ textAlign: 'left' }}>{t('Servicio', 'Service')}</th>
          <th className="olive">{t('Precio unitario', 'Unit price')}</th>
          <th className="olive">Subtotal</th>
          <th className="olive">{t('IVA', 'VAT')}</th>
          <th className="olive">Total</th>
        </tr>
      ),
      filas: filas.map((f, i) => ({
        key: String(i),
        nodo: (
          <tr>
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
        ),
      })),
      pie:
        filas.length > 1 ? (
          <tr className="total">
            <td />
            <td>Total</td>
            <td />
            <td className="r">{dinero(suma('subtotal'))}</td>
            <td className="r">{dinero(suma('iva'))}</td>
            <td className="r strong">{dinero(suma('total'))}</td>
          </tr>
        ) : undefined,
    }),
    ...(tieneDetalle
      ? [
          {
            key: 'detalle-titulo',
            conSiguiente: true,
            pegado: true,
            nodo: <div className="accent titulo-bloque" style={{ fontSize: 12, fontWeight: 600 }}>{t('Detalle de la propuesta:', 'Proposal details:')}</div>,
          },
          ...bloquesLineas({ ...c$('detalle'), id: 'detalle', placeholder: t('Nuevo punto', 'New item'), como: 'li', clase: 'detalle' }),
        ]
      : []),
    ...(tieneNotas ? bloquesLineas({ ...c$('notas'), id: 'notas', placeholder: t('Nota', 'Note'), como: 'div', clase: 'muted nota-linea' }) : []),
    ...bloquesTerminos({
      titulo: t('Términos y condiciones:', 'Terms and conditions:'),
      tituloClase: 'h-sec',
      clase: 'terms',
      terminos: c$('terminos'),
      vars: { minimo: String(minimo) },
      idioma: d.idioma,
      salto: 'primera',
    }),
    {
      key: 'cierre',
      nodo: (
        <div className="pila">
          <div>
            <Aprobacion idioma={d.idioma} />
          </div>
          <Cierre idioma={d.idioma} firmante={c$('firmante')} />
        </div>
      ),
    },
  ]

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
      <Hojas bloques={bloques} />
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

  const bloques: Bloque[] = [
    { key: 'encabezado', nodo: <Encabezado linea={<LugarFecha idioma={d.idioma} ciudad={c$('ciudad')} iso={d.fecha} />} d={d} c$={c$} /> },
    ...bloquesLineas({ ...c$('intro'), id: 'intro', vars, placeholder: t('Párrafo', 'Paragraph'), como: 'p' }),
    {
      key: 'titulo',
      conSiguiente: true,
      nodo: <div className="h-title">{t('Cotización de servicios de nómina de empleados indirectos', 'Quote for payroll services of indirect employees')}</div>,
    },
    {
      key: 'datos',
      nodo: (
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
      ),
    },
    {
      key: 'salario',
      nodo: (
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
      ),
    },
    { key: 'nota', nodo: <div className="note" style={{ marginTop: -4 }}>{t('Precio por persona + IVA.', 'Price per person + TAX.')}</div> },
    ...bloquesTerminos({ titulo: t('TÉRMINOS Y CONDICIONES:', 'TERMS AND CONDITIONS:'), clase: 'terms', terminos: c$('terminos'), vars, idioma: d.idioma, salto: 'primera' }),
    {
      key: 'cierre',
      nodo: (
        <div className="pila">
          <div>
            <Aprobacion idioma={d.idioma} />
          </div>
          <Cierre idioma={d.idioma} firmante={c$('firmante')} gracias />
        </div>
      ),
    },
  ]

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
      <Hojas bloques={bloques} />
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
  const fechaCorta = es ? fechaEs : fechaEn
  const monto = (i: number, k: 'menorMensual' | 'menorAnual' | 'mayorMensual' | 'mayorAnual') => (
    <Editable {...emp$(i, k)} mostrar={dinero(num(d.empleados[i][k]))} placeholder="$0.00" />
  )
  const clientePortada =
    nombres.length === 1
      ? nombres[0]
      : nombres.length > 1
        ? t(`${nombres.length} empleados`, `${nombres.length} employees`)
        : t('Nombre del empleado', 'Employee name')
  const parrafo = (key: string, texto: ReactNode): Bloque => ({ key, nodo: <p>{texto}</p> })

  const bloques: Bloque[] = [
    { key: 'encabezado', nodo: <Encabezado linea={es ? fechaEsDia(d.fecha) : fechaEnDia(d.fecha)} d={d} c$={c$} /> },
    parrafo(
      'p1',
      es
        ? `Gracias por su confianza y colaboración continua. A continuación encontrará la cotización de la Póliza de Gastos Médicos Mayores para ${nombres.length === 1 ? 'el siguiente empleado' : 'los siguientes empleados'}:`
        : `Thank you for your continued trust and partnership. Please find below the quote for the Major Medical Policy for the following employee${nombres.length === 1 ? '' : 's'}:`,
    ),
    { key: 'nombres', nodo: <div className="accent" style={{ fontSize: 11.5, fontWeight: 600 }}>{nombres.join(', ') || t('Nombre del empleado', 'Employee name')}</div> },
    parrafo(
      'p2',
      es
        ? `Esta cotización refleja la cobertura y los precios aplicables para su alta, con una vigencia del ${fechaCorta(d.inicio)} al ${fechaCorta(d.fin)}.`
        : `This quotation reflects the applicable coverage and pricing for their enrollment, with an effective period from ${fechaCorta(d.inicio)}, through ${fechaCorta(d.fin)}.`,
    ),
    parrafo(
      'p3',
      t(
        'Seguimos comprometidos en brindarle un servicio confiable, atención oportuna y opciones de cobertura competitivas.',
        'We remain committed to providing reliable service, timely support, and competitive coverage options.',
      ),
    ),
    { key: 'titulo', conSiguiente: true, nodo: <div className="h-title">{t('Seguro médico privado', 'Private medical insurance')}</div> },
    ...d.empleados.map((_, i) => ({
      key: `empleado-${i}`,
      nodo: (
        <table>
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
      ),
    })),
    { key: 'nota', nodo: <div className="note" style={{ marginTop: -4 }}>{t('Precio por persona + IVA.', 'Price per person + TAX.')}</div> },
    ...bloquesTerminos({ titulo: t('TÉRMINOS Y CONDICIONES:', 'TERMS AND CONDITIONS:'), clase: 'terms lg', terminos: c$('terminos'), idioma: d.idioma, salto: 'primera' }),
    {
      key: 'cierre',
      nodo: (
        <div className="pila">
          <div>
            <Aprobacion idioma={d.idioma} />
          </div>
          <Cierre idioma={d.idioma} firmante={c$('firmante')} gracias />
        </div>
      ),
    },
  ]

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
      <Hojas bloques={bloques} />
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

  const bloques: Bloque[] = [
    { key: 'encabezado', nodo: <Encabezado linea={<LugarFecha idioma={d.idioma} ciudad={c$('ciudad')} iso={d.fecha} />} d={d} c$={c$} /> },
    ...bloquesLineas({
      ...c$('intro'),
      id: 'intro',
      vars: { empresa: d.empresa || t('su empresa', 'your company'), titulo: d.tituloPortada },
      placeholder: t('Párrafo', 'Paragraph'),
      como: 'p',
    }),
    {
      key: 'titulo',
      conSiguiente: true,
      nodo: <div className="h-title">{t('Cotización de servicios de nómina de empleados indirectos', 'Quote for payroll services of indirect employees')}</div>,
    },
    // Tabla partible: con muchos empleados sigue en la hoja siguiente con su encabezado.
    ...bloquesTabla({
      key: 'bonos',
      clase: 'sm',
      anchos: [undefined, '16%', '16%', '18%', '16%'],
      encabezado: (
        <tr>
          <th className="dark">{t('Empleado', 'Employee')}</th>
          <th className="dark">{t('Bono bruto', 'Gross Bonus')}</th>
          <th className="dark">{t('Bono neto', 'Net Bonus')}</th>
          <th className="dark">{t('Costo de nómina', 'Payroll Cost')}</th>
          <th className="dark">Total</th>
        </tr>
      ),
      filas: filas.map((f) => ({
        key: String(f.i),
        nodo: (
          <tr>
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
        ),
      })),
      pie: (
        <tr className="total">
          <td>{t('Gran total', 'Grand total')}</td>
          <td className="r">{dinero(suma('bruto'))}</td>
          <td className="r">{dinero(suma('neto'))}</td>
          <td className="r">{dinero(suma('costo'))}</td>
          <td className="r strong">{dinero(suma('total'))}</td>
        </tr>
      ),
    }),
    { key: 'nota', nodo: <div className="note" style={{ marginTop: -4 }}>{t('Precio por persona + IVA.', 'Price per person + TAX.')}</div> },
    ...bloquesTerminos({ titulo: t('TÉRMINOS Y CONDICIONES:', 'TERMS AND CONDITIONS:'), clase: 'terms lg', terminos: c$('terminos'), idioma: d.idioma, salto: 'primera' }),
    {
      key: 'cierre',
      nodo: (
        <div className="pila">
          <div className="small">{t('Muchas gracias por su confianza.', 'Thank you very much for your partnership.')}</div>
          <div>
            <Aprobacion idioma={d.idioma} />
          </div>
          <div>
            <div className="small">{t('Atentamente,', 'Sincerely,')}</div>
            <div className="signature">
              <Editable {...c$('firmante')} placeholder={t('Nombre de quien firma', 'Signer name')} />
            </div>
          </div>
        </div>
      ),
    },
  ]

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
      <Hojas bloques={bloques} />
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
  const vars = { posicion: (d.posiciones[0]?.posicion || t('[posición]', '[position]')).toLowerCase() }

  const bloques: Bloque[] = [
    {
      key: 'encabezado',
      nodo: <Encabezado linea={<LugarFecha idioma={d.idioma} ciudad={c$('ciudad')} iso={d.fecha} />} d={d} c$={c$} cargo={c$('cargo')} />,
    },
    ...bloquesLineas({ ...c$('intro'), id: 'intro', vars, placeholder: t('Párrafo', 'Paragraph'), como: 'p' }),
    ...bloquesTabla({
      key: 'posiciones',
      anchos: [undefined, '26%', '17%', '18%'],
      encabezado: (
        <tr>
          <th className="dark">{t('Posición', 'Position')}</th>
          <th className="dark" style={{ textAlign: 'left' }}>{t('Modalidad', 'Modality')}</th>
          <th className="dark">{t('Precio regular', 'Regular price')}</th>
          <th className="dark">{t('Precio promoción', 'Promotional price')}</th>
        </tr>
      ),
      filas: d.posiciones.map((p, i) => ({
        key: String(i),
        nodo: (
          <tr>
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
        ),
      })),
    }),
    {
      key: 'nota-precios',
      nodo: (
        <div className={d.notaPrecios.trim() ? 'note' : 'note vacio'} style={{ fontWeight: 600, marginTop: -4 }}>
          <Editable {...c$('notaPrecios')} placeholder={t('Nota de precios (opcional)', 'Pricing note (optional)')} />
        </div>
      ),
    },
    ...bloquesSecciones({
      ...c$('secciones'),
      id: 'secciones',
      placeholder: t('Nuevo punto', 'New item'),
      placeholderTitulo: t('Título de sección', 'Section title'),
    }),
    {
      key: 'cierre',
      nodo: (
        <div className="pila">
          <Cierre idioma={d.idioma} firmante={c$('firmante')} />
          <div>
            <Aprobacion idioma={d.idioma} />
          </div>
        </div>
      ),
    },
  ]

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
      <Hojas bloques={bloques} />
    </>
  )
}
