import { useState, type FormEvent } from 'react'
import { registrar, supabase, type Colaborador } from '../lib/supabase'
import { textoDiaMes } from './fechas'
import { leerFoto } from './imagen'
import { personasSemilla, TOTAL_SEMILLA } from './semilla'
import { coincide } from './tipos'

const error = (e: unknown) => (e instanceof Error ? e.message : String(e))

export function Avatar({ foto, tamano = 40 }: { foto: string | null; tamano?: number }) {
  return foto ? (
    <img className="fel-avatar" src={foto} alt="" width={tamano} height={tamano} />
  ) : (
    <span className="fel-avatar vacio" style={{ width: tamano, height: tamano }} aria-hidden="true">
      <svg viewBox="0 0 24 24">
        <circle cx="12" cy="9" r="3.6" fill="currentColor" />
        <path d="M5 20c0-3.9 3.1-6.5 7-6.5s7 2.6 7 6.5z" fill="currentColor" />
      </svg>
    </span>
  )
}

/** Campo de foto: elige un archivo, lo reduce y muestra cómo queda. */
export function CampoFoto({ foto, onFoto, id }: { foto: string | null; onFoto: (foto: string | null) => void; id: string }) {
  const [problema, setProblema] = useState('')
  return (
    <div className="fel-foto-campo">
      <Avatar foto={foto} tamano={56} />
      <div className="fel-foto-acciones">
        <label className="btn secundario" htmlFor={id}>
          {foto ? 'Cambiar foto' : 'Subir foto'}
        </label>
        <input
          id={id}
          type="file"
          accept="image/*"
          className="fel-archivo"
          onChange={async (e) => {
            const archivo = e.target.files?.[0]
            e.target.value = ''
            if (!archivo) return
            setProblema('')
            try {
              onFoto(await leerFoto(archivo))
            } catch (err) {
              setProblema(error(err))
            }
          }}
        />
        {foto && (
          <button type="button" className="link peligro" onClick={() => onFoto(null)}>
            Quitar
          </button>
        )}
      </div>
      {problema && <div className="alerta" role="alert">{problema}</div>}
    </div>
  )
}

type Borrador = Omit<Colaborador, 'id'> & { id?: string }
const VACIO: Borrador = { nombre: '', puesto: '', area: '', foto: null, nacimiento: null, ingreso: null, activo: true }

function FormPersona({ inicial, listo, cancelar }: { inicial: Borrador; listo: (mensaje: string) => void; cancelar: () => void }) {
  const [p, setP] = useState(inicial)
  const [guardando, setGuardando] = useState(false)
  const [problema, setProblema] = useState('')
  const cambiar = (c: Partial<Borrador>) => setP((a) => ({ ...a, ...c }))

  async function guardar(e: FormEvent) {
    e.preventDefault()
    setGuardando(true)
    setProblema('')
    const fila = { nombre: p.nombre.trim(), puesto: p.puesto.trim(), area: p.area.trim(), foto: p.foto, nacimiento: p.nacimiento || null, ingreso: p.ingreso || null, activo: p.activo }
    const { error: err } = p.id ? await supabase.from('colaboradores').update(fila).eq('id', p.id) : await supabase.from('colaboradores').insert(fila)
    setGuardando(false)
    if (err) return setProblema(`No se pudo guardar: ${err.message}`)
    registrar(p.id ? 'colaborador_editado' : 'colaborador_agregado', { documento: fila.nombre })
    listo(p.id ? `Se guardaron los cambios de ${fila.nombre}.` : `${fila.nombre} quedó en el directorio.`)
  }

  async function eliminar() {
    if (!p.id || !confirm(`¿Eliminar a ${p.nombre} del directorio? Esto no se puede deshacer.`)) return
    setGuardando(true)
    const { error: err } = await supabase.from('colaboradores').delete().eq('id', p.id)
    setGuardando(false)
    if (err) return setProblema(`No se pudo eliminar: ${err.message}`)
    registrar('colaborador_eliminado', { documento: p.nombre })
    listo(`${p.nombre} se eliminó del directorio.`)
  }

  return (
    <form className="fel-form-persona" onSubmit={guardar}>
      <div className="admin-alta">
        <div className="campo">
          <label htmlFor="fp-nombre">Nombre completo</label>
          <input id="fp-nombre" required maxLength={120} value={p.nombre} onChange={(e) => cambiar({ nombre: e.target.value })} autoFocus />
        </div>
        <div className="campo">
          <label htmlFor="fp-puesto">Puesto</label>
          <input id="fp-puesto" maxLength={120} value={p.puesto} onChange={(e) => cambiar({ puesto: e.target.value })} placeholder="Auxiliar contable" />
        </div>
        <div className="campo">
          <label htmlFor="fp-area">Área o unidad</label>
          <input id="fp-area" maxLength={80} value={p.area} onChange={(e) => cambiar({ area: e.target.value })} placeholder="TREVÉ Corporativo, HAATS, Feedbak…" list="fel-areas" />
        </div>
        <div className="campo">
          <label htmlFor="fp-nac">Cumpleaños</label>
          <input id="fp-nac" type="date" value={p.nacimiento ?? ''} onChange={(e) => cambiar({ nacimiento: e.target.value || null })} />
          <small>Si no sabes el año, pon cualquiera: solo se usa el día y el mes.</small>
        </div>
        <div className="campo">
          <label htmlFor="fp-ing">Fecha de ingreso</label>
          <input id="fp-ing" type="date" value={p.ingreso ?? ''} onChange={(e) => cambiar({ ingreso: e.target.value || null })} />
          <small>Para el aniversario y los años que cumple.</small>
        </div>
      </div>
      <CampoFoto id="fp-foto" foto={p.foto} onFoto={(foto) => cambiar({ foto })} />
      {p.id && (
        <label className="casilla">
          <input type="checkbox" checked={p.activo} onChange={(e) => cambiar({ activo: e.target.checked })} />
          Activo (si ya no trabaja aquí, desmárcalo: deja de aparecer en la lista)
        </label>
      )}
      {problema && <div className="alerta" role="alert">{problema}</div>}
      <div className="admin-acciones">
        <button type="submit" className="btn primario" disabled={guardando}>
          {guardando ? 'Guardando…' : p.id ? 'Guardar cambios' : 'Agregar al directorio'}
        </button>
        <button type="button" className="btn secundario" onClick={cancelar} disabled={guardando}>
          Cancelar
        </button>
        {p.id && (
          <button type="button" className="link peligro fel-eliminar" onClick={eliminar} disabled={guardando}>
            Eliminar del directorio
          </button>
        )}
      </div>
    </form>
  )
}

/** Directorio de colaboradores: de aquí salen nombre, puesto, área y foto de cada felicitación. */
export function Directorio({ personas, recargar, usar }: { personas: Colaborador[] | null; recargar: () => void; usar: (p: Colaborador) => void }) {
  const [editando, setEditando] = useState<Borrador | null>(null)
  const [filtro, setFiltro] = useState('')
  const [hecho, setHecho] = useState('')
  const [problema, setProblema] = useState('')
  const [importando, setImportando] = useState(false)
  const areas = [...new Set((personas ?? []).map((p) => p.area).filter(Boolean))].sort()
  const lista = (personas ?? []).filter((p) => coincide(p, filtro)).sort((a, b) => Number(b.activo) - Number(a.activo) || a.nombre.localeCompare(b.nombre, 'es'))

  async function importar() {
    setImportando(true)
    setProblema('')
    try {
      const { error: err } = await supabase.from('colaboradores').insert(await personasSemilla())
      if (err) throw err
      registrar('colaborador_agregado', { documento: `${TOTAL_SEMILLA} personas de las plantillas` })
      setHecho(`Se agregaron ${TOTAL_SEMILLA} personas. Agrégales su cumpleaños y fecha de ingreso para verlos en "Próximas fechas".`)
      recargar()
    } catch (e) {
      setProblema(`No se pudo importar: ${error(e)}`)
    }
    setImportando(false)
  }

  return (
    <section className="admin-caja">
      <datalist id="fel-areas">
        {areas.map((a) => (
          <option key={a} value={a} />
        ))}
      </datalist>
      <div className="bitacora-cab">
        <h2>Directorio de colaboradores</h2>
        {!editando && (
          <button type="button" className="btn primario" onClick={() => (setEditando(VACIO), setHecho(''))}>
            + Agregar persona
          </button>
        )}
      </div>
      {hecho && (
        <div className="credenciales" role="status">
          <strong>{hecho}</strong>
        </div>
      )}
      {problema && <div className="alerta" role="alert">{problema}</div>}
      {editando && (
        <FormPersona
          key={editando.id ?? 'nuevo'}
          inicial={editando}
          cancelar={() => setEditando(null)}
          listo={(m) => (setEditando(null), setHecho(m), recargar())}
        />
      )}
      {personas === null && <p className="nota">Cargando…</p>}
      {personas?.length === 0 && !editando && (
        <div className="fel-vacio">
          <p>El directorio está vacío. Puedes empezar con las {TOTAL_SEMILLA} personas que ya aparecen en las plantillas (con su foto, puesto y área).</p>
          <button type="button" className="btn primario" onClick={importar} disabled={importando}>
            {importando ? 'Importando…' : `Importar ${TOTAL_SEMILLA} personas de las plantillas`}
          </button>
        </div>
      )}
      {personas && personas.length > 0 && (
        <>
          <div className="campo fel-filtro">
            <label htmlFor="fel-filtro">Buscar</label>
            <input id="fel-filtro" type="search" value={filtro} onChange={(e) => setFiltro(e.target.value)} placeholder="Nombre, puesto o área" />
          </div>
          <ul className="fel-directorio">
            {lista.map((p) => (
              <li key={p.id} className={p.activo ? undefined : 'inactivo'}>
                <Avatar foto={p.foto} tamano={44} />
                <div className="admin-quien">
                  <strong>{p.nombre}</strong>
                  <span>{[p.puesto, p.area].filter(Boolean).join(' · ') || 'Sin puesto'}</span>
                  <small>
                    {[p.nacimiento && `Cumpleaños ${textoDiaMes(p.nacimiento)}`, p.ingreso && `Ingreso ${p.ingreso.slice(0, 4)}`, !p.foto && 'Sin foto', !p.activo && 'Inactivo']
                      .filter(Boolean)
                      .join(' · ') || 'Sin fechas'}
                  </small>
                </div>
                <div className="admin-acciones">
                  {p.activo && (
                    <button type="button" className="btn secundario" onClick={() => usar(p)}>
                      Usar
                    </button>
                  )}
                  <button type="button" className="btn secundario" onClick={() => (setEditando(p), setHecho(''), window.scrollTo({ top: 0, behavior: 'smooth' }))}>
                    Editar
                  </button>
                </div>
              </li>
            ))}
            {lista.length === 0 && <li className="nota">Nadie coincide con “{filtro}”.</li>}
          </ul>
        </>
      )}
    </section>
  )
}
