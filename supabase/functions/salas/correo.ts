// Contenido de las invitaciones y avisos que manda Outlook (HTML sencillo con estilos en línea,
// que se ve bien en Outlook, Gmail y el celular). Sin dependencias: se prueba con vitest.

const ZONA = 'America/Mexico_City'
const AZUL = '#0b4c5e'
const NARANJA = '#E77425'
const GRIS = '#5a6b70'

export interface Persona {
  nombre: string
  email: string
}

export interface DatosReunion {
  motivo: string
  sala: string
  inicio: string
  fin: string
  responsable: Persona
  /** Quien la registró, si no es el responsable (p. ej. una asistente). */
  registro?: Persona | null
  personas: number
  invitados: string[]
  notas: string
  codigo: string
  /** Externo: empresa de quien reserva. */
  empresa?: string | null
  /** Dirección de la app para ver o cambiar la reservación. */
  app?: string | null
  /** Externo: enlace para cambiar el horario o cancelar sin cuenta. */
  gestion?: string | null
}

export type Aviso =
  | { tipo: 'cambio'; antes: { sala: string; inicio: string; fin: string } }
  | { tipo: 'cedida'; a: string; motivo: string }
  | { tipo: 'admin'; quien: string }

export const escapar = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

const conMayuscula = (s: string) => s.charAt(0).toLocaleUpperCase('es-MX') + s.slice(1)

/** "jueves 16 de octubre de 2026" */
export function textoDia(iso: string): string {
  return conMayuscula(new Date(iso).toLocaleDateString('es-MX', { timeZone: ZONA, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }))
}

const hora = (iso: string) => new Date(iso).toLocaleTimeString('es-MX', { timeZone: ZONA, hour: 'numeric', minute: '2-digit' })

/** "9:00 a.m. – 10:30 a.m." */
export const textoHorario = (inicio: string, fin: string) => `${hora(inicio)} – ${hora(fin)}`

/** "1 h 30 min" */
export function textoDuracion(inicio: string, fin: string): string {
  const min = Math.round((Date.parse(fin) - Date.parse(inicio)) / 60_000)
  const h = Math.floor(min / 60)
  const m = min % 60
  return [h ? `${h} h` : '', m ? `${m} min` : ''].filter(Boolean).join(' ')
}

const fila = (etiqueta: string, valor: string) =>
  `<tr><td style="padding:6px 12px 6px 0;color:${GRIS};font-size:13px;vertical-align:top;white-space:nowrap">${etiqueta}</td><td style="padding:6px 0;font-size:14px;color:#1b2b30;vertical-align:top">${valor}</td></tr>`

const persona = (p: Persona) => `${escapar(p.nombre || p.email)} <span style="color:${GRIS}">&lt;${escapar(p.email)}&gt;</span>`

function caja(contenido: string, fondo: string, borde: string) {
  return `<div style="margin:0 0 18px;padding:12px 14px;border-radius:8px;background:${fondo};border-left:4px solid ${borde};font-size:14px;color:#1b2b30;line-height:1.5">${contenido}</div>`
}

function textoAviso(a: Aviso): string {
  if (a.tipo === 'cambio') {
    return caja(
      `<strong>Esta reunión cambió de horario.</strong><br>Antes: <s>${escapar(a.antes.sala)} · ${textoDia(a.antes.inicio)}, ${textoHorario(a.antes.inicio, a.antes.fin)}</s>`,
      '#fff4e0',
      NARANJA,
    )
  }
  if (a.tipo === 'cedida') return caja(`<strong>El horario se cedió a ${escapar(a.a)}</strong> para: ${escapar(a.motivo)}.`, '#fff4e0', NARANJA)
  return caja(`Cambio hecho por la administración de salas (${escapar(a.quien)}).`, '#eef1f2', AZUL)
}

function marco(titulo: string, cuerpo: string, pie: string) {
  return `<div style="font-family:Segoe UI,Helvetica,Arial,sans-serif;max-width:560px;margin:0 auto;color:#1b2b30">
<div style="padding:18px 22px;background:${AZUL};border-radius:10px 10px 0 0;color:#fff">
<div style="font-size:11px;letter-spacing:2px;opacity:.8">TREVÉ · SALAS DE JUNTAS</div>
<div style="font-size:20px;font-weight:600;margin-top:4px">${titulo}</div>
</div>
<div style="padding:20px 22px;border:1px solid #dfe5e8;border-top:0;border-radius:0 0 10px 10px;background:#fff">${cuerpo}</div>
<div style="padding:10px 4px;font-size:11px;color:${GRIS};line-height:1.5">${pie}</div>
</div>`
}

/** Cuerpo del evento de Outlook (lo que ven quien reserva, los invitados y la sala). */
export function cuerpoInvitacion(d: DatosReunion, aviso?: Aviso): string {
  const filas = [
    fila('Cuándo', `<strong>${textoDia(d.inicio)}</strong><br>${textoHorario(d.inicio, d.fin)} <span style="color:${GRIS}">(${textoDuracion(d.inicio, d.fin)}, hora del centro de México)</span>`),
    fila('Dónde', `<strong>${escapar(d.sala)}</strong> · Oficinas Trevé`),
    fila('Reserva', persona(d.responsable) + (d.empresa ? `<br><span style="color:${GRIS}">${escapar(d.empresa)}</span>` : '')),
    d.registro && d.registro.email.toLowerCase() !== d.responsable.email.toLowerCase() ? fila('Registró', persona(d.registro)) : '',
    fila('Personas', String(d.personas)),
    d.invitados.length ? fila('Invitados', d.invitados.map(escapar).join('<br>')) : '',
    d.notas.trim() ? fila('Notas', escapar(d.notas).replace(/\n/g, '<br>')) : '',
    fila('Código', `<span style="font-family:Consolas,monospace">${escapar(d.codigo)}</span>`),
  ].join('')
  const enlaces = [
    d.app ? `<a href="${escapar(d.app)}" style="color:${AZUL}">Ver disponibilidad y reservaciones</a>` : '',
    d.gestion ? `<a href="${escapar(d.gestion)}" style="color:${AZUL}">Cambiar horario o cancelar</a>` : '',
  ].filter(Boolean)
  const cuerpo = `${aviso ? textoAviso(aviso) : ''}<div style="font-size:17px;font-weight:600;margin:0 0 12px;color:${AZUL}">${escapar(d.motivo)}</div>
<table role="presentation" style="border-collapse:collapse;width:100%">${filas}</table>
${enlaces.length ? `<div style="margin-top:16px;font-size:13px">${enlaces.join(' &nbsp;·&nbsp; ')}</div>` : ''}`
  const pie = `Acepta esta invitación para agregarla a tu calendario. Para cambiarla o cancelarla usa la app de salas de Trevé${d.gestion ? ' o el enlace de arriba' : ''}; los invitados reciben la actualización automáticamente.`
  return marco(aviso?.tipo === 'cambio' ? 'Reunión reprogramada' : 'Reunión en sala de juntas', cuerpo, pie)
}

/** Texto corto de cancelación (Outlook lo agrega a su aviso). */
export function comentarioCancelacion(d: { motivo: string; sala: string; inicio: string; fin: string }, razon: string): string {
  return `Se canceló "${d.motivo}" en ${d.sala} (${textoDia(d.inicio)}, ${textoHorario(d.inicio, d.fin)}). ${razon}`.trim()
}

/** Correo de cancelación (cuando la reunión no estaba en Outlook y Outlook no puede avisar solo). */
export function correoCancelacion(d: { motivo: string; sala: string; inicio: string; fin: string; codigo: string }, razon: string, app?: string | null): { asunto: string; html: string } {
  const cuerpo = `${caja(`<strong>Esta reunión se canceló.</strong>${razon.trim() ? `<br>${escapar(razon)}` : ''}`, '#fde8e6', '#b3261e')}<div style="font-size:17px;font-weight:600;margin:0 0 12px;color:${AZUL}"><s>${escapar(d.motivo)}</s></div>
<table role="presentation" style="border-collapse:collapse;width:100%">
${fila('Cuándo', `${textoDia(d.inicio)}, ${textoHorario(d.inicio, d.fin)}`)}
${fila('Dónde', escapar(d.sala))}
${fila('Código', `<span style="font-family:Consolas,monospace">${escapar(d.codigo)}</span>`)}
</table>
${app ? `<p style="margin:18px 0 0"><a href="${escapar(app)}" style="color:${AZUL}">Ver disponibilidad de las salas</a></p>` : ''}`
  return { asunto: `Cancelada: ${d.motivo} · ${d.sala}, ${textoDia(d.inicio)} ${hora(d.inicio)}`, html: marco('Reunión cancelada', cuerpo, 'Si ya la tenías en tu calendario, bórrala. Trevé · Salas de juntas') }
}

/** Correo al dueño de una reservación: alguien pide su horario. */
export function correoSolicitud(d: DatosReunion, solicitante: Persona, motivo: string, mensaje: string, app?: string | null): { asunto: string; html: string } {
  const cuerpo = `<p style="margin:0 0 14px;font-size:14px;line-height:1.5"><strong>${persona(solicitante)}</strong> pide el horario de tu reservación para otra reunión.</p>
<table role="presentation" style="border-collapse:collapse;width:100%">
${fila('Tu reunión', `<strong>${escapar(d.motivo)}</strong>`)}
${fila('Cuándo', `${textoDia(d.inicio)}, ${textoHorario(d.inicio, d.fin)}`)}
${fila('Sala', escapar(d.sala))}
${fila('Para qué la pide', escapar(motivo))}
${mensaje.trim() ? fila('Mensaje', escapar(mensaje).replace(/\n/g, '<br>')) : ''}
</table>
${app ? `<p style="margin:18px 0 0"><a href="${escapar(app)}" style="display:inline-block;padding:9px 16px;border-radius:6px;background:${AZUL};color:#fff;text-decoration:none;font-size:14px">Responder en la app</a></p>` : ''}`
  return {
    asunto: `Solicitud de horario: ${d.sala}, ${textoDia(d.inicio)} ${hora(d.inicio)}`,
    html: marco('Te piden tu horario de sala', cuerpo, 'Si aceptas, tu reservación se cancela (tus invitados reciben la cancelación) y se reserva para quien la pidió. Si no respondes antes de la hora, la solicitud vence sola.'),
  }
}

/** Correo a quien pidió el horario: aceptada o rechazada. */
export function correoRespuesta(d: { motivo: string; sala: string; inicio: string; fin: string }, aceptada: boolean, quien: string, respuesta: string, app?: string | null): { asunto: string; html: string } {
  const cuerpo = `<p style="margin:0 0 14px;font-size:14px;line-height:1.5">${
    aceptada
      ? `<strong>¡Listo!</strong> ${escapar(quien)} aceptó tu solicitud. La sala quedó reservada a tu nombre y te llega la invitación por separado.`
      : `${escapar(quien)} <strong>no aceptó</strong> tu solicitud; el horario sigue ocupado.`
  }</p>
<table role="presentation" style="border-collapse:collapse;width:100%">
${fila('Reunión', `<strong>${escapar(d.motivo)}</strong>`)}
${fila('Cuándo', `${textoDia(d.inicio)}, ${textoHorario(d.inicio, d.fin)}`)}
${fila('Sala', escapar(d.sala))}
${respuesta.trim() ? fila('Comentario', escapar(respuesta)) : ''}
</table>
${!aceptada && app ? `<p style="margin:18px 0 0"><a href="${escapar(app)}" style="color:${AZUL}">Buscar otro horario</a></p>` : ''}`
  return { asunto: `${aceptada ? 'Aceptada' : 'No aceptada'}: tu solicitud de ${d.sala}`, html: marco(aceptada ? 'Solicitud aceptada' : 'Solicitud no aceptada', cuerpo, 'Trevé · Salas de juntas') }
}
