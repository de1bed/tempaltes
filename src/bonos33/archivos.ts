import JSZip from 'jszip'

/**
 * Lectura de archivos en el navegador (nada se sube): el texto del PDF del listado de nómina,
 * renglón por renglón, y las celdas de la primera hoja de un Excel.
 */

/** Renglones de texto de un PDF, en orden de lectura (pdf.js sin worker aparte: se carga solo aquí). */
export async function lineasPdf(datos: ArrayBuffer): Promise<string[]> {
  const [pdfjs, worker] = await Promise.all([import('pdfjs-dist/legacy/build/pdf.mjs'), import('pdfjs-dist/legacy/build/pdf.worker.mjs')])
  // Versión "legacy" (funciona también en navegadores no tan nuevos). pdf.js usa este módulo en el mismo hilo si existe (así el archivo único del artifact no necesita otro archivo).
  ;(globalThis as { pdfjsWorker?: unknown }).pdfjsWorker = worker
  // Solo se lee el texto: sin fuentes ni avisos.
  const tarea = pdfjs.getDocument({ data: new Uint8Array(datos), disableFontFace: true, verbosity: 0 })
  const doc = await tarea.promise
  const lineas: string[] = []
  for (let p = 1; p <= doc.numPages; p++) {
    const pagina = await doc.getPage(p)
    const contenido = await pagina.getTextContent()
    // Agrupa los pedazos de texto por altura (y) y los ordena por x.
    const filas = new Map<number, { x: number; fin: number; texto: string }[]>()
    for (const item of contenido.items) {
      if (!('str' in item) || !item.str.trim()) continue
      const [, , , , x, y] = item.transform as number[]
      const clave = [...filas.keys()].find((k) => Math.abs(k - y) < 2.5) ?? y
      const fila = filas.get(clave) ?? []
      fila.push({ x, fin: x + item.width, texto: item.str })
      filas.set(clave, fila)
    }
    for (const y of [...filas.keys()].sort((a, b) => b - a)) {
      const partes = filas.get(y)!.sort((a, b) => a.x - b.x)
      let linea = ''
      let fin = -Infinity
      for (const parte of partes) {
        // Un hueco grande entre pedazos separa columnas (como en la versión "layout" del PDF).
        linea += linea ? (parte.x - fin > 8 ? '   ' : parte.x - fin > 1 ? ' ' : '') : ''
        linea += parte.texto
        fin = parte.fin
      }
      lineas.push(linea)
    }
  }
  await tarea.destroy()
  return lineas
}

const textoXml = (s: string) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&')

const columna = (ref: string) => {
  let c = 0
  for (const ch of /^[A-Z]+/.exec(ref)![0]) c = c * 26 + ch.charCodeAt(0) - 64
  return c - 1
}

/** Celdas de la primera hoja visible de un .xlsx: filas × columnas (texto o número). */
export async function filasXlsx(datos: ArrayBuffer): Promise<(string | number | null)[][]> {
  const zip = await JSZip.loadAsync(datos)
  const leer = (ruta: string) => zip.file(ruta)?.async('string') ?? Promise.resolve('')
  const [libro, rels, compartidos] = await Promise.all([leer('xl/workbook.xml'), leer('xl/_rels/workbook.xml.rels'), leer('xl/sharedStrings.xml')])
  const textos = [...compartidos.matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) => textoXml([...m[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((t) => t[1]).join('')))
  const hoja = [...libro.matchAll(/<sheet\b([^>]*)\/>/g)].map((m) => m[1]).find((a) => !/state="(hidden|veryHidden)"/.test(a))
  const rid = hoja && /r:id="([^"]+)"/.exec(hoja)?.[1]
  const destino = rid && new RegExp(`Id="${rid}"[^>]*Target="([^"]+)"`).exec(rels)?.[1]
  const ruta = destino ? (destino.startsWith('/') ? destino.slice(1) : `xl/${destino}`) : 'xl/worksheets/sheet1.xml'
  const xml = await leer(ruta)
  const filas: (string | number | null)[][] = []
  for (const f of xml.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)) {
    const fila: (string | number | null)[] = []
    for (const c of f[1].matchAll(/<c r="([A-Z]+)\d+"([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const tipo = /t="([^"]+)"/.exec(c[2])?.[1]
      const v = /<v>([\s\S]*?)<\/v>/.exec(c[3] ?? '')?.[1]
      let valor: string | number | null = null
      if (tipo === 's' && v !== undefined) valor = textos[Number(v)] ?? ''
      else if (tipo === 'inlineStr') valor = textoXml([...(c[3] ?? '').matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((t) => t[1]).join(''))
      else if (tipo === 'str' || tipo === 'e') valor = v !== undefined ? textoXml(v) : null
      else if (tipo === 'b') valor = v === '1' ? 'TRUE' : 'FALSE'
      else if (v !== undefined) valor = Number(v)
      fila[columna(c[1])] = valor
    }
    filas.push(Array.from(fila, (x) => x ?? null))
  }
  return filas
}
