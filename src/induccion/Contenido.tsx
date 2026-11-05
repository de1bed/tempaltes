import { useEffect, useState } from 'react'
import { faltante, idYoutube } from '../../supabase/functions/induccion/logica'
import { registrar, supabase } from '../lib/supabase'
import { fechaHora, guardarCurso, mensaje, miniatura, type Curso, type Paso, type Presentacion } from './api'
import { borrarImagenes, subirPdf, subirVideo } from './archivos'

const nuevoId = () => crypto.randomUUID().slice(0, 8)

/** Clave legible a partir del nombre ("Gastos médicos" → "gastos-medicos"). */
const claveDe = (nombre: string) =>
  nombre
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 32) || 'presentacion'

function TarjetaPresentacion({ p, usada, cambiada }: { p: Presentacion; usada: boolean; cambiada: () => void }) {
  const [mini, setMini] = useState('')
  const [progreso, setProgreso] = useState<{ hecho: number; total: number } | null>(null)
  const [falla, setFalla] = useState('')

  useEffect(() => {
    if (p.paginas > 0) miniatura(p).then(setMini, () => setMini(''))
  }, [p])

  async function subir(archivo: File | undefined) {
    if (!archivo) return
    if (archivo.type !== 'application/pdf' && !archivo.name.toLowerCase().endsWith('.pdf')) return setFalla('Sube la presentación en PDF (en PowerPoint: Archivo → Exportar → PDF).')
    setFalla('')
    setProgreso({ hecho: 0, total: 0 })
    try {
      await subirPdf(p, archivo, (hecho, total) => setProgreso({ hecho, total }))
      registrar('induccion_presentacion', { documento: `${p.nombre} · ${archivo.name}` })
      cambiada()
    } catch (e) {
      setFalla(mensaje(e))
    }
    setProgreso(null)
  }

  async function borrar() {
    if (usada) return setFalla('Esta presentación se usa en los pasos del curso: quítala de los pasos y guarda antes de borrarla.')
    if (!confirm(`¿Borrar la presentación "${p.nombre}"?`)) return
    try {
      await borrarImagenes(p)
      const { error } = await supabase.from('induccion_presentaciones').delete().eq('id', p.id)
      if (error) throw error
      cambiada()
    } catch (e) {
      setFalla(mensaje(e))
    }
  }

  return (
    <li className="ind-pres">
      <div className="ind-pres-mini" style={{ aspectRatio: String(p.proporcion) }}>
        {mini ? <img src={mini} alt="" /> : <span>{p.paginas ? '…' : 'Sin PDF'}</span>}
      </div>
      <div className="admin-quien">
        <strong>{p.nombre}</strong>
        <span>{p.paginas ? `${p.paginas} diapositivas` : 'Falta subir el PDF'}</span>
        {p.paginas > 0 && p.actualizado && <small>Actualizada {fechaHora(p.actualizado)}</small>}
        {progreso && <span className="ind-progreso">{progreso.total ? `Convirtiendo y subiendo ${progreso.hecho} de ${progreso.total}…` : 'Leyendo el PDF…'}</span>}
        {falla && <div className="alerta" role="alert">{falla}</div>}
        <div className="admin-acciones">
          <label className={progreso ? 'btn primario chico deshabilitado' : 'btn primario chico'}>
            {p.paginas ? 'Reemplazar PDF' : 'Subir PDF'}
            <input type="file" accept="application/pdf,.pdf" hidden disabled={Boolean(progreso)} onChange={(e) => (void subir(e.target.files?.[0]), (e.target.value = ''))} />
          </label>
          <button type="button" className="btn secundario chico" onClick={borrar} disabled={Boolean(progreso)}>
            Borrar
          </button>
        </div>
      </div>
    </li>
  )
}

function EditorPaso({ paso, i, total, presentaciones, cambiar, mover, quitar }: { paso: Paso; i: number; total: number; presentaciones: Presentacion[]; cambiar: (p: Paso) => void; mover: (d: -1 | 1) => void; quitar: () => void }) {
  const aviso = faltante(paso, presentaciones)
  const [enlace, setEnlace] = useState(paso.tipo === 'video' && paso.youtube ? `https://www.youtube.com/watch?v=${paso.youtube}` : '')
  const [subiendo, setSubiendo] = useState(false)
  const [falla, setFalla] = useState('')

  return (
    <li className={aviso ? 'ind-paso-editor incompleto' : 'ind-paso-editor'}>
      <div className="ind-paso-num">
        <span>{i + 1}</span>
        <button type="button" className="link" onClick={() => mover(-1)} disabled={i === 0} aria-label="Subir">
          ↑
        </button>
        <button type="button" className="link" onClick={() => mover(1)} disabled={i === total - 1} aria-label="Bajar">
          ↓
        </button>
      </div>
      <div className="ind-paso-campos">
        <div className="ind-paso-fila">
          <span className="ind-etiqueta">{paso.tipo === 'video' ? 'Video' : 'Diapositivas'}</span>
          <input className="ind-paso-titulo" value={paso.titulo} onChange={(e) => cambiar({ ...paso, titulo: e.target.value })} aria-label="Título del paso" maxLength={120} />
          <button type="button" className="link" onClick={quitar}>
            Quitar
          </button>
        </div>
        {paso.tipo === 'diapositivas' ? (
          <div className="ind-paso-fila">
            <select value={paso.presentacion} onChange={(e) => cambiar({ ...paso, presentacion: e.target.value })} aria-label="Presentación">
              {presentaciones.map((p) => (
                <option key={p.id} value={p.clave}>
                  {p.nombre}
                </option>
              ))}
            </select>
            <label className="ind-rango">
              de la
              <input type="number" min={1} value={paso.desde} onChange={(e) => cambiar({ ...paso, desde: Math.max(1, Number(e.target.value) || 1) })} />
            </label>
            <label className="ind-rango">
              a la
              <input
                type="number"
                min={1}
                placeholder="fin"
                value={paso.hasta ?? ''}
                onChange={(e) => cambiar({ ...paso, hasta: e.target.value === '' ? null : Math.max(1, Number(e.target.value) || 1) })}
              />
            </label>
          </div>
        ) : (
          <>
            <div className="ind-paso-fila">
              <input
                className="ind-paso-enlace"
                placeholder="Enlace de YouTube"
                value={enlace}
                onChange={(e) => {
                  setEnlace(e.target.value)
                  const id = idYoutube(e.target.value)
                  cambiar({ ...paso, youtube: id, archivo: id ? null : paso.archivo })
                }}
                aria-label="Enlace de YouTube"
              />
              <span className="nota">o</span>
              <label className={subiendo ? 'btn secundario chico deshabilitado' : 'btn secundario chico'}>
                {subiendo ? 'Subiendo…' : paso.archivo ? 'Cambiar archivo' : 'Subir MP4'}
                <input
                  type="file"
                  accept="video/mp4,video/webm"
                  hidden
                  disabled={subiendo}
                  onChange={async (e) => {
                    const f = e.target.files?.[0]
                    e.target.value = ''
                    if (!f) return
                    setFalla('')
                    setSubiendo(true)
                    try {
                      const ruta = await subirVideo(f)
                      setEnlace('')
                      cambiar({ ...paso, archivo: ruta, youtube: null })
                    } catch (err) {
                      setFalla(mensaje(err))
                    }
                    setSubiendo(false)
                  }}
                />
              </label>
            </div>
            <div className="ind-paso-fila">
              {enlace && !paso.youtube && <span className="alerta">No reconozco ese enlace de YouTube.</span>}
              {paso.archivo && !paso.youtube && <span className="nota">Video subido a la app.</span>}
              <label className="casilla">
                <input type="checkbox" checked={paso.obligatorio} onChange={(e) => cambiar({ ...paso, obligatorio: e.target.checked })} />
                Hay que verlo completo para seguir
              </label>
            </div>
          </>
        )}
        {aviso && <span className="ind-aviso-paso">{aviso}</span>}
        {falla && <div className="alerta" role="alert">{falla}</div>}
      </div>
    </li>
  )
}

export function Contenido({ curso, presentaciones, recargar, vistaPrevia }: { curso: Curso; presentaciones: Presentacion[]; recargar: () => Promise<void>; vistaPrevia: () => void }) {
  const [pasos, setPasos] = useState<Paso[]>(curso.pasos)
  const [titulo, setTitulo] = useState(curso.titulo)
  const [minima, setMinima] = useState(curso.calificacion_minima)
  const [repetir, setRepetir] = useState(curso.permite_repetir)
  const [guardando, setGuardando] = useState(false)
  const [aviso, setAviso] = useState<{ ok: boolean; texto: string } | null>(null)
  const [nueva, setNueva] = useState('')

  const cambiado = JSON.stringify(pasos) !== JSON.stringify(curso.pasos) || titulo !== curso.titulo || minima !== curso.calificacion_minima || repetir !== curso.permite_repetir

  async function guardar() {
    setAviso(null)
    if (!titulo.trim()) return setAviso({ ok: false, texto: 'El curso necesita un título.' })
    if (pasos.some((p) => !p.titulo.trim())) return setAviso({ ok: false, texto: 'Cada paso necesita un título.' })
    setGuardando(true)
    try {
      await guardarCurso(curso.id, { pasos: pasos.map((p) => ({ ...p, titulo: p.titulo.trim() })), titulo: titulo.trim(), calificacion_minima: minima, permite_repetir: repetir })
      registrar('induccion_contenido', { documento: titulo.trim(), detalle: { pasos, calificacion_minima: minima, permite_repetir: repetir } })
      await recargar()
      setAviso({ ok: true, texto: 'Cambios guardados. Las sesiones abiertas ya ven el contenido nuevo.' })
    } catch (e) {
      setAviso({ ok: false, texto: mensaje(e) })
    }
    setGuardando(false)
  }

  async function agregarPresentacion() {
    const nombre = nueva.trim()
    if (!nombre) return
    let clave = claveDe(nombre)
    if (presentaciones.some((p) => p.clave === clave)) clave = `${clave}-${nuevoId().slice(0, 4)}`
    const { error } = await supabase.from('induccion_presentaciones').insert({ clave, nombre })
    if (error) return setAviso({ ok: false, texto: mensaje(error) })
    setNueva('')
    await recargar()
  }

  const moverPaso = (i: number, d: -1 | 1) =>
    setPasos((ps) => {
      const copia = [...ps]
      ;[copia[i], copia[i + d]] = [copia[i + d], copia[i]]
      return copia
    })

  return (
    <>
      <section className="admin-caja">
        <h2>Presentaciones</h2>
        <p className="nota">
          Sube cada presentación en PDF (en PowerPoint: Archivo → Exportar → PDF). La app la convierte en imágenes para verla en cualquier celular; los enlaces dentro de las
          diapositivas no funcionan, así que los videos van como pasos aparte. Para actualizarla, sube el PDF nuevo: las sesiones abiertas lo ven al momento.
        </p>
        <ul className="ind-presentaciones">
          {presentaciones.map((p) => (
            <TarjetaPresentacion key={`${p.id}-${p.version}`} p={p} usada={curso.pasos.some((x) => x.tipo === 'diapositivas' && x.presentacion === p.clave)} cambiada={() => void recargar()} />
          ))}
        </ul>
        <div className="ind-paso-fila">
          <input placeholder="Nombre de otra presentación" value={nueva} onChange={(e) => setNueva(e.target.value)} maxLength={120} aria-label="Nombre de la presentación nueva" />
          <button type="button" className="btn secundario chico" onClick={agregarPresentacion} disabled={!nueva.trim()}>
            Agregar presentación
          </button>
        </div>
      </section>

      <section className="admin-caja">
        <div className="ind-detalle-cab">
          <h2>Pasos del curso</h2>
          <button type="button" className="btn secundario chico" onClick={vistaPrevia} disabled={cambiado} title={cambiado ? 'Guarda los cambios para verlos' : undefined}>
            Vista previa
          </button>
        </div>
        <p className="nota">La persona los ve en este orden y al final contesta el cuestionario. Los pasos incompletos (sin PDF o sin video) se saltan hasta que se completen.</p>
        <ol className="ind-pasos-editor">
          {pasos.map((p, i) => (
            <EditorPaso
              key={p.id}
              paso={p}
              i={i}
              total={pasos.length}
              presentaciones={presentaciones}
              cambiar={(nuevo) => setPasos((ps) => ps.map((x) => (x.id === p.id ? nuevo : x)))}
              mover={(d) => moverPaso(i, d)}
              quitar={() => setPasos((ps) => ps.filter((x) => x.id !== p.id))}
            />
          ))}
        </ol>
        <div className="admin-acciones">
          <button
            type="button"
            className="btn secundario chico"
            disabled={presentaciones.length === 0}
            onClick={() => setPasos((ps) => [...ps, { id: nuevoId(), tipo: 'diapositivas', titulo: 'Presentación', presentacion: presentaciones[0]?.clave ?? '', desde: 1, hasta: null }])}
          >
            + Diapositivas
          </button>
          <button type="button" className="btn secundario chico" onClick={() => setPasos((ps) => [...ps, { id: nuevoId(), tipo: 'video', titulo: 'Video', youtube: null, archivo: null, obligatorio: true }])}>
            + Video
          </button>
        </div>
      </section>

      <section className="admin-caja">
        <h2>Calificación</h2>
        <div className="admin-alta">
          <div className="campo">
            <label htmlFor="cur-titulo">Nombre del curso (sale en la constancia)</label>
            <input id="cur-titulo" value={titulo} onChange={(e) => setTitulo(e.target.value)} maxLength={120} />
          </div>
          <div className="campo">
            <label htmlFor="cur-minima">Calificación para aprobar (de 100)</label>
            <input id="cur-minima" type="number" min={1} max={100} value={minima} onChange={(e) => setMinima(Math.min(100, Math.max(1, Number(e.target.value) || 1)))} />
          </div>
        </div>
        <div className="campo-check">
          <label>
            <input type="checkbox" checked={repetir} onChange={(e) => setRepetir(e.target.checked)} />
            Si no aprueba, puede volver a contestar el cuestionario
          </label>
        </div>
      </section>

      <div className={cambiado || aviso ? 'ind-guardar fija' : 'ind-guardar'}>
        {aviso && (
          <div className={aviso.ok ? 'credenciales' : 'alerta'} role="status">
            {aviso.texto}
          </div>
        )}
        <div className="admin-acciones">
          <button type="button" className="btn secundario" disabled={!cambiado || guardando} onClick={() => (setPasos(curso.pasos), setTitulo(curso.titulo), setMinima(curso.calificacion_minima), setRepetir(curso.permite_repetir))}>
            Descartar
          </button>
          <button type="button" className="btn primario" disabled={!cambiado || guardando} onClick={guardar}>
            {guardando ? 'Guardando…' : 'Guardar cambios'}
          </button>
        </div>
      </div>
    </>
  )
}
