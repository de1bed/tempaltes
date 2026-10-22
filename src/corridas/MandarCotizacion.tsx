import { useState } from 'react'
import { dinero } from '../lib/formato'
import { registrar, type Perfil } from '../lib/supabase'
import type { ResultadoCorrida } from './calculo'
import { enviarCorrida, NOMBRES_CORRIDA, resumenCorrida } from './envios'
import type { CorridaData, CorridaId } from './tipos'

/** Botón de la corrida: la manda a la bandeja de quienes hacen cotizaciones. */
export function MandarCotizacion({ id, d, r, perfil, deshabilitado }: { id: CorridaId; d: CorridaData; r: ResultadoCorrida; perfil: Perfil; deshabilitado: boolean }) {
  const [abierto, setAbierto] = useState(false)
  const [nota, setNota] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState('')
  const [listo, setListo] = useState(false)
  const s = resumenCorrida(r)

  function cerrar() {
    setAbierto(false)
    setNota('')
    setError('')
    setListo(false)
  }

  async function enviar() {
    setError('')
    setEnviando(true)
    try {
      await enviarCorrida(id, d, r, perfil, nota)
      registrar('corrida_enviada', { plantilla: id, documento: `${NOMBRES_CORRIDA[id]} · ${d.puesto || 'sin puesto'} · ${d.empresa || 'sin cliente'}`, detalle: d })
      setListo(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setEnviando(false)
    }
  }

  return (
    <>
      <button type="button" className="btn secundario" disabled={deshabilitado} onClick={() => setAbierto(true)} title={deshabilitado ? 'Completa los datos marcados en el formulario' : 'La corrida llega a la bandeja de cotizaciones'}>
        Mandar a cotizaciones
      </button>
      {abierto && (
        <div className="modal-fondo" onClick={(e) => e.target === e.currentTarget && cerrar()} onKeyDown={(e) => e.key === 'Escape' && cerrar()}>
          <div className="modal acceso-caja envio-modal" role="dialog" aria-modal="true" aria-labelledby="envio-titulo">
            <h1 id="envio-titulo">Mandar a cotizaciones</h1>
            {listo ? (
              <div className="acceso-form">
                <p className="acceso-nota">Listo. Quien hace cotizaciones la verá en "Corridas recibidas" y la convierte en cotización con un clic.</p>
                <button type="button" className="btn primario" onClick={cerrar}>
                  Cerrar
                </button>
              </div>
            ) : (
              <div className="acceso-form">
                <dl className="resumen">
                  <dt>Corrida</dt>
                  <dd>{NOMBRES_CORRIDA[id]}</dd>
                  <dt>Cliente</dt>
                  <dd>{d.empresa || '—'}</dd>
                  <dt>Puesto</dt>
                  <dd>{d.puesto || '—'}</dd>
                  <dt>Bruto semanal</dt>
                  <dd>{dinero(s.brutoSemanal)}</dd>
                  <dt>Patronales semanal</dt>
                  <dd>{dinero(s.patronalesSemanal)}</dd>
                  <dt>Finiquito semanal</dt>
                  <dd>{dinero(s.provisionSemanal)}</dd>
                </dl>
                {s.dias !== 7 && <small className="nota">La corrida es {s.periodo.toLowerCase()}: los montos se llevan a semana para la cotización.</small>}
                <div className="campo">
                  <label htmlFor="envio-nota">Nota para cotizaciones (opcional)</label>
                  <textarea id="envio-nota" rows={3} maxLength={1000} value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Ej. 5 posiciones, iniciar en noviembre" />
                </div>
                {error && <div className="alerta" role="alert">{error}</div>}
                <div className="admin-acciones">
                  <button type="button" className="btn secundario" onClick={cerrar}>
                    Cancelar
                  </button>
                  <button type="button" className="btn primario" disabled={enviando} onClick={enviar}>
                    {enviando ? 'Enviando…' : 'Enviar'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
