import type { Idioma } from './modelo'

/**
 * Contratos (licencia Feedbak y NDA). El cuerpo es texto por líneas:
 *   "## Título"   cláusula numerada automáticamente
 *   "### Título"  subtítulo sin número
 *   "- texto"     inciso a), b), c)…
 *   otra línea    párrafo
 * Los {tokens} se llenan con los datos del formulario.
 */

interface ContratoBase {
  idioma: Idioma
  /** Fecha de firma / entrada en vigor. */
  fecha: string
  /** Razón social del cliente. */
  empresa: string
  /** Representante legal del cliente. */
  contacto: string
  /** Representante legal del proveedor (firma). */
  firmante: string
  /** No se usa en contratos; existe para compartir la interfaz con las cotizaciones. */
  tratamiento: string
  proveedor: string
  titulo: string
  cuerpo: string
}

export interface ContratoLicenciaData extends ContratoBase {
  numero: string
  vigencia: 'anual' | 'semestral'
  testigoCliente: string
  testigoProveedor: string
}

export interface NdaData extends ContratoBase {
  subtitulo: string
  /** Representantes del proveedor responsables de la información. */
  representantesProveedor: string
  direccionProveedor: string
  direccionCliente: string
  testigo: string
}

type Textos<T> = Record<Idioma, Partial<T>>

export const LICENCIA: Textos<ContratoLicenciaData> = {
  es: {
    titulo:
      'CONTRATO DE LICENCIA Y SERVICIOS DE DESARROLLO DE MÓDULOS DE SOFTWARE QUE CELEBRAN POR UNA PARTE {proveedor}, REPRESENTADA POR {representanteProveedor}, EN LO SUCESIVO “FEEDBAK” O “EL DESARROLLADOR”, Y POR LA OTRA {cliente}, EN LO SUCESIVO “EL CLIENTE” O “USTED”, AL TENOR DE LAS SIGUIENTES DECLARACIONES Y CLÁUSULAS.',
    cuerpo: `## Definiciones del Contrato.
“Usted”, “Cliente” y “su” se refieren a la persona física o jurídica que ha celebrado este contrato (“contrato”) y solicitado programas y/o servicios a “FEEDBAK” respecto del licenciamiento de productos de software y servicios de soporte del desarrollador de las plataformas y aplicaciones electrónicas propiedad de “FEEDBAK”, incluyendo de manera enunciativa más no limitativa la plataforma “Mi Kiosko®” y sus módulos.
“Programas Complementarios” se refiere a materiales de terceros especificados en la documentación del programa, los cuales podrán ser utilizados con la finalidad de instalar u operar los programas que se entregan junto con los programas complementarios.
“Documentación del programa” se refiere al manual de usuario y a los manuales de instalación del programa.
“Programa(s)” se refiere a los productos de software, plataformas y aplicaciones electrónicas propiedad de “FEEDBAK”, que “Usted” ha solicitado, la documentación del programa, el desarrollo de módulos y atributos especiales requeridos por “Usted”, el desarrollo de nuevos programas, plataformas o sistemas con las especificaciones o requerimientos del Cliente y cualquier actualización del programa adquirido por medio de Soporte Técnico y/o que efectúe “FEEDBAK” por cualquier motivo.
“Servicio” se refiere a soporte técnico, desarrollo de software, modificación de plataformas electrónicas, consultoría, educación, servicios de computación y administración externa o remota o cualquier otro servicio que “Usted” haya solicitado o solicite a “FEEDBAK”.
“Cotización, carátula o Documento de Pedido” se refiere a la propuesta presentada previo a la firma del presente contrato y anexada a este documento (“Anexo 1”), que una vez aceptada por Usted forma parte integral del mismo, en la que se describe el nombre o razón social de “Usted” o el cliente, su domicilio, datos de facturación, datos de contacto, descripción de los módulos, programas y productos objeto de licenciamiento del presente contrato, vigencia de la licencia, contraprestación y forma de pago, así como otros detalles inherentes al licenciamiento de software.
## Vigencia del Contrato.
Este contrato es aplicable y tendrá vigencia inicial {vigencia} a partir de su suscripción, la cual se acuerda es el día {inicio}, siendo la terminación de vigencia el día {renovacion}; sin embargo, ambas partes acuerdan que el mismo podrá prorrogarse por un periodo indeterminado, siempre que las partes se encuentren al corriente de sus obligaciones de pago periódicas y/o exista algún requerimiento de actualización, desarrollo y/o continuidad de licenciamiento por parte del Cliente.
Sin perjuicio de lo anterior, cualquiera de las Partes podrá concluir el presente Contrato mediante un aviso previo por escrito dirigido a la contraparte con por lo menos 30 (treinta) días de anticipación a la fecha de terminación efectiva.
## Licenciamiento.
Una vez aceptada y firmada su orden y el presente instrumento, {proveedor} le otorga a {cliente} licencia de uso limitada, onerosa, por tiempo determinado, no exclusiva y no cedible, para usar los programas y módulos del sistema de software, así como el acceso a las aplicaciones y plataformas de “FEEDBAK” que “Usted” haya ordenado y/o sean desarrolladas específicamente por “FEEDBAK” de conformidad con sus requerimientos y necesidades específicas, únicamente para sus operaciones internas de negocio y sujeto a los términos de este contrato, las definiciones y reglas de licenciamiento, la cotización y la documentación del programa.
“Usted” podrá permitir a sus agentes y contratistas (incluyendo sin limitaciones a sus agentes externos o subcontratistas) usar los programas para este propósito y “Usted” será responsable del cumplimiento por ellos de este contrato respecto de tal uso. Para los programas específicamente diseñados para permitir interactuar con sus colaboradores y empleados en apoyo a sus operaciones internas de negocio, particularmente la administración y control de capital humano, dicho uso estará permitido bajo los términos de este contrato.
La documentación del programa será enviada con los programas, o “Usted” podrá acceder a la documentación en línea a través de nuestra página web.
Los servicios de soporte complementarios se prestarán conforme a las políticas de {proveedor}, las cuales están sujetas a cambios.
A la firma del presente instrumento Usted acepta incondicionalmente que en caso de mora, falta de pago de la cuota o tarifa de licenciamiento, o en el evento de que una vez concluido el periodo de vigencia Usted no renueve en tiempo y forma el periodo de licenciamiento, se interrumpirá automáticamente el acceso al sistema y funciones del programa, mismas que se restablecerán dentro de los 5 (cinco) días siguientes a la fecha en que haya cubierto la tarifa de renovación o extensión de la presente licencia, en caso de que aplique.
## Propiedad y Restricciones.
“FEEDBAK” se reserva los derechos de propiedad intelectual y patrimonial sobre los programas. “FEEDBAK” retiene la titularidad y derechos de propiedad intelectual sobre cualquier material desarrollado y entregado bajo este contrato que resulte de la prestación de servicios.
- “Usted” no podrá remover o modificar cualquier marca del programa, o avisos de los derechos de propiedad de “FEEDBAK” o de sus licenciantes;
- “Usted” no podrá proporcionar los programas o los materiales que resulten de los servicios de cualquier manera a un tercero para el uso en las operaciones de negocio de dicho tercero (a menos que dicho acceso se encuentre expresamente permitido por la licencia del programa específico o de los materiales resultado de los servicios que “Usted” haya adquirido);
- “Usted” no deberá realizar o permitir ingeniería inversa, desencriptado o descompilación de los programas (esta prohibición incluye sin limitar la revisión de la estructura de los sistemas o materiales similares producidos por los programas);
- “Usted” no podrá revelar los resultados de pruebas de rendimiento de cualquier programa sin el consentimiento previo y por escrito de “FEEDBAK”.
## Garantías, Renuncias y Recursos Exclusivos.
“FEEDBAK” garantiza que el programa licenciado a “Usted” de conformidad con el presente contrato funcionará de manera adecuada conforme a su programación, siempre que Usted cuente con el equipo con la capacidad que sea recomendada por “FEEDBAK” para correr los programas de manera idónea, a partir de la fecha de activación de su licencia.
“Usted” deberá notificar a “FEEDBAK” cualquier deficiencia del programa conforme a las garantías de éste dentro de los 3 (tres) meses a partir de que se presente la deficiencia o falla en el programa.
“FEEDBAK” también garantiza que los servicios serán prestados en forma profesional de conformidad con los estándares de la industria. “Usted” deberá notificar a “FEEDBAK” cualquier deficiencia de los servicios conforme a la garantía de los servicios dentro de un término de 90 días contados a partir de la prestación del respectivo servicio deficiente.
“FEEDBAK” no garantiza que los programas funcionarán libres de errores en forma ininterrumpida, o que “FEEDBAK” corregirá todos los errores de los programas.
En caso de que “FEEDBAK” incumpla con alguna de las anteriores garantías, su recurso exclusivo y la responsabilidad total de “FEEDBAK” será la siguiente:
- La corrección de los errores de los programas que causen el incumplimiento de la garantía. En caso de que “FEEDBAK” no pueda corregir substancialmente tal incumplimiento de forma comercialmente razonable, “Usted” podrá terminar su licencia de programa.
Hasta donde no lo prohíba la ley, estas garantías son exclusivas y no existen otras garantías o condiciones expresas o implícitas, incluyendo garantías o condiciones de comerciabilidad y adecuación a un fin particular.
## Desarrollo de Programas o Módulos.
Durante la vigencia del presente instrumento “Usted” podrá ordenar modificaciones a los programas o módulos de las plataformas de “FEEDBAK”, quien se reserva el derecho de realizar las modificaciones que sean requeridas o sugeridas por el cliente y/o en su caso desarrollar nuevas aplicaciones tendientes a satisfacer los requerimientos del cliente. “Usted” cuenta con un término de 30 días a partir de la fecha de entrega para evaluar estos programas; si “Usted” decide utilizar cualquiera de estos programas después de rebasar el periodo de prueba, “Usted” deberá obtener de “FEEDBAK” una ampliación de la licencia de uso para dichos programas o módulos en lo particular. En tanto no exista un acuerdo de ampliación de licencia de uso para los módulos, plataformas o modificaciones a los sistemas de “FEEDBAK”, cualquier autorización de uso de la versión beta o programa licenciado con fines de prueba se otorga sin garantía alguna y no tendrá soporte técnico.
## Indemnización.
Si un tercero reclama, ya sea en contra de “Usted” o de “FEEDBAK” (“Receptor”, término que puede referirse a “Usted” o a “FEEDBAK” dependiendo de quién sea la parte que recibe el Material), que cualquier información, diseño, instrucción, especificación, software, dato o material (conjuntamente el “Material”) proporcionado ya sea por “Usted” o por “FEEDBAK” (“Proveedor”, término que puede referirse a “Usted” o a “FEEDBAK” dependiendo de quién sea la parte que proporciona el Material) y utilizado por “el Receptor” infringe sus derechos de propiedad intelectual, “el Proveedor”, bajo su propio costo, defenderá a “el Receptor” de cualquier reclamación y lo indemnizará por los daños, responsabilidad, costos y gastos determinados por la autoridad judicial correspondiente como resultado de la reclamación del tercero o del convenio conciliatorio acordado por “el Proveedor”, siempre y cuando “el Receptor”:
- Notifique al Proveedor inmediatamente y por escrito de la reclamación, en un plazo no mayor a 30 días contados a partir de que el Receptor reciba la notificación de la reclamación;
- Otorgue al Proveedor el control absoluto de la defensa y de cualquier transacción o negociación conciliatoria; y,
- Otorgue al Proveedor la información, autoridad, facultades y asistencia necesaria para defender o conciliar la reclamación.
## Soporte Técnico y Desarrollo.
El Soporte Técnico y Desarrollo consiste en servicios de soporte técnico, programación y reprogramación periódicos que “Usted” haya ordenado para los programas, módulos o plataformas electrónicas de “FEEDBAK”. Si se ordena, el Soporte Técnico se prestará conforme a la disponibilidad y políticas de Soporte Técnico vigentes al momento en que se prestan los servicios. Las políticas de soporte técnico de “FEEDBAK” incorporadas en este contrato se encuentran sujetas a cambios a discreción de “FEEDBAK”; sin embargo, los cambios en las políticas de “FEEDBAK” no resultarán en una reducción de los servicios prestados para los programas soportados durante el periodo por el que las tarifas de Soporte Técnico hayan sido pagadas. “Usted” deberá revisar dichas políticas antes de contratar los servicios de Soporte Técnico.
El Soporte Técnico estará vigente desde la fecha de entrada en vigor del documento de pedido, salvo que se establezca de otra forma en su orden.
Las partes reconocen y acuerdan que el presente instrumento constituye un contrato de licenciamiento y prestación de servicios, y no así un contrato de autoría o creación y desarrollo de obra por cuenta y orden de Usted, por lo que cualquier desarrollo, adaptación, habilitación o modificación de los programas, módulos y plataformas electrónicas que sean desarrolladas o licenciadas por “FEEDBAK” en términos del presente instrumento a favor del Cliente, salvo acuerdo en contrario por escrito, son y serán propiedad exclusiva de “FEEDBAK”, quien se reserva en todo momento los derechos autorales y patrimoniales como desarrollador y creador de las mismas, por lo que podrá disponer libremente de ellos para todos los fines, y Usted no tendrá derecho a percibir regalía, cuota o reconocimiento de derecho alguno sobre los desarrollos y programas de “FEEDBAK”.
A la firma del presente instrumento Usted renuncia a cualquier derecho autoral o de exclusividad que pudiera corresponderle.
## Terminación del Contrato por Incumplimiento.
Si cualquiera de las partes incumple con algún término de este contrato y no subsana dicho incumplimiento dentro de los 30 días siguientes contados a partir de la notificación dada por escrito donde se especifique el incumplimiento, la parte responsable se encontrará en incumplimiento y la parte afectada podrá dar por terminado el presente contrato.
Si “FEEDBAK” termina el presente contrato conforme a lo establecido anteriormente, “Usted” deberá pagar dentro de los siguientes 30 días las sumas que se hayan generado hasta el momento de dicha terminación, así como todas las cantidades que se encuentren pendientes de pago por los programas y/o servicios recibidos bajo el presente contrato, más los correspondientes impuestos y gastos.
Si “FEEDBAK” termina la licencia del programa conforme a la sección “Indemnización”, “Usted” deberá pagar en un término de 30 días las cantidades que se encuentren pendientes de pago por los servicios relacionados con dicha licencia, más los impuestos y gastos relacionados. Excepto por la falta de pago, la parte afectada por un incumplimiento podrá, a su discreción, ampliar el plazo de 30 días en tanto la parte que incumple continúe haciendo esfuerzos razonables para subsanar el incumplimiento. “Usted” acepta que, si incumple algún término del presente contrato, no podrá usar los programas ni recibirá los servicios ordenados.
## Contraprestación por los Servicios, Tarifas e Impuestos.
Todas las tarifas por concepto de licenciamiento y/o servicios de “FEEDBAK” deberán ser pagadas en un plazo de 7 (siete) días naturales contados a partir de la fecha de facturación de los mismos.
“Usted” acepta que cualquier usuario adicional que supere el número de licencias adquiridas será facturado de acuerdo con el precio base por usuario establecido en el Anexo 1, el cual deberá ser pagado en un plazo de 7 (siete) días naturales a partir de la fecha de facturación. En caso de no realizar el pago dentro del plazo indicado, se aplicará un interés moratorio mensual del 10%. Esta tarifa se aplicará hasta que “El Cliente” decida ajustar el número de usuarios de su licenciamiento, ya sea reduciéndolo o ampliándolo.
## Información Confidencial.
En virtud del presente contrato las partes pueden tener acceso a información confidencial de las mismas (“Información Confidencial”). Las partes convienen revelar solo la información que sea requerida para el cumplimiento de las obligaciones conforme a este contrato. Dicha Información Confidencial quedará limitada a los términos y precios del presente contrato, así como a toda aquella información que se identifique claramente como confidencial al momento de su revelación.
La Información Confidencial de una de las partes no incluirá información que:
- Es o llegue a ser del dominio público por causa distinta de la acción u omisión de la otra parte;
- Estuviera en posesión legítima de la otra parte antes de su revelación, y no hubiera sido obtenida por la otra parte directa o indirectamente de la parte reveladora;
- Es legítimamente revelada a la otra parte por una tercera persona sin restricciones de revelación;
- Es independientemente desarrollada por la otra parte.
Cada una de las partes acuerda mantener la confidencialidad de la Información Confidencial de la otra durante un periodo de 5 (cinco) años contados a partir de la fecha de revelación. De igual forma, cada una de las partes acuerda revelar la Información Confidencial solamente a aquellos empleados o agentes que estén obligados a protegerla contra su revelación no autorizada.
## Limitación de Responsabilidad.
Ninguna de las partes será responsable por cualquier daño indirecto, incidental, especial, punitivo o consecuente por lucro cesante, pérdida de ingresos, información o uso de información. La responsabilidad máxima de “FEEDBAK” por cualquier daño y perjuicio relacionado con el presente contrato o sus documentos de pedido, ya sea contractual, extracontractual u otra, estará limitada al monto de las tarifas que “Usted” le haya pagado a “FEEDBAK” bajo este contrato, y si dichos daños y perjuicios resultan de su uso de los programas o servicios, dicha responsabilidad estará limitada a las tarifas que “Usted” le haya pagado a “FEEDBAK” por el programa o servicio deficiente que da origen a la responsabilidad.
## Otros.
- Este contrato se regirá conforme a las leyes sustantivas en materia de propiedad intelectual e industrial, así como el Código de Comercio. “Usted” y “FEEDBAK” acuerdan someterse a la jurisdicción exclusiva de los tribunales competentes de la ciudad de Tijuana, Baja California, para cualquier controversia relacionada con este contrato.
- “Usted” no podrá ceder el presente contrato, ni otorgar o transferir los programas y/o servicios, o un interés o derecho sobre los mismos, a otra persona física o moral.
- Previa notificación dada por escrito con 15 días de anticipación, “FEEDBAK” podrá auditar su uso de los programas. “Usted” acepta cooperar con la auditoría de “FEEDBAK” y proporcionarle la asistencia que sea necesaria y el acceso a la información que sea requerida. Dicha auditoría no interferirá irracionalmente con sus operaciones internas de negocio. “Usted” acepta pagar, dentro de los 15 días siguientes a la notificación dada en tal sentido por escrito, las tarifas correspondientes al uso de los programas que como resultado de la auditoría se revele que no le han sido pagadas a “FEEDBAK”. En caso de omisión de pago, “FEEDBAK” podrá terminar su Soporte Técnico, las licencias y/o este contrato. “Usted” acepta que “FEEDBAK” no será responsable de cualquiera de los costos en que “Usted” haya incurrido en la cooperación con la auditoría.
- Los programas, módulos, aplicaciones electrónicas, desarrollo de software y adecuaciones objeto de licenciamiento, desarrollo y/o modificación al amparo del presente instrumento se encuentran autorizados por “FEEDBAK” para ser utilizados única y exclusivamente en México, por lo que Usted reconoce la existencia de normas y reglamentos inherentes a la exportación y/o uso de programas electrónicos en jurisdicciones extranjeras, y acepta cumplir en todo momento con las normatividades vigentes, tanto nacionales como internacionales, en materia de uso y exportación de software, obligándose a no exportar directa o indirectamente datos en violación de dichas leyes.
## Definiciones y Reglas de Licenciamiento.
### Definiciones
Documentación del programa: se define como el manual de usuario del Programa y los manuales de instalación del Programa.
Usuarios de Aplicaciones: será la persona autorizada por el cliente para hacer uso de los programas y aplicaciones instaladas en uno o varios servidores al amparo del presente contrato.
### Designación de Plazos
El plazo de la(s) licencia(s) otorgada(s) al tenor del presente contrato será(n) permanente(s) a partir de la suscripción del presente instrumento, sin perjuicio de que los servicios de actualización y mantenimiento tendrán una vigencia anual, y los mismos se podrán prorrogar por un periodo indeterminado, siempre que las partes se encuentren al corriente de sus obligaciones, particularmente la obligación de pago prevista en el presente instrumento y/o su documento de pedido; en caso de que no exista prórroga, las licencias objeto del presente instrumento terminarán.`,
  },
  en: {
    titulo:
      'SOFTWARE LICENSE AND MODULE DEVELOPMENT SERVICES AGREEMENT ENTERED INTO BY {proveedor}, REPRESENTED BY {representanteProveedor}, HEREINAFTER “FEEDBAK” OR “THE DEVELOPER”, AND {cliente}, HEREINAFTER “THE CLIENT” OR “YOU”, IN ACCORDANCE WITH THE FOLLOWING STATEMENTS AND CLAUSES.',
    cuerpo: `## Definitions.
“You”, “Client” and “your” refer to the individual or legal entity that has entered into this agreement (“agreement”) and requested programs and/or services from “FEEDBAK” regarding the licensing of software products and developer support services for the platforms and electronic applications owned by “FEEDBAK”, including, without limitation, the “Mi Kiosko®” platform and its modules.
“Complementary Programs” refers to third-party materials specified in the program documentation, which may be used to install or operate the programs delivered together with the complementary programs.
“Program Documentation” refers to the user manual and the program installation manuals.
“Program(s)” refers to the software products, platforms and electronic applications owned by “FEEDBAK” that “You” have requested, the program documentation, the development of modules and special features required by “You”, the development of new programs, platforms or systems according to the Client’s specifications or requirements, and any update to the acquired program provided through Technical Support and/or made by “FEEDBAK” for any reason.
“Service” refers to technical support, software development, modification of electronic platforms, consulting, training, computing services and external or remote administration, or any other service that “You” have requested or request from “FEEDBAK”.
“Quote, cover sheet or Order Document” refers to the proposal submitted before signing this agreement and attached to it (“Exhibit 1”), which, once accepted by You, forms an integral part of it, and which describes the name or corporate name of “You” or the client, address, billing and contact information, description of the modules, programs and products licensed under this agreement, license term, consideration and payment terms, as well as other details inherent to the software license.
## Term of the Agreement.
This agreement shall have an initial {vigencia} term from its execution, which the parties agree is {inicio}, ending on {renovacion}; however, both parties agree that it may be extended for an indefinite period, provided that the parties are current on their periodic payment obligations and/or the Client has a requirement for updates, development and/or continued licensing.
Notwithstanding the foregoing, either Party may terminate this Agreement by giving the other party written notice at least 30 (thirty) days before the effective termination date.
## Licensing.
Once your order and this instrument have been accepted and signed, {proveedor} grants {cliente} a limited, paid, fixed-term, non-exclusive and non-transferable license to use the programs and modules of the software system, as well as access to the “FEEDBAK” applications and platforms that “You” have ordered and/or that are developed specifically by “FEEDBAK” according to your specific requirements and needs, solely for your internal business operations and subject to the terms of this agreement, the licensing definitions and rules, the quote and the program documentation.
“You” may allow your agents and contractors (including, without limitation, your outsourcers and subcontractors) to use the programs for this purpose, and “You” will be responsible for their compliance with this agreement in such use. For programs specifically designed to interact with your collaborators and employees in support of your internal business operations, particularly human capital management and control, such use will be permitted under the terms of this agreement.
The program documentation will be delivered with the programs, or “You” may access it online through our website.
Complementary support services will be provided in accordance with the policies of {proveedor}, which are subject to change.
By signing this instrument, You unconditionally accept that in the event of late payment or non-payment of the license fee, or if once the term ends You do not renew the license period in a timely manner, access to the system and program functions will be automatically suspended and will be restored within 5 (five) days after you have paid the renewal or extension fee for this license, if applicable.
## Ownership and Restrictions.
“FEEDBAK” reserves the intellectual and economic property rights over the programs. “FEEDBAK” retains title and intellectual property rights over any material developed and delivered under this agreement as a result of the services provided.
- “You” may not remove or modify any program trademark or notice of the property rights of “FEEDBAK” or its licensors;
- “You” may not provide the programs or the materials resulting from the services in any way to a third party for use in that third party’s business operations (unless such access is expressly permitted by the license for the specific program or service materials “You” have acquired);
- “You” may not reverse engineer, decrypt or decompile the programs, or allow others to do so (this prohibition includes, without limitation, reviewing the structure of the systems or similar materials produced by the programs);
- “You” may not disclose the results of performance tests of any program without the prior written consent of “FEEDBAK”.
## Warranties, Disclaimers and Exclusive Remedies.
“FEEDBAK” warrants that the program licensed to “You” under this agreement will operate properly according to its programming, provided that You have equipment with the capacity recommended by “FEEDBAK” to run the programs properly, from the license activation date.
“You” must notify “FEEDBAK” of any program deficiency under these warranties within 3 (three) months after the deficiency or failure occurs.
“FEEDBAK” also warrants that the services will be performed in a professional manner in accordance with industry standards. “You” must notify “FEEDBAK” of any service deficiency under the services warranty within 90 days after the deficient service was performed.
“FEEDBAK” does not warrant that the programs will operate error-free or uninterrupted, or that “FEEDBAK” will correct all program errors.
If “FEEDBAK” breaches any of the above warranties, your exclusive remedy and the entire liability of “FEEDBAK” will be the following:
- Correction of the program errors that cause the breach of warranty. If “FEEDBAK” cannot substantially correct such breach in a commercially reasonable manner, “You” may terminate your program license.
To the extent not prohibited by law, these warranties are exclusive and there are no other express or implied warranties or conditions, including warranties or conditions of merchantability and fitness for a particular purpose.
## Development of Programs or Modules.
During the term of this instrument, “You” may order modifications to the programs or modules of the “FEEDBAK” platforms, and “FEEDBAK” reserves the right to make the modifications required or suggested by the client and/or, where appropriate, to develop new applications to meet the client’s requirements. “You” will have 30 days from the delivery date to evaluate these programs; if “You” decide to use any of them after the trial period, “You” must obtain from “FEEDBAK” an extension of the license to use such programs or modules. Until there is an agreement to extend the license for the modules, platforms or modifications to the “FEEDBAK” systems, any authorization to use the beta version or program licensed for testing purposes is granted without any warranty and without technical support.
## Indemnification.
If a third party claims against “You” or “FEEDBAK” (“Recipient”, a term that may refer to “You” or “FEEDBAK” depending on which party receives the Material) that any information, design, instruction, specification, software, data or material (together, the “Material”) provided by either “You” or “FEEDBAK” (“Provider”, a term that may refer to “You” or “FEEDBAK” depending on which party provides the Material) and used by “the Recipient” infringes its intellectual property rights, “the Provider”, at its own expense, will defend “the Recipient” against any claim and indemnify it for the damages, liability, costs and expenses determined by the competent judicial authority as a result of the third-party claim or of the settlement agreed by “the Provider”, provided that “the Recipient”:
- Notifies the Provider immediately and in writing of the claim, within no more than 30 days after the Recipient receives notice of the claim;
- Gives the Provider full control of the defense and of any settlement or negotiation; and,
- Gives the Provider the information, authority, powers and assistance needed to defend or settle the claim.
## Technical Support and Development.
Technical Support and Development consists of periodic technical support, programming and reprogramming services that “You” have ordered for the “FEEDBAK” programs, modules or electronic platforms. If ordered, Technical Support will be provided in accordance with the Technical Support availability and policies in effect when the services are provided. The “FEEDBAK” technical support policies incorporated into this agreement are subject to change at the discretion of “FEEDBAK”; however, changes to those policies will not result in a reduction of the services provided for the supported programs during the period for which the Technical Support fees have been paid. “You” should review those policies before contracting Technical Support services.
Technical Support will be in effect from the effective date of the order document, unless otherwise stated in your order.
The parties acknowledge and agree that this instrument is a licensing and services agreement, and not an agreement for authorship or for the creation and development of a work on your behalf; therefore, any development, adaptation, enablement or modification of the programs, modules and electronic platforms developed or licensed by “FEEDBAK” under this instrument in favor of the Client, unless otherwise agreed in writing, are and will be the exclusive property of “FEEDBAK”, which at all times reserves the moral and economic rights as their developer and creator and may freely dispose of them for all purposes, and You will not be entitled to any royalty, fee or recognition of any right over the developments and programs of “FEEDBAK”.
By signing this instrument, You waive any copyright or exclusivity right that may correspond to you.
## Termination for Breach.
If either party breaches any term of this agreement and does not cure the breach within 30 days after written notice specifying the breach, the breaching party will be in default and the affected party may terminate this agreement.
If “FEEDBAK” terminates this agreement as set forth above, “You” must pay within the following 30 days the amounts accrued up to the time of termination, as well as all amounts outstanding for the programs and/or services received under this agreement, plus the corresponding taxes and expenses.
If “FEEDBAK” terminates the program license under the “Indemnification” section, “You” must pay within 30 days the amounts outstanding for the services related to that license, plus related taxes and expenses. Except for non-payment, the party affected by a breach may, at its discretion, extend the 30-day period as long as the breaching party continues to make reasonable efforts to cure the breach. “You” agree that if you breach any term of this agreement, you may not use the programs or receive the ordered services.
## Consideration for Services, Fees and Taxes.
All license and/or service fees of “FEEDBAK” must be paid within 7 (seven) calendar days from their invoice date.
“You” agree that any additional user exceeding the number of licenses acquired will be invoiced at the base price per user set forth in Exhibit 1, payable within 7 (seven) calendar days from the invoice date. If payment is not made within that period, a monthly late-payment interest of 10% will apply. This fee will apply until “The Client” decides to adjust the number of users in its license, either by reducing or increasing it.
## Confidential Information.
Under this agreement the parties may have access to each other’s confidential information (“Confidential Information”). The parties agree to disclose only the information required to perform their obligations under this agreement. Such Confidential Information will be limited to the terms and prices of this agreement, as well as any information clearly identified as confidential at the time of disclosure.
A party’s Confidential Information will not include information that:
- Is or becomes public knowledge through no act or omission of the other party;
- Was lawfully in the other party’s possession before disclosure and was not obtained, directly or indirectly, from the disclosing party;
- Is lawfully disclosed to the other party by a third party without disclosure restrictions;
- Is independently developed by the other party.
Each party agrees to keep the other party’s Confidential Information confidential for a period of 5 (five) years from the date of disclosure. Likewise, each party agrees to disclose Confidential Information only to those employees or agents who are obligated to protect it against unauthorized disclosure.
## Limitation of Liability.
Neither party will be liable for any indirect, incidental, special, punitive or consequential damages for lost profits, lost revenue, information or use of information. The maximum liability of “FEEDBAK” for any damages related to this agreement or its order documents, whether in contract, tort or otherwise, will be limited to the fees “You” have paid to “FEEDBAK” under this agreement, and if such damages result from your use of the programs or services, such liability will be limited to the fees “You” have paid to “FEEDBAK” for the deficient program or service giving rise to the liability.
## Miscellaneous.
- This agreement will be governed by the substantive laws on intellectual and industrial property and by the Mexican Commercial Code. “You” and “FEEDBAK” agree to submit to the exclusive jurisdiction of the competent courts of the city of Tijuana, Baja California, for any dispute related to this agreement.
- “You” may not assign this agreement, or grant or transfer the programs and/or services, or any interest or right in them, to any other individual or legal entity.
- With 15 days’ prior written notice, “FEEDBAK” may audit your use of the programs. “You” agree to cooperate with the “FEEDBAK” audit and to provide the necessary assistance and access to the information required. The audit will not unreasonably interfere with your internal business operations. “You” agree to pay, within 15 days after written notice, the fees for any use of the programs that the audit reveals has not been paid to “FEEDBAK”. If payment is not made, “FEEDBAK” may terminate your Technical Support, the licenses and/or this agreement. “You” agree that “FEEDBAK” will not be responsible for any costs “You” incur in cooperating with the audit.
- The programs, modules, electronic applications, software development and adaptations licensed, developed and/or modified under this instrument are authorized by “FEEDBAK” for use solely and exclusively in Mexico; You therefore acknowledge the existence of rules and regulations governing the export and/or use of electronic programs in foreign jurisdictions and agree to comply at all times with the national and international regulations in force on the use and export of software, undertaking not to export data directly or indirectly in violation of such laws.
## Licensing Definitions and Rules.
### Definitions
Program Documentation: the Program user manual and the Program installation manuals.
Application Users: the person authorized by the client to use the programs and applications installed on one or more servers under this agreement.
### Terms
The term of the license(s) granted under this agreement will be permanent from the execution of this instrument, notwithstanding that the update and maintenance services will have an annual term and may be extended for an indefinite period, provided that the parties are current on their obligations, particularly the payment obligation set forth in this instrument and/or its order document; if there is no extension, the licenses covered by this instrument will terminate.`,
  },
}

export const NDA: Textos<NdaData> = {
  es: {
    titulo: 'CONTRATO DE CONFIDENCIALIDAD',
    subtitulo: '(Anexo al Contrato de Licencia por Suscripción y Prestación de Servicios)',
    cuerpo: `El presente Contrato de Confidencialidad se celebra entre {proveedor} (“FEEDBAKMX”) y el Cliente {cliente} identificado anteriormente.
Con el fin de proteger cierta información confidencial (la “Información Confidencial”) que se puede revelar entre “FEEDBAKMX” y el Cliente, las partes acuerdan lo siguiente:
El (los) Revelador(es) de Información Confidencial es (son): “{cliente}”, representada por {representante}.
## Representantes.
El o los representante(s) de las partes responsable(s) de la revelación o recepción de Información Confidencial es (son):
### En representación de “{proveedor}”
Nombre: {representantesProveedor}.
Cargo: Representante legal.
Dirección: {direccionProveedor}.
### En representación del Cliente “{cliente}”
Nombre: {representante}.
Cargo: Representante legal.
Dirección: {direccionCliente}.
## Definición de Información Confidencial.
La “Información Confidencial” revelada en virtud del presente Contrato se describe como: el receptor de Información Confidencial en virtud del presente Contrato (“Receptor”) tendrá la obligación de proteger solo aquella Información Confidencial que:
- Revele el Revelador, por escrito, y sea marcada como confidencial al momento de su revelación.
- Revele el Revelador de cualquier otra forma y se identifique como confidencial al momento de su revelación, y que además esté resumida y designada como confidencial en un memorándum escrito entregado al representante del “Receptor” dentro de los 30 días siguientes a su revelación.
## Periodo de Revelación.
Este Contrato solo controla la Información Confidencial revelada a partir de la Fecha de Entrada en Vigencia, {fecha}.
## Uso de la Información Confidencial.
Un Receptor utilizará la Información Confidencial solo para fines de análisis y presentación de propuesta de servicios entre {cliente} y “FEEDBAKMX”, así como el licenciamiento, implementación, adaptación o instalación y administración del software denominado “MI KIOSKO”, propiedad de FEEDBAK-IT.
Las partes acuerdan que en caso de que la información confidencial revelada incluya datos personales o privados de sus colaboradores o empleados personas físicas, aplicarán las medidas y limitaciones establecidas en la Ley Federal de Protección de Datos Personales en Posesión de los Particulares y su respectivo reglamento, debiendo en consecuencia recabar el consentimiento de los titulares para el tratamiento de tales datos en términos del contrato de prestación de servicios y licenciamiento.
## Plazo.
La obligación del Receptor de proteger la Información Confidencial revelada en virtud del presente Contrato vence a los 10 (diez) años a partir de su revelación o del vencimiento del Contrato de Licencia por Suscripción y Prestación de Servicios.
## Protección de Información Confidencial.
El Receptor protegerá la Información Confidencial usando el mismo nivel de cuidado, pero no un nivel de cuidado inferior al razonable, que utilizaría para proteger su propia información confidencial de naturaleza similar, para impedir el uso, divulgación o publicación no autorizada de la Información Confidencial.
## Exclusiones.
Este Contrato no impone obligación alguna a un Receptor en relación con la Información Confidencial que:
- Estuviese en posesión del Receptor antes de ser recibida del Revelador.
- Es o se convierta del conocimiento público sin responsabilidad alguna por parte del Receptor.
- Sea legalmente recibida por el Receptor por parte de un tercero, sin obligación alguna de confidencialidad.
- Sea revelada por el Revelador a un tercero sin una obligación de confidencialidad sobre este último.
- Sea desarrollada independientemente por el Receptor.
- Sea revelada por requerimiento legal de autoridad judicial o fiscal competente.
- Sea revelada por el Receptor con la previa autorización escrita del Revelador.
## Derecho de Propiedad.
Ninguna de las partes contractuales adquiere derechos de propiedad intelectual o de otro tipo en virtud de este Contrato, excepto el derecho limitado de uso estipulado en la cláusula 4 anterior. Tratándose del tratamiento de datos personales de terceras personas, las partes se obligan a eliminarlos de sus bases de datos al vencimiento definitivo del contrato de licencia.
## Desarrollo Independiente.
Ninguna disposición de este contrato se interpretará como una exclusión a favor de cualquiera de las partes para desarrollar, usar, comercializar, licenciar y/o vender software o material de procesamiento de datos desarrollado independientemente que sea similar o esté relacionado con la Información Confidencial.
## Totalidad del Contrato y Ley Aplicable.
Este Contrato constituye la totalidad del contrato en relación con la Información Confidencial revelada en el presente y reemplaza todos los contratos anteriores o vigentes respecto de dicha Información Confidencial, sea en forma escrita u oral.
- Cualquier modificación a los presentes términos deberá constar por escrito y ser previamente aprobada y suscrita por ambas partes.
- Este Contrato se celebra y se interpretará al amparo de la legislación mercantil de México, sometiéndose ambas partes a la jurisdicción de los tribunales y juzgados con residencia en Tijuana, B.C.
- Ninguna de las partes estará obligada, en virtud de este Contrato, a comprar o de alguna forma adquirir servicios o productos de la otra parte.
El presente instrumento se firma en la Ciudad de Tijuana, Baja California, el día {fecha}.`,
  },
  en: {
    titulo: 'CONFIDENTIALITY AGREEMENT',
    subtitulo: '(Exhibit to the Subscription License and Services Agreement)',
    cuerpo: `This Confidentiality Agreement is entered into between {proveedor} (“FEEDBAKMX”) and the Client {cliente} identified above.
In order to protect certain confidential information (the “Confidential Information”) that may be disclosed between “FEEDBAKMX” and the Client, the parties agree as follows:
The Discloser(s) of Confidential Information is (are): “{cliente}”, represented by {representante}.
## Representatives.
The representative(s) of the parties responsible for disclosing or receiving Confidential Information is (are):
### On behalf of “{proveedor}”
Name: {representantesProveedor}.
Title: Legal representative.
Address: {direccionProveedor}.
### On behalf of the Client “{cliente}”
Name: {representante}.
Title: Legal representative.
Address: {direccionCliente}.
## Definition of Confidential Information.
The “Confidential Information” disclosed under this Agreement is described as follows: the recipient of Confidential Information under this Agreement (“Recipient”) will be obligated to protect only the Confidential Information that:
- Is disclosed by the Discloser in writing and marked as confidential at the time of disclosure.
- Is disclosed by the Discloser in any other form, identified as confidential at the time of disclosure, and also summarized and designated as confidential in a written memorandum delivered to the “Recipient’s” representative within 30 days after disclosure.
## Disclosure Period.
This Agreement governs only Confidential Information disclosed from the Effective Date, {fecha}.
## Use of Confidential Information.
A Recipient will use Confidential Information only for the purpose of analyzing and presenting a services proposal between {cliente} and “FEEDBAKMX”, as well as the licensing, implementation, adaptation or installation and administration of the software called “MI KIOSKO”, owned by FEEDBAK-IT.
The parties agree that if the confidential information disclosed includes personal or private data of their collaborators or employees who are individuals, the measures and limitations established in the Mexican Federal Law on the Protection of Personal Data Held by Private Parties and its regulations will apply, and the parties must therefore obtain the data subjects’ consent for processing such data under the services and license agreement.
## Term.
The Recipient’s obligation to protect Confidential Information disclosed under this Agreement expires 10 (ten) years after its disclosure or upon expiration of the Subscription License and Services Agreement.
## Protection of Confidential Information.
The Recipient will protect Confidential Information using the same degree of care, but no less than a reasonable degree of care, that it would use to protect its own confidential information of a similar nature, to prevent the unauthorized use, disclosure or publication of the Confidential Information.
## Exclusions.
This Agreement imposes no obligation on a Recipient with respect to Confidential Information that:
- Was in the Recipient’s possession before being received from the Discloser.
- Is or becomes public knowledge through no fault of the Recipient.
- Is lawfully received by the Recipient from a third party without any confidentiality obligation.
- Is disclosed by the Discloser to a third party without a confidentiality obligation on that third party.
- Is independently developed by the Recipient.
- Is disclosed as required by law or by a competent judicial or tax authority.
- Is disclosed by the Recipient with the Discloser’s prior written authorization.
## Ownership Rights.
Neither contracting party acquires intellectual property or other rights under this Agreement, except the limited right of use set forth in clause 4 above. With respect to the processing of third parties’ personal data, the parties agree to delete such data from their databases upon final expiration of the license agreement.
## Independent Development.
Nothing in this agreement will be construed as preventing either party from developing, using, marketing, licensing and/or selling independently developed software or data processing material that is similar or related to the Confidential Information.
## Entire Agreement and Governing Law.
This Agreement constitutes the entire agreement regarding the Confidential Information disclosed hereunder and supersedes all prior or current agreements, written or oral, regarding such Confidential Information.
- Any modification to these terms must be in writing and previously approved and signed by both parties.
- This Agreement is entered into and will be interpreted under the commercial laws of Mexico, and both parties submit to the jurisdiction of the courts located in Tijuana, B.C.
- Neither party will be obligated under this Agreement to purchase or otherwise acquire services or products from the other party.
This instrument is signed in the City of Tijuana, Baja California, on {fecha}.`,
  },
}
