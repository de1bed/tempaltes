import { useEffect, useState } from 'react'
import { salasApi } from '../lib/supabase'

interface Estado {
  configurado: boolean
  conexion: { cuenta: string; actualizado: string } | null
  calendarios: { id: string; nombre: string }[]
  salas: { id: string; nombre: string; calendario_id: string | null; calendario_nombre: string | null }[]
  aviso: string | null
  /** Calendario .ics de cada sala (para suscribir) y enlace que publica Outlook (para leer). */
  ics: { sala_id: string; feed: string; publicado: string | null }[]
  /** La cuenta conectada dio permiso de mandar correos (avisos de solicitudes). */
  correo?: boolean
}

const RESULTADOS: Record<string, string> = {
  conectado: 'Outlook quedó conectado. Ahora elige qué calendario es cada sala.',
  cancelado: 'Se canceló la conexión con Outlook.',
  error: 'No se pudo conectar Outlook. Intenta de nuevo.',
}

const REDIRECCION = 'https://ficswawndpxegjkzxkvj.supabase.co/functions/v1/salas'
const textoError = (e: unknown) => (e instanceof Error ? e.message : String(e))

function Copiar({ texto }: { texto: string }) {
  const [listo, setListo] = useState(false)
  return (
    <button
      type="button"
      className="btn secundario"
      onClick={() =>
        navigator.clipboard.writeText(texto).then(
          () => (setListo(true), setTimeout(() => setListo(false), 2000)),
          () => window.prompt('Copia el enlace:', texto),
        )
      }
    >
      {listo ? 'Copiado ✓' : 'Copiar'}
    </button>
  )
}

/** Enlace publicado de Outlook para una sala: pegar, probar y guardar. */
function Publicado({ salaId, nombre, actual, alGuardar }: { salaId: string; nombre: string; actual: string | null; alGuardar: () => void }) {
  const [url, setUrl] = useState(actual ?? '')
  const [estado, setEstado] = useState<{ ok: boolean; texto: string } | null>(null)
  const [ocupado, setOcupado] = useState(false)

  async function guardar(valor: string) {
    setOcupado(true)
    setEstado(null)
    try {
      const r = await salasApi<{ proximos: number }>('ics_publicado', { sala_id: salaId, url: valor })
      setEstado({ ok: true, texto: valor ? `Listo: la app ya lee el calendario de ${nombre} (${r.proximos} eventos en los próximos 30 días).` : 'Se quitó el enlace.' })
      if (!valor) setUrl('')
      alGuardar()
    } catch (e) {
      setEstado({ ok: false, texto: textoError(e) })
    }
    setOcupado(false)
  }

  return (
    <div className="campo">
      <label htmlFor={`pub-${salaId}`}>Enlace ICS publicado de {nombre}</label>
      <div className="salas-enlace">
        <input id={`pub-${salaId}`} type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://outlook.live.com/owa/calendar/…/calendar.ics" />
        <button type="button" className="btn primario" disabled={ocupado || !url.trim() || url.trim() === actual} onClick={() => guardar(url.trim())}>
          {ocupado ? 'Probando…' : 'Guardar'}
        </button>
        {actual && (
          <button type="button" className="link peligro" disabled={ocupado} onClick={() => guardar('')}>
            Quitar
          </button>
        )}
      </div>
      {actual && !estado && <small>✓ La app marca como ocupado lo que se agenda en este calendario de Outlook.</small>}
      {estado && <div className={estado.ok ? 'credenciales salas-ok' : 'alerta'} role="status">{estado.texto}</div>}
    </div>
  )
}

/** Solo administrador: cómo se conectan las salas con Outlook (sin Azure y, opcional, conexión completa). */
/** Diagnóstico: manda un correo de prueba desde la cuenta conectada y muestra lo que contestó Microsoft. */
function ProbarCorreo() {
  const [para, setPara] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [resultado, setResultado] = useState<{ ok: boolean; texto: string } | null>(null)
  async function probar() {
    setEnviando(true)
    setResultado(null)
    try {
      const r = await salasApi<{ ok: boolean; para: string; error: string | null }>('outlook_probar_correo', para.trim() ? { para: para.trim() } : {})
      setResultado(
        r.ok
          ? { ok: true, texto: `Microsoft aceptó el correo para ${r.para}. Si no llega en unos minutos, revisa spam o cuarentena en ese correo, y en outlook.live.com (cuenta de salas) los "Elementos enviados" y si hay avisos de "No se puede entregar".` }
          : { ok: false, texto: `Microsoft no aceptó el correo: ${r.error}` },
      )
    } catch (e) {
      setResultado({ ok: false, texto: textoError(e) })
    }
    setEnviando(false)
  }
  return (
    <details className="salas-paso">
      <summary>¿No llegan los correos? Probar envío</summary>
      <div className="salas-enlace">
        <input aria-label="Correo de prueba" type="email" placeholder="Correo de destino (vacío = el tuyo)" value={para} onChange={(e) => setPara(e.target.value)} />
        <button type="button" className="btn secundario" onClick={probar} disabled={enviando}>
          {enviando ? 'Enviando…' : 'Mandar prueba'}
        </button>
      </div>
      {resultado && (
        <div className={resultado.ok ? 'credenciales' : 'alerta'} role="status">
          {resultado.texto}
        </div>
      )}
      <p className="nota">En Historial cada movimiento dice a quién se avisó y si fue por Outlook o por correo.</p>
    </details>
  )
}

export function ConexionOutlook({ alCambiar }: { alCambiar: () => void }) {
  const [estado, setEstado] = useState<Estado | null>(null)
  const [error, setError] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const [version, setVersion] = useState(0)
  // Resultado al regresar de Microsoft (?outlook=conectado); se quita de la dirección.
  const [resultado] = useState(() => {
    const params = new URLSearchParams(window.location.search)
    const valor = params.get('outlook')
    if (valor) {
      params.delete('outlook')
      const busqueda = params.toString()
      history.replaceState(null, '', window.location.pathname + (busqueda ? `?${busqueda}` : '') + window.location.hash)
    }
    return valor ? (RESULTADOS[valor] ?? '') : ''
  })

  useEffect(() => {
    salasApi<Estado>('outlook_estado').then(
      (r) => (setEstado(r), setError('')),
      (e: unknown) => setError(textoError(e)),
    )
  }, [version])

  async function hacer(accion: string, datos: Record<string, unknown> = {}) {
    setError('')
    setOcupado(true)
    try {
      const r = await salasApi<{ url?: string }>(accion, datos)
      if (r.url) {
        window.location.assign(r.url)
        return
      }
      setVersion((v) => v + 1)
      alCambiar()
    } catch (e) {
      setError(textoError(e))
    } finally {
      setOcupado(false)
    }
  }

  const conectar = () => hacer('outlook_iniciar', { volver: window.location.origin + window.location.pathname })
  const salas = estado?.salas ?? []
  const icsDe = (id: string) => estado?.ics.find((x) => x.sala_id === id)
  const completa = Boolean(estado?.conexion)

  return (
    <section className="admin-caja salas-outlook">
      <h2>Calendario de Outlook</h2>
      {resultado && (
        <div className="credenciales" role="status">
          <strong>{resultado}</strong>
        </div>
      )}
      {error && <div className="alerta" role="alert">{error}</div>}
      {!estado ? (
        !error && <p className="nota">Cargando…</p>
      ) : (
        <>
          {completa && (
            <p className="nota">
              ✓ Conexión completa activa con <strong>{estado.conexion!.cuenta}</strong>: las reservaciones se copian solas al calendario de cada sala y
              llegan las invitaciones. Los pasos 1 y 2 son opcionales.
            </p>
          )}
          {completa && estado.correo && <ProbarCorreo />}
          {completa && !estado.correo && (
            <div className="alerta" role="status">
              Falta el permiso de correo para avisar por email de las solicitudes de horario. En el paso 3 da clic en <strong>“Volver a conectar”</strong> y acepta
              los permisos (las invitaciones de calendario ya funcionan).
            </div>
          )}

          <div className="salas-paso">
            <h3>1 · Ver las reservaciones de la app en Outlook</h3>
            <p className="nota">
              En <strong>outlook.live.com</strong> → Calendario → <strong>Agregar calendario</strong> → <strong>Suscribirse desde la web</strong> → pega el enlace
              de la sala → ponle nombre → <strong>Importar</strong>. Se hace una vez por sala (y cualquiera del equipo puede suscribirse). Outlook lo actualiza
              solo cada pocas horas; para verlo al momento, cada quien usa “Agregar a mi Outlook” al reservar.
            </p>
            {salas.map((s) => {
              const ics = icsDe(s.id)
              if (!ics) return null
              return (
                <div className="campo" key={s.id}>
                  <label htmlFor={`feed-${s.id}`}>Calendario de {s.nombre}</label>
                  <div className="salas-enlace">
                    <input id={`feed-${s.id}`} readOnly value={ics.feed} onFocus={(e) => e.target.select()} />
                    <Copiar texto={ics.feed} />
                    <button
                      type="button"
                      className="link peligro"
                      disabled={ocupado}
                      title="Si el enlace se compartió de más: el anterior deja de funcionar y hay que volver a suscribirse"
                      onClick={() => confirm(`¿Crear un enlace nuevo para ${s.nombre}? El actual deja de funcionar.`) && hacer('ics_regenerar', { sala_id: s.id })}
                    >
                      Cambiar enlace
                    </button>
                  </div>
                </div>
              )
            })}
          </div>

          <div className="salas-paso">
            <h3>2 · Que la app vea lo que se agenda directo en Outlook</h3>
            <p className="nota">
              En <strong>outlook.live.com</strong> → ⚙ Configuración → Calendario → <strong>Calendarios compartidos</strong> → <strong>Publicar un calendario</strong>{' '}
              → elige el calendario de la sala y <strong>“Puede ver todos los detalles”</strong> → Publicar → copia el <strong>vínculo ICS</strong> (no el HTML) y
              pégalo aquí. La app lo revisa al mostrar horarios y antes de cada reservación.
            </p>
            {salas.map((s) => (
              <Publicado key={s.id} salaId={s.id} nombre={s.nombre} actual={icsDe(s.id)?.publicado ?? null} alGuardar={() => (setVersion((v) => v + 1), alCambiar())} />
            ))}
          </div>

          <details className="salas-paso salas-completa" open={completa || !!resultado}>
            <summary>
              <h3>3 · Conexión completa (opcional, requiere Azure)</h3>
            </summary>
            <p className="nota">Copia cada reservación al momento al calendario de la sala, manda las invitaciones y lee Outlook en tiempo real.</p>
            {!estado.configurado ? (
              <ol className="salas-guia">
                <li>
                  Entra a <strong>entra.microsoft.com</strong> (o portal.azure.com) con tu cuenta de Microsoft. Si pide crear un directorio o cuenta gratuita de
                  Azure, acéptalo: no cobra por esto.
                </li>
                <li>
                  <strong>Aplicaciones → Registros de aplicaciones → Nuevo registro</strong>. Nombre: <em>Treve Salas</em>. Tipo de cuenta:{' '}
                  <strong>Solo cuentas personales de Microsoft</strong>.
                </li>
                <li>
                  URI de redirección: plataforma <strong>Web</strong> y esta dirección: <code>{REDIRECCION}</code> <Copiar texto={REDIRECCION} />
                </li>
                <li>
                  Copia el <strong>Id. de aplicación (cliente)</strong>.
                </li>
                <li>
                  <strong>Certificados y secretos → Nuevo secreto de cliente</strong> (24 meses) → copia el <strong>Valor</strong> (solo se ve una vez).
                </li>
                <li>
                  <strong>Permisos de API → Agregar → Microsoft Graph → Delegados</strong>: <code>Calendars.ReadWrite</code>, <code>User.Read</code>,{' '}
                  <code>offline_access</code>.
                </li>
                <li>
                  En Supabase → Edge Functions → <strong>Secrets</strong> agrega <code>MS_CLIENT_ID</code> (el Id.) y <code>MS_CLIENT_SECRET</code> (el Valor).
                  Al recargar esta página aparece el botón “Conectar Outlook”.
                </li>
              </ol>
            ) : !estado.conexion ? (
              <>
                <p className="nota">La app ya está registrada en Microsoft. Conecta la cuenta de Outlook donde están los calendarios de las salas (una sola vez).</p>
                <div className="admin-acciones">
                  <button type="button" className="btn primario" disabled={ocupado} onClick={conectar}>
                    Conectar Outlook
                  </button>
                </div>
              </>
            ) : (
              <>
                {estado.aviso && <div className="alerta" role="alert">{estado.aviso}</div>}
                <div className="admin-alta">
                  {salas.map((s) => (
                    <div className="campo" key={s.id}>
                      <label htmlFor={`cal-${s.id}`}>Calendario de {s.nombre}</label>
                      <select
                        id={`cal-${s.id}`}
                        value={s.calendario_id ?? ''}
                        disabled={ocupado}
                        onChange={(e) => {
                          const cal = estado.calendarios.find((c) => c.id === e.target.value)
                          hacer('outlook_asignar', { sala_id: s.id, calendario_id: cal?.id ?? null, calendario_nombre: cal?.nombre ?? null })
                        }}
                      >
                        <option value="">Sin calendario (pasos 1 y 2)</option>
                        {s.calendario_id && !estado.calendarios.some((c) => c.id === s.calendario_id) && (
                          <option value={s.calendario_id}>{s.calendario_nombre ?? 'Calendario actual'}</option>
                        )}
                        {estado.calendarios.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.nombre}
                          </option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
                <div className="admin-acciones">
                  <button type="button" className="btn secundario" disabled={ocupado} onClick={conectar}>
                    Volver a conectar
                  </button>
                  <button type="button" className="link peligro" disabled={ocupado} onClick={() => hacer('outlook_desconectar')}>
                    Desconectar
                  </button>
                </div>
              </>
            )}
          </details>
        </>
      )}
    </section>
  )
}
