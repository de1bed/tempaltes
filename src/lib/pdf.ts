/**
 * Genera el PDF en el navegador, sin el diálogo de impresión: cada hoja se
 * dibuja como imagen y se coloca a página completa en un PDF Carta o A4.
 * Así sale igual en cualquier dispositivo (el Safari de iPhone/iPad ignora el
 * tamaño de hoja, agrega márgenes y encabezados propios al imprimir).
 */

export type Tamano = 'carta' | 'a4'

const MEDIDAS_MM: Record<Tamano, [number, number]> = {
  carta: [215.9, 279.4],
  a4: [210, 297],
}

/** Resolución de las hojas: 2.5 × 96 dpi ≈ 240 dpi, nítido al imprimir. */
const ESCALA = 2.5

/** Nombre de archivo sin acentos ni caracteres problemáticos (algunos navegadores lo cambian a "download"). */
export const nombreSeguro = (nombre: string) =>
  nombre
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w .+()-]/g, '')
    .replace(/\s+/g, ' ')
    .trim()

const esSafari = () => /^((?!chrome|android|crios|fxios).)*safari/i.test(navigator.userAgent)

export async function generarPdf(
  hojas: HTMLElement[],
  tamano: Tamano,
  nombre: string,
  progreso?: (hoja: number, total: number) => void,
): Promise<void> {
  // Se cargan solo al generar el PDF para no hacer más pesada la app.
  const [{ domToCanvas }, { jsPDF }] = await Promise.all([import('modern-screenshot'), import('jspdf')])
  await document.fonts?.ready

  const [ancho, alto] = MEDIDAS_MM[tamano]
  const pdf = new jsPDF({ unit: 'mm', format: [ancho, alto], orientation: 'portrait', compress: true })
  const captura = (el: HTMLElement) =>
    domToCanvas(el, {
      scale: ESCALA,
      width: el.offsetWidth,
      height: el.offsetHeight,
      backgroundColor: '#ffffff',
      // Sin sombras ni contornos de la vista previa.
      style: { boxShadow: 'none', outline: 'none', margin: '0' },
    })

  // Safari a veces deja imágenes en blanco en la primera captura: se hace una de calentamiento.
  if (esSafari() && hojas[0]) await captura(hojas[0])

  for (let i = 0; i < hojas.length; i++) {
    progreso?.(i + 1, hojas.length)
    const canvas = await captura(hojas[i])
    if (i > 0) pdf.addPage([ancho, alto], 'portrait')
    pdf.addImage(canvas.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, ancho, alto, undefined, 'FAST')
  }
  pdf.save(`${nombreSeguro(nombre)}.pdf`)
}
