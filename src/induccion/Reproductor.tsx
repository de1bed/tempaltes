import { useEffect, useRef, useState } from 'react'
import type { PasoVisible } from './api'

// ───── YouTube (API del reproductor, para saber cuándo terminó el video) ─────

interface YTPlayer {
  destroy(): void
}
interface YTApi {
  Player: new (
    el: HTMLElement,
    opciones: {
      videoId: string
      width?: string
      height?: string
      playerVars?: Record<string, number | string>
      events?: { onStateChange?: (e: { data: number }) => void; onError?: (e: { data: number }) => void }
    },
  ) => YTPlayer
}
declare global {
  interface Window {
    YT?: YTApi
    onYouTubeIframeAPIReady?: () => void
  }
}

let cargaYT: Promise<YTApi> | null = null
function cargarYouTube(): Promise<YTApi> {
  if (window.YT?.Player) return Promise.resolve(window.YT)
  cargaYT ??= new Promise<YTApi>((resolver, fallar) => {
    const previo = window.onYouTubeIframeAPIReady
    window.onYouTubeIframeAPIReady = () => {
      previo?.()
      resolver(window.YT!)
    }
    const s = document.createElement('script')
    s.src = 'https://www.youtube.com/iframe_api'
    s.async = true
    s.onerror = () => {
      cargaYT = null
      fallar(new Error('No se pudo cargar YouTube'))
    }
    document.head.appendChild(s)
    setTimeout(() => {
      if (window.YT?.Player) return
      cargaYT = null
      fallar(new Error('YouTube tardó demasiado'))
    }, 15_000)
  })
  return cargaYT
}

/** Video de YouTube o archivo; avisa cuando se vio completo. */
export function Video({ paso, alTerminar }: { paso: Extract<PasoVisible, { tipo: 'video' }>; alTerminar: () => void }) {
  const caja = useRef<HTMLDivElement>(null)
  const [falla, setFalla] = useState(false)
  const terminar = useRef(alTerminar)
  useEffect(() => {
    terminar.current = alTerminar
  })

  useEffect(() => {
    const id = paso.youtube
    const contenedor = caja.current
    if (!id || !contenedor) return
    let jugador: YTPlayer | null = null
    let vivo = true
    // YouTube reemplaza el elemento que recibe: se le da uno propio para que React no lo pierda.
    const destino = document.createElement('div')
    contenedor.appendChild(destino)
    cargarYouTube().then(
      (YT) => {
        if (!vivo) return
        jugador = new YT.Player(destino, {
          videoId: id,
          width: '100%',
          height: '100%',
          playerVars: { rel: 0, playsinline: 1, modestbranding: 1 },
          events: {
            onStateChange: (e) => e.data === 0 && terminar.current(),
            onError: () => setFalla(true),
          },
        })
      },
      () => vivo && setFalla(true),
    )
    return () => {
      vivo = false
      jugador?.destroy()
      contenedor.replaceChildren()
    }
  }, [paso.youtube])

  const enlace = paso.youtube ? `https://www.youtube.com/watch?v=${paso.youtube}` : paso.url
  return (
    <div className="ind-video">
      {paso.youtube ? (
        <div className="ind-video-marco" ref={caja} />
      ) : (
        paso.url && (
          <div className="ind-video-marco">
            <video src={paso.url} controls playsInline preload="metadata" onEnded={() => alTerminar()} onError={() => setFalla(true)} />
          </div>
        )
      )}
      {falla && enlace && (
        <div className="ind-aviso">
          El video no se pudo reproducir aquí.{' '}
          <a href={enlace} target="_blank" rel="noreferrer" onClick={() => setTimeout(() => terminar.current(), 1000)}>
            Ábrelo en otra pestaña
          </a>{' '}
          y regresa al terminar.
        </div>
      )}
    </div>
  )
}

/** Diapositivas con flechas, teclado y deslizar en el celular. */
export function Diapositivas({
  paso,
  pagina,
  irA,
  alTerminar,
  alRegresar,
  textoFinal = 'Siguiente',
}: {
  paso: Extract<PasoVisible, { tipo: 'diapositivas' }>
  pagina: number
  irA: (n: number) => void
  alTerminar: () => void
  alRegresar?: () => void
  textoFinal?: string
}) {
  const total = paso.paginas.length
  const n = Math.min(Math.max(0, pagina), total - 1)
  const toque = useRef<number | null>(null)
  const [cargada, setCargada] = useState<string | null>(null)

  const siguiente = () => (n + 1 < total ? irA(n + 1) : alTerminar())
  const anterior = () => (n > 0 ? irA(n - 1) : alRegresar?.())
  const acciones = useRef({ siguiente, anterior })
  useEffect(() => {
    acciones.current = { siguiente, anterior }
  })

  // Flechas del teclado (y el control remoto de presentaciones, que manda las mismas teclas).
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null
      if (t && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) return
      // La barra espaciadora sobre un botón ya lo presiona.
      if (e.key === ' ' && t && /^(BUTTON|A)$/.test(t.tagName)) return
      if (['ArrowRight', 'PageDown', ' '].includes(e.key)) {
        e.preventDefault()
        acciones.current.siguiente()
      } else if (['ArrowLeft', 'PageUp'].includes(e.key)) {
        e.preventDefault()
        acciones.current.anterior()
      }
    }
    window.addEventListener('keydown', tecla)
    return () => window.removeEventListener('keydown', tecla)
  }, [])

  // Precarga las que siguen para que el cambio sea inmediato.
  useEffect(() => {
    for (const url of paso.paginas.slice(n + 1, n + 3)) new Image().src = url
  }, [paso.paginas, n])

  const url = paso.paginas[n]
  return (
    <div className="ind-diapos">
      <div
        className="ind-diapo"
        style={{ aspectRatio: String(paso.proporcion) }}
        onTouchStart={(e) => (toque.current = e.touches[0].clientX)}
        onTouchEnd={(e) => {
          if (toque.current == null) return
          const dx = e.changedTouches[0].clientX - toque.current
          toque.current = null
          if (dx < -50) siguiente()
          else if (dx > 50) anterior()
        }}
      >
        {cargada !== url && <div className="ind-cargando">Cargando…</div>}
        <img key={url} src={url} alt={`Diapositiva ${n + 1} de ${total}`} onLoad={() => setCargada(url)} draggable={false} />
      </div>
      <div className="ind-controles">
        <button type="button" className="btn secundario" onClick={anterior} disabled={n === 0 && !alRegresar}>
          ← Anterior
        </button>
        <span className="ind-contador">
          {n + 1} / {total}
        </span>
        <button type="button" className="btn primario" onClick={siguiente}>
          {n + 1 < total ? 'Siguiente →' : `${textoFinal} →`}
        </button>
      </div>
    </div>
  )
}

/**
 * Recorre los pasos del curso (diapositivas y videos). Lo usan la persona que toma la inducción
 * y Recursos Humanos al proyectarla. `exigirVideos`: no deja pasar un video obligatorio sin verlo.
 */
export function Reproductor({
  pasos,
  paso,
  pagina,
  vistos,
  exigirVideos,
  mover,
  videoVisto,
  alTerminar,
  textoFinal,
}: {
  pasos: PasoVisible[]
  paso: number
  pagina: number
  vistos: string[]
  exigirVideos: boolean
  mover: (paso: number, pagina: number) => void
  videoVisto: (id: string) => void
  alTerminar: () => void
  textoFinal: string
}) {
  const actual = pasos[paso]
  const ultimo = paso === pasos.length - 1
  const avanzar = () => (ultimo ? alTerminar() : mover(paso + 1, 0))
  const regresar = paso > 0 ? () => mover(paso - 1, Math.max(0, pasos[paso - 1].tipo === 'diapositivas' ? (pasos[paso - 1] as { paginas: string[] }).paginas.length - 1 : 0)) : undefined
  if (!actual) return null
  const bloqueado = exigirVideos && actual.tipo === 'video' && actual.obligatorio && !vistos.includes(actual.id)

  return (
    <div className="ind-reproductor">
      <ol className="ind-pasos" aria-label="Pasos">
        {pasos.map((p, i) => (
          <li key={p.id} className={i === paso ? 'actual' : i < paso ? 'hecho' : undefined} title={p.titulo}>
            <span />
          </li>
        ))}
      </ol>
      <div className="ind-paso-cab">
        <span className="marca-kicker">
          PASO {paso + 1} DE {pasos.length} · {actual.tipo === 'video' ? 'VIDEO' : 'PRESENTACIÓN'}
        </span>
        <h2>{actual.titulo}</h2>
      </div>
      {actual.tipo === 'diapositivas' ? (
        <Diapositivas key={actual.id} paso={actual} pagina={pagina} irA={(n) => mover(paso, n)} alTerminar={avanzar} alRegresar={regresar} textoFinal={ultimo ? textoFinal : 'Siguiente'} />
      ) : (
        <>
          <Video key={actual.id} paso={actual} alTerminar={() => videoVisto(actual.id)} />
          <div className="ind-controles">
            <button type="button" className="btn secundario" onClick={regresar} disabled={!regresar}>
              ← Anterior
            </button>
            <span className={bloqueado ? 'ind-contador largo' : 'ind-contador'}>{bloqueado ? 'Mira el video completo para continuar' : vistos.includes(actual.id) ? '✓ Visto' : ''}</span>
            <button type="button" className="btn primario" onClick={avanzar} disabled={bloqueado}>
              {ultimo ? textoFinal : 'Siguiente'} →
            </button>
          </div>
        </>
      )}
    </div>
  )
}
