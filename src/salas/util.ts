import type { Perfil, Reservacion } from '../lib/supabase'
import { local, textoDia, textoHora } from './tiempo'

/** Lo que se muestra después de reservar, mover, cancelar o pedir un horario. */
export interface Hecho {
  texto: string
  detalle?: string
  r?: Reservacion
  alerta?: boolean
}

export const minutosDe = (r: { inicio: string; fin: string }) => (Date.parse(r.fin) - Date.parse(r.inicio)) / 60_000

/** Dirección de la app para los enlaces de las invitaciones (en el artifact no aplica). */
export const urlApp = (seccion = 'salas') => (import.meta.env.MODE === 'artifact' ? null : `${window.location.origin}${window.location.pathname}#${seccion}`)

/** A nombre de quién está la reservación (si no se dijo, de quien la registró). */
export const responsableDe = (r: Pick<Reservacion, 'responsable_nombre' | 'responsable_email' | 'creado_por_nombre' | 'creado_por_email'>) => ({
  nombre: r.responsable_nombre || r.creado_por_nombre,
  email: r.responsable_email || r.creado_por_email,
})

/** La registró la persona o está a su nombre. */
export const esMia = (r: Pick<Reservacion, 'creado_por' | 'responsable_email'>, perfil: Perfil) =>
  r.creado_por === perfil.id || r.responsable_email?.toLowerCase() === perfil.email.toLowerCase()

/** "ABCD-EFGH": más fácil de leer y escribir. */
export const codigoLegible = (c: string) => `${c.slice(0, 4)}-${c.slice(4)}`

export const DURACIONES = [30, 60, 90, 120, 180, 240]

export const textoDuracion = (min: number) => (min < 60 ? `${min} min` : `${min / 60} h`.replace('.5 h', ' h 30 min'))

export const error = (e: unknown) => (e instanceof Error ? e.message : String(e))

export const CORREO = /^[^\s@<>,;]+@[^\s@<>,;]+\.[^\s@<>,;]+$/

export const conMayuscula = (s: string) => (s ? s.charAt(0).toLocaleUpperCase('es-MX') + s.slice(1) : s)

/** Texto para "jue 16 oct, 9:00 – 10:00 a.m." */
export const textoReunion = (inicio: string, fin: string) =>
  `${conMayuscula(textoDia(local(new Date(inicio)).dia, { weekday: 'short', day: 'numeric', month: 'short' }))}, ${textoHora(local(new Date(inicio)).minutos)} – ${textoHora(local(new Date(fin)).minutos)}`

/** Invitados más lo que quedó escrito en el campo sin convertirse en "chip" (si dieron clic directo en Reservar). */
export function conPendientes(campoId: string, lista: string[]): string[] {
  const texto = (document.getElementById(campoId) as HTMLInputElement | null)?.value ?? ''
  const extra = texto.split(/[\s,;]+/).map((x) => x.trim().toLowerCase()).filter((x) => CORREO.test(x) && !lista.includes(x))
  return [...lista, ...extra]
}
