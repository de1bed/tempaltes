import { useState } from 'react'
import { guardarArchivo } from '../lib/guardar'
import type { Reservacion } from '../lib/supabase'
import { archivoIcs, enlaceGoogle, enlaceOutlook } from './agregar'

/** Botones para pasar la reservación al calendario propio (Outlook, Google o archivo .ics). */
export function AgregarCalendario({ r, sala, compacto = false }: { r: Reservacion; sala: string; compacto?: boolean }) {
  const [falla, setFalla] = useState('')
  // El visor de artifacts no deja descargar .ics; en la app normal sí.
  const conIcs = import.meta.env.MODE !== 'artifact'
  return (
    <div className={compacto ? 'salas-agregar compacto' : 'salas-agregar'}>
      {!compacto && <span className="salas-agregar-titulo">Agrégala a tu calendario e invita desde ahí:</span>}
      <a className={compacto ? 'link salas-agregar-link' : 'btn primario'} href={enlaceOutlook(r, sala)} target="_blank" rel="noopener noreferrer">
        {compacto ? 'Outlook' : 'Agregar a mi Outlook'}
      </a>
      <a className={compacto ? 'link salas-agregar-link' : 'btn secundario'} href={enlaceOutlook(r, sala, true)} target="_blank" rel="noopener noreferrer" title="Outlook de Microsoft 365 (cuenta de trabajo)">
        Outlook trabajo
      </a>
      <a className={compacto ? 'link salas-agregar-link' : 'btn secundario'} href={enlaceGoogle(r, sala)} target="_blank" rel="noopener noreferrer">
        Google
      </a>
      {conIcs && (
        <button
          type="button"
          className={compacto ? 'link salas-agregar-link' : 'btn secundario'}
          onClick={() => guardarArchivo(archivoIcs(r, sala), `${r.codigo}.ics`).catch((e: unknown) => setFalla(e instanceof Error ? e.message : String(e)))}
          title="Para Outlook de escritorio, Apple Calendar y otros"
        >
          Archivo .ics
        </button>
      )}
      {falla && <span className="alerta">{falla}</span>}
    </div>
  )
}
