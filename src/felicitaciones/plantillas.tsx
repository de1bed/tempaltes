import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode, type Ref } from 'react'
import barras from './fondos/barras.png'
import treve from './fondos/treve.png'
import { textoFecha } from './fechas'
import { ANIVERSARIO, FONDOS_CUMPLE, MEDIDAS, type DatosTarjeta } from './tipos'

// Fondos de las plantillas originales (PowerPoint): cumpleaños 1-5 y aniversario por año (1-15).
const AZUL = '#032B49'
const NARANJA = '#E77425'
const ARENA = '#B7B09D'

/** Texto que se reduce solo (hasta `min` px) para no pasar de `lineas` renglones ni del ancho. */
function Ajustar({ texto, max, min, lineas, alto = 1.1, style }: { texto: string; max: number; min: number; lineas: number; alto?: number; style?: CSSProperties }) {
  const ref = useRef<HTMLDivElement>(null)
  const [fuentes, setFuentes] = useState(false)
  useEffect(() => {
    let vigente = true
    document.fonts?.ready.then(() => vigente && setFuentes(true))
    return () => {
      vigente = false
    }
  }, [])
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    let t = max
    el.style.fontSize = `${t}px`
    while (t > min && (el.clientHeight > Math.ceil(t * alto * lineas) + 1 || el.scrollWidth > el.clientWidth + 1)) {
      t -= 1
      el.style.fontSize = `${t}px`
    }
  }, [texto, max, min, lineas, alto, fuentes])
  return (
    <div ref={ref} style={{ lineHeight: alto, overflowWrap: 'normal', ...style }}>
      {texto}
    </div>
  )
}

const abs = (left: number, top: number, width?: number, height?: number): CSSProperties => ({ position: 'absolute', left, top, width, height })

function Foto({ src, style }: { src: string | null; style: CSSProperties }) {
  return (
    <div style={{ ...style, overflow: 'hidden', background: '#ECE9E1' }}>
      {src ? (
        <img src={src} alt="" style={{ display: 'block', width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 25%' }} />
      ) : (
        <svg viewBox="0 0 24 24" style={{ width: '100%', height: '100%', padding: '18%', color: ARENA }} aria-hidden="true">
          <circle cx="12" cy="8.5" r="4" fill="currentColor" />
          <path d="M4 21c0-4.4 3.6-7.5 8-7.5s8 3.1 8 7.5z" fill="currentColor" />
        </svg>
      )}
    </div>
  )
}

const linea = (left: number, top: number, width: number, color = ARENA, grosor = 1): CSSProperties => ({ ...abs(left, top, width, grosor), background: color })

/** Puesto y área como en las plantillas: "CUENTAS POR COBRAR / TREVÉ Corporativo". */
const puestoYArea = (d: DatosTarjeta, mayusculas: boolean) => [mayusculas ? d.puesto.toUpperCase() : d.puesto, d.area].filter((s) => s.trim()).join(' / ')

function Cumpleanos({ d }: { d: DatosTarjeta }) {
  return (
    <>
      <img src={FONDOS_CUMPLE[d.fondo] ?? FONDOS_CUMPLE[0]} alt="" style={{ ...abs(0, 0, 720, 960), display: 'block' }} />
      <Foto src={d.foto} style={abs(132, 75, 206, 239)} />
      <div style={{ ...abs(127, 300, 391, 96), display: 'flex', alignItems: 'flex-end' }}>
        <Ajustar texto={d.nombre.toUpperCase()} max={35} min={22} lineas={2} alto={0.95} style={{ width: '100%', color: '#000' }} />
      </div>
      <div style={{ ...linea(140, 399, 312, '#ED7D31', 2.5), boxShadow: '0 1.5px 2px rgba(0,0,0,.25)' }} />
      <div style={abs(127, 410, 330)}>
        <Ajustar texto={puestoYArea(d, true)} max={24} min={15} lineas={2} alto={1.05} style={{ fontWeight: 700, color: '#000' }} />
      </div>
      <div style={{ ...abs(127, 486, 305), fontSize: 21.3, lineHeight: 1.1, color: AZUL }}>
        <p style={{ margin: '0 0 8px' }}>La familia TREVÉ te desea un feliz Cumpleaños</p>
        <p style={{ margin: 0 }}>¡Nuestros mejores deseos para ti en este día tan especial!</p>
      </div>
    </>
  )
}

function Aniversario({ d }: { d: DatosTarjeta }) {
  return (
    <>
      <img src={ANIVERSARIO[d.anios] ?? ANIVERSARIO[1]} alt="" style={{ ...abs(0, 0, 1200, 1920), display: 'block' }} />
      <Foto src={d.foto} style={abs(279, 926, 285, 290)} />
      <div style={{ ...abs(190, 1240, 469), textAlign: 'center' }}>
        <Ajustar texto={d.nombre.toUpperCase()} max={32} min={22} lineas={2} style={{ color: '#072B49' }} />
        <Ajustar texto={puestoYArea(d, false).toUpperCase()} max={26} min={17} lineas={2} alto={1.05} style={{ marginTop: 6, fontWeight: 700, color: '#B7B09C' }} />
      </div>
    </>
  )
}

/** Barra azul, palabra vertical, barras de colores y logo: lo común de bienvenida y despedida. */
function Marco({ palabra, caja, children }: { palabra: string; caja: [number, number, number]; children: ReactNode }) {
  const [left, top, width] = caja
  return (
    <>
      <div style={{ ...abs(0, 0, 138, 960), background: AZUL }} />
      <div
        style={{
          ...abs(left, top, width, 111),
          padding: '4.8px 9.6px',
          transform: 'rotate(-90deg)',
          fontSize: 128,
          lineHeight: 0.9,
          color: 'rgba(183, 176, 157, 0.2)',
          overflowWrap: 'anywhere',
          whiteSpace: 'normal',
        }}
      >
        {palabra}
      </div>
      <img src={barras} alt="" style={abs(88, 37, 98, 148)} />
      <img src={treve} alt="" style={abs(559, 883, 138, 54)} />
      {children}
    </>
  )
}

/** Renglón de texto centrado en la parte blanca (de 138 a 719 px). */
const Centrado = ({ top, children }: { top: number; children: ReactNode }) => <div style={{ ...abs(138, top, 581), textAlign: 'center', lineHeight: '20px', whiteSpace: 'nowrap' }}>{children}</div>

/** Nombre sobre la línea `linea` (y en px): uno o dos renglones, siempre arriba de la línea. */
function Nombre({ d, linea }: { d: DatosTarjeta; linea: number }) {
  return (
    <div style={{ ...abs(138, linea - 86, 581, 80), display: 'flex', alignItems: 'flex-end', padding: '0 10px', textAlign: 'center' }}>
      <Ajustar texto={d.nombre} max={44} min={26} lineas={2} alto={0.9} style={{ width: '100%', fontFamily: '"Montserrat Alternates", Poppins, sans-serif', color: NARANJA }} />
    </div>
  )
}

function Bienvenida({ d }: { d: DatosTarjeta }) {
  return (
    <Marco palabra={d.genero === 'a' ? 'BIENVENIDA' : 'BIENVENIDO'} caja={[-316, 525, 752]}>
      <Centrado top={84}>Le damos una cálida bienvenida a:</Centrado>
      <Foto src={d.foto} style={abs(301, 135, 254, 244)} />
      <Nombre d={d} linea={451} />
      <div style={linea(187, 451, 488)} />
      <Centrado top={502}>quien se une a nuestra familia TREVÉ</Centrado>
      <Centrado top={532}>desarrollándose en el puesto de:</Centrado>
      <div style={{ ...abs(220, 568, 403), textAlign: 'center' }}>
        <Ajustar texto={d.puesto} max={17.3} min={12} lineas={1} style={{ color: NARANJA }} />
      </div>
      <div style={linea(246, 594, 345)} />
      <div style={{ ...abs(190, 619), lineHeight: '20px' }}>dentro del equipo de:</div>
      <div style={{ ...abs(389, 614, 220), textAlign: 'center' }}>
        <Ajustar texto={d.area} max={17.3} min={11} lineas={1} style={{ color: NARANJA }} />
      </div>
      <div style={linea(389, 640, 219)} />
      {['Estamos felices de que ahora', 'forme parte de nuestro gran equipo,', 'estamos seguros que compartiremos', 'momentos de alegría y contribuiremos', 'en el crecimiento así como el éxito', 'de la Organización.'].map((t, i) => (
        <Centrado key={t} top={678 + i * 29}>
          {t}
        </Centrado>
      ))}
    </Marco>
  )
}

function Despedida({ d }: { d: DatosTarjeta }) {
  return (
    <Marco palabra="MUCHO ÉXITO" caja={[-399, 441, 920]}>
      <Centrado top={57}>Informamos a todo el personal que a partir</Centrado>
      <div style={{ ...abs(138, 84, 581), display: 'flex', justifyContent: 'center', alignItems: 'flex-end', lineHeight: '20px' }}>
        <span>del</span>
        <span style={{ width: 126, margin: '0 18px 0 7px', borderBottom: `1px solid ${ARENA}`, textAlign: 'center', color: NARANJA }}>{textoFecha(d.fecha)}</span>
        <span>el colaborador/a:</span>
      </div>
      <Foto src={d.foto} style={abs(333, 155, 194, 206)} />
      <Nombre d={d} linea={448} />
      <div style={linea(187, 448, 488)} />
      <div style={{ ...abs(213, 497), lineHeight: '20px' }}>con la posición de:</div>
      <div style={{ ...abs(355, 482, 330), textAlign: 'center' }}>
        <Ajustar texto={d.puesto} max={24} min={13} lineas={1} style={{ color: NARANJA }} />
      </div>
      <div style={linea(336, 514, 316)} />
      <Centrado top={536}>dejó de formar parte de nuestro equipo.</Centrado>
      <Centrado top={584}>La familia TREVÉ le desea éxito en esta nueva etapa</Centrado>
      <Centrado top={623}>de su carrera y agradecemos su profesionalismo</Centrado>
      <Centrado top={662}>así como su colaboración con nosotros.</Centrado>
      <Centrado top={731}>Cualquier duda o pendiente en relación con sus</Centrado>
      <Centrado top={769}>actividades, por favor comunicarse con:</Centrado>
      <div style={{ ...abs(223, 826, 422), textAlign: 'center' }}>
        <Ajustar texto={d.contacto} max={21.3} min={13} lineas={1} style={{ color: NARANJA }} />
      </div>
      <div style={linea(241, 854, 375)} />
    </Marco>
  )
}

/** La tarjeta a tamaño real; la vista previa la escala con CSS y la descarga la captura tal cual. */
export function Tarjeta({ datos, ref }: { datos: DatosTarjeta; ref?: Ref<HTMLDivElement> }) {
  const { ancho, alto } = MEDIDAS[datos.tipo]
  return (
    <div ref={ref} className="fel-tarjeta" style={{ width: ancho, height: alto, color: AZUL }}>
      {datos.tipo === 'cumpleanos' && <Cumpleanos d={datos} />}
      {datos.tipo === 'aniversario' && <Aniversario d={datos} />}
      {datos.tipo === 'bienvenida' && <Bienvenida d={datos} />}
      {datos.tipo === 'despedida' && <Despedida d={datos} />}
    </div>
  )
}
