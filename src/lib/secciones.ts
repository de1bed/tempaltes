import type { TipoDocumento } from './modelo'

/** Lo que se puede hacer desde la pantalla de inicio. */
export interface Seccion {
  tipo: TipoDocumento | 'corrida'
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
    descripcion: 'Aquí van a estar los formatos de corridas.',
    color: '#E2601A',
  },
]
