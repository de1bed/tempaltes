/**
 * Entrega un archivo generado a la persona. Dentro del visor de artifacts de claude.ai las
 * descargas normales están bloqueadas: ahí se usa su capacidad "downloads" (pide confirmación).
 * En cualquier otro lugar (sitio normal) se descarga con un enlace, como siempre.
 */
interface Descargas {
  save(req: { filename: string; data: Blob }): Promise<unknown>
}
interface Visor {
  use(nombre: 'downloads'): Promise<Descargas | null>
}

export async function guardarArchivo(blob: Blob, nombre: string): Promise<void> {
  const visor = (window as unknown as { claude?: Visor }).claude
  const descargas = typeof visor?.use === 'function' ? await visor.use('downloads').catch(() => null) : null
  if (descargas) {
    try {
      await descargas.save({ filename: nombre, data: blob })
    } catch (e) {
      // Si la persona dijo que no, no es un error.
      if ((e as { code?: string })?.code === 'declined') return
      throw new Error((e as { message?: string })?.message ?? 'No se pudo guardar el archivo')
    }
    return
  }
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nombre
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}
