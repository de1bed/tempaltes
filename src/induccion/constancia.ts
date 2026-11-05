import { IMG } from '../lib/imagenes'
import { guardarArchivo } from '../lib/guardar'
import { nombreSeguro } from '../lib/pdf'
import { fechaLarga } from './api'

export interface DatosConstancia {
  nombre: string
  curso: string
  calificacion: number
  /** Fecha en que aprobó (ISO). */
  fecha: string
}

async function comoDataUrl(url: string): Promise<string> {
  const blob = await (await fetch(url)).blob()
  return new Promise((r, f) => {
    const lector = new FileReader()
    lector.onload = () => r(String(lector.result))
    lector.onerror = f
    lector.readAsDataURL(blob)
  })
}

/** Constancia en PDF (carta horizontal) para quien aprobó el curso. */
export async function descargarConstancia(d: DatosConstancia) {
  const { jsPDF } = await import('jspdf')
  const pdf = new jsPDF({ unit: 'mm', format: 'letter', orientation: 'landscape' })
  const ancho = 279.4
  const alto = 215.9
  const marca: [number, number, number] = [11, 76, 94]
  const verde: [number, number, number] = [111, 192, 141]

  // Marco y franjas de color.
  pdf.setFillColor(...marca)
  pdf.rect(0, 0, ancho, 9, 'F')
  pdf.setFillColor(...verde)
  pdf.rect(0, 9, ancho, 2.2, 'F')
  pdf.setFillColor(...marca)
  pdf.rect(0, alto - 6, ancho, 6, 'F')
  pdf.setDrawColor(223, 229, 232)
  pdf.setLineWidth(0.5)
  pdf.rect(12, 20, ancho - 24, alto - 34)

  const logo = await comoDataUrl(IMG.treveLogo).catch(() => null)
  if (logo) {
    const props = pdf.getImageProperties(logo)
    const h = 16
    pdf.addImage(logo, 'PNG', (ancho - (h * props.width) / props.height) / 2, 30, (h * props.width) / props.height, h)
  }

  const centro = (texto: string, y: number, tamano: number, estilo: 'normal' | 'bold' = 'normal', color: [number, number, number] = [27, 43, 48]) => {
    pdf.setFont('helvetica', estilo)
    pdf.setFontSize(tamano)
    pdf.setTextColor(...color)
    pdf.text(texto, ancho / 2, y, { align: 'center', maxWidth: ancho - 60 })
  }

  centro('CONSTANCIA', 66, 30, 'bold', marca)
  centro('Se otorga a', 82, 13, 'normal', [90, 107, 112])
  centro(d.nombre.toUpperCase(), 100, 24, 'bold')
  pdf.setDrawColor(...verde)
  pdf.setLineWidth(0.8)
  pdf.line(ancho / 2 - 70, 106, ancho / 2 + 70, 106)
  centro(`por haber concluido y aprobado el curso “${d.curso}”`, 120, 14)
  centro(`con una calificación de ${d.calificacion} / 100.`, 129, 14)
  centro(`Tijuana, Baja California, a ${fechaLarga(d.fecha)}.`, 148, 12, 'normal', [90, 107, 112])

  pdf.setDrawColor(27, 43, 48)
  pdf.setLineWidth(0.3)
  pdf.line(ancho / 2 - 45, 176, ancho / 2 + 45, 176)
  centro('Recursos Humanos', 182, 11, 'bold')
  centro('TREVÉ Corporativo', 187.5, 10, 'normal', [90, 107, 112])

  await guardarArchivo(pdf.output('blob'), `${nombreSeguro(`Constancia ${d.curso} - ${d.nombre}`)}.pdf`)
}
