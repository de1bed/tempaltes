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

function reescribirHoja(xml: string, hoja: string, cambios: Map<string, Cambio>): string {
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
    const formula = cambio.formula !== undefined ? `<f>${escapar(cambio.formula)}</f>` : cambio.quitarFormula ? '' : f
    const { t, contenido } = valorXml(cambio.valor, Boolean(formula))
    return `<c r="${ref}"${estilo}${t ? ` t="${t}"` : ''}>${formula}${contenido}</c>`
  })
  if (pendientes.size) throw new Error(`La hoja ${hoja} no tiene las celdas ${[...pendientes].join(', ')} en la plantilla`)
  return resultado
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

export async function escribirExcel(plantilla: ArrayBuffer | Uint8Array, libro: Libro): Promise<Uint8Array> {
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
    zip.file(ruta, reescribirHoja(xml, hoja, cambios))
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
