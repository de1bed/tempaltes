/** Utilidades para la edición directa sobre la vista previa (ver src/doc/Editable.tsx). */

export interface Ligado {
  /** Valor guardado (tal cual está en el formulario). */
  valor: string
  onCambio: (v: string) => void
}

/** Crea el enlace de un campo de texto de `d` con su setter. */
export function ligar<T>(d: T, set: (p: Partial<T>) => void) {
  return <K extends keyof T>(k: K): Ligado => ({
    valor: String(d[k] ?? ''),
    onCambio: (v) => set({ [k]: v } as unknown as Partial<T>),
  })
}

export function cursorAl(el: HTMLElement, final: boolean) {
  const r = document.createRange()
  r.selectNodeContents(el)
  r.collapse(!final)
  const sel = window.getSelection()
  sel?.removeAllRanges()
  sel?.addRange(r)
}

/** Posición del cursor dentro del texto de `el`. */
export function posicionCursor(el: HTMLElement): number {
  const sel = window.getSelection()
  if (!sel || sel.rangeCount === 0) return el.textContent?.length ?? 0
  const r = sel.getRangeAt(0).cloneRange()
  r.selectNodeContents(el)
  r.setEnd(sel.getRangeAt(0).startContainer, sel.getRangeAt(0).startOffset)
  return r.toString().length
}

export function enfocar(id: string, final = true) {
  const el = document.getElementById(id)
  if (!el) return
  el.focus()
  cursorAl(el, final)
}

/** Número de hojas de un texto de secciones con saltos "---" (ver Secciones). */
export function contarHojas(texto: string): number {
  return texto.split('\n').filter((l) => l.trim() === '---').length + 1
}
