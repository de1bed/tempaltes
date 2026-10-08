import type { TipoDocumento } from './modelo'

/** Lo que el administrador puede activar a cada persona: las secciones de documentos y Salas. */
export type Permiso = TipoDocumento | 'salas'

/** Lo que se puede hacer desde la pantalla de inicio. */
export interface Seccion {
  tipo: TipoDocumento
  titulo: string
  singular: string
  descripcion: string
  color: string
}

export const SECCIONES: Seccion[] = [
  {
    tipo: 'cotizacion',
    titulo: 'Cotizaciones',
    singular: 'Cotización',
    descripcion: 'Propuestas de Feedbak, Staffvia y HAATS con los precios del tabulador.',
    color: '#6FC08D',
  },
  {
    tipo: 'contrato',
    titulo: 'Contratos',
    singular: 'Contrato',
    descripcion: 'Contrato de licencia y servicios y contrato de confidencialidad (NDA).',
    color: '#0B4C5E',
  },
  {
    tipo: 'corrida',
    titulo: 'Corridas',
    singular: 'Corrida',
    descripcion: 'Simulaciones salariales Kofile, General Treve y 33 Hilos con las plantillas aprobadas, en Excel y PDF.',
    color: '#E2601A',
  },
]

export const PERMISOS: { id: Permiso; titulo: string }[] = [...SECCIONES.map((s) => ({ id: s.tipo, titulo: s.titulo })), { id: 'salas', titulo: 'Salas' }]
