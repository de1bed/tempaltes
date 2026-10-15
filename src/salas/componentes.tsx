import { useMemo, useState, type KeyboardEvent } from 'react'
import { HORA_FIN, HORA_INICIO, local, mesesDelRango, semanasDelMes, textoDia, textoHora } from './tiempo'
import { conMayuscula, CORREO } from './util'

// Piezas que comparten la reservación con cuenta y la de externos (sin cuenta).

const TURNOS = [
  { id: 'manana', nombre: 'Mañana', desde: 7 * 60, hasta: 12 * 60 },
  { id: 'tarde', nombre: 'Tarde', desde: 12 * 60, hasta: 18 * 60 },
  { id: 'noche', nombre: 'Noche', desde: 18 * 60, hasta: 21 * 60 },
]
const LETRAS = ['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá', 'Do']


/** Un bloque de la cinta del día: propio, de alguien más o el que se está cambiando de horario. */
export interface BloqueAgenda {
  inicio: string
  fin: string
  propia: boolean
  moviendo?: boolean
}


export function Flecha({ dir, label, disabled, onClick }: { dir: 'izq' | 'der'; label: string; disabled?: boolean; onClick: () => void }) {
  return (
    <button type="button" className="salas-flecha" aria-label={label} disabled={disabled} onClick={onClick}>
      <svg viewBox="0 0 12 12" aria-hidden="true">
        {dir === 'izq' ? (
          <path d="M7.5 2.5 4 6l3.5 3.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        ) : (
          <path d="M4.5 2.5 8 6l-3.5 3.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        )}
      </svg>
    </button>
  )
}

export function Calendario({ dias, dia, ocupados, onElegir }: { dias: string[]; dia: string; ocupados: Set<string>; onElegir: (dia: string) => void }) {
  const meses = useMemo(() => mesesDelRango(dias), [dias])
  const mesDelDia = dia.slice(0, 7)
  // El mes visto a mano solo vale mientras no cambie el día elegido (mover o clic en otra fecha).
  const [vista, setVista] = useState<{ mes: string; ancla: string } | null>(null)
  const hoy = local(new Date()).dia
  const mes = vista && vista.ancla === dia && meses.includes(vista.mes) ? vista.mes : mesDelDia
  const mesSeguro = meses.includes(mes) ? mes : (meses[0] ?? mesDelDia)
  const indice = meses.indexOf(mesSeguro)
  const habiles = useMemo(() => new Set(dias), [dias])
  const semanas = useMemo(() => semanasDelMes(mesSeguro, habiles), [mesSeguro, habiles])

  return (
    <div className="salas-cal">
      <div className="salas-cal-nav">
        <Flecha dir="izq" label="Mes anterior" disabled={indice <= 0} onClick={() => setVista({ mes: meses[indice - 1], ancla: dia })} />
        <strong>{conMayuscula(textoDia(`${mesSeguro}-01`, { month: 'long', year: 'numeric' }))}</strong>
        <Flecha dir="der" label="Mes siguiente" disabled={indice < 0 || indice >= meses.length - 1} onClick={() => setVista({ mes: meses[indice + 1], ancla: dia })} />
      </div>
      <div className="salas-cal-letras" aria-hidden="true">
        {LETRAS.map((l) => (
          <span key={l}>{l}</span>
        ))}
      </div>
      <div className="salas-cal-grid" role="group" aria-label="Días para reservar">
        {semanas.map((semana) => (
          <div key={semana[0].dia} className="salas-cal-semana">
            {semana.map((celda) => {
              const enMes = celda.dia.slice(0, 7) === mesSeguro
              const puede = celda.habil && enMes
              const marcado = puede && ocupados.has(celda.dia)
              return (
                <button
                  key={celda.dia}
                  type="button"
                  className={['salas-celda', !enMes ? 'fuera' : '', celda.dia === dia && enMes ? 'activo' : '', celda.dia === hoy && enMes ? 'hoy' : '', marcado ? 'ocupado' : ''].filter(Boolean).join(' ')}
                  disabled={!puede}
                  aria-pressed={celda.dia === dia}
                  aria-label={`${textoDia(celda.dia)}${celda.dia === hoy ? ', hoy' : ''}${marcado ? ', con reservaciones' : ''}`}
                  onClick={() => puede && onElegir(celda.dia)}
                >
                  <span>{Number(celda.dia.slice(8))}</span>
                  <i />
                </button>
              )
            })}
          </div>
        ))}
      </div>
      <p className="nota salas-cal-nota">Lunes a viernes. El punto marca un día con reservaciones.</p>
    </div>
  )
}

export function CintaDia({ dia, agenda, elegido, duracion }: { dia: string; agenda: BloqueAgenda[]; elegido: number | null; duracion: number }) {
  const ini = HORA_INICIO * 60
  const total = (HORA_FIN - HORA_INICIO) * 60
  const pct = (min: number) => ((min - ini) / total) * 100
  const clamp = (iso: string) => {
    const l = local(new Date(iso))
    if (l.dia < dia) return ini
    if (l.dia > dia) return HORA_FIN * 60
    return Math.min(HORA_FIN * 60, Math.max(ini, l.minutos))
  }
  return (
    <div className="salas-cinta-wrap">
      <div className="salas-cinta" aria-hidden="true">
        {agenda.map((a, i) => {
          const a0 = clamp(a.inicio)
          const a1 = clamp(a.fin)
          if (a1 <= a0) return null
          return <span key={i} className={['salas-cinta-bloque', a.propia ? 'propia' : '', a.moviendo ? 'moviendo' : ''].filter(Boolean).join(' ')} style={{ left: `${pct(a0)}%`, width: `${Math.max(pct(a1) - pct(a0), 0.8)}%` }} />
        })}
        {elegido !== null && <span className="salas-cinta-sel" style={{ left: `${pct(elegido)}%`, width: `${(duracion / total) * 100}%` }} />}
      </div>
      <div className="salas-cinta-horas" aria-hidden="true">
        {[
          ['7 a.m.', 0],
          ['12 p.m.', (5 / 14) * 100],
          ['5 p.m.', (10 / 14) * 100],
          ['9 p.m.', 100],
        ].map(([texto, left]) => (
          <span key={texto} style={{ left: `${left}%` }}>
            {texto}
          </span>
        ))}
      </div>
    </div>
  )
}


/** Horarios libres agrupados por turno; el elegido queda marcado. */
export function HorariosLibres({ libres, elegido, onElegir }: { libres: number[]; elegido: number | null; onElegir: (m: number) => void }) {
  return (
    <div className="salas-turnos">
      {TURNOS.map((t) => {
        const horas = libres.filter((m) => m >= t.desde && m < t.hasta)
        if (horas.length === 0) return null
        return (
          <div key={t.id} className="salas-turno">
            <h4>{t.nombre}</h4>
            <div className="salas-horas">
              {horas.map((m) => (
                <button key={m} type="button" className={m === elegido ? 'salas-hora activo' : 'salas-hora'} aria-pressed={m === elegido} onClick={() => onElegir(m)}>
                  {textoHora(m)}
                </button>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

/** Correos como "chips": se agregan con Enter, coma o espacio; se quitan con la ×. */
export function CampoInvitados({ id, valor, onChange, max = 30 }: { id: string; valor: string[]; onChange: (v: string[]) => void; max?: number }) {
  const [texto, setTexto] = useState('')
  const [aviso, setAviso] = useState('')
  function agregar(entrada: string) {
    const nuevos = entrada.split(/[\s,;]+/).map((x) => x.trim().toLowerCase()).filter(Boolean)
    if (!nuevos.length) return
    const malos = nuevos.filter((x) => !CORREO.test(x))
    const buenos = nuevos.filter((x) => CORREO.test(x) && !valor.includes(x))
    onChange([...valor, ...buenos].slice(0, max))
    setTexto(malos.join(' '))
    setAviso(malos.length ? `Revisa: ${malos.join(', ')}` : '')
  }
  function tecla(e: KeyboardEvent<HTMLInputElement>) {
    if (['Enter', ',', ';', ' '].includes(e.key)) {
      e.preventDefault()
      agregar(texto)
    } else if (e.key === 'Backspace' && !texto && valor.length) onChange(valor.slice(0, -1))
  }
  return (
    <div className="salas-chips-campo">
      <div className="salas-chips" onClick={() => document.getElementById(id)?.focus()}>
        {valor.map((c) => (
          <span key={c} className="salas-chip">
            {c}
            <button type="button" aria-label={`Quitar ${c}`} onClick={() => onChange(valor.filter((x) => x !== c))}>
              ×
            </button>
          </span>
        ))}
        <input
          id={id}
          type="text"
          inputMode="email"
          autoComplete="off"
          value={texto}
          placeholder={valor.length ? '' : 'correo@empresa.com'}
          onChange={(e) => (e.target.value.match(/[,;\s]$/) ? agregar(e.target.value) : setTexto(e.target.value))}
          onKeyDown={tecla}
          onBlur={() => agregar(texto)}
          onPaste={(e) => {
            e.preventDefault()
            agregar(texto + ' ' + e.clipboardData.getData('text'))
          }}
        />
      </div>
      {aviso && <small className="salas-aviso-campo">{aviso}</small>}
    </div>
  )
}

