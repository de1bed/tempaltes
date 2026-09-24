import { hoyISO } from './formato'
import type { Moneda, ProductoFeedbak } from './tabuladores'

/** Campos numéricos se guardan como texto (tal cual se escriben) y se convierten al renderizar. */

export type Idioma = 'es' | 'en'
export type Portada = '1' | '2' | '3' | 'ninguna'

interface Base {
  idioma: Idioma
  fecha: string
  contacto: string
  empresa: string
  /** Solo se usa en español: Estimada / Estimado / Estimados. */
  tratamiento: string
  firmante: string
}

export interface FeedbakData extends Base {
  portada: Portada
  producto: ProductoFeedbak
  colaboradores: string
  administradores: string
  moneda: Moneda
  tipoCambio: string
  ciudad: string
  puesto: string
  capacitacionHoras: string
  horasSoporte: string
  costoHoraAdicional: string
  firmanteEmpresa: string
}

export interface Servicio {
  cantidad: string
  descripcion: string
  precio: string
}

export interface ServiciosData extends Base {
  tituloPortada: string
  ciudad: string
  intro: string
  servicios: Servicio[]
  iva: string
  notaPrecios: string
  detalle: string
  notas: string
  terminos: string
}

export interface PayrollData extends Base {
  tituloPortada: string
  clientePortada: string
  ciudad: string
  intro: string
  puesto: string
  headcount: string
  frecuencia: string
  fee: string
  salario: string
  impuestos: string
  prestaciones: string
  terminos: string
}

export interface EmpleadoGmm {
  nombre: string
  edad: string
  menorMensual: string
  menorAnual: string
  mayorMensual: string
  mayorAnual: string
}

export interface GmmData extends Base {
  clientePortada: string
  inicio: string
  fin: string
  empleados: EmpleadoGmm[]
  terminos: string
}

export interface EmpleadoBono {
  nombre: string
  bruto: string
  neto: string
  costo: string
}

export interface BonosData extends Base {
  tituloPortada: string
  clientePortada: string
  ciudad: string
  intro: string
  empleados: EmpleadoBono[]
  terminos: string
}

export interface Datos {
  feedbak: FeedbakData
  servicios: ServiciosData
  payroll: PayrollData
  gmm: GmmData
  bonos: BonosData
}

export type PlantillaId = keyof Datos

export const PLANTILLAS: { id: PlantillaId; marca: string; nombre: string; color: string }[] = [
  { id: 'feedbak', marca: 'Feedbak', nombre: 'Licenciamiento Mi Kiosko / Checador', color: '#6FC08D' },
  { id: 'servicios', marca: 'Staffvia', nombre: 'Servicios y trámites', color: '#8FA86A' },
  { id: 'payroll', marca: 'Staffvia', nombre: 'Nómina (payroll)', color: '#123A5A' },
  { id: 'gmm', marca: 'Staffvia', nombre: 'Gastos médicos (GMM)', color: '#F2A72C' },
  { id: 'bonos', marca: 'Staffvia', nombre: 'Bonos', color: '#E2601A' },
]

/* ───────── Textos editables con versión en cada idioma ───────── */

type Textos<T> = Record<Idioma, Partial<T>>

const FEEDBAK: Textos<FeedbakData> = {
  es: { ciudad: 'Tijuana B.C.', costoHoraAdicional: '$65.00 Dlls (Paquetes disponibles)' },
  en: { ciudad: 'Tijuana, B.C.', costoHoraAdicional: '$65.00 USD (packages available)' },
}

const SERVICIOS: Textos<ServiciosData> = {
  es: {
    tituloPortada: 'Trámite de Constancia de Inscripción de Empleador',
    intro:
      'Agradecemos tu atención y la oportunidad de colaborar con ustedes. Presentamos nuestra propuesta de servicios derivado de tu solicitud, la cual se desglosa a continuación:',
    notaPrecios: '** Precios por persona/servicio. Precios en pesos mexicanos más IVA',
    detalle:
      'Trámite de constancia de Inscripción de empleador de inicio a fin, para lo cual se deberá contar con la documentación completa por parte del cliente/beneficiario, que será solicitada, por correo electrónico para su seguimiento.',
    notas: '*El tiempo de respuesta máximo para la entrega de información será de 17 días hábiles.\n*Estos servicios solo se aplican a la ciudad de Tijuana.',
    terminos: `Se requiere un anticipo del 50% del monto total de los estudios.
Anticipo no reembolsable. En caso de que se cancele el servicio.
Crédito a 7 (siete) días naturales a partir de la entrega de la factura. En caso de falta de pago total o parcial dentro de dicho plazo, se generará un interés moratorio del 10% (diez por ciento) mensual sobre el saldo vencido.
Precios más IVA.
En el caso de las comprobaciones domiciliarias, el precio abarca área o la ciudad de Tijuana únicamente, en caso de requerirlo en otra área, será necesaria una nueva cotización.
El precio especial unitario se aplicará únicamente a solicitudes de 5 personas o más, siempre que se soliciten en una sola requisición.
Cualquier servicio adicional diverso a los expresamente señalados en el presente documento, serán motivo de una cotización adicional y deberá ser facturado de manera independiente, previo acuerdo con el cliente.`,
  },
  en: {
    tituloPortada: 'Employer Registration Certificate Filing',
    intro:
      'Thank you for your attention and for the opportunity to work with you. Based on your request, we are pleased to present our service proposal, detailed below:',
    notaPrecios: '** Prices per person/service. Prices in Mexican pesos plus VAT.',
    detalle:
      'End-to-end Employer Registration Certificate filing. The client/beneficiary must provide the complete documentation, which will be requested by email for follow-up.',
    notas: '*The maximum response time to deliver the information is 17 business days.\n*These services apply only to the city of Tijuana.',
    terminos: `A 50% advance payment of the total amount is required.
The advance payment is non-refundable if the service is cancelled.
Credit of 7 (seven) calendar days from delivery of the invoice. If full or partial payment is not made within that period, a late-payment interest of 10% (ten percent) per month will be charged on the past-due balance.
Prices plus VAT.
For home verifications, the price covers the Tijuana area only; if required in another area, a new quote will be needed.
The special unit price applies only to requests for 5 or more people submitted in a single requisition.
Any additional service not expressly stated in this document will be quoted separately and invoiced independently, subject to prior agreement with the client.`,
  },
}

const PAYROLL: Textos<PayrollData> = {
  es: {
    intro:
      'Agradecemos sinceramente la oportunidad de colaborar con ustedes y apoyar a {empresa} en el logro de sus objetivos estratégicos. Con esto en mente, nos complace compartir la cotización para el puesto de {puesto}.',
    frecuencia: 'Semanal',
    terminos: `Nómina semanal del empleado y pago de cuotas patronales.
Esta cotización tiene una vigencia de 7 días.
Ofrecemos una prueba psicométrica sin costo adicional para el candidato finalista de este puesto.
La facturación se realizará a la empresa estadounidense en dólares, al tipo de cambio del día de la factura.
Se cobrará un cargo mensual del 10% sobre el saldo vencido si la factura no se paga dentro de los 7 días naturales siguientes a su envío y recepción por parte del cliente.
Precio por persona.
Incluye vacaciones, aguinaldo y prima vacacional.
Los montos de la estructura salarial pueden cambiar según la oferta final de contratación del candidato o candidatos.
Cualquier servicio adicional no expresado en esta cotización se cotizará por separado y deberá pagarse por adelantado, como viáticos, reportes especiales, equipo de protección personal, bonos extra, herramientas, vales de gasolina o seguro médico, entre otros, y se agregará un costo de servicio del {fee}.
El precio no incluye ningún tipo de indemnización o finiquito por terminación de contrato.
La factura puede variar debido a que las cuotas patronales son variables.
El servicio de gastos médicos mayores se cotizará de manera independiente según la contratación de cada colaborador. Los gastos se facturarán por separado.
Este cambio aplicará a la facturación del personal activo y de nuevo ingreso.
Administración y atención a sus empleados.
Asuntos laborales incluidos parcialmente.
Tarjeta bancaria (débito) para el depósito de nómina.`,
  },
  en: {
    intro:
      'We truly appreciate the opportunity to partner with you and support {empresa} in achieving its strategic goals. With that in mind, we’re pleased to share a quote for the {puesto} role.',
    frecuencia: 'Weekly',
    terminos: `Weekly payroll for employee and payment of employer taxes.
This quotation is valid for 7 days.
We offer a psychometric test, at no additional cost, for the finalist candidate for this position.
Invoicing would be to the American Company in Dollars according to the Dollar rate on the day of the invoice.
10% monthly fee of the past due balance will be charged if the invoice if is not paid on the next 7 natural days after the invoice is sent and received by the customer.
Price per person.
Includes vacation pay, Christmas bonus, and vacation bonus.
Amounts on the salary structure can change based on the final contract offer for the candidate(s).
Any additional service not expressed on this quotation will be quoted and has to be paid in advance, like travel expenses, special reports, personal protection equipment, extra bonuses, tools, gas coupons, or medical insurance, etc., and a {fee} service cost will be added.
The price does not include any type of compensation or liquidation for a contract termination.
The bill may be different because employer charges are variable.
The major medical expenses service will be quoted independently according to the hiring of each collaborator. Expenses will be billed separately.
This change will apply to the invoicing of active personnel and new income.
Administration and attention to your employees.
Labor affairs are partially included.
Bank Card Processing (Debit) for payroll deposit.`,
  },
}

const GMM: Textos<GmmData> = {
  es: {
    terminos: `La facturación se emitirá a la empresa estadounidense en dólares, al tipo de cambio aplicable en la fecha de la factura.
Se aplicará un cargo moratorio mensual del 10% sobre cualquier saldo vencido si el pago no se recibe dentro de los siete (7) días naturales a partir de la fecha de la factura.
Los precios se calculan por persona y se cotizan en pesos mexicanos.
Cualquier servicio adicional no incluido en esta cotización se cotizará por separado y deberá pagarse por adelantado. Esto puede incluir, entre otros, viáticos, reportes especiales, equipo de protección personal, bonos, herramientas, vales de gasolina o seguros médicos adicionales. A dichos conceptos se aplicará una cuota de servicio del 9.5%.
Los gastos del Seguro Médico Privado se facturan mensualmente y cubren el periodo de la póliza indicado en esta cotización.
Estos términos aplican tanto al personal actual como a los empleados de nuevo ingreso.`,
  },
  en: {
    terminos: `Invoicing will be issued to the American company in U.S. Dollars, based on the exchange rate applicable on the invoice date.
A monthly late fee of 10% will be applied to any past-due balance if payment is not received within seven (7) calendar days from the invoice date.
Pricing is calculated per person and quoted in Mexican Pesos.
Any additional services not included in this quotation will be quoted separately and must be paid in advance. These may include, but are not limited to, travel expenses, special reports, personal protective equipment, bonuses, tools, fuel vouchers, or additional medical insurance. A 9.5% service fee will apply to such items.
Private Medical Insurance expenses are billed monthly and cover the applicable policy period indicated in this quotation.
These terms apply to both existing personnel and newly enrolled employees.`,
  },
}

const BONOS: Textos<BonosData> = {
  es: {
    tituloPortada: 'Bonos Q3',
    intro:
      'Agradecemos sinceramente la oportunidad de colaborar con {empresa} y apoyar a su equipo en el reconocimiento y la recompensa de las contribuciones sobresalientes de sus colaboradores.\nEl presente documento contiene el resumen de {titulo}, incluyendo los montos de bono bruto y neto por empleado, el costo total de nómina y el gran total para su revisión. Todas las cifras se basan en la información de nómina proporcionada y se presentan para su aprobación antes de su procesamiento.',
    terminos: `Crédito: 7 días naturales a partir de la recepción de la factura. Se cobrará un cargo mensual del 8% sobre el saldo vencido si la factura no se paga dentro de los 7 días naturales siguientes a su presentación y recepción por parte del cliente.
Todos los precios están en pesos mexicanos y tienen una vigencia de 7 días.
No incluye IVA.
La factura puede variar debido a que las cuotas patronales son variables.
Los montos netos pueden variar por las deducciones del empleado.
Los precios pueden cambiar según la oferta final de contratación del candidato o candidatos.
El tipo de cambio se aplicará en la fecha de emisión de la factura.`,
  },
  en: {
    tituloPortada: 'Q3 Bonuses',
    intro:
      'We truly appreciate the opportunity to partner with {empresa} and support your team in recognizing and rewarding the outstanding contributions of your employees.\nThe following document provides the {titulo} summary, including the gross and net bonus amounts per employee, total payroll costs, and the grand total for your review. All figures are based on the payroll data provided and are prepared for your approval prior to processing.',
    terminos: `We Credit: 7 natural days upon receipt of invoice 8% monthly fee of the past due balance will be charged if the invoice if is not paid on the next 7 natural days after invoice is presented and received by customer.
All prices are in Mexican pesos and valid for 7 days.
Tax not included (IVA)
The bill may be different because employer charges are variable.
Net amounts may vary due to employee deductions.
Pricing can change based on the final contract offer for the candidate(s).
Exchange rate to be applied at the invoice issuing date.`,
  },
}

const TEXTOS: { [K in PlantillaId]: Textos<Datos[K]> } = {
  feedbak: FEEDBAK,
  servicios: SERVICIOS,
  payroll: PAYROLL,
  gmm: GMM,
  bonos: BONOS,
}

/**
 * Cambia el idioma de una plantilla. Los textos que siguen igual al original
 * del idioma anterior se reemplazan por su traducción; los que el usuario
 * editó se conservan tal cual.
 */
export function cambiarIdioma<K extends PlantillaId>(id: K, d: Datos[K], idioma: Idioma): Datos[K] {
  if (d.idioma === idioma) return d
  const antes = TEXTOS[id][d.idioma] as Record<string, unknown>
  const despues = TEXTOS[id][idioma] as Record<string, unknown>
  const r = { ...d, idioma } as Record<string, unknown>
  for (const k of Object.keys(despues)) {
    if (r[k] === antes[k]) r[k] = despues[k]
  }
  return r as unknown as Datos[K]
}

export function datosIniciales(): Datos {
  const hoy = hoyISO()
  const comun = { fecha: hoy, contacto: '', empresa: '', tratamiento: 'Estimada' }
  return {
    feedbak: {
      ...comun,
      idioma: 'es',
      portada: '1',
      producto: 'mk-checador',
      colaboradores: '100',
      administradores: '2',
      moneda: 'MXN',
      tipoCambio: '17',
      puesto: '',
      capacitacionHoras: '3.0',
      horasSoporte: '8',
      firmante: 'Nancy Santiago',
      firmanteEmpresa: 'Treve / Feedbak',
      ciudad: '',
      costoHoraAdicional: '',
      ...FEEDBAK.es,
    },
    servicios: {
      ...comun,
      idioma: 'es',
      ciudad: 'Tijuana, Baja California',
      servicios: [{ cantidad: '1', descripcion: 'Trámite de Constancia de Inscripción de Empleador', precio: '2500' }],
      iva: '16',
      firmante: 'Customer Services',
      tituloPortada: '',
      intro: '',
      notaPrecios: '',
      detalle: '',
      notas: '',
      terminos: '',
      ...SERVICIOS.es,
    },
    payroll: {
      ...comun,
      idioma: 'en',
      tituloPortada: 'Dealer Service Representative',
      clientePortada: 'TREVE – ',
      ciudad: 'Tijuana, Baja California',
      puesto: 'Dealer Service Representative',
      headcount: '1',
      fee: '7.25',
      salario: '0',
      impuestos: '0',
      prestaciones: '0',
      firmante: 'Customer Services',
      intro: '',
      frecuencia: '',
      terminos: '',
      ...PAYROLL.en,
    },
    gmm: {
      ...comun,
      idioma: 'en',
      clientePortada: 'TREVE – ',
      inicio: hoy,
      fin: hoy,
      empleados: [{ nombre: '', edad: '', menorMensual: '0', menorAnual: '0', mayorMensual: '0', mayorAnual: '0' }],
      firmante: 'Customer Services',
      terminos: '',
      ...GMM.en,
    },
    bonos: {
      ...comun,
      idioma: 'en',
      clientePortada: 'TREVE – ',
      ciudad: 'Tijuana, Baja California',
      empleados: [{ nombre: '', bruto: '0', neto: '0', costo: '0' }],
      firmante: 'Xóchitl Vargas',
      tituloPortada: '',
      intro: '',
      terminos: '',
      ...BONOS.en,
    },
  }
}

/** Sustituye {clave} por su valor; las claves desconocidas quedan intactas. */
export function rellenar(texto: string, vars: Record<string, string>): string {
  return texto.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? vars[k] : m))
}
