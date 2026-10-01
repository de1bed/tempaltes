import JSZip from 'jszip'
import { ErrorExcel, type Libro, type Valor } from './motor/libro'

/**
 * Escribe la corrida sobre una copia limpia de la plantilla .xlsx aprobada.
 * Se cambian solo las celdas capturadas y el valor guardado de cada fórmula:
 * hojas, formato, fórmulas, comentarios y diseño quedan intactos. Como cada
 * fórmula lleva su valor ya calculado, el archivo nunca abre en ceros o en
 * blanco (aunque el visor no recalcule); además se marca para que Excel
 * recalcule al abrir.
 */

const escapar = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

type Cambio = { formula?: string; quitarFormula?: boolean; valor: Valor; esFormula: boolean }

function valorXml(v: Valor, esFormula: boolean): { t?: string; contenido: string } {
  if (v === null) return esFormula ? { t: 'str', contenido: '<v></v>' } : { contenido: '' }
  if (v instanceof ErrorExcel) return { t: 'e', contenido: `<v>${escapar(v.codigo)}</v>` }
  if (typeof v === 'boolean') return { t: 'b', contenido: `<v>${v ? 1 : 0}</v>` }
  if (typeof v === 'number') return Number.isFinite(v) ? { contenido: `<v>${v}</v>` } : { t: 'e', contenido: '<v>#NUM!</v>' }
  return esFormula ? { t: 'str', contenido: `<v>${escapar(v)}</v>` } : { t: 'inlineStr', contenido: `<is><t xml:space="preserve">${escapar(v)}</t></is>` }
}

const columna = (ref: string) => {
  let c = 0
  for (const ch of /^[A-Z]+/.exec(ref)![0]) c = c * 26 + ch.charCodeAt(0) - 64
  return c
}
const fila = (ref: string) => Number(/\d+$/.exec(ref)![0])

function celdaXml(ref: string, estilo: string, formulaOriginal: string, cambio: Cambio): string {
  const formula = cambio.formula !== undefined ? `<f>${escapar(cambio.formula)}</f>` : cambio.quitarFormula ? '' : formulaOriginal
  const { t, contenido } = valorXml(cambio.valor, Boolean(formula))
  return `<c r="${ref}"${estilo}${t ? ` t="${t}"` : ''}>${formula}${contenido}</c>`
}

/** Agrega una celda que la plantilla no tiene, en su fila y columna (creando la fila si hace falta). */
function insertarCelda(xml: string, ref: string, celda: string): string {
  const f = fila(ref)
  const filaRe = new RegExp(`<row r="${f}"([^>]*?)(\\/>|>([\\s\\S]*?)<\\/row>)`)
  const m = filaRe.exec(xml)
  if (m) {
    const interior = m[3] ?? ''
    // Antes de la primera celda con columna mayor, o al final de la fila.
    let pos = interior.length
    for (const c of interior.matchAll(/<c r="([A-Z]+)\d+"/g)) {
      if (columna(c[1]) > columna(ref)) {
        pos = c.index!
        break
      }
    }
    const nueva = `<row r="${f}"${m[1]}>${interior.slice(0, pos)}${celda}${interior.slice(pos)}</row>`
    return xml.slice(0, m.index) + nueva + xml.slice(m.index + m[0].length)
  }
  // La fila no existe: va antes de la primera fila mayor (o al final de sheetData).
  for (const r of xml.matchAll(/<row r="(\d+)"/g)) {
    if (Number(r[1]) > f) return xml.slice(0, r.index) + `<row r="${f}">${celda}</row>` + xml.slice(r.index)
  }
  return xml.replace('</sheetData>', `<row r="${f}">${celda}</row></sheetData>`)
}

function reescribirHoja(xml: string, hoja: string, cambios: Map<string, Cambio>, estilos: Record<string, string> = {}): string {
  const pendientes = new Set(cambios.keys())
  const resultado = xml.replace(/<c r="([A-Z]+\d+)"([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g, (original, ref: string, attrs: string, interior = '') => {
    const cambio = cambios.get(ref)
    if (!cambio) return original
    pendientes.delete(ref)
    const estilo = /\ss="(\d+)"/.exec(attrs)?.[0] ?? ''
    const f = /<f\b[^>]*\/>|<f\b[^>]*>[\s\S]*?<\/f>/.exec(interior)?.[0] ?? ''
    if (f && /t="shared"/.test(f) && /\sref="/.test(f) && (cambio.quitarFormula || cambio.formula !== undefined)) {
      throw new Error(`${hoja}!${ref} es la fórmula base de un grupo compartido; no se puede reemplazar sin romper las demás`)
    }
    return celdaXml(ref, estilo, f, cambio)
  })
  // Celdas nuevas (p. ej. la línea "Otras percepciones" del resumen): solo las que se pidieron
  // con formato de referencia; cualquier otra celda faltante es un error de mapeo.
  let salida = resultado
  for (const ref of pendientes) {
    const fuente = estilos[ref]
    if (!fuente) throw new Error(`La hoja ${hoja} no tiene la celda ${ref} en la plantilla`)
    const estilo = new RegExp(`<c r="${fuente}"[^>]*?(\\ss="\\d+")`).exec(salida)?.[1] ?? ''
    salida = insertarCelda(salida, ref, celdaXml(ref, estilo, '', cambios.get(ref)!))
  }
  return salida
}

/** Rutas de las hojas dentro del .xlsx, por nombre. */
async function rutasDeHojas(zip: JSZip): Promise<Map<string, string>> {
  const libro = await zip.file('xl/workbook.xml')!.async('string')
  const rels = await zip.file('xl/_rels/workbook.xml.rels')!.async('string')
  const destinos = new Map<string, string>()
  for (const m of rels.matchAll(/<Relationship\b[^>]*>/g)) {
    const id = /\bId="([^"]+)"/.exec(m[0])?.[1]
    const destino = /\bTarget="([^"]+)"/.exec(m[0])?.[1]
    if (id && destino) destinos.set(id, destino.startsWith('/') ? destino.slice(1) : `xl/${destino}`)
  }
  const rutas = new Map<string, string>()
  for (const m of libro.matchAll(/<sheet\b[^>]*>/g)) {
    const nombre = /\bname="([^"]*)"/.exec(m[0])?.[1]
    const id = /\br:id="([^"]+)"/.exec(m[0])?.[1]
    if (nombre !== undefined && id && destinos.has(id)) rutas.set(desescapar(nombre), destinos.get(id)!)
  }
  return rutas
}

const desescapar = (s: string) => s.replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&apos;/g, "'").replace(/&amp;/g, '&')

/**
 * @param estilos celdas nuevas → celda de la misma hoja de la que toman el formato,
 *   con clave "Hoja!Celda" (ver ResultadoCorrida.estilosExcel).
 */
export async function escribirExcel(plantilla: ArrayBuffer | Uint8Array, libro: Libro, estilos: Record<string, string> = {}): Promise<Uint8Array> {
  const zip = await JSZip.loadAsync(plantilla)
  const rutas = await rutasDeHojas(zip)

  const capturas = new Map(libro.datosCapturados.map((c) => [`${c.hoja}!${c.celda}`, c.dato]))
  for (const hoja of libro.hojas) {
    const cambios = new Map<string, Cambio>()
    for (const celda of libro.celdasConFormula(hoja)) {
      const captura = capturas.get(`${hoja}!${celda}`)
      cambios.set(celda, { valor: libro.valor(hoja, celda), esFormula: true, formula: captura && 'formula' in captura ? captura.formula : undefined })
    }
    for (const { hoja: h, celda, dato } of libro.datosCapturados) {
      if (h !== hoja || !('valor' in dato)) continue
      cambios.set(celda, { valor: dato.valor, esFormula: false, quitarFormula: true })
    }
    if (!cambios.size) continue
    const ruta = rutas.get(hoja)
    if (!ruta) throw new Error(`El archivo no tiene la hoja "${hoja}"`)
    const xml = await zip.file(ruta)!.async('string')
    const estilosHoja = Object.fromEntries(
      Object.entries(estilos)
        .filter(([k]) => k.slice(0, k.lastIndexOf('!')) === hoja)
        .map(([k, v]) => [k.slice(k.lastIndexOf('!') + 1), v]),
    )
    zip.file(ruta, reescribirHoja(xml, hoja, cambios, estilosHoja))
  }

  // La cadena de cálculo guardada ya no corresponde si se reemplazó alguna fórmula: Excel la reconstruye.
  zip.remove('xl/calcChain.xml')
  const rels = await zip.file('xl/_rels/workbook.xml.rels')!.async('string')
  zip.file('xl/_rels/workbook.xml.rels', rels.replace(/<Relationship\b[^>]*calcChain[^>]*\/>/g, ''))
  const tipos = await zip.file('[Content_Types].xml')!.async('string')
  zip.file('[Content_Types].xml', tipos.replace(/<Override\b[^>]*calcChain[^>]*\/>/g, ''))
  // Recalcular al abrir (los valores ya vienen calculados; esto solo asegura que Excel los confirme).
  let wb = await zip.file('xl/workbook.xml')!.async('string')
  if (/<calcPr\b/.test(wb)) wb = wb.replace(/<calcPr\b([^>]*?)(\/?)>/, (_m, a: string, cierre: string) => `<calcPr${a.replace(/\sfullCalcOnLoad="[^"]*"/, '')} fullCalcOnLoad="1"${cierre}>`)
  else wb = wb.replace(/(<\/definedNames>|<\/sheets>)(?![\s\S]*<\/definedNames>)/, '$1<calcPr fullCalcOnLoad="1"/>')
  zip.file('xl/workbook.xml', wb)

  return zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE', compressionOptions: { level: 6 } })
}
