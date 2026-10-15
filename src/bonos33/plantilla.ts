import type { Empleado } from './calculo'
import type { PersonaBase, PersonaListado } from './listado'

/**
 * Qué cambia en la plantilla de 33 Hilos al cargar un listado de nómina (PDF) o la base Salary (Excel).
 * El listado de nómina es la fuente del salario diario (es lo que se paga esa semana); la base trae
 * el puesto completo (el PDF lo corta).
 */

export type TipoCambio = 'nuevo' | 'salario' | 'puesto' | 'ingreso' | 'falta'

export interface CambioPlantilla {
  tipo: TipoCambio
  num: string
  nombre: string
  antes: string
  despues: string
  /** Se aplica si está marcado (la persona puede desmarcarlo). */
  marcado: boolean
  /** Valor nuevo que se guarda (salario, puesto o fecha). */
  valor?: number | string
  /** Fila completa para dar de alta (solo "nuevo"). */
  alta?: Omit<Empleado, 'actualizado'>
}

const dinero = (x: number) => x.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export function compararListado(empleados: Empleado[], personas: PersonaListado[], fuente: string): CambioPlantilla[] {
  const porNum = new Map(empleados.map((e) => [e.num, e]))
  const cambios: CambioPlantilla[] = []
  for (const p of personas) {
    const e = porNum.get(p.num)
    if (!e) {
      cambios.push({
        tipo: 'nuevo',
        num: p.num,
        nombre: p.nombre,
        antes: '',
        despues: `${p.puesto || 'sin puesto'} · SD ${dinero(p.salario_diario)}`,
        marcado: true,
        alta: { num: p.num, nombre: p.nombre, puesto: p.puesto, ingreso: p.ingreso, salario_diario: p.salario_diario, sodexo: 200, activo: true, fuente },
      })
      continue
    }
    if (Math.abs(e.salario_diario - p.salario_diario) >= 0.005) cambios.push({ tipo: 'salario', num: p.num, nombre: e.nombre, antes: dinero(e.salario_diario), despues: dinero(p.salario_diario), marcado: true, valor: p.salario_diario })
    if (p.ingreso && e.ingreso !== p.ingreso) cambios.push({ tipo: 'ingreso', num: p.num, nombre: e.nombre, antes: e.ingreso ?? '—', despues: p.ingreso, marcado: !e.ingreso, valor: p.ingreso })
    // El PDF corta el puesto: solo se usa si no había ninguno.
    if (!e.puesto && p.puesto) cambios.push({ tipo: 'puesto', num: p.num, nombre: e.nombre, antes: '—', despues: p.puesto, marcado: true, valor: p.puesto })
  }
  const enListado = new Set(personas.map((p) => p.num))
  for (const e of empleados) {
    if (e.activo && !enListado.has(e.num)) cambios.push({ tipo: 'falta', num: e.num, nombre: e.nombre, antes: 'activo', despues: 'no aparece en el listado', marcado: false })
  }
  return cambios
}

export function compararBase(empleados: Empleado[], personas: PersonaBase[], fuente: string): CambioPlantilla[] {
  const porNum = new Map(empleados.map((e) => [e.num, e]))
  const cambios: CambioPlantilla[] = []
  for (const p of personas) {
    const e = porNum.get(p.num)
    if (!e) {
      cambios.push({
        tipo: 'nuevo',
        num: p.num,
        nombre: p.nombre,
        antes: '',
        despues: `${p.puesto || 'sin puesto'} · SD ${dinero(p.salario_diario)} (bruto semanal ÷ 8.4)`,
        marcado: true,
        alta: { num: p.num, nombre: p.nombre.toUpperCase(), puesto: p.puesto, ingreso: p.ingreso, salario_diario: p.salario_diario, sodexo: 200, activo: true, fuente },
      })
      continue
    }
    if (p.puesto && p.puesto !== e.puesto) cambios.push({ tipo: 'puesto', num: p.num, nombre: e.nombre, antes: e.puesto || '—', despues: p.puesto, marcado: true, valor: p.puesto })
    // La base puede ser más vieja que el último listado: el salario se propone sin marcar.
    if (Math.abs(e.salario_diario - p.salario_diario) >= 0.005) cambios.push({ tipo: 'salario', num: p.num, nombre: e.nombre, antes: dinero(e.salario_diario), despues: `${dinero(p.salario_diario)} (bruto semanal ÷ 8.4)`, marcado: false, valor: p.salario_diario })
  }
  return cambios
}

/** Filas para guardar (upsert) con los cambios marcados. */
export function aplicarCambios(empleados: Empleado[], cambios: CambioPlantilla[], fuente: string): Omit<Empleado, 'actualizado'>[] {
  const porNum = new Map(empleados.map((e) => [e.num, { ...e }]))
  const tocados = new Set<string>()
  const altas: Omit<Empleado, 'actualizado'>[] = []
  for (const c of cambios.filter((x) => x.marcado)) {
    if (c.tipo === 'nuevo' && c.alta) {
      altas.push(c.alta)
      continue
    }
    const e = porNum.get(c.num)
    if (!e) continue
    tocados.add(c.num)
    if (c.tipo === 'salario' && typeof c.valor === 'number') {
      e.salario_diario = c.valor
      e.fuente = fuente
    }
    if (c.tipo === 'puesto' && typeof c.valor === 'string') e.puesto = c.valor
    if (c.tipo === 'ingreso' && typeof c.valor === 'string') e.ingreso = c.valor
    if (c.tipo === 'falta') e.activo = false
  }
  const cambiados = [...tocados].map((n) => {
    const e = { ...porNum.get(n)! }
    delete e.actualizado
    return e
  })
  return [...altas, ...cambiados]
}

export const ETIQUETA_CAMBIO: Record<TipoCambio, string> = {
  nuevo: 'Alta',
  salario: 'Salario diario',
  puesto: 'Puesto',
  ingreso: 'Fecha de ingreso',
  falta: 'Ya no aparece',
}
