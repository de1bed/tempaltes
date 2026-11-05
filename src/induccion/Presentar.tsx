import { useEffect, useRef, useState } from 'react'
import { pasosVisibles } from '../../supabase/functions/induccion/logica'
import { IMG } from '../lib/imagenes'
import { codigoLegible, enlaceSesion, firmar, mensaje, type Curso, type PasoVisible, type Presentacion } from './api'
import { Reproductor } from './Reproductor'
import { useQr } from './qr'

/** QR grande con el código, para proyectar y que el grupo entre desde el celular. */
export function PantallaQR({ codigo, titulo, texto }: { codigo: string; titulo: string; texto: string }) {
  const qr = useQr(enlaceSesion(codigo))
  return (
    <div className="ind-pantalla-qr">
      <img src={IMG.treveLogo} alt="Trevé" className="ind-qr-logo" />
      <h2>{titulo}</h2>
      <p>{texto}</p>
      <div className="ind-qr-grande" dangerouslySetInnerHTML={{ __html: qr }} />
      <div className="ind-qr-codigo">{codigoLegible(codigo)}</div>
      <small>{enlaceSesion(codigo).replace(/^https?:\/\//, '')}</small>
    </div>
  )
}

/**
 * Proyectar la inducción (Recursos Humanos): las diapositivas y videos en grande; al final, el QR
 * para que el grupo conteste el cuestionario. Sin código es solo una vista previa del curso.
 */
export function Presentar({ curso, presentaciones, codigo, cerrar }: { curso: Curso; presentaciones: Presentacion[]; codigo?: string; cerrar: () => void }) {
  const [pasos, setPasos] = useState<PasoVisible[] | null>(null)
  const [falla, setFalla] = useState('')
  const [pos, setPos] = useState({ paso: 0, pagina: 0 })
  const [qr, setQr] = useState(false)
  const caja = useRef<HTMLDivElement>(null)
  const [completa, setCompleta] = useState(false)

  useEffect(() => {
    pasosVisibles(curso, presentaciones, (r) => firmar(r)).then(setPasos, (e) => setFalla(mensaje(e)))
  }, [curso, presentaciones])

  useEffect(() => {
    const cambio = () => setCompleta(document.fullscreenElement === caja.current)
    document.addEventListener('fullscreenchange', cambio)
    return () => document.removeEventListener('fullscreenchange', cambio)
  }, [])

  // Esc cierra (si no está en pantalla completa: ahí Esc solo sale de ella).
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => e.key === 'Escape' && !document.fullscreenElement && cerrar()
    window.addEventListener('keydown', tecla)
    return () => window.removeEventListener('keydown', tecla)
  }, [cerrar])

  const pantallaCompleta = () => (document.fullscreenElement ? document.exitFullscreen() : caja.current?.requestFullscreen?.())?.catch(() => {})

  return (
    <div className="ind-presentar" ref={caja} role="dialog" aria-modal="true" aria-label={codigo ? 'Presentar inducción' : 'Vista previa del curso'}>
      <div className="ind-presentar-barra">
        <strong>{codigo ? `Presentando · código ${codigoLegible(codigo)}` : 'Vista previa'}</strong>
        <span className="ind-presentar-acciones">
          {codigo && (
            <button type="button" className="btn secundario chico" onClick={() => setQr((v) => !v)}>
              {qr ? 'Volver a la presentación' : 'Mostrar QR'}
            </button>
          )}
          {document.fullscreenEnabled && (
            <button type="button" className="btn secundario chico" onClick={pantallaCompleta}>
              {completa ? 'Salir de pantalla completa' : 'Pantalla completa'}
            </button>
          )}
          <button type="button" className="btn secundario chico" onClick={cerrar}>
            Cerrar
          </button>
        </span>
      </div>
      <div className="ind-presentar-cuerpo">
        {falla && <div className="alerta" role="alert">{falla}</div>}
        {qr && codigo ? (
          <PantallaQR codigo={codigo} titulo="Contesta el cuestionario" texto="Escanea el código con la cámara de tu celular y escribe tu nombre." />
        ) : !pasos ? (
          !falla && <p className="nota">Cargando…</p>
        ) : pasos.length === 0 ? (
          <p className="nota">El curso todavía no tiene pasos listos: sube las presentaciones en Contenido.</p>
        ) : (
          <Reproductor
            pasos={pasos}
            paso={pos.paso}
            pagina={pos.pagina}
            vistos={[]}
            exigirVideos={false}
            mover={(paso, pagina) => setPos({ paso, pagina })}
            videoVisto={() => {}}
            alTerminar={() => (codigo ? setQr(true) : cerrar())}
            textoFinal={codigo ? 'Mostrar QR del cuestionario' : 'Terminar'}
          />
        )}
      </div>
    </div>
  )
}
