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
  /** Carta: un párrafo por línea. {plataformas} se sustituye. */
  intro: string
  titulo: string
  /** Nota bajo los precios. {Moneda} se sustituye. */
  notaMontos: string
  /** Términos: líneas que empiezan con "## " son títulos de sección; las demás, puntos. */
  terminos: string
}

export interface Servicio {
  cantidad: string
  descripcion: string
  precio: string
  /** Precio especial por volumen; vacío = sin precio especial. */
  precioEspecial?: string
}

export interface ServiciosData extends Base {
  tituloPortada: string
  ciudad: string
  intro: string
  servicios: Servicio[]
  iva: string
  /** Solicitudes mínimas para el precio especial. Vacío = sin columna de precio especial. */
  minimoEspecial?: string
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

export interface PeriodoHaats {
  periodo: string
  mensualidad: string
  precioHora: string
  credito: string
}

export interface FilaHoras {
  horas: string
  turno: string
  precioHora: string
}

interface HaatsBase extends Base {
  ciudad: string
  cargo: string
  intro: string
  tituloTabla: string
  notaPrecios: string
  /** "## " = título de sección, "---" = salto de hoja. */
  secciones: string
  firmantePuesto: string
}

export interface HaatsMensualData extends HaatsBase {
  periodos: PeriodoHaats[]
}

export interface HaatsHorasData extends HaatsBase {
  filas: FilaHoras[]
}

export interface Posicion {
  posicion: string
  modalidad: string
  precioRegular: string
  precioPromo: string
}

export interface ReclutamientoData extends Base {
  tituloPortada: string
  ciudad: string
  cargo: string
  intro: string
  posiciones: Posicion[]
  notaPrecios: string
  /** "## " = título de sección, "- " = subpunto, "---" = salto de hoja. */
  secciones: string
}

export interface Datos {
  feedbak: FeedbakData
  servicios: ServiciosData
  payroll: PayrollData
  gmm: GmmData
  bonos: BonosData
  estudios: ServiciosData
  reclutamiento: ReclutamientoData
  haatsMensual: HaatsMensualData
  haatsHoras: HaatsHorasData
}

export type PlantillaId = keyof Datos

export const PLANTILLAS: { id: PlantillaId; marca: string; nombre: string; color: string }[] = [
  { id: 'feedbak', marca: 'Feedbak', nombre: 'Licenciamiento Mi Kiosko / Checador', color: '#6FC08D' },
  { id: 'servicios', marca: 'Staffvia', nombre: 'Servicios y trámites', color: '#8FA86A' },
  { id: 'payroll', marca: 'Staffvia', nombre: 'Nómina (payroll)', color: '#123A5A' },
  { id: 'gmm', marca: 'Staffvia', nombre: 'Gastos médicos (GMM)', color: '#F2A72C' },
  { id: 'bonos', marca: 'Staffvia', nombre: 'Bonos', color: '#E2601A' },
  { id: 'estudios', marca: 'Staffvia', nombre: 'Estudios con precio especial', color: '#5E8C9A' },
  { id: 'reclutamiento', marca: 'Staffvia', nombre: 'Reclutamiento', color: '#2F6F4E' },
  { id: 'haatsMensual', marca: 'HAATS', nombre: 'Servicio especializado mensual', color: '#8B0B7A' },
  { id: 'haatsHoras', marca: 'HAATS', nombre: 'Tiempo extra por horas', color: '#1B944B' },
]

/* ───────── Textos editables con versión en cada idioma ───────── */

type Textos<T> = Record<Idioma, Partial<T>>

const FEEDBAK: Textos<FeedbakData> = {
  es: {
    ciudad: 'Tijuana B.C.',
    costoHoraAdicional: '$65.00 Dlls (Paquetes disponibles)',
    intro: `Sabemos que llevar la administración en empresas tan importantes como la suya, es todo un reto. Debido a esto, para Feedbak es un privilegio presentar las Plataformas Tecnológicas que permiten eficientizar tiempos de Administración y ahorrar importantes costos asociados con el personal; a través de {plataformas}.
Con esto en mente les presentamos la siguiente propuesta.`,
    titulo: 'Cotización Licenciamiento de Plataforma Tecnológica',
    notaMontos: 'Todos los montos están expresados en {Moneda} y no incluyen IVA (donde aplique).',
    terminos: `## 1. Condiciones de Pago
El pago anual o semestral deberá realizarse en una sola exhibición antes del inicio del servicio.
En pagos mensuales, el setup inicial y la primera mensualidad deberán cubrirse al iniciar el proyecto.
Nuestros servicios son pre-pago: todas las mensualidades son por adelantado.
Los precios están expresados en {moneda}, más IVA (16%, donde aplique), y son válidos por 15 días naturales.
El costo por cada Usuario Administrador adicional será de {precioAdmin} más IVA (16%, donde aplique) de manera mensual. Dicho importe tendrá el carácter de no negociable y no estará sujeto a la aplicación de promociones, descuentos, bonificaciones ni cualquier otro beneficio comercial vigente o futuro.
En el supuesto de que el monto total de la factura entregada y no objetada por “El cliente” o cualquier porción de dicha factura no sea pagada a “El Proveedor” dentro del terminó de 7 días naturales antes citado, conllevará un cargo de interés moratorio del 10% (diez por ciento) mensual sobre el saldo vencido pagadero por “El Cliente” a “El Proveedor” en conjunto con la suerte principal consignada en la factura respectiva.
## 2. Vigencia y Ajustes de Precio
Los precios podrán actualizarse anualmente conforme a inflación (Índice INPC) u otros factores de mercado.
El cliente será notificado con al menos 30 días de anticipación.
## 3. Alcance de la Implementación y Soporte
La propuesta incluye las horas de soporte indicadas durante la implementación. Para horas adicionales, favor de solicitar una cotización separada.
Toda configuración especial o requisito para la puesta en marcha y el correcto funcionamiento de la plataforma, es cubierto por el tiempo disponible de “Implementación”. En caso de agotar todas las horas y requerir horas adicionales, estas serán facturadas por paquetes por separado con un costo de $1,200.00 por hora (más IVA) y un tiempo de respuesta de hasta 24 horas en días hábiles. En caso de ser un soporte o servicio urgente este tendrá un costo de $1,900.00 pesos (más IVA) por hora en un tiempo no mayor a 3 horas, en caso de ser fuera de horario de oficina se agregará el 20% de costo sobre total de tiempo. Horarios de Lun-Jue 8am a 6pm y Vie 8am a 3pm PST. Sábados y Domingos no son días hábiles.
Gastos de viáticos fuera de la ciudad (cuando aplique y previa autorización del cliente) correrán por cuenta del cliente.
## 4. Hardware y Responsabilidades del Cliente
La cotización no incluye ningún tipo de hardware (iPads, Tablets, accesorios, pedestales, arneses, etc.).
El cliente tiene la responsabilidad de: Adquirir y mantener los equipos necesarios. Instalar y configurar la aplicación en cada dispositivo; así como de proveer la información a la plataforma mediante archivos de texto o Excel, según se indique.
Feedbak puede cotizar y proveer hardware bajo solicitud expresa del cliente.
## 5. Capacitación
La cotización provista incluye una sesión inicial remota vía Zoom para administradores.
La sesión será grabada y entregada al cliente para consultas posteriores.
Cualquier capacitación adicional, podrá causar cargo por horas de soporte.
Material de soporte se proveerá vía video en plataformas.
## 6. Privacidad y Protección de Datos
La información suministrada por el cliente será tratada conforme a la Ley Federal de Protección de Datos Personales.
El cliente declara contar con el consentimiento de sus empleados para el tratamiento de la información compartida.
Feedbak no modificará ni operará la información del cliente sin autorización.
Feedbak no tiene acceso a datos específicos de los empleados.
Feedbak no utiliza ni explota esos datos para fines distintos al servicio.
Los datos están encriptados y protegidos todo el tiempo.
El acceso a datos personales se concede solamente en casos estrictamente necesarios (soporte, mantenimiento, cumplimiento legal).
## 7. Soporte Técnico Posterior
El soporte técnico posterior requiere contar con póliza o paquete vigente de horas de soporte (Cotizadas por separado).
Tickets deben levantarse vía soporte@feedbakmx.com o en la plataforma correspondiente en el menú de “Soporte”.
Incidencias resueltas en menos de 5 minutos no generarán costo.
## 8. Facturación
Contamos con Facturación en México y EEUU. En caso de requerir facturación vía Invoice, favor de notificarlo al área de servicio al cliente.`,
  },
  en: {
    ciudad: 'Tijuana, B.C.',
    costoHoraAdicional: '$65.00 USD (packages available)',
    intro: `We know that managing administration in companies as important as yours is a real challenge. That is why Feedbak is proud to present the Technology Platforms that streamline administrative time and deliver significant savings in personnel-related costs through {plataformas}.
With this in mind, we are pleased to present the following proposal.`,
    titulo: 'Technology Platform Licensing Quote',
    notaMontos: 'All amounts are expressed in {Moneda} and do not include VAT (where applicable).',
    terminos: `## 1. Payment Terms
Annual or semi-annual payments must be made in a single installment before the service starts.
For monthly payments, the initial setup and the first monthly fee must be paid at the start of the project.
Our services are prepaid: all monthly fees are paid in advance.
Prices are expressed in {moneda}, plus VAT (16%, where applicable), and are valid for 15 calendar days.
The cost of each additional Administrator User will be {precioAdmin} plus VAT (16%, where applicable) per month. This amount is non-negotiable and is not subject to any current or future promotions, discounts, credits or other commercial benefits.
If the total amount of an invoice delivered and not disputed by “The Client”, or any portion of it, is not paid to “The Provider” within the 7 calendar days mentioned above, a late-payment interest of 10% (ten percent) per month will be charged on the past-due balance payable by “The Client” to “The Provider”, together with the principal amount stated on the respective invoice.
## 2. Validity and Price Adjustments
Prices may be updated annually based on inflation (Mexican INPC index) or other market factors.
The client will be notified at least 30 days in advance.
## 3. Implementation Scope and Support
This proposal includes the support hours indicated during implementation. For additional hours, please request a separate quote.
Any special configuration or requirement for the launch and proper operation of the platform is covered by the available “Implementation” time. If all hours are used and additional hours are required, they will be invoiced separately in packages at $1,200.00 MXN per hour (plus VAT), with a response time of up to 24 business hours. Urgent support or services will cost $1,900.00 MXN (plus VAT) per hour, with a response time of no more than 3 hours; outside office hours, a 20% surcharge will be added to the total time. Office hours: Mon–Thu 8am to 6pm and Fri 8am to 3pm PST. Saturdays and Sundays are not business days.
Out-of-town travel expenses (when applicable and with prior client authorization) will be covered by the client.
## 4. Hardware and Client Responsibilities
This quote does not include any hardware (iPads, tablets, accessories, stands, harnesses, etc.).
The client is responsible for purchasing and maintaining the necessary equipment, installing and configuring the application on each device, and providing the information to the platform through text or Excel files, as indicated.
Feedbak can quote and provide hardware upon the client’s express request.
## 5. Training
This quote includes one initial remote session via Zoom for administrators.
The session will be recorded and delivered to the client for future reference.
Any additional training may be charged as support hours.
Support material will be provided as videos within the platforms.
## 6. Privacy and Data Protection
Information provided by the client will be handled in accordance with the Mexican Federal Law on the Protection of Personal Data.
The client states that it has its employees’ consent to process the information shared.
Feedbak will not modify or operate the client’s information without authorization.
Feedbak does not have access to specific employee data.
Feedbak does not use or exploit this data for purposes other than the service.
Data is encrypted and protected at all times.
Access to personal data is granted only when strictly necessary (support, maintenance, legal compliance).
## 7. Ongoing Technical Support
Ongoing technical support requires an active support policy or package of support hours (quoted separately).
Tickets must be submitted to soporte@feedbakmx.com or through the “Support” menu in the corresponding platform.
Issues resolved in under 5 minutes will not be charged.
## 8. Invoicing
We can invoice in Mexico and the United States. If you require a US invoice, please let our customer service team know.`,
  },
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


const ESTUDIOS: Textos<ServiciosData> = {
  es: {
    tituloPortada: 'Comprobaciones domiciliarias y cartas de antecedentes no penales',
    intro:
      'Agradecemos su atención y la oportunidad de colaborar con ustedes. Presentamos nuestra propuesta de servicios derivado de su solicitud, la cual se desglosa a continuación:',
    notaPrecios: '** Precios por persona/servicio. Precios en pesos mexicanos más IVA',
    detalle: `Revisión de antecedentes penales
Entrega de reporte de revisión
*El tiempo de respuesta máximo para la entrega de información será de 10 días hábiles
Visita a domicilio para toma de fotografías.
Fotografías del domicilio del colaborador.
*El tiempo de respuesta máximo para la entrega de información será de 10 días hábiles
*Estos servicios solo se aplican a la ciudad de Tijuana.`,
    notas: '',
    terminos: `Se requiere un anticipo del 50% del monto total de los estudios.
Anticipo no reembolsable. En caso de que se cancele el servicio, el monto pagado se mantendrá como un saldo a favor del cliente.
Crédito a 28 (veintiocho) días naturales a partir de la entrega de la factura. En caso de falta de pago total o parcial dentro de dicho plazo, se generará un interés moratorio del 10% (diez por ciento) mensual sobre el saldo vencido.
Precios más IVA.
En el caso de las comprobaciones domiciliarias, el precio abarca área o la ciudad de Tijuana únicamente, en caso de requerirlo en otra área, será necesaria una nueva cotización.
El precio especial unitario se aplicará únicamente a solicitudes de {minimo} personas o más, siempre que se soliciten en una sola requisición.
Cualquier servicio adicional diverso a los expresamente señalados en el presente documento, serán motivo de una cotización adicional y deberá ser facturado de manera independiente, previo acuerdo con el cliente.`,
  },
  en: {
    tituloPortada: 'Home verifications and criminal background letters',
    intro:
      'Thank you for your attention and for the opportunity to work with you. Based on your request, we are pleased to present our service proposal, detailed below:',
    notaPrecios: '** Prices per person/service. Prices in Mexican pesos plus VAT.',
    detalle: `Criminal background check
Delivery of the review report
*The maximum response time to deliver the information is 10 business days
Home visit to take photographs.
Photographs of the employee’s home.
*The maximum response time to deliver the information is 10 business days
*These services apply only to the city of Tijuana.`,
    notas: '',
    terminos: `A 50% advance payment of the total amount is required.
The advance payment is non-refundable. If the service is cancelled, the amount paid will remain as a credit in the client’s favor.
Credit of 28 (twenty-eight) calendar days from delivery of the invoice. If full or partial payment is not made within that period, a late-payment interest of 10% (ten percent) per month will be charged on the past-due balance.
Prices plus VAT.
For home verifications, the price covers the Tijuana area only; if required in another area, a new quote will be needed.
The special unit price applies only to requests for {minimo} or more people submitted in a single requisition.
Any additional service not expressly stated in this document will be quoted separately and invoiced independently, subject to prior agreement with the client.`,
  },
}

const RECLUTAMIENTO: Textos<ReclutamientoData> = {
  es: {
    tituloPortada: 'Ayudante general',
    cargo: 'Recursos Humanos',
    intro: `Agradecemos su atención y la oportunidad de colaborar con su empresa. Presentamos a continuación nuestra propuesta de servicios de reclutamiento, enfocada en atraer y seleccionar talento alineado a sus requerimientos, contribuyendo al logro de sus objetivos operativos.
A continuación, dejamos a su consideración la cotización para la posición de {posicion} en la siguiente modalidad:`,
    notaPrecios: '** Precios por persona. Precios en pesos mexicanos más IVA',
    secciones: `## Descripción del servicio:
Propuesta contratada con garantía: Todo personal que pase la entrevista, sea aceptado/contratado por el cliente y permanezca activo durante 5 días naturales (a partir de su primer día de ingreso) será facturado.
## Términos y condiciones:
La vigencia de la cotización será por 7 días naturales.
Crédito de 20 días naturales.
Toda factura será remitida semanalmente y será pagadera dentro de los 20 (veinte) días naturales a partir del día de la emisión de la factura. En el supuesto de que el monto total de la factura entregada y no objetada por “El Cliente”, o cualquier porción de dicha factura no sea pagada a “El Proveedor” dentro del término de 20 (veinte) días naturales antes citado, conllevará un cargo de interés moratorio del 10% (diez por ciento) mensual sobre el saldo vencido pagadero por “El Cliente” a “El Proveedor” en conjunto con la suerte principal consignada en la factura respectiva.
En el caso de que el cliente cancele el requerimiento del servicio, deberá avisar con 24 horas de anticipación, en caso contrario, se realizará un cargo por servicios de $980.00 + IVA, para todo el personal procesado, aunque no se realice la contratación.
Esta cotización no incluye servicio de transporte.
Este precio está definido de acuerdo con el perfil, ubicación de la planta, actividades a realizar, salario, procesos operativos y de reclutamiento definidos, por lo que en caso de que se presente algún cambio, será necesario la reevaluación del precio final.
Cualquier servicio adicional diverso a los expresamente señalados en el presente documento, tales como reportes especiales, equipo de protección personal, botas, cascos, caretas, cubre bocas, cofias, gorros, guantes, herramientas, etc.; serán motivo de una ulterior cotización y facturados de manera independiente, previo acuerdo con el cliente.
No incluye trámite de carta de antecedentes no penales. En caso de que el cliente requiera este trámite, será necesaria una cotización adicional.
---
## Cotización en modalidad de contratado con garantía, incluye:
Reclutamiento
Expediente con documentación básica
Solicitud genérica o del cliente
Doping de 3 parámetros
## Turnos y salarios:
Lunes a jueves, 07:00 a.m. a 17:00 p.m. y viernes 07:00 a.m. a 15:00 p.m.
Lunes a jueves, 19:00 p.m. a 5:30 a.m.
Lunes a viernes, 21:30 p.m. a 6:00 a.m.
## Salario:
Salario base $3,094 + $241 en vales, $2,845 netos
## Datos de reclutamiento y perfil:
Puesto: Auxiliar general
Vacantes: 10 a 15 personas a confirmar por el cliente (los precios mostrados en esta cotización son en pesos mexicanos, unitarios y por persona)
Edad: 18 a 45 años
Género: Masculino
Escolaridad: Primaria terminada
Experiencia: No se requiere experiencia. Buena movilidad, esfuerzo físico (proactivos).
Documentación:
- INE
- NSS
- Acta de nacimiento
- RFC
- CURP
- Comprobante de domicilio
---
## Prestaciones:
De ley
Comedor subsidiado
Vales de despensa`,
  },
  en: {
    tituloPortada: 'General helper',
    cargo: 'Human Resources',
    intro: `Thank you for your attention and for the opportunity to work with your company. Below is our recruitment services proposal, focused on attracting and selecting talent aligned with your requirements and contributing to your operational goals.
For your consideration, please find below the quote for the {posicion} position under the following modality:`,
    notaPrecios: '** Prices per person. Prices in Mexican pesos plus VAT.',
    secciones: `## Service description:
Guaranteed-hire proposal: every person who passes the interview, is accepted/hired by the client and remains active for 5 calendar days (from their first day) will be invoiced.
## Terms and conditions:
This quote is valid for 7 calendar days.
Credit of 20 calendar days.
All invoices will be issued weekly and are payable within 20 (twenty) calendar days from the invoice date. If the total amount of an invoice delivered and not disputed by “The Client”, or any portion of it, is not paid to “The Provider” within the 20 (twenty) calendar days mentioned above, a late-payment interest of 10% (ten percent) per month will be charged on the past-due balance payable by “The Client” to “The Provider”, together with the principal amount stated on the respective invoice.
If the client cancels the service request, it must give 24 hours’ notice; otherwise, a service charge of $980.00 + VAT will apply for all processed personnel, even if no hiring takes place.
This quote does not include transportation.
This price is based on the defined profile, plant location, activities, salary, and operating and recruitment processes; if any of these change, the final price will need to be reassessed.
Any additional service not expressly stated in this document, such as special reports, personal protective equipment, boots, helmets, face shields, face masks, hairnets, caps, gloves, tools, etc., will require a separate quote and will be invoiced independently, subject to prior agreement with the client.
Criminal background letters are not included. If the client requires them, an additional quote will be needed.
---
## The guaranteed-hire modality includes:
Recruitment
File with basic documentation
Generic or client application form
3-panel drug test
## Shifts and schedules:
Monday to Thursday, 7:00 a.m. to 5:00 p.m., and Friday 7:00 a.m. to 3:00 p.m.
Monday to Thursday, 7:00 p.m. to 5:30 a.m.
Monday to Friday, 9:30 p.m. to 6:00 a.m.
## Salary:
Base salary $3,094 + $241 in vouchers, $2,845 net
## Recruitment details and profile:
Position: General helper
Openings: 10 to 15 people, to be confirmed by the client (prices in this quote are in Mexican pesos, per unit and per person)
Age: 18 to 45 years
Gender: Male
Education: Completed elementary school
Experience: No experience required. Good mobility, physical effort (proactive).
Documents:
- INE (voter ID)
- NSS (social security number)
- Birth certificate
- RFC (tax ID)
- CURP
- Proof of address
---
## Benefits:
Statutory benefits
Subsidized cafeteria
Grocery vouchers`,
  },
}

const HAATS_INTRO = {
  es: 'Nos es muy grato saludarles y agradecerles ampliamente la oportunidad que cada año nos brindan de seguir adelante con nuestra relación/alianza de negocio, la cual ha sido exitosa y satisfactoria para ambas partes durante los últimos años. Por lo cual presentamos nuestra propuesta de:',
  en: 'It is a great pleasure to greet you and thank you for the opportunity you give us each year to continue our business relationship and alliance, which has been successful and satisfying for both parties in recent years. We are therefore pleased to present our proposal for:',
}

const HAATS_TERMINOS = {
  es: [
    'Toda factura remitida será pagadera dentro de los 30 días de crédito acordados. En el supuesto de que el monto total de la factura entregada y no objetada por “El Cliente”, o cualquier porción de dicha factura no sea pagada a “El Proveedor” dentro del término de los días de crédito acordados antes citado, conllevará un cargo de interés moratorio del 10% (diez por ciento) mensual sobre el saldo vencido pagadero por “El Cliente” a “El Proveedor” en conjunto con la suerte principal consignada en la factura respectiva.',
    'Facturación en Pesos Moneda Nacional.',
    'En caso de que el cliente requiera apoyo de tiempo extra por parte de algún integrante del equipo, aplica costo adicional con el mismo valor del precio por hora por festivo laborado.',
    'Cualquier servicio adicional diverso a los expresamente señalados en el presente documento, tales como reportes especiales, servicio de transporte, equipo de protección personal, herramientas, etc.; serán motivo de una nueva cotización y facturados de manera independiente, previo acuerdo con el cliente.',
    'Cliente no podrá contactar a personal del Proveedor para trabajo en su plantilla. En caso de requerir la contratación directa del equipo de enfermería, tendrá que manejarse una cotización por la transferencia de personal.',
  ],
  en: [
    'Every invoice issued is payable within the 30 agreed credit days. If the total amount of an invoice delivered and not disputed by “The Client”, or any portion of it, is not paid to “The Provider” within the agreed credit days, a late-payment interest of 10% (ten percent) per month will be charged on the past-due balance payable by “The Client” to “The Provider”, together with the principal amount stated on the respective invoice.',
    'Invoicing in Mexican Pesos.',
    'If the client requires overtime support from any team member, an additional charge applies at the same rate as the hourly price for a worked holiday.',
    'Any additional service not expressly stated in this document, such as special reports, transportation, personal protective equipment, tools, etc., will require a new quote and will be invoiced separately, subject to prior agreement with the client.',
    'The Client may not recruit the Provider’s personnel for its own workforce. If the Client wishes to hire the nursing team directly, a personnel transfer quote will be required.',
  ],
}
const HAATS_FACTURACION_EU = {
  es: 'Ofrecemos facturación en Estados Unidos a través de nuestro corporativo, brindando mayor flexibilidad y facilidad para nuestros clientes internacionales, si lo desea, puede solicitar esta opción para optimizar sus procesos y reducir gastos.',
  en: 'We offer invoicing in the United States through our corporate office, providing greater flexibility for our international clients. You may request this option to streamline your processes and reduce costs.',
}
const HAATS_INCLUYE = (es: boolean, cobertura: string, personal: string, nomina: string) =>
  (es
    ? [cobertura, personal, '1 equipo celular para la plantilla.', '1 reloj checador.', 'Uniforme para personal fijo con logo de HAATS.', 'Completa administración y atención en los asuntos laborales del personal.', nomina, 'Incluye finiquito.', 'Responsabilidad y pago de todas las obligaciones patronales: IMSS, Infonavit e impuestos.', 'Protección legal-laboral.', 'Incluye el reclutamiento, filtro y preselección de las posiciones a ingresar por este servicio (cuando se requiera).']
    : [cobertura, personal, '1 mobile phone for the team.', '1 time clock.', 'Uniforms with the HAATS logo for full-time staff.', 'Full administration and handling of the staff’s labor matters.', nomina, 'Severance pay included.', 'Responsibility for and payment of all employer obligations: IMSS, Infonavit and taxes.', 'Legal and labor protection.', 'Includes recruitment, screening and pre-selection for the positions covered by this service (when required).']
  ).join('\n')
const HAATS_ADICIONALES = {
  es: `El personal del Proveedor se ajustará a los procesos internos del Cliente, apoyándose en instalaciones, formatos y herramientas que el Cliente le provea. Por lo cual, es responsabilidad del Cliente proveer las herramientas que se lleguen a necesitar para el desarrollo de las actividades y responsabilidad del Proveedor el cuidado y administración de las mismas.
Los servicios profesionales de enfermería objeto de la presente cotización serán prestados directamente a Usted por personal debidamente autorizado para el ejercicio de su profesión. El profesionista asignado será el único responsable sanitario de los servicios de enfermería y cuidado de la salud que sean requeridos por el cliente, por lo que TREVE no asume ni asumirá ninguna responsabilidad derivada de las recomendaciones, cuidados o acciones realizadas por el personal de enfermería asignado al cliente, quien deberá verificar que dichos servicios se lleven a cabo de conformidad con lo establecido en la NOM-019-SSA3-2013.`,
  en: `The Provider’s staff will follow the Client’s internal processes, using the facilities, forms and tools provided by the Client. The Client is therefore responsible for providing the tools needed to carry out the activities, and the Provider is responsible for their care and management.
The professional nursing services in this quote will be provided directly to you by staff duly authorized to practice their profession. The assigned professional will be solely responsible, from a health standpoint, for the nursing and healthcare services required by the client; therefore, TREVE does not and will not assume any liability arising from the recommendations, care or actions of the nursing staff assigned to the client, who must ensure that these services are performed in accordance with Mexican standard NOM-019-SSA3-2013.`,
}

function seccionesHaats(idioma: Idioma, mensual: boolean): string {
  const es = idioma === 'es'
  const terminos = [...HAATS_TERMINOS[idioma], ...(mensual ? [HAATS_FACTURACION_EU[idioma]] : [])].join('\n')
  const incluye = mensual
    ? HAATS_INCLUYE(es, es ? 'Personal las 24 horas, 7 días de la semana.' : '24/7 staffing.', es ? '2 enfermeros fijos (uno por turno).' : '2 full-time nurses (one per shift).', es ? 'Pago de nómina semanal, incluyendo cuotas patronales.' : 'Weekly payroll, including employer contributions.')
    : HAATS_INCLUYE(es, es ? 'Personal las 12 horas.' : '12-hour staffing.', es ? '1 enfermero fijo (uno por turno).' : '1 full-time nurse (one per shift).', es ? 'Pago de nómina, incluyendo cuotas patronales.' : 'Payroll, including employer contributions.')
  return [
    es ? '## TÉRMINOS Y CONDICIONES:' : '## TERMS AND CONDITIONS:',
    terminos,
    '---',
    es ? '## COTIZACIÓN INCLUYE:' : '## THIS QUOTE INCLUDES:',
    incluye,
    es ? '## ADICIONALES' : '## ADDITIONAL TERMS',
    HAATS_ADICIONALES[idioma],
  ].join('\n')
}

function textosHaats(mensual: boolean): Textos<HaatsBase> {
  const t = (idioma: Idioma): Partial<HaatsBase> => ({
    cargo: idioma === 'es' ? 'Recursos Humanos' : 'Human Resources',
    intro: HAATS_INTRO[idioma],
    tituloTabla: mensual
      ? idioma === 'es' ? 'Servicio Especializado de Enfermería' : 'Specialized Nursing Service'
      : idioma === 'es' ? 'Servicio de enfermería por tiempo extra por horas' : 'Overtime nursing service by the hour',
    notaPrecios: idioma === 'es' ? 'Precios en Pesos + IVA' : 'Prices in Mexican Pesos + VAT',
    secciones: seccionesHaats(idioma, mensual),
    firmante: idioma === 'es' ? 'Ejecutivo de Cuenta' : 'Account Executive',
  })
  return { es: t('es'), en: t('en') }
}
const HAATS_MENSUAL = textosHaats(true) as Textos<HaatsMensualData>
const HAATS_HORAS = textosHaats(false) as Textos<HaatsHorasData>

const TEXTOS: { [K in PlantillaId]: Textos<Datos[K]> } = {
  feedbak: FEEDBAK,
  servicios: SERVICIOS,
  payroll: PAYROLL,
  gmm: GMM,
  bonos: BONOS,
  estudios: ESTUDIOS,
  reclutamiento: RECLUTAMIENTO,
  haatsMensual: HAATS_MENSUAL,
  haatsHoras: HAATS_HORAS,
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
      intro: '',
      titulo: '',
      notaMontos: '',
      terminos: '',
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
    estudios: {
      ...comun,
      idioma: 'es',
      ciudad: 'Tijuana, Baja California',
      servicios: [
        { cantidad: '6', descripcion: 'Comprobaciones domiciliarias', precio: '650', precioEspecial: '477' },
        { cantidad: '8', descripcion: 'Cartas de antecedentes no penales', precio: '849', precioEspecial: '465' },
      ],
      iva: '16',
      minimoEspecial: '20',
      firmante: 'Customer Services',
      tituloPortada: '',
      intro: '',
      notaPrecios: '',
      detalle: '',
      notas: '',
      terminos: '',
      ...ESTUDIOS.es,
    },
    reclutamiento: {
      ...comun,
      idioma: 'es',
      ciudad: 'Tijuana, Baja California',
      posiciones: [{ posicion: 'Ayudantes generales', modalidad: 'Contratado garantía 5 días', precioRegular: '2530', precioPromo: '2145' }],
      firmante: 'Customer Service',
      tituloPortada: '',
      cargo: '',
      intro: '',
      notaPrecios: '',
      secciones: '',
      ...RECLUTAMIENTO.es,
    },
    haatsMensual: {
      ...comun,
      tratamiento: 'Estimado',
      idioma: 'es',
      ciudad: 'Tijuana, B.C.',
      periodos: [
        { periodo: '17 de junio al 17 de julio', mensualidad: '105996.34', precioHora: '210.90', credito: '30 días' },
        { periodo: '17 de julio al 17 de agosto', mensualidad: '105996.34', precioHora: '210.90', credito: '30 días' },
        { periodo: '17 de agosto al 17 de septiembre', mensualidad: '105996.34', precioHora: '210.90', credito: '30 días' },
      ],
      firmantePuesto: 'Customer Service',
      firmante: '',
      cargo: '',
      intro: '',
      tituloTabla: '',
      notaPrecios: '',
      secciones: '',
      ...HAATS_MENSUAL.es,
    },
    haatsHoras: {
      ...comun,
      tratamiento: 'Estimado',
      idioma: 'es',
      ciudad: 'Tijuana, B.C.',
      filas: [{ horas: '288', turno: 'Diurno y nocturno', precioHora: '157.25' }],
      firmantePuesto: 'Customer Service',
      firmante: '',
      cargo: '',
      intro: '',
      tituloTabla: '',
      notaPrecios: '',
      secciones: '',
      ...HAATS_HORAS.es,
    },
  }
}

/** Sustituye {clave} por su valor; las claves desconocidas quedan intactas. */
export function rellenar(texto: string, vars: Record<string, string>): string {
  return texto.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? vars[k] : m))
}
