// Historial de documentos: cada PDF o Excel que se genera queda guardado con quién lo hizo y sus datos.
import type { TipoDocumento } from './modelo'
import { supabase, type Perfil } from './supabase'

export interface EntradaHistorial {
  id: number
  creado: string
  creado_por: string | null
  creado_por_email: string
  creado_por_nombre: string
  tipo: TipoDocumento
  plantilla: string
  formato: 'pdf' | 'excel'
  documento: string
  empresa: string
  datos: Record<string, unknown>
}

/** Guarda el documento generado. Nunca detiene la descarga: si falla, solo se avisa en la consola. */
export function guardarEnHistorial(
  perfil: Perfil,
  e: { tipo: TipoDocumento; plantilla: string; formato: 'pdf' | 'excel'; documento: string; empresa: string; datos: unknown },
) {
  void supabase
    .from('historial')
    .insert({
      creado_por_nombre: (perfil.nombre || perfil.email).slice(0, 120),
      tipo: e.tipo,
      plantilla: e.plantilla,
      formato: e.formato,
      documento: e.documento.slice(0, 300),
      empresa: e.empresa.trim().slice(0, 200),
      datos: e.datos,
    })
    .then(({ error }) => {
      if (error) console.warn('No se pudo guardar en el historial', error.message)
    })
}

/** Lo más reciente primero, de 200 en 200 (`antesDe` = id del último que ya se tiene). */
export async function leerHistorial(antesDe?: number): Promise<EntradaHistorial[]> {
  let q = supabase.from('historial').select('*').order('id', { ascending: false }).limit(200)
  if (antesDe) q = q.lt('id', antesDe)
  const { data, error } = await q
  if (error) throw new Error('No se pudo cargar el historial.')
  return data as EntradaHistorial[]
}
