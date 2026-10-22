import { describe, expect, it } from 'vitest'
import { aHtml, alternarNegritas, sinMarcas } from './marcado'

describe('negritas', () => {
  it('convierte **texto** en <strong> y escapa lo demás', () => {
    expect(aHtml('el día **24 de septiembre** <b>x</b> & "y"')).toBe('el día <strong>24 de septiembre</strong> &lt;b&gt;x&lt;/b&gt; &amp; &quot;y&quot;')
    expect(aHtml('sin marcas')).toBe('sin marcas')
    expect(sinMarcas('**Vigencia** del contrato')).toBe('Vigencia del contrato')
  })

  it('pone y quita negritas en la selección', () => {
    const a = alternarNegritas('hola mundo', 5, 10)
    expect(a).toEqual({ texto: 'hola **mundo**', inicio: 7, fin: 12 })
    expect(alternarNegritas(a.texto, a.inicio, a.fin)).toEqual({ texto: 'hola mundo', inicio: 5, fin: 10 })
    expect(alternarNegritas('hola **mundo**', 5, 14)).toEqual({ texto: 'hola mundo', inicio: 5, fin: 10 })
    expect(alternarNegritas('ab', 1, 1)).toEqual({ texto: 'a****b', inicio: 3, fin: 3 })
  })
})
