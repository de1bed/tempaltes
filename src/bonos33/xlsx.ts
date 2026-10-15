import JSZip from 'jszip'

/**
 * Escritor mínimo de .xlsx para los reportes de bonos: texto, números y fórmulas (con su valor
 * ya calculado, para que el archivo nunca abra en ceros), anchos de columna, celdas combinadas
 * y un juego fijo de estilos. Excel recalcula al abrir.
 */

export const E = {
  normal: 0,
  negrita: 1,
  dinero: 2,
  dineroNegrita: 3,
  encabezado: 4,
  titulo: 5,
  porcentaje: 6,
  totalDinero: 7,
  nota: 8,
  tc: 9,
  totalTexto: 10,
  seccion: 11,
  usd: 12,
  totalUsd: 13,
  dineroResaltado: 14,
} as const
export type Estilo = (typeof E)[keyof typeof E]

export interface Celda {
  v?: string | number | null
  /** Fórmula sin "=". */
  f?: string
  s?: Estilo
}

export interface Hoja {
  nombre: string
  /** Celdas por referencia ("A1"). */
  celdas: Record<string, Celda>
  anchos?: number[]
  combinadas?: string[]
  /** Fila que se inmoviliza (encabezado). */
  congelarFilas?: number
}

const escapar = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

export const col = (n: number) => {
  let s = ''
  for (let x = n; x > 0; x = Math.floor((x - 1) / 26)) s = String.fromCharCode(65 + ((x - 1) % 26)) + s
  return s
}
const partes = (ref: string) => {
  const m = /^([A-Z]+)(\d+)$/.exec(ref)!
  let c = 0
  for (const ch of m[1]) c = c * 26 + ch.charCodeAt(0) - 64
  return { c, f: Number(m[2]) }
}

function celdaXml(ref: string, c: Celda): string {
  const s = c.s ? ` s="${c.s}"` : ''
  const f = c.f ? `<f>${escapar(c.f)}</f>` : ''
  if (typeof c.v === 'number' && Number.isFinite(c.v)) return `<c r="${ref}"${s}>${f}<v>${c.v}</v></c>`
  if (typeof c.v === 'string' && c.v !== '') return c.f ? `<c r="${ref}"${s} t="str">${f}<v>${escapar(c.v)}</v></c>` : `<c r="${ref}"${s} t="inlineStr"><is><t xml:space="preserve">${escapar(c.v)}</t></is></c>`
  return `<c r="${ref}"${s}>${f}</c>`
}

function hojaXml(h: Hoja): string {
  const filas = new Map<number, [number, string][]>()
  for (const [ref, c] of Object.entries(h.celdas)) {
    const { c: ci, f } = partes(ref)
    const fila = filas.get(f) ?? []
    fila.push([ci, celdaXml(ref, c)])
    filas.set(f, fila)
  }
  const datos = [...filas.keys()]
    .sort((a, b) => a - b)
    .map((f) => `<row r="${f}">${filas.get(f)!.sort((a, b) => a[0] - b[0]).map((x) => x[1]).join('')}</row>`)
    .join('')
  const cols = h.anchos?.length ? `<cols>${h.anchos.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join('')}</cols>` : ''
  const vista = h.congelarFilas
    ? `<sheetViews><sheetView workbookViewId="0"><pane ySplit="${h.congelarFilas}" topLeftCell="A${h.congelarFilas + 1}" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>`
    : '<sheetViews><sheetView workbookViewId="0"/></sheetViews>'
  const merge = h.combinadas?.length ? `<mergeCells count="${h.combinadas.length}">${h.combinadas.map((r) => `<mergeCell ref="${r}"/>`).join('')}</mergeCells>` : ''
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">${vista}<sheetFormatPr defaultRowHeight="15"/>${cols}<sheetData>${datos}</sheetData>${merge}<pageMargins left="0.5" right="0.5" top="0.6" bottom="0.6" header="0.3" footer="0.3"/><pageSetup orientation="landscape" fitToWidth="1" fitToHeight="0"/></worksheet>`
}

// Fuentes: 0 normal, 1 negrita, 2 título, 3 blanca negrita, 4 nota gris cursiva, 5 sección.
// Rellenos: 2 azul Treve (encabezado), 3 gris claro (totales), 4 durazno (resaltado).
// Bordes: 1 delgado gris, 2 superior doble (totales).
const ESTILOS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<numFmts count="4"><numFmt numFmtId="164" formatCode="#,##0.00"/><numFmt numFmtId="165" formatCode="0.00%"/><numFmt numFmtId="166" formatCode="0.0000"/><numFmt numFmtId="167" formatCode="&quot;$&quot;#,##0.00"/></numFmts>
<fonts count="6">
<font><sz val="10"/><name val="Arial"/></font>
<font><b/><sz val="10"/><name val="Arial"/></font>
<font><b/><sz val="14"/><color rgb="FF0B4C5E"/><name val="Arial"/></font>
<font><b/><sz val="10"/><color rgb="FFFFFFFF"/><name val="Arial"/></font>
<font><i/><sz val="9"/><color rgb="FF5A6B70"/><name val="Arial"/></font>
<font><b/><sz val="11"/><color rgb="FF0B4C5E"/><name val="Arial"/></font>
</fonts>
<fills count="5"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FF0B4C5E"/><bgColor indexed="64"/></patternFill></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FFEEF1F2"/><bgColor indexed="64"/></patternFill></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FFFFF4E0"/><bgColor indexed="64"/></patternFill></fill></fills>
<borders count="3"><border><left/><right/><top/><bottom/><diagonal/></border>
<border><left style="thin"><color rgb="FFDFE5E8"/></left><right style="thin"><color rgb="FFDFE5E8"/></right><top style="thin"><color rgb="FFDFE5E8"/></top><bottom style="thin"><color rgb="FFDFE5E8"/></bottom><diagonal/></border>
<border><left/><right/><top style="thin"><color rgb="FF0B4C5E"/></top><bottom style="double"><color rgb="FF0B4C5E"/></bottom><diagonal/></border></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="15">
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>
<xf numFmtId="164" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1"/>
<xf numFmtId="164" fontId="1" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyBorder="1"/>
<xf numFmtId="0" fontId="3" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
<xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/>
<xf numFmtId="165" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1"/>
<xf numFmtId="164" fontId="1" fillId="3" borderId="2" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1"/>
<xf numFmtId="0" fontId="4" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment wrapText="1" vertical="top"/></xf>
<xf numFmtId="166" fontId="1" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyBorder="1"/>
<xf numFmtId="0" fontId="1" fillId="3" borderId="2" xfId="0" applyFont="1" applyFill="1" applyBorder="1"/>
<xf numFmtId="0" fontId="5" fillId="0" borderId="0" xfId="0" applyFont="1"/>
<xf numFmtId="167" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1"/>
<xf numFmtId="167" fontId="1" fillId="3" borderId="2" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1"/>
<xf numFmtId="164" fontId="1" fillId="4" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1"/>
</cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`

/** Arma el .xlsx con las hojas dadas. */
export async function escribirXlsx(hojas: Hoja[]): Promise<Blob> {
  const zip = new JSZip()
  zip.file(
    '[Content_Types].xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${hojas
      .map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`)
      .join('')}</Types>`,
  )
  zip.file(
    '_rels/.rels',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
  )
  zip.file(
    'xl/workbook.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><bookViews><workbookView/></bookViews><sheets>${hojas
      .map((h, i) => `<sheet name="${escapar(h.nombre.slice(0, 31))}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`)
      .join('')}</sheets><calcPr calcId="191029" fullCalcOnLoad="1"/></workbook>`,
  )
  zip.file(
    'xl/_rels/workbook.xml.rels',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${hojas
      .map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`)
      .join('')}<Relationship Id="rId${hojas.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`,
  )
  zip.file('xl/styles.xml', ESTILOS)
  hojas.forEach((h, i) => zip.file(`xl/worksheets/sheet${i + 1}.xml`, hojaXml(h)))
  return zip.generateAsync({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
}
