import { guardarArchivo } from '../lib/guardar'
import { nombreSeguro } from '../lib/pdf'

/** Límite de la columna `foto` en la base de datos (caracteres del data URI). */
const MAX_FOTO = 400_000

/** Lee una foto, la reduce (máx. 600 px por lado) y la devuelve como data URI JPEG para guardarla en el directorio. */
export async function leerFoto(archivo: File): Promise<string> {
  if (!archivo.type.startsWith('image/')) throw new Error('El archivo no es una imagen')
  const url = URL.createObjectURL(archivo)
  try {
    const img = new Image()
    img.src = url
    await img.decode()
    const escala = Math.min(1, 600 / Math.max(img.naturalWidth, img.naturalHeight))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(img.naturalWidth * escala)
    canvas.height = Math.round(img.naturalHeight * escala)
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
    for (const calidad of [0.86, 0.75, 0.6, 0.45]) {
      const datos = canvas.toDataURL('image/jpeg', calidad)
      if (datos.length <= MAX_FOTO) return datos
    }
    throw new Error('La foto es demasiado pesada')
  } catch (e) {
    throw e instanceof Error && e.message.startsWith('La ') ? e : new Error('No se pudo leer la imagen. Prueba con un JPG o PNG.')
  } finally {
    URL.revokeObjectURL(url)
  }
}

/** Captura la tarjeta (a tamaño real) como JPG. */
export async function capturar(el: HTMLElement, escala: number): Promise<Blob> {
  const { domToBlob } = await import('modern-screenshot')
  await document.fonts?.ready
  const opciones = { scale: escala, width: el.offsetWidth, height: el.offsetHeight, type: 'image/jpeg', quality: 0.92, backgroundColor: '#ffffff' }
  // Safari a veces deja imágenes en blanco en la primera captura: se hace una de calentamiento.
  if (/^((?!chrome|android|crios|fxios).)*safari/i.test(navigator.userAgent)) await domToBlob(el, opciones)
  return domToBlob(el, opciones)
}

export const descargar = (blob: Blob, nombre: string) => guardarArchivo(blob, `${nombreSeguro(nombre)}.jpg`)

/** Copia la imagen al portapapeles (como PNG, que es lo que aceptan los navegadores). */
export async function copiar(blob: Blob) {
  const png = await aPng(blob)
  await navigator.clipboard.write([new ClipboardItem({ 'image/png': png })])
}

async function aPng(blob: Blob): Promise<Blob> {
  const bitmap = await createImageBitmap(blob)
  const canvas = document.createElement('canvas')
  canvas.width = bitmap.width
  canvas.height = bitmap.height
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0)
  return new Promise((ok, mal) => canvas.toBlob((b) => (b ? ok(b) : mal(new Error('No se pudo copiar'))), 'image/png'))
}

/** Menú de compartir del teléfono (WhatsApp, correo…), si el navegador lo permite. */
export const puedeCompartir = () => typeof navigator.canShare === 'function' && navigator.canShare({ files: [new File([''], 'x.jpg', { type: 'image/jpeg' })] })

export async function compartir(blob: Blob, nombre: string) {
  const archivo = new File([blob], `${nombreSeguro(nombre)}.jpg`, { type: 'image/jpeg' })
  await navigator.share({ files: [archivo], title: nombre })
}
