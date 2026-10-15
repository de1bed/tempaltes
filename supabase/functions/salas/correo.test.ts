import { describe, expect, it } from 'vitest'
import { comentarioCancelacion, correoRespuesta, correoSolicitud, cuerpoInvitacion, textoDuracion, type DatosReunion } from './correo'

const d: DatosReunion = {
  motivo: 'Junta con cliente <ACME>',
  sala: 'Sala principal',
  inicio: '2026-10-20T16:00:00Z',
  fin: '2026-10-20T17:30:00Z',
  responsable: { nombre: 'Ana López', email: 'ana@treve.mx' },
  registro: { nombre: 'Xóchitl Vargas', email: 'xochitl@treve.mx' },
  personas: 4,
  invitados: ['cliente@acme.com', 'beto@treve.mx'],
  notas: 'Traer laptop\nY presentación',
  codigo: 'SALA-AB12CD',
  app: 'https://salas.treve.mx/#salas',
}

describe('cuerpoInvitacion', () => {
  const html = cuerpoInvitacion(d)
  it('trae fecha, horario y duración en hora de México', () => {
    expect(html).toContain('Martes, 20 de octubre de 2026')
    expect(html).toMatch(/10:00\s?a\.\s?m\. – 11:30\s?a\.\s?m\./)
    expect(html).toContain('1 h 30 min')
  })
  it('trae sala, responsable, quien registró, invitados, notas y código', () => {
    for (const t of ['Sala principal', 'ana@treve.mx', 'xochitl@treve.mx', 'cliente@acme.com', 'Traer laptop<br>Y presentación', 'SALA-AB12CD', 'https://salas.treve.mx/#salas']) expect(html).toContain(t)
  })
  it('escapa lo que escribe la gente', () => {
    expect(html).toContain('Junta con cliente &lt;ACME&gt;')
    expect(html).not.toContain('<ACME>')
  })
  it('no repite "Registró" si es la misma persona', () => {
    expect(cuerpoInvitacion({ ...d, registro: { nombre: 'Ana', email: 'ANA@treve.mx' } })).not.toContain('Registró')
  })
  it('avisa de un cambio con el horario anterior', () => {
    const cambio = cuerpoInvitacion(d, { tipo: 'cambio', antes: { sala: 'Salita 2', inicio: '2026-10-19T15:00:00Z', fin: '2026-10-19T16:00:00Z' } })
    expect(cambio).toContain('Reunión reprogramada')
    expect(cambio).toContain('cambió de horario')
    expect(cambio).toContain('Salita 2 · Lunes, 19 de octubre de 2026')
  })
})

describe('otros correos', () => {
  it('duración', () => {
    expect(textoDuracion('2026-10-20T16:00:00Z', '2026-10-20T16:30:00Z')).toBe('30 min')
    expect(textoDuracion('2026-10-20T16:00:00Z', '2026-10-20T18:00:00Z')).toBe('2 h')
  })
  it('cancelación', () => {
    expect(comentarioCancelacion(d, 'La canceló Ana.')).toMatch(/^Se canceló "Junta con cliente <ACME>" en Sala principal \(Martes, 20 de octubre de 2026, .+\)\. La canceló Ana\.$/)
  })
  it('solicitud y respuesta', () => {
    const s = correoSolicitud(d, { nombre: 'Beto', email: 'beto@treve.mx' }, 'Entrevista', 'Es urgente', d.app)
    expect(s.asunto).toContain('Sala principal')
    expect(s.html).toContain('Entrevista')
    expect(s.html).toContain('Responder en la app')
    expect(correoRespuesta(d, true, 'Ana', '').html).toContain('aceptó tu solicitud')
    expect(correoRespuesta(d, false, 'Ana', 'Es con cliente').html).toContain('Es con cliente')
  })
})

describe('correo de cancelación (respaldo cuando la reunión no estaba en Outlook)', () => {
  it('dice qué se canceló, cuándo, dónde y por qué', async () => {
    const { correoCancelacion } = await import('./correo')
    const c = correoCancelacion({ motivo: 'Junta <equipo>', sala: 'Sala principal', inicio: '2026-10-15T14:00:00Z', fin: '2026-10-15T15:00:00Z', codigo: 'SALA-85C504' }, 'David cedió el horario a Ana.')
    expect(c.asunto).toContain('Cancelada: Junta <equipo> · Sala principal')
    expect(c.html).toContain('Junta &lt;equipo&gt;')
    expect(c.html).toContain('David cedió el horario a Ana.')
    expect(c.html).toContain('SALA-85C504')
  })
})
