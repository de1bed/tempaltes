// Negritas en los textos editables: **texto** se muestra en negritas en la hoja (y en el PDF).
// Al editar se ven los asteriscos, igual que las variables {cliente}.

const ESCAPES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }

/** Texto con **negritas** → HTML seguro (todo lo demás se escapa). */
export function aHtml(texto: string): string {
  return texto.replace(/[&<>"']/g, (c) => ESCAPES[c]).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
}

/** Quita las marcas de negritas (para índices y nombres de archivo). */
export const sinMarcas = (texto: string) => texto.replace(/\*\*(.+?)\*\*/g, '$1')

/**
 * Pone o quita negritas en la selección [inicio, fin) del texto.
 * Sin selección deja `****` con el cursor en medio. Devuelve el texto y la nueva selección.
 */
export function alternarNegritas(texto: string, inicio: number, fin: number): { texto: string; inicio: number; fin: number } {
  const antes = texto.slice(0, inicio)
  const sel = texto.slice(inicio, fin)
  const despues = texto.slice(fin)
  // Ya estaba en negritas (con los ** fuera o dentro de la selección): se quitan.
  if (antes.endsWith('**') && despues.startsWith('**') && sel)
    return { texto: antes.slice(0, -2) + sel + despues.slice(2), inicio: inicio - 2, fin: fin - 2 }
  if (sel.length > 4 && sel.startsWith('**') && sel.endsWith('**')) return { texto: antes + sel.slice(2, -2) + despues, inicio, fin: fin - 4 }
  return { texto: `${antes}**${sel}**${despues}`, inicio: inicio + 2, fin: fin + 2 }
}
