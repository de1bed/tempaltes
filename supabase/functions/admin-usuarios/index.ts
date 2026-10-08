// Administración de cuentas: solo el administrador da de alta personas y decide a qué secciones entran.
// No hay registro abierto: las cuentas se crean aquí con la llave secreta, que nunca sale del servidor.
import { createClient } from 'npm:@supabase/supabase-js@2.117.1'

/** Único correo que puede ser administrador. */
const ADMIN_EMAIL = 'davidrocha0520@gmail.com'
const SECCIONES = ['cotizacion', 'contrato', 'corrida']
const MIN_PASSWORD = 8
/** "Desactivar" bloquea el inicio de sesión ~100 años; se quita al reactivar. */
const BLOQUEO = '876000h'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const admin = createClient(Deno.env.get('SUPABASE_URL')!, JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS')!)['default'], {
  auth: { persistSession: false, autoRefreshToken: false },
})

class ErrorAcceso extends Error {
  constructor(
    mensaje: string,
    public estado = 400,
  ) {
    super(mensaje)
  }
}

function responder(cuerpo: unknown, estado = 200) {
  return new Response(JSON.stringify(cuerpo), { status: estado, headers: { ...CORS, 'Content-Type': 'application/json' } })
}

function texto(v: unknown, campo: string): string {
  if (typeof v !== 'string') throw new ErrorAcceso(`Falta ${campo}`)
  return v.trim()
}

function validarPassword(v: unknown): string {
  if (typeof v !== 'string' || v.length < MIN_PASSWORD) throw new ErrorAcceso(`La contraseña debe tener al menos ${MIN_PASSWORD} caracteres`)
  if (v.length > 72) throw new ErrorAcceso('La contraseña es demasiado larga (máximo 72 caracteres)')
  return v
}

function validarSecciones(v: unknown): string[] {
  if (!Array.isArray(v) || v.some((s) => !SECCIONES.includes(s))) throw new ErrorAcceso('Secciones no válidas')
  return [...new Set(v as string[])]
}

function validarId(v: unknown): string {
  const id = texto(v, 'id')
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new ErrorAcceso('id no válido')
  return id
}

async function hayAdmin(): Promise<boolean> {
  const { count, error } = await admin.from('perfiles').select('id', { count: 'exact', head: true }).eq('es_admin', true)
  if (error) throw error
  return (count ?? 0) > 0
}

/** Devuelve el id del administrador que hace la petición o lanza 401/403. */
async function exigirAdmin(req: Request): Promise<string> {
  const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '')
  if (!token) throw new ErrorAcceso('Inicia sesión', 401)
  const { data, error } = await admin.auth.getUser(token)
  if (error || !data.user) throw new ErrorAcceso('Sesión no válida', 401)
  const { data: perfil } = await admin.from('perfiles').select('es_admin, activo').eq('id', data.user.id).maybeSingle()
  if (!perfil?.es_admin || !perfil.activo) throw new ErrorAcceso('Solo el administrador puede hacer esto', 403)
  return data.user.id
}

/** Crea la cuenta en Auth y su perfil; si el perfil falla, borra la cuenta para no dejar huérfanos. */
async function crearCuenta(email: string, password: string, perfil: { nombre: string; es_admin: boolean; secciones: string[] }) {
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true })
  if (error || !data.user) {
    const repetido = error?.message?.toLowerCase().includes('already')
    throw new ErrorAcceso(repetido ? 'Ya existe una cuenta con ese correo' : `No se pudo crear la cuenta: ${error?.message}`)
  }
  const { error: errPerfil } = await admin.from('perfiles').insert({ id: data.user.id, email, ...perfil })
  if (errPerfil) {
    await admin.auth.admin.deleteUser(data.user.id)
    throw new ErrorAcceso(`No se pudo crear el perfil: ${errPerfil.message}`)
  }
  return data.user.id
}

async function listar() {
  const { data: perfiles, error } = await admin.from('perfiles').select('*').order('creado')
  if (error) throw error
  const accesos = new Map<string, string | null>()
  for (let pagina = 1; ; pagina++) {
    const { data, error: errUsuarios } = await admin.auth.admin.listUsers({ page: pagina, perPage: 1000 })
    if (errUsuarios) throw errUsuarios
    for (const u of data.users) accesos.set(u.id, u.last_sign_in_at ?? null)
    if (data.users.length < 1000) break
  }
  return perfiles.map((p) => ({ ...p, ultimo_acceso: accesos.get(p.id) ?? null }))
}

async function manejar(req: Request) {
  const cuerpo = (await req.json().catch(() => ({}))) as Record<string, unknown>
  const accion = cuerpo.accion

  // Sin sesión: saber si ya se configuró el administrador y configurarlo una sola vez.
  if (accion === 'estado') return { admin_configurado: await hayAdmin() }
  if (accion === 'configurar_admin') {
    if (await hayAdmin()) throw new ErrorAcceso('El administrador ya está configurado', 403)
    const password = validarPassword(cuerpo.password)
    await crearCuenta(ADMIN_EMAIL, password, { nombre: texto(cuerpo.nombre ?? '', 'nombre'), es_admin: true, secciones: SECCIONES })
    return { ok: true, email: ADMIN_EMAIL }
  }

  const yo = await exigirAdmin(req)
  switch (accion) {
    case 'listar':
      return { usuarios: await listar() }

    case 'crear': {
      const email = texto(cuerpo.email, 'correo').toLowerCase()
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new ErrorAcceso('Correo no válido')
      const id = await crearCuenta(email, validarPassword(cuerpo.password), {
        nombre: texto(cuerpo.nombre ?? '', 'nombre'),
        es_admin: false,
        secciones: validarSecciones(cuerpo.secciones ?? []),
      })
      return { ok: true, id }
    }

    case 'actualizar': {
      const id = validarId(cuerpo.id)
      const cambios: Record<string, unknown> = {}
      if (cuerpo.nombre !== undefined) cambios.nombre = texto(cuerpo.nombre, 'nombre')
      if (cuerpo.secciones !== undefined) cambios.secciones = validarSecciones(cuerpo.secciones)
      if (cuerpo.activo !== undefined) {
        if (typeof cuerpo.activo !== 'boolean') throw new ErrorAcceso('activo no válido')
        if (id === yo) throw new ErrorAcceso('No puedes desactivar tu propia cuenta')
        cambios.activo = cuerpo.activo
      }
      // El administrador siempre conserva todas las secciones.
      if (id === yo) delete cambios.secciones
      const { data, error } = await admin.from('perfiles').update(cambios).eq('id', id).select('id').maybeSingle()
      if (error) throw error
      if (!data) throw new ErrorAcceso('No existe esa cuenta', 404)
      if (cambios.activo !== undefined) {
        const { error: errBan } = await admin.auth.admin.updateUserById(id, { ban_duration: cambios.activo ? 'none' : BLOQUEO })
        if (errBan) throw errBan
      }
      return { ok: true }
    }

    case 'cambiar_password': {
      const id = validarId(cuerpo.id)
      const { error } = await admin.auth.admin.updateUserById(id, { password: validarPassword(cuerpo.password) })
      if (error) throw new ErrorAcceso(`No se pudo cambiar la contraseña: ${error.message}`)
      return { ok: true }
    }

    case 'eliminar': {
      const id = validarId(cuerpo.id)
      if (id === yo) throw new ErrorAcceso('No puedes eliminar tu propia cuenta')
      const { error } = await admin.auth.admin.deleteUser(id)
      if (error) throw new ErrorAcceso(`No se pudo eliminar: ${error.message}`)
      return { ok: true }
    }

    default:
      throw new ErrorAcceso('Acción no válida')
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return responder({ error: 'Método no permitido' }, 405)
  try {
    return responder(await manejar(req))
  } catch (e) {
    if (e instanceof ErrorAcceso) return responder({ error: e.message }, e.estado)
    console.error(e)
    return responder({ error: 'Error interno' }, 500)
  }
})
