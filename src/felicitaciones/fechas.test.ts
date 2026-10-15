import { describe, expect, it } from 'vitest'
import { aniosEsteAnio, proximas, proximaVez, textoCuando, textoFecha } from './fechas'

const persona = (id: string, nacimiento: string | null, ingreso: string | null) => ({ id, nacimiento, ingreso })

describe('proximaVez', () => {
  it('cae este año si todavía no pasa', () => {
    expect(proximaVez('1990-10-20', '2026-10-15')).toBe('2026-10-20')
  })
  it('hoy cuenta como próxima vez', () => {
    expect(proximaVez('1990-10-15', '2026-10-15')).toBe('2026-10-15')
  })
  it('si ya pasó, es el año siguiente', () => {
    expect(proximaVez('1990-03-01', '2026-10-15')).toBe('2027-03-01')
  })
  it('29 de febrero se festeja el 28 en años no bisiestos', () => {
    expect(proximaVez('2000-02-29', '2026-01-10')).toBe('2026-02-28')
    expect(proximaVez('2000-02-29', '2027-12-01')).toBe('2028-02-29')
  })
})

describe('proximas', () => {
  const hoy = '2026-12-20'
  const lista = proximas(
    [
      persona('a', '1991-12-20', null),
      persona('b', '1985-01-05', '2020-12-28'),
      persona('c', '1980-06-01', '2026-12-25'),
      persona('d', null, '2019-03-01'),
    ],
    hoy,
  )

  it('ordena por cercanía y cruza el fin de año', () => {
    expect(lista.map((e) => [e.persona.id, e.tipo, e.fecha, e.dias])).toEqual([
      ['a', 'cumpleanos', '2026-12-20', 0],
      ['b', 'aniversario', '2026-12-28', 8],
      ['b', 'cumpleanos', '2027-01-05', 16],
    ])
  })
  it('calcula los años del aniversario', () => {
    expect(lista.find((e) => e.tipo === 'aniversario')?.anios).toBe(6)
  })
  it('no cuenta como aniversario el día que entró', () => {
    expect(lista.some((e) => e.persona.id === 'c' && e.tipo === 'aniversario')).toBe(false)
  })
})

describe('textos', () => {
  it('fecha como en la plantilla', () => {
    expect(textoFecha('2026-08-07')).toBe('07/08/2026')
  })
  it('cuándo', () => {
    expect(textoCuando('2026-10-15', 0)).toBe('Hoy')
    expect(textoCuando('2026-10-16', 1)).toBe('Mañana')
    expect(textoCuando('2026-10-23', 8)).toBe('vie 23 oct')
  })
  it('años de aniversario de este año', () => {
    expect(aniosEsteAnio('2018-05-02', '2026-10-15')).toBe(8)
    expect(aniosEsteAnio('2026-05-02', '2026-10-15')).toBe(1)
  })
})
