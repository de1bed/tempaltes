import type { Colaborador } from '../lib/supabase'

// Personas activas que ya aparecían en las plantillas de PowerPoint (sin las despedidas),
// para empezar el directorio sin capturar a mano. Se importan una sola vez, con el directorio vacío.
const FOTOS = import.meta.glob<string>('./semilla/*.jpg', { eager: true, import: 'default' })

const PERSONAS: [string, string, string, string | null][] = [
  ['Erika Mateos Guzman', 'Cuentas por cobrar', 'TREVÉ Corporativo', 'cump-1'],
  ['Carlos Alberto Velasco Alegria', 'Chofer', 'HAATS', 'cump-2'],
  ['Edith Ramirez Huerta', 'Encargada de cuentas por pagar', 'TREVÉ Corporativo', 'cump-3'],
  ['Yael Alejandro Contreras Rios', 'Desarrollador', 'Feedbak', null],
  ['Adelina Vargas Martinez', 'Encargada SARH', 'TREVÉ Corporativo', 'cump-5'],
  ['Arturo Padrón Montiel', 'Desarrollador', 'Feedbak', 'bien-1'],
  ['Marimar González Pacheco', 'Auxiliar contable', 'Finanzas', 'bien-3'],
  ['Edgar Omar Aleman Lopez', 'Supervisor de contabilidad', 'Finanzas', 'aniv-1'],
  ['Casandra Guadalupe Gonzalez Carreon', 'Agente de selección', 'Reclutamiento', 'aniv-2'],
  ['Carmen Lorenza Hernandez Morales', 'Auxiliar de limpieza', 'RH', 'aniv-4'],
  ['David Sequeira Villan', 'Auxiliar preventivo', 'HAATS', 'aniv-5'],
  ['Salvador Yzarraraz Zaragoza', 'Auxiliar preventivo', 'HAATS', 'aniv-6'],
  ['Moises Alejandro Sanchez Hernandez', 'Almacenista', 'QINFIX', 'aniv-7'],
  ['Edgar Omar Sotelo Guerra', 'Chofer', 'HAATS', 'aniv-8'],
  ['Maria Vidal Gomez Cruz', 'Coordinadora administrativa', 'HAATS', 'aniv-9'],
  ['Jorge Josafat Unda Rosales', 'Líder de Operaciones de la Unidad de Negocio', 'HAATS', 'aniv-10'],
  ['Martin Lambarena Becerra', 'Encargado de mantenimiento', 'SARH', 'aniv-12'],
  ['Julio Esteban Cegueda Barrientos', 'Gerente Jr administrativo y soporte', 'Feedbak', 'aniv-13'],
]

export const TOTAL_SEMILLA = PERSONAS.length

/** Convierte la URL de la foto (archivo o data URI) en data URI para guardarla en la base de datos. */
async function comoDataUri(url: string): Promise<string> {
  if (url.startsWith('data:')) return url
  const blob = await (await fetch(url)).blob()
  return new Promise((ok, mal) => {
    const lector = new FileReader()
    lector.onload = () => ok(lector.result as string)
    lector.onerror = () => mal(lector.error)
    lector.readAsDataURL(blob)
  })
}

export async function personasSemilla(): Promise<Omit<Colaborador, 'id'>[]> {
  return Promise.all(
    PERSONAS.map(async ([nombre, puesto, area, foto]) => ({
      nombre,
      puesto,
      area,
      foto: foto ? await comoDataUri(FOTOS[`./semilla/${foto}.jpg`]) : null,
      nacimiento: null,
      ingreso: null,
      activo: true,
    })),
  )
}
