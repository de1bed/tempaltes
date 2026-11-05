import { describe, expect, it } from 'vitest'
import { calificar, faltante, idYoutube, pasosVisibles, preguntasPublicas, rangoPaginas, rutaPagina, validarPreguntas, type Paso, type Presentacion, type Pregunta } from './logica'

const induccion: Presentacion = { id: 'p-ind', clave: 'induccion', nombre: 'Inducción', paginas: 36, version: 2, extension: 'webp', proporcion: 16 / 9 }
const mms: Presentacion = { id: 'p-mms', clave: 'mms', nombre: 'MMS', paginas: 0, version: 0, extension: 'webp', proporcion: 16 / 9 }

const pasos: Paso[] = [
  { id: 'a', tipo: 'diapositivas', titulo: 'Bienvenida', presentacion: 'induccion', desde: 1, hasta: 25 },
  { id: 'v', tipo: 'video', titulo: 'Acoso', youtube: 'jPP7EDNG58U', archivo: null, obligatorio: true },
  { id: 'b', tipo: 'diapositivas', titulo: 'Reglamento', presentacion: 'induccion', desde: 26, hasta: null },
  { id: 'm', tipo: 'diapositivas', titulo: 'MMS', presentacion: 'mms', desde: 1, hasta: null },
  { id: 'v2', tipo: 'video', titulo: 'MMS 30 s', youtube: null, archivo: null, obligatorio: false },
  { id: 'v3', tipo: 'video', titulo: 'Archivo', youtube: null, archivo: 'videos/x.mp4', obligatorio: false },
]

const preguntas: Pregunta[] = [
  { id: 'q1', texto: 'Banco', opciones: ['BBVA', 'Santander'], correcta: 0 },
  { id: 'q2', texto: 'Pago', opciones: ['Viernes', 'Lunes', 'Mes'], correcta: 0 },
  { id: 'q3', texto: 'Seguro', opciones: ['20', '40'], correcta: 1 },
  { id: 'q4', texto: 'Correo', opciones: ['ética', 'jefe'], correcta: 0 },
  { id: 'q5', texto: 'MMS', opciones: ['Sí', 'No'], correcta: 0 },
]

describe('diapositivas', () => {
  it('toma el rango pedido y lo recorta a las que existen', () => {
    expect(rangoPaginas(pasos[0] as never, induccion)).toHaveLength(25)
    expect(rangoPaginas(pasos[2] as never, induccion)).toEqual([26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36])
    expect(rangoPaginas({ ...(pasos[2] as never as object), desde: 30, hasta: 99 } as never, induccion)).toEqual([30, 31, 32, 33, 34, 35, 36])
    expect(rangoPaginas(pasos[3] as never, mms)).toEqual([])
  })

  it('arma la ruta en el bucket con la versión', () => {
    expect(rutaPagina(induccion, 7)).toBe('presentaciones/p-ind/v2/007.webp')
  })

  it('omite lo que falta y firma en orden', async () => {
    const visibles = await pasosVisibles({ pasos }, [induccion, mms], async (rutas) => rutas.map((r) => `firmado:${r}`))
    expect(visibles.map((p) => p.id)).toEqual(['a', 'v', 'b', 'v3'])
    const a = visibles[0]
    expect(a.tipo === 'diapositivas' && a.paginas[0]).toBe('firmado:presentaciones/p-ind/v2/001.webp')
    const b = visibles[2]
    expect(b.tipo === 'diapositivas' && b.paginas).toHaveLength(11)
    expect(b.tipo === 'diapositivas' && b.paginas[0]).toBe('firmado:presentaciones/p-ind/v2/026.webp')
    expect(visibles[1]).toMatchObject({ tipo: 'video', youtube: 'jPP7EDNG58U', url: null, obligatorio: true })
    expect(visibles[3]).toMatchObject({ tipo: 'video', youtube: null, url: 'firmado:videos/x.mp4' })
  })

  it('explica qué falta', () => {
    expect(faltante(pasos[0], [induccion, mms])).toBeNull()
    expect(faltante(pasos[3], [induccion, mms])).toMatch(/Falta subir el PDF/)
    expect(faltante(pasos[4], [induccion, mms])).toMatch(/Falta el video/)
    expect(faltante({ ...(pasos[0] as object), desde: 40, hasta: 50 } as Paso, [induccion])).toMatch(/no existen/)
    expect(faltante({ ...(pasos[0] as object), presentacion: 'otra' } as Paso, [induccion])).toMatch(/no existe/)
  })
})

describe('YouTube', () => {
  it('reconoce enlaces y el id solo', () => {
    expect(idYoutube('https://www.youtube.com/watch?v=jPP7EDNG58U&authuser=0')).toBe('jPP7EDNG58U')
    expect(idYoutube('https://www.youtube.com/watch?feature=share&v=jPP7EDNG58U')).toBe('jPP7EDNG58U')
    expect(idYoutube('https://youtu.be/jPP7EDNG58U?t=3')).toBe('jPP7EDNG58U')
    expect(idYoutube('https://youtube.com/shorts/jPP7EDNG58U')).toBe('jPP7EDNG58U')
    expect(idYoutube('jPP7EDNG58U')).toBe('jPP7EDNG58U')
    expect(idYoutube('https://vimeo.com/123')).toBeNull()
  })
})

describe('cuestionario', () => {
  it('no manda las respuestas correctas', () => {
    const publicas = preguntasPublicas(preguntas)
    expect(publicas[0]).toEqual({ id: 'q1', texto: 'Banco', opciones: ['BBVA', 'Santander'] })
    expect(JSON.stringify(publicas)).not.toContain('correcta')
  })

  it('califica sobre 100 y aprueba con la mínima', () => {
    const r = calificar(preguntas, { q1: 0, q2: 0, q3: 1, q4: 0, q5: 1 }, 80)
    expect(r).toMatchObject({ aciertos: 4, total: 5, calificacion: 80, aprobado: true })
    expect(r.detalle[4]).toEqual({ id: 'q5', texto: 'MMS', opciones: ['Sí', 'No'], correcta: 0, respuesta: 1 })
    expect(calificar(preguntas, { q1: 0, q2: 0, q3: 1 }, 80)).toMatchObject({ aciertos: 3, calificacion: 60, aprobado: false })
  })

  it('las respuestas fuera de rango o raras cuentan como no contestadas', () => {
    const r = calificar(preguntas, { q1: 5, q2: '0', q3: 1.5, q4: -1, q5: null }, 80)
    expect(r.aciertos).toBe(0)
    expect(r.detalle.every((d) => d.respuesta === -1)).toBe(true)
  })

  it('sin preguntas no se aprueba', () => {
    expect(calificar([], {}, 80)).toMatchObject({ total: 0, calificacion: 0, aprobado: false })
  })

  it('valida antes de guardar', () => {
    expect(validarPreguntas(preguntas)).toBeNull()
    expect(validarPreguntas([])).toMatch(/al menos una/)
    expect(validarPreguntas([{ id: 'x', texto: ' ', opciones: ['a', 'b'], correcta: 0 }])).toMatch(/no tiene texto/)
    expect(validarPreguntas([{ id: 'x', texto: 'T', opciones: ['a'], correcta: 0 }])).toMatch(/dos opciones/)
    expect(validarPreguntas([{ id: 'x', texto: 'T', opciones: ['a', ''], correcta: 0 }])).toMatch(/vacía/)
    expect(validarPreguntas([{ id: 'x', texto: 'T', opciones: ['a', 'a'], correcta: 0 }])).toMatch(/repetidas/)
    expect(validarPreguntas([{ id: 'x', texto: 'T', opciones: ['a', 'b'], correcta: 2 }])).toMatch(/correcta/)
  })
})
