import { supabase } from '../lib/supabase'
import { rutaPagina } from '../../supabase/functions/induccion/logica'
import { BUCKET, type Presentacion } from './api'

/** Ancho de cada diapositiva guardada: nítida en pantalla completa y ligera en el celular. */
const ANCHO = 1600

function aBlob(canvas: HTMLCanvasElement, tipo: string, calidad: number): Promise<Blob | null> {
  return new Promise((r) => canvas.toBlob(r, tipo, calidad))
}

/**
 * Convierte el PDF de una presentación en imágenes (una por diapositiva) en el navegador y las sube.
 * Las imágenes nuevas van en otra carpeta (versión) y al final se borran las anteriores, así que quien
 * esté viendo la presentación mientras tanto no ve una mezcla.
 */
export async function subirPdf(p: Presentacion, archivo: File, progreso: (hecho: number, total: number) => void): Promise<void> {
  const [pdfjs, worker] = await Promise.all([import('pdfjs-dist/legacy/build/pdf.mjs'), import('pdfjs-dist/legacy/build/pdf.worker.mjs')])
  ;(globalThis as { pdfjsWorker?: unknown }).pdfjsWorker = worker
  const tarea = pdfjs.getDocument({ data: new Uint8Array(await archivo.arrayBuffer()), useSystemFonts: true, verbosity: 0 })
  const doc = await tarea.promise
  const total = doc.numPages
  if (total < 1) throw new Error('El PDF no tiene páginas.')
  if (total > 300) throw new Error('El PDF tiene más de 300 páginas.')

  const version = p.version + 1
  // Safari no genera WebP: ahí se guardan en JPG.
  const prueba = await aBlob(Object.assign(document.createElement('canvas'), { width: 2, height: 2 }), 'image/webp', 0.8)
  const webp = prueba?.type === 'image/webp'
  const extension = webp ? 'webp' : 'jpg'
  let proporcion = 16 / 9

  for (let n = 1; n <= total; n++) {
    progreso(n - 1, total)
    const pagina = await doc.getPage(n)
    const base = pagina.getViewport({ scale: 1 })
    if (n === 1) proporcion = base.width / base.height
    const viewport = pagina.getViewport({ scale: ANCHO / base.width })
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(viewport.width)
    canvas.height = Math.round(viewport.height)
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    await pagina.render({ canvas, canvasContext: ctx, viewport }).promise
    const blob = await aBlob(canvas, webp ? 'image/webp' : 'image/jpeg', 0.85)
    if (!blob) throw new Error(`No se pudo convertir la diapositiva ${n}.`)
    const ruta = rutaPagina({ id: p.id, version, extension }, n)
    const { error } = await supabase.storage.from(BUCKET).upload(ruta, blob, { contentType: blob.type, upsert: true, cacheControl: '31536000' })
    if (error) throw new Error(`No se pudo subir la diapositiva ${n}: ${error.message}`)
    pagina.cleanup()
  }
  progreso(total, total)
  await tarea.destroy()

  const { error } = await supabase
    .from('induccion_presentaciones')
    .update({ paginas: total, version, extension, proporcion: Math.round(proporcion * 10000) / 10000, actualizado: new Date().toISOString() })
    .eq('id', p.id)
  if (error) throw error

  // Limpieza de la versión anterior (si falla, solo quedan archivos sin usar).
  if (p.version > 0) {
    const carpeta = `presentaciones/${p.id}/v${p.version}`
    const { data } = await supabase.storage.from(BUCKET).list(carpeta, { limit: 1000 })
    if (data?.length) await supabase.storage.from(BUCKET).remove(data.map((f) => `${carpeta}/${f.name}`))
  }
}

/** Borra todas las imágenes de una presentación (al eliminarla). */
export async function borrarImagenes(p: Presentacion) {
  if (p.version < 1) return
  const carpeta = `presentaciones/${p.id}/v${p.version}`
  const { data } = await supabase.storage.from(BUCKET).list(carpeta, { limit: 1000 })
  if (data?.length) await supabase.storage.from(BUCKET).remove(data.map((f) => `${carpeta}/${f.name}`))
}

/** Sube un video (MP4/WebM, hasta 50 MB) y devuelve su ruta en el bucket. */
export async function subirVideo(archivo: File): Promise<string> {
  if (!/^video\/(mp4|webm)$/.test(archivo.type)) throw new Error('El video debe ser MP4 o WebM.')
  if (archivo.size > 50 * 1024 * 1024) throw new Error('El video pesa más de 50 MB. Súbelo a YouTube (como "no listado") y pega el enlace.')
  const ruta = `videos/${crypto.randomUUID()}.${archivo.type === 'video/webm' ? 'webm' : 'mp4'}`
  const { error } = await supabase.storage.from(BUCKET).upload(ruta, archivo, { contentType: archivo.type, cacheControl: '31536000' })
  if (error) throw new Error(`No se pudo subir el video: ${error.message}`)
  return ruta
}
