import { useEffect, useState } from 'react'
import { IMG } from '../lib/imagenes'
import { salasApi, type Sala } from '../lib/supabase'
import { codigoLegible, error } from './util'

interface Acceso {
  sala_id: string
  codigo: string
  activo: boolean
  actualizado: string
}

const enlaceExterno = (salaId: string) => `${window.location.origin}${window.location.pathname}#externo/${salaId}`

/** Administradores de salas: código de cada sala para externos (sin cuenta) y la hoja con QR para imprimir. */
export function AccesoExternos({ salas }: { salas: Sala[] }) {
  const [acceso, setAcceso] = useState<Acceso[] | null>(null)
  const [falla, setFalla] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const [version, setVersion] = useState(0)
  const [imprimir, setImprimir] = useState<{ sala: Sala; codigo: string } | null>(null)

  useEffect(() => {
    salasApi<{ acceso: Acceso[] }>('acceso_estado').then(
      (r) => (setAcceso(r.acceso), setFalla('')),
      (e: unknown) => setFalla(error(e)),
    )
  }, [version])

  async function cambiar(salaId: string, datos: Record<string, unknown>) {
    setOcupado(true)
    setFalla('')
    try {
      await salasApi('acceso_cambiar', { sala_id: salaId, ...datos })
      setVersion((v) => v + 1)
    } catch (e) {
      setFalla(error(e))
    }
    setOcupado(false)
  }

  return (
    <section className="admin-caja">
      <h2>Reservación para externos</h2>
      <p className="nota">
        Para las personas del edificio que no son de Trevé: escanean el QR de la sala, escriben el código impreso y reservan sin cuenta. Ven solo los horarios
        ocupados (sin nombres), reciben la invitación por correo y pueden cambiar el horario o cancelar con el enlace que les llega (o con el código de su reservación y su correo). Máximo {3} reservaciones próximas por correo y 4
        horas por reunión. Todo queda en el historial como “Externo”. Si el código se comparte de más, genera uno nuevo y vuelve a imprimir la hoja.
      </p>
      {falla && <div className="alerta" role="alert">{falla}</div>}
      {!acceso ? (
        !falla && <p className="nota">Cargando…</p>
      ) : (
        <ul className="admin-lista">
          {salas.map((s) => {
            const a = acceso.find((x) => x.sala_id === s.id)
            if (!a) return null
            return (
              <li key={s.id} className="admin-usuario">
                <div className="salas-acceso">
                  <div className="admin-quien">
                    <strong>{s.nombre}</strong>
                    <span>
                      Código: <code className="salas-codigo">{codigoLegible(a.codigo)}</code> {a.activo ? '' : '· desactivado'}
                    </span>
                    <small>{enlaceExterno(s.id)}</small>
                  </div>
                  <div className="admin-acciones">
                    <button type="button" className="btn primario" disabled={!a.activo} onClick={() => setImprimir({ sala: s, codigo: a.codigo })}>
                      Hoja para imprimir
                    </button>
                    <button
                      type="button"
                      className="btn secundario"
                      disabled={ocupado}
                      onClick={() => confirm(`¿Generar un código nuevo para ${s.nombre}? El actual deja de funcionar y hay que reimprimir la hoja.`) && cambiar(s.id, { nuevo_codigo: true })}
                    >
                      Código nuevo
                    </button>
                    <label className="casilla">
                      <input type="checkbox" checked={a.activo} disabled={ocupado} onChange={(e) => cambiar(s.id, { activo: e.target.checked })} />
                      Activo
                    </label>
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      )}
      {imprimir && <HojaQR sala={imprimir.sala} codigo={imprimir.codigo} cerrar={() => setImprimir(null)} />}
    </section>
  )
}

/** Hoja carta para pegar junto a la sala: QR, código y pasos. */
function HojaQR({ sala, codigo, cerrar }: { sala: Sala; codigo: string; cerrar: () => void }) {
  const [qr, setQr] = useState('')
  const enlace = enlaceExterno(sala.id)
  useEffect(() => {
    import('qrcode').then((QR) => QR.toString(enlace, { type: 'svg', margin: 1, errorCorrectionLevel: 'M', color: { dark: '#0b4c5e', light: '#ffffff' } }).then(setQr))
  }, [enlace])
  return (
    <div className="salas-imprimir-fondo" role="dialog" aria-modal="true" aria-label={`Hoja para imprimir de ${sala.nombre}`}>
      <div className="salas-imprimir-barra">
        <button type="button" className="btn primario" onClick={() => window.print()}>
          Imprimir
        </button>
        <button type="button" className="btn secundario" onClick={cerrar}>
          Cerrar
        </button>
        <span className="nota">Tamaño carta. Pégala afuera de la sala.</span>
      </div>
      <div className="salas-hoja">
        <img className="salas-hoja-logo" src={IMG.treveLogo} alt="Trevé" />
        <div className="salas-hoja-kicker">RESERVA ESTA SALA</div>
        <h1>{sala.nombre}</h1>
        <div className="salas-hoja-qr" dangerouslySetInnerHTML={{ __html: qr }} />
        <div className="salas-hoja-codigo-etq">Código de acceso</div>
        <div className="salas-hoja-codigo">{codigoLegible(codigo)}</div>
        <ol className="salas-hoja-pasos">
          <li>Escanea el código QR con la cámara de tu celular.</li>
          <li>Escribe el código de acceso de esta hoja.</li>
          <li>Elige día y hora libres y escribe tus datos y los de tus invitados.</li>
          <li>Te llega la invitación a tu correo. Para cambiar el horario o cancelar, usa el enlace que viene en ella (o escanea este QR y entra con el código de tu reservación).</li>
        </ol>
        <div className="salas-hoja-pie">
          Lunes a viernes de 7:00 a.m. a 9:00 p.m., hora de Tijuana · {enlace.replace(/^https?:\/\//, '')}
        </div>
      </div>
    </div>
  )
}
