import { useState, type FormEvent } from 'react'
import type { EstadoOutlook } from '../lib/supabase'
import { CampoInvitados } from './componentes'
import { conPendientes, error } from './util'

export interface Detalles {
  motivo: string
  personas: number
  invitados: string[]
  notas: string
  enlace_reunion: string
}

/**
 * Cambiar motivo, personas, invitados, link o notas sin tocar el horario.
 * Solo se manda lo que cambió; los invitados reciben la actualización (los nuevos, la invitación).
 */
export function EditarDetalles({
  inicial,
  guardar,
  alCerrar,
  alTerminar,
}: {
  inicial: Detalles
  guardar: (cambios: Partial<Detalles>) => Promise<EstadoOutlook>
  alCerrar: () => void
  alTerminar: (texto: string, detalle?: string) => void
}) {
  const [motivo, setMotivo] = useState(inicial.motivo)
  const [personas, setPersonas] = useState(String(inicial.personas))
  const [invitados, setInvitados] = useState(inicial.invitados)
  const [enlace, setEnlace] = useState(inicial.enlace_reunion)
  const [notas, setNotas] = useState(inicial.notas)
  const [enviando, setEnviando] = useState(false)
  const [falla, setFalla] = useState('')

  async function enviar(e: FormEvent) {
    e.preventDefault()
    setFalla('')
    const lista = conPendientes('editar-invitados', invitados)
    const nuevos: Detalles = { motivo: motivo.trim(), personas: Number(personas), invitados: lista, notas: notas.trim(), enlace_reunion: enlace.trim() }
    const cambios = Object.fromEntries(
      (Object.keys(nuevos) as (keyof Detalles)[]).filter((k) => JSON.stringify(nuevos[k]) !== JSON.stringify(inicial[k])).map((k) => [k, nuevos[k]]),
    ) as Partial<Detalles>
    if (Object.keys(cambios).length === 0) return setFalla('No cambiaste nada.')
    setEnviando(true)
    try {
      const outlook = await guardar(cambios)
      const agregados = lista.filter((x) => !inicial.invitados.includes(x)).length
      const quitados = inicial.invitados.filter((x) => !lista.includes(x)).length
      const detalle = [
        agregados ? `${agregados} ${agregados === 1 ? 'invitado nuevo recibe' : 'invitados nuevos reciben'} la invitación` : '',
        quitados ? `${quitados} ${quitados === 1 ? 'quitado recibe' : 'quitados reciben'} la cancelación` : '',
        outlook === 'ok' ? 'Outlook avisó a todos' : outlook === 'error' ? 'Outlook no respondió: el aviso se mandó por correo' : 'Se avisó por correo',
      ]
        .filter(Boolean)
        .join(' · ')
      alTerminar('Se actualizaron los datos de la reunión.', detalle)
    } catch (err) {
      setFalla(error(err))
      setEnviando(false)
    }
  }

  return (
    <form className="salas-form editar-detalles" onSubmit={enviar}>
      <strong>Editar detalles</strong>
      <small className="nota">El horario no cambia (para eso usa "Cambiar horario").</small>
      <div className="admin-alta">
        <div className="campo">
          <label htmlFor="editar-motivo">Motivo de la reunión</label>
          <input id="editar-motivo" type="text" required maxLength={200} value={motivo} onChange={(e) => setMotivo(e.target.value)} />
        </div>
        <div className="campo">
          <label htmlFor="editar-personas">Personas</label>
          <input id="editar-personas" type="number" min={1} max={100} required value={personas} onChange={(e) => setPersonas(e.target.value)} />
        </div>
      </div>
      <div className="campo">
        <label htmlFor="editar-invitados">Invitados</label>
        <CampoInvitados id="editar-invitados" valor={invitados} onChange={setInvitados} />
      </div>
      <div className="campo">
        <label htmlFor="editar-enlace">Link de reunión (Meet, Zoom, etc.)</label>
        <input id="editar-enlace" type="url" maxLength={500} value={enlace} onChange={(e) => setEnlace(e.target.value)} placeholder="https://…" />
      </div>
      <div className="campo">
        <label htmlFor="editar-notas">Notas</label>
        <textarea id="editar-notas" rows={2} maxLength={1000} value={notas} onChange={(e) => setNotas(e.target.value)} />
      </div>
      {falla && <div className="alerta" role="alert">{falla}</div>}
      <div className="admin-acciones">
        <button type="button" className="btn secundario" onClick={alCerrar}>
          Cancelar
        </button>
        <button type="submit" className="btn primario" disabled={enviando}>
          {enviando ? 'Guardando…' : 'Guardar cambios'}
        </button>
      </div>
    </form>
  )
}
