import { hoyISO } from './formato'
import type { Moneda, ProductoFeedbak } from './tabuladores'

/** Campos numéricos se guardan como texto (tal cual se escriben) y se convierten al renderizar. */

export type Portada = '1' | '2' | '3' | 'ninguna'

export interface FeedbakData {
  portada: Portada
  producto: ProductoFeedbak
  colaboradores: string
  administradores: string
  moneda: Moneda
  tipoCambio: string
  ciudad: string
  fecha: string
  contacto: string
  puesto: string
  empresa: string
  tratamiento: string
  capacitacionHoras: string
  horasSoporte: string
  costoHoraAdicional: string
  firmante: string
  firmanteEmpresa: string
}

export interface Servicio {
  cantidad: string
  descripcion: string
  precio: string
}

export interface ServiciosData {
  tituloPortada: string
  ciudad: string
  fecha: string
  contacto: string
  empresa: string
  tratamiento: string
  intro: string
  servicios: Servicio[]
  iva: string
  notaPrecios: string
  detalle: string
  notas: string
  terminos: string
  firmante: string
}

export interface PayrollData {
  tituloPortada: string
  clientePortada: string
  ciudad: string
  fecha: string
  contacto: string
  empresa: string
  intro: string
  puesto: string
  headcount: string
  frecuencia: string
  fee: string
  salario: string
  impuestos: string
  prestaciones: string
  terminos: string
  firmante: string
}

export interface EmpleadoGmm {
  nombre: string
  edad: string
  menorMensual: string
  menorAnual: string
  mayorMensual: string
  mayorAnual: string
}

export interface GmmData {
  clientePortada: string
  fecha: string
  contacto: string
  empresa: string
  inicio: string
  fin: string
  empleados: EmpleadoGmm[]
  terminos: string
  firmante: string
}

export interface EmpleadoBono {
  nombre: string
  bruto: string
  neto: string
  costo: string
}

export interface BonosData {
  tituloPortada: string
  clientePortada: string
  ciudad: string
  fecha: string
  contacto: string
  empresa: string
  intro: string
  empleados: EmpleadoBono[]
  terminos: string
  firmante: string
}

export interface Datos {
  feedbak: FeedbakData
  servicios: ServiciosData
  payroll: PayrollData
  gmm: GmmData
  bonos: BonosData
}

export type PlantillaId = keyof Datos

export const PLANTILLAS: { id: PlantillaId; marca: string; idioma: string; nombre: string; color: string }[] = [
  { id: 'feedbak', marca: 'Feedbak', idioma: 'ES', nombre: 'Licenciamiento Mi Kiosko / Checador', color: '#6FC08D' },
  { id: 'servicios', marca: 'Staffvia', idioma: 'ES', nombre: 'Servicios y trámites', color: '#8FA86A' },
  { id: 'payroll', marca: 'Staffvia', idioma: 'EN', nombre: 'Payroll services', color: '#123A5A' },
  { id: 'gmm', marca: 'Staffvia', idioma: 'EN', nombre: 'Medical insurance (GMM)', color: '#F2A72C' },
  { id: 'bonos', marca: 'Staffvia', idioma: 'EN', nombre: 'Bonuses', color: '#E2601A' },
]

const TERMINOS_SERVICIOS = `Se requiere un anticipo del 50% del monto total de los estudios.
Anticipo no reembolsable. En caso de que se cancele el servicio.
Crédito a 7 (siete) días naturales a partir de la entrega de la factura. En caso de falta de pago total o parcial dentro de dicho plazo, se generará un interés moratorio del 10% (diez por ciento) mensual sobre el saldo vencido.
Precios más IVA.
En el caso de las comprobaciones domiciliarias, el precio abarca área o la ciudad de Tijuana únicamente, en caso de requerirlo en otra área, será necesaria una nueva cotización.
El precio especial unitario se aplicará únicamente a solicitudes de 5 personas o más, siempre que se soliciten en una sola requisición.
Cualquier servicio adicional diverso a los expresamente señalados en el presente documento, serán motivo de una cotización adicional y deberá ser facturado de manera independiente, previo acuerdo con el cliente.`

const TERMINOS_PAYROLL = `Weekly payroll for employee and payment of employer taxes.
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
Bank Card Processing (Debit) for payroll deposit.`

const TERMINOS_GMM = `Invoicing will be issued to the American company in U.S. Dollars, based on the exchange rate applicable on the invoice date.
A monthly late fee of 10% will be applied to any past-due balance if payment is not received within seven (7) calendar days from the invoice date.
Pricing is calculated per person and quoted in Mexican Pesos.
Any additional services not included in this quotation will be quoted separately and must be paid in advance. These may include, but are not limited to, travel expenses, special reports, personal protective equipment, bonuses, tools, fuel vouchers, or additional medical insurance. A 9.5% service fee will apply to such items.
Private Medical Insurance expenses are billed monthly and cover the applicable policy period indicated in this quotation.
These terms apply to both existing personnel and newly enrolled employees.`

const TERMINOS_BONOS = `We Credit: 7 natural days upon receipt of invoice 8% monthly fee of the past due balance will be charged if the invoice if is not paid on the next 7 natural days after invoice is presented and received by customer.
All prices are in Mexican pesos and valid for 7 days.
Tax not included (IVA)
The bill may be different because employer charges are variable.
Net amounts may vary due to employee deductions.
Pricing can change based on the final contract offer for the candidate(s).
Exchange rate to be applied at the invoice issuing date.`

export function datosIniciales(): Datos {
  const hoy = hoyISO()
  return {
    feedbak: {
      portada: '1',
      producto: 'mk-checador',
      colaboradores: '100',
      administradores: '2',
      moneda: 'MXN',
      tipoCambio: '17',
      ciudad: 'Tijuana B.C.',
      fecha: hoy,
      contacto: '',
      puesto: '',
      empresa: '',
      tratamiento: 'Estimada',
      capacitacionHoras: '3.0',
      horasSoporte: '8',
      costoHoraAdicional: '$65.00 Dlls (Paquetes disponibles)',
      firmante: 'Nancy Santiago',
      firmanteEmpresa: 'Treve / Feedbak',
    },
    servicios: {
      tituloPortada: 'Trámite de Constancia de Inscripción de Empleador',
      ciudad: 'Tijuana, Baja California',
      fecha: hoy,
      contacto: '',
      empresa: '',
      tratamiento: 'Estimada',
      intro:
        'Agradecemos tu atención y la oportunidad de colaborar con ustedes. Presentamos nuestra propuesta de servicios derivado de tu solicitud, la cual se desglosa a continuación:',
      servicios: [{ cantidad: '1', descripcion: 'Trámite de Constancia de Inscripción de Empleador', precio: '2500' }],
      iva: '16',
      notaPrecios: '** Precios por persona/servicio. Precios en pesos mexicanos más IVA',
      detalle:
        'Trámite de constancia de Inscripción de empleador de inicio a fin, para lo cual se deberá contar con la documentación completa por parte del cliente/beneficiario, que será solicitada, por correo electrónico para su seguimiento.',
      notas: '*El tiempo de respuesta máximo para la entrega de información será de 17 días hábiles.\n*Estos servicios solo se aplican a la ciudad de Tijuana.',
      terminos: TERMINOS_SERVICIOS,
      firmante: 'Customer Services',
    },
    payroll: {
      tituloPortada: 'Dealer Service Representative',
      clientePortada: 'TREVE – ',
      ciudad: 'Tijuana, Baja California',
      fecha: hoy,
      contacto: '',
      empresa: '',
      intro:
        'We truly appreciate the opportunity to partner with you and support {empresa} in achieving its strategic goals. With that in mind, we’re pleased to share a quote for the {puesto} role.',
      puesto: 'Dealer Service Representative',
      headcount: '1',
      frecuencia: 'Weekly',
      fee: '7.25',
      salario: '0',
      impuestos: '0',
      prestaciones: '0',
      terminos: TERMINOS_PAYROLL,
      firmante: 'Customer Services',
    },
    gmm: {
      clientePortada: 'TREVE – ',
      fecha: hoy,
      contacto: '',
      empresa: '',
      inicio: hoy,
      fin: hoy,
      empleados: [{ nombre: '', edad: '', menorMensual: '0', menorAnual: '0', mayorMensual: '0', mayorAnual: '0' }],
      terminos: TERMINOS_GMM,
      firmante: 'Customer Services',
    },
    bonos: {
      tituloPortada: 'Q3 Bonuses',
      clientePortada: 'TREVE – ',
      ciudad: 'Tijuana, Baja California',
      fecha: hoy,
      contacto: '',
      empresa: '',
      intro:
        'We truly appreciate the opportunity to partner with {empresa} and support your team in recognizing and rewarding the outstanding contributions of your employees.\nThe following document provides the {titulo} summary, including the gross and net bonus amounts per employee, total payroll costs, and the grand total for your review. All figures are based on the payroll data provided and are prepared for your approval prior to processing.',
      empleados: [{ nombre: '', bruto: '0', neto: '0', costo: '0' }],
      terminos: TERMINOS_BONOS,
      firmante: 'Xóchitl Vargas',
    },
  }
}

/** Sustituye {clave} por su valor; las claves desconocidas quedan intactas. */
export function rellenar(texto: string, vars: Record<string, string>): string {
  return texto.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? vars[k] : m))
}
