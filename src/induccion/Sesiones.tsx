import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { faltante } from '../../supabase/functions/induccion/logica'
import { registrar, supabase, type Perfil } from '../lib/supabase'
import { codigoLegible, duracion, enlaceSesion, fechaHora, generarCodigo, mensaje, type Curso, type Participante, type Paso, type Presentacion, type Sesion } from './api'
import { PantallaQR } from './Presentar'
import { useQr } from './qr'

/** Cómo va una persona, en palabras (y un tono para el color). */
function estadoDe(p: Participante, incluyeContenido: boolean, pasos: Paso[]): { texto: string; tono: 'ok' | 'mal' | 'curso' } {
  if (p.aprobado_en) return { texto: `Aprobó · ${p.mejor_calificacion ?? '—'}`, tono: 'ok' }
  if (p.intentos > 0) return { texto: `No ha aprobado · ${p.mejor_calificacion ?? 0} · ${p.intentos} ${p.intentos === 1 ? 'intento' : 'intentos'}`, tono: 'mal' }
  if (!incluyeContenido || p.contenido_terminado) return { texto: 'Contestando el cuestionario', tono: 'curso' }
  const paso = pasos[p.paso]
  if (!paso) return { texto: 'Empezando', tono: 'curso' }
  return { texto: `Paso ${p.paso + 1} de ${pasos.length}: ${paso.titulo}${paso.tipo === 'diapositivas' ? ` (diapositiva ${p.pagina + 1})` : ''}`, tono: 'curso' }
}

const DIAS = { individual: 30, grupo: 2 }

/** Abierta y sin vencer. */
const estaVigente = (s: Sesion) => s.activa && Date.parse(s.vence) > Date.now()

function NuevaSesion({ perfil, curso, creada }: { perfil: Perfil; curso: Curso; creada: (s: Sesion) => void }) {
  const [tipo, setTipo] = useState<'individual' | 'grupo'>('individual')
  const [nombre, setNombre] = useState('')
  const [correo, setCorreo] = useState('')
  const [incluye, setIncluye] = useState(true)
  const [dias, setDias] = useState(DIAS.individual)
  const [falla, setFalla] = useState('')
  const [enviando, setEnviando] = useState(false)

  function cambiarTipo(t: 'individual' | 'grupo') {
    setTipo(t)
    // En grupo normalmente se proyecta la presentación y en el celular solo se contesta.
    setIncluye(t === 'individual')
    setDias(DIAS[t])
  }

  async function crear(e: FormEvent) {
    e.preventDefault()
    setFalla('')
    if (nombre.trim().length < 3) return setFalla(tipo === 'individual' ? 'Escribe el nombre de la persona.' : 'Escribe un nombre para el grupo (por ejemplo, "Ingresos 10 de noviembre").')
    setEnviando(true)
    try {
      // El código es único: si (muy rara vez) ya existe, se intenta con otro.
      for (let i = 0; i < 5; i++) {
        const { data, error } = await supabase
          .from('induccion_sesiones')
          .insert({
            curso_id: curso.id,
            codigo: generarCodigo(),
            tipo,
            nombre: nombre.trim(),
            correo: tipo === 'individual' && correo.trim() ? correo.trim().toLowerCase() : null,
            incluye_contenido: incluye,
            vence: new Date(Date.now() + dias * 24 * 3600_000).toISOString(),
            creada_por_nombre: perfil.nombre || perfil.email,
          })
          .select('*')
          .single()
        if (error?.code === '23505') continue
        if (error) throw error
        registrar('induccion_sesion', { documento: `${tipo === 'individual' ? 'Inducción de' : 'Grupo'} ${nombre.trim()} · ${data.codigo}`, detalle: { tipo, incluye_contenido: incluye, dias } })
        setNombre('')
        setCorreo('')
        creada(data as Sesion)
        break
      }
    } catch (err) {
      setFalla(mensaje(err))
    }
    setEnviando(false)
  }

  return (
    <form className="admin-caja" onSubmit={crear}>
      <h2>Nueva sesión</h2>
      <div className="vista-toggle ind-tipo" role="group" aria-label="Tipo de sesión">
        <button type="button" className={tipo === 'individual' ? 'activo' : undefined} aria-pressed={tipo === 'individual'} onClick={() => cambiarTipo('individual')}>
          Una persona
        </button>
        <button type="button" className={tipo === 'grupo' ? 'activo' : undefined} aria-pressed={tipo === 'grupo'} onClick={() => cambiarTipo('grupo')}>
          Grupo (QR)
        </button>
      </div>
      <p className="nota">
        {tipo === 'individual'
          ? 'La persona recibe un enlace o código y toma la inducción a su ritmo, desde el celular o la computadora. Puede pausar y retomar con el mismo código.'
          : 'Para varias personas a la vez: proyectas el QR, cada quien entra desde su celular con su nombre y aquí ves en vivo cómo va cada una.'}
      </p>
      <div className="admin-alta">
        <div className="campo">
          <label htmlFor="ses-nombre">{tipo === 'individual' ? 'Nombre de la persona' : 'Nombre del grupo'}</label>
          <input id="ses-nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} maxLength={120} placeholder={tipo === 'individual' ? 'Nombre completo' : 'Ingresos 10 de noviembre'} />
        </div>
        {tipo === 'individual' && (
          <div className="campo">
            <label htmlFor="ses-correo">Correo (opcional)</label>
            <input id="ses-correo" type="email" value={correo} onChange={(e) => setCorreo(e.target.value)} maxLength={200} />
          </div>
        )}
        <div className="campo">
          <label htmlFor="ses-dias">El código vale por</label>
          <select id="ses-dias" value={dias} onChange={(e) => setDias(Number(e.target.value))}>
            {[1, 2, 7, 15, 30, 60].map((d) => (
              <option key={d} value={d}>
                {d === 1 ? '1 día' : `${d} días`}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="campo-check">
        <label>
          <input type="checkbox" checked={incluye} onChange={(e) => setIncluye(e.target.checked)} />
          {tipo === 'grupo' ? 'Cada persona ve la presentación en su celular (si no, se proyecta y en el celular solo se contesta)' : 'Incluir la presentación y los videos antes del cuestionario'}
        </label>
      </div>
      {falla && <div className="alerta" role="alert">{falla}</div>}
      <div className="admin-acciones">
        <button type="submit" className="btn primario" disabled={enviando}>
          {enviando ? 'Creando…' : 'Crear sesión'}
        </button>
      </div>
    </form>
  )
}

function Compartir({ sesion }: { sesion: Sesion }) {
  const enlace = enlaceSesion(sesion.codigo)
  const qr = useQr(enlace)
  const [copiado, setCopiado] = useState(false)
  const mensajeTexto = `Hola${sesion.tipo === 'individual' ? ` ${sesion.nombre.split(' ')[0]}` : ''}, esta es tu inducción de TREVÉ: ${enlace} (código ${codigoLegible(sesion.codigo)}).`
  return (
    <div className="ind-compartir">
      <div className="ind-qr-chico" dangerouslySetInnerHTML={{ __html: qr }} />
      <div className="ind-compartir-datos">
        <span className="nota">Código</span>
        <code className="ind-codigo">{codigoLegible(sesion.codigo)}</code>
        <small className="ind-enlace">{enlace}</small>
        <div className="admin-acciones">
          <button
            type="button"
            className="btn secundario chico"
            onClick={() => navigator.clipboard?.writeText(mensajeTexto).then(() => (setCopiado(true), setTimeout(() => setCopiado(false), 2000)))}
          >
            {copiado ? '¡Copiado!' : 'Copiar mensaje con enlace'}
          </button>
          <a className="btn secundario chico" href={`https://wa.me/?text=${encodeURIComponent(mensajeTexto)}`} target="_blank" rel="noreferrer">
            WhatsApp
          </a>
          {sesion.correo && (
            <a className="btn secundario chico" href={`mailto:${sesion.correo}?subject=${encodeURIComponent('Tu inducción en TREVÉ')}&body=${encodeURIComponent(mensajeTexto)}`}>
              Correo
            </a>
          )}
        </div>
      </div>
    </div>
  )
}

function Detalle({
  sesion,
  pasos,
  presentar,
  cambiar,
  contar,
  cerrar,
}: {
  sesion: Sesion
  pasos: Paso[]
  presentar: () => void
  cambiar: () => void
  /** Avisa a la lista cuántas personas hay (se actualiza en vivo). */
  contar: (sesionId: string, total: number, aprobados: number) => void
  cerrar: () => void
}) {
  const [gente, setGente] = useState<Participante[] | null>(null)
  const [falla, setFalla] = useState('')
  const [qrGrande, setQrGrande] = useState(false)
  const vigente = estaVigente(sesion)

  const cargar = useCallback(async () => {
    const { data, error } = await supabase.from('induccion_participantes').select('*').eq('sesion_id', sesion.id).order('inicio')
    if (error) return setFalla(mensaje(error))
    const lista = data as Participante[]
    setGente(lista)
    setFalla('')
    contar(sesion.id, lista.length, lista.filter((p) => p.aprobado_en).length)
  }, [sesion.id, contar])

  // En vivo: se actualiza cada 5 segundos mientras está abierta.
  useEffect(() => {
    void cargar()
    if (!vigente) return
    const t = setInterval(() => {
      if (document.visibilityState === 'visible') void cargar()
    }, 5000)
    return () => clearInterval(t)
  }, [cargar, vigente])

  async function activar(activa: boolean) {
    const { error } = await supabase.from('induccion_sesiones').update({ activa }).eq('id', sesion.id)
    if (error) setFalla(mensaje(error))
    else cambiar()
  }

  async function borrar() {
    if (!confirm(`¿Borrar la sesión "${sesion.nombre}" y los resultados de ${gente?.length ?? 0} persona(s)? No se puede deshacer.`)) return
    const { error } = await supabase.from('induccion_sesiones').delete().eq('id', sesion.id)
    if (error) return setFalla(mensaje(error))
    cerrar()
    cambiar()
  }

  const aprobados = gente?.filter((p) => p.aprobado_en).length ?? 0
  return (
    <section className="admin-caja ind-detalle">
      <div className="ind-detalle-cab">
        <div className="admin-quien">
          <strong>{sesion.nombre}</strong>
          <span>
            {sesion.tipo === 'individual' ? 'Una persona' : 'Grupo'} · {sesion.incluye_contenido ? 'presentación en el celular' : 'presentación proyectada, solo cuestionario en el celular'}
          </span>
          <small>
            {vigente ? `Abierta hasta ${fechaHora(sesion.vence)}` : sesion.activa ? 'Venció' : 'Cerrada'} · creó {sesion.creada_por_nombre || '—'}
          </small>
        </div>
        <button type="button" className="link" onClick={cerrar}>
          Cerrar detalle
        </button>
      </div>
      {vigente && <Compartir sesion={sesion} />}
      <div className="admin-acciones">
        {vigente && sesion.tipo === 'grupo' && (
          <>
            <button type="button" className="btn primario" onClick={presentar}>
              Presentar
            </button>
            <button type="button" className="btn secundario" onClick={() => setQrGrande(true)}>
              Proyectar QR
            </button>
          </>
        )}
        {sesion.activa ? (
          <button type="button" className="btn secundario" onClick={() => activar(false)}>
            Cerrar sesión de inducción
          </button>
        ) : (
          <button type="button" className="btn secundario" onClick={() => activar(true)}>
            Reabrir
          </button>
        )}
        <button type="button" className="btn secundario" onClick={borrar}>
          Borrar
        </button>
      </div>
      {falla && <div className="alerta" role="alert">{falla}</div>}
      <h3 className="salas-sub">
        {gente === null ? 'Cargando…' : gente.length === 0 ? 'Todavía no entra nadie' : `${gente.length} ${gente.length === 1 ? 'persona' : 'personas'} · ${aprobados} aprobada${aprobados === 1 ? '' : 's'}`}
        {vigente && gente !== null && <span className="ind-vivo"> · en vivo</span>}
      </h3>
      {gente && gente.length > 0 && (
        <ul className="admin-lista">
          {gente.map((p) => {
            const e = estadoDe(p, sesion.incluye_contenido, pasos)
            return (
              <li key={p.id} className="admin-usuario ind-persona">
                <div className="admin-quien">
                  <strong>{p.nombre}</strong>
                  <span className={`ind-tono ${e.tono}`}>{e.texto}</span>
                  <small>
                    Entró {fechaHora(p.inicio)} · {p.aprobado_en ? `tardó ${duracion(p.inicio, p.aprobado_en)}` : `lleva ${duracion(p.inicio, p.ultimo_avance)}`}
                  </small>
                </div>
              </li>
            )
          })}
        </ul>
      )}
      {qrGrande && (
        <div className="ind-presentar" role="dialog" aria-modal="true" aria-label="QR de la sesión">
          <div className="ind-presentar-barra">
            <strong>{sesion.nombre}</strong>
            <button type="button" className="btn secundario chico" onClick={() => setQrGrande(false)}>
              Cerrar
            </button>
          </div>
          <div className="ind-presentar-cuerpo">
            <PantallaQR
              codigo={sesion.codigo}
              titulo={sesion.incluye_contenido ? 'Tu inducción en TREVÉ' : 'Contesta el cuestionario'}
              texto="Escanea el código con la cámara de tu celular y escribe tu nombre."
            />
          </div>
        </div>
      )}
    </section>
  )
}

export function Sesiones({ perfil, curso, presentaciones, presentar }: { perfil: Perfil; curso: Curso; presentaciones: Presentacion[]; presentar: (codigo: string) => void }) {
  const [sesiones, setSesiones] = useState<Sesion[] | null>(null)
  const [conteo, setConteo] = useState<Record<string, { total: number; aprobados: number }>>({})
  const [elegida, setElegida] = useState<string | null>(null)
  const [verCerradas, setVerCerradas] = useState(false)
  const [falla, setFalla] = useState('')
  const [version, setVersion] = useState(0)
  const pasos = useMemo(() => curso.pasos.filter((p) => !faltante(p, presentaciones)), [curso.pasos, presentaciones])
  const contar = useCallback(
    (id: string, total: number, aprobados: number) =>
      setConteo((c) => (c[id]?.total === total && c[id]?.aprobados === aprobados ? c : { ...c, [id]: { total, aprobados } })),
    [],
  )

  useEffect(() => {
    void (async () => {
      const { data, error } = await supabase.from('induccion_sesiones').select('*').order('creada', { ascending: false }).limit(200)
      if (error) return setFalla(mensaje(error))
      const lista = data as Sesion[]
      setSesiones(lista)
      if (lista.length === 0) return setConteo({})
      const { data: gente } = await supabase.from('induccion_participantes').select('sesion_id, aprobado_en').in('sesion_id', lista.map((s) => s.id))
      const c: Record<string, { total: number; aprobados: number }> = {}
      for (const g of gente ?? []) {
        c[g.sesion_id] ??= { total: 0, aprobados: 0 }
        c[g.sesion_id].total++
        if (g.aprobado_en) c[g.sesion_id].aprobados++
      }
      setConteo(c)
    })()
  }, [version])

  const vigente = estaVigente
  const visibles = (sesiones ?? []).filter((s) => verCerradas || vigente(s))
  const detalle = sesiones?.find((s) => s.id === elegida)

  return (
    <>
      <NuevaSesion
        perfil={perfil}
        curso={curso}
        creada={(s) => {
          setElegida(s.id)
          setVersion((v) => v + 1)
        }}
      />
      {detalle && <Detalle key={detalle.id} sesion={detalle} pasos={pasos} presentar={() => presentar(detalle.codigo)} cambiar={() => setVersion((v) => v + 1)} contar={contar} cerrar={() => setElegida(null)} />}
      <section className="admin-caja">
        <div className="ind-detalle-cab">
          <h2>Sesiones</h2>
          <label className="casilla">
            <input type="checkbox" checked={verCerradas} onChange={(e) => setVerCerradas(e.target.checked)} />
            Ver cerradas y vencidas
          </label>
        </div>
        {falla && <div className="alerta" role="alert">{falla}</div>}
        {sesiones === null ? (
          !falla && <p className="nota">Cargando…</p>
        ) : visibles.length === 0 ? (
          <p className="nota">{sesiones.length ? 'No hay sesiones abiertas.' : 'Todavía no hay sesiones. Crea la primera arriba.'}</p>
        ) : (
          <ul className="admin-lista">
            {visibles.map((s) => {
              const c = conteo[s.id] ?? { total: 0, aprobados: 0 }
              return (
                <li key={s.id} className={vigente(s) ? 'admin-usuario' : 'admin-usuario inactivo'}>
                  <button type="button" className={elegida === s.id ? 'ind-fila elegida' : 'ind-fila'} onClick={() => setElegida(s.id)}>
                    <span className="admin-quien">
                      <strong>{s.nombre}</strong>
                      <span>
                        {s.tipo === 'individual' ? 'Una persona' : 'Grupo'} · <code>{codigoLegible(s.codigo)}</code> · {vigente(s) ? `vence ${fechaHora(s.vence)}` : s.activa ? 'venció' : 'cerrada'}
                      </span>
                    </span>
                    <span className="ind-conteo">
                      {s.tipo === 'individual'
                        ? c.aprobados
                          ? 'Aprobó'
                          : c.total
                            ? 'En curso'
                            : 'Sin empezar'
                        : `${c.total} ${c.total === 1 ? 'persona' : 'personas'} · ${c.aprobados} ✓`}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </>
  )
}
