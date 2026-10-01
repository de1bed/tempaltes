import { Area, Fecha, Fila, Numero, Opciones, Seccion, Texto } from '../ui/campos'
import { calcularCorrida, etiquetaObjetivo, OBJETIVOS, ARCHIVOS_APROBADOS } from './calculo'
import {
  CONCEPTOS_NO_SOPORTADOS,
  type ConceptoPendiente,
  type CorridaData,
  type CorridaId,
  type Hilos33Data,
  type KofileData,
  type Objetivo,
} from './tipos'

const moneda = (x: number, dec = 2) => `$${x.toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec })}`

const DESCRIPCION: Record<CorridaId, string> = {
  kofile: 'Simulación extendida Kofile: nómina catorcenal con ISR/ISPT, IMSS, asimilado e invoice bi-weekly.',
  general: 'Corrida general Treve en formato completo/desglosado (Calculo, IMSS Calculo, Simulacion).',
  hilos33: 'Formato 33 Hilos: montos de la corrida general Treve presentados en la estructura 33 Hilos.',
}

function Casillas({ valores, onChange }: { valores: ConceptoPendiente[]; onChange: (v: ConceptoPendiente[]) => void }) {
  return (
    <div className="casillas" role="group" aria-label="Conceptos no incluidos en la plantilla">
      {(Object.entries(CONCEPTOS_NO_SOPORTADOS) as [ConceptoPendiente, string][]).map(([id, texto]) => {
        const marcado = valores.includes(id)
        return (
          <label key={id} className={marcado ? 'casilla marcada' : 'casilla'}>
            <input type="checkbox" checked={marcado} onChange={() => onChange(marcado ? valores.filter((x) => x !== id) : [...valores, id])} />
            {texto}
          </label>
        )
      })}
    </div>
  )
}

/** Resultado de las validaciones de la corrida (se muestra arriba del formulario). */
export function EstadoCorrida({ id, d }: { id: CorridaId; d: CorridaData }) {
  const r = calcularCorrida(id, d)
  if (r.faltantes.length) {
    return (
      <div className="estado-corrida falta" role="status">
        <strong>Faltan datos para generar la corrida</strong>
        <ul>
          {r.faltantes.map((f) => (
            <li key={f}>{f}</li>
          ))}
        </ul>
      </div>
    )
  }
  const errores = r.validaciones.filter((v) => !v.ok && v.nivel !== 'pendiente')
  const pendientes = r.validaciones.filter((v) => v.nivel === 'pendiente')
  return (
    <div className={errores.length ? 'estado-corrida falta' : 'estado-corrida ok'} role="status">
      <div className="estado-cifras">
        <div>
          <span>Salario diario</span>
          <strong>{moneda(r.salarioDiario, Number(d.decimales) === 6 && d.objetivo !== 'salarioDiario' ? 6 : 2)}</strong>
        </div>
        <div>
          <span>{r.sodexo.monto > 0 ? 'Neto + Sodexo' : 'Neto'}</span>
          <strong>{moneda(r.sodexo.monto > 0 ? r.netoSodexo.monto : r.neto.monto)}</strong>
        </div>
      </div>
      {d.objetivo !== 'salarioDiario' && (
        <div className="estado-objetivo">
          {r.objetivo.etiqueta}: {moneda(r.objetivo.obtenido)} · diferencia {moneda(r.objetivo.diferencia)}
        </div>
      )}
      <details className="estado-detalle" open={errores.length > 0}>
        <summary>{errores.length ? `${errores.length} validación(es) con problema` : `Validación correcta (${r.validaciones.length - pendientes.length} revisiones)`}</summary>
        <ul>
          {r.validaciones.map((v) => (
            <li key={v.texto} className={v.nivel === 'pendiente' ? 'pendiente' : v.ok ? 'bien' : 'mal'}>
              {v.texto}
            </li>
          ))}
        </ul>
      </details>
    </div>
  )
}

export function FormCorrida<T extends CorridaData>({ id, d, set }: { id: CorridaId; d: T; set: (p: Partial<T>) => void }) {
  const k = id === 'kofile' ? (d as unknown as KofileData) : null
  const h = id === 'hilos33' ? (d as unknown as Hilos33Data) : null
  const setK = set as unknown as (p: Partial<KofileData>) => void
  const setH = set as unknown as (p: Partial<Hilos33Data>) => void
  const asimilado = k?.esquema === 'asimilado'
  const objetivos = OBJETIVOS[id].filter((o) => !(asimilado && o === 'netoSodexo'))
  const periodo = id === 'kofile' ? 'catorcena' : 'semana'

  return (
    <>
      <p className="nota-corrida">
        {DESCRIPCION[id]} Plantilla: <code>{ARCHIVOS_APROBADOS[id]}</code>
      </p>
      <EstadoCorrida id={id} d={d} />

      <Seccion titulo="Solicitud">
        <Fila>
          <Texto label="Cliente / proyecto" value={d.empresa} onChange={(v) => set({ empresa: v } as Partial<T>)} />
          <Fecha label="Fecha" value={d.fecha} onChange={(v) => set({ fecha: v } as Partial<T>)} />
        </Fila>
        <Texto label="Puesto / posición *" value={d.puesto} placeholder="Ej. Project Manager" onChange={(v) => set({ puesto: v } as Partial<T>)} />
      </Seccion>

      <Seccion titulo="Objetivo">
        {k && (
          <Opciones
            label="Esquema"
            value={k.esquema}
            onChange={(v) => setK({ esquema: v, ...(v === 'asimilado' && k.objetivo === 'netoSodexo' ? { objetivo: 'neto' as Objetivo } : {}) })}
            opciones={[
              ['nomina', 'Nómina (ISR por tabla + IMSS) – hoja Simulacion'],
              ['asimilado', 'Asimilado + invoice bi-weekly – hoja Simulacion Asimilado'],
            ]}
          />
        )}
        <Opciones
          label="¿Qué quieres fijar?"
          value={d.objetivo}
          onChange={(v) => set({ objetivo: v } as Partial<T>)}
          opciones={objetivos.map((o) => [o, etiquetaObjetivo(id, o, 'es', asimilado)] as const)}
          ayuda={d.objetivo === 'salarioDiario' ? 'Se captura el salario diario tal cual (no se busca nada).' : 'La app busca el salario diario que llega a este monto.'}
        />
        <Fila>
          <Numero label={d.objetivo === 'salarioDiario' ? 'Salario diario *' : 'Monto objetivo *'} prefijo="$" value={d.monto} onChange={(v) => set({ monto: v } as Partial<T>)} />
          {d.objetivo !== 'salarioDiario' && (
            <Opciones
              label="Decimales del salario diario"
              value={d.decimales}
              onChange={(v) => set({ decimales: v } as Partial<T>)}
              opciones={[
                ['2', '2 (centavos)'],
                ['6', '6 (cierre exacto)'],
              ]}
            />
          )}
        </Fila>
      </Seccion>

      <Seccion titulo="Prestaciones y conceptos">
        <Fila>
          {!asimilado && <Numero label={`Sodexo por ${periodo}`} prefijo="$" value={d.sodexo} onChange={(v) => set({ sodexo: v } as Partial<T>)} ayuda="0 = sin Sodexo" />}
          {!asimilado && <Numero label="Ajuste moneda (deducción)" prefijo="$" value={d.ajusteMoneda} onChange={(v) => set({ ajusteMoneda: v } as Partial<T>)} />}
        </Fila>
        {k && (
          <>
            <Fila>
              <Opciones
                label="Séptimo día"
                value={k.septimo ? 'si' : 'no'}
                onChange={(v) => setK({ septimo: v === 'si' })}
                opciones={[
                  ['si', 'Con séptimo día'],
                  ['no', 'Sin séptimo día'],
                ]}
              />
              <Numero label="Días de vacaciones (prima vacacional)" value={k.diasVacaciones} onChange={(v) => setK({ diasVacaciones: v })} ayuda="Plantilla: 24" />
            </Fila>
            <Fila>
              <Opciones
                label="Bono de desempeño mensual"
                value={k.bonoDesempeno}
                onChange={(v) => setK({ bonoDesempeno: v })}
                opciones={[
                  ['plantilla', 'Según plantilla (salario mensual)'],
                  ['monto', 'Monto mensual fijo'],
                ]}
              />
              {k.bonoDesempeno === 'monto' && <Numero label="Bono mensual" prefijo="$" value={k.bonoDesempenoMonto} onChange={(v) => setK({ bonoDesempenoMonto: v })} />}
            </Fila>
            <Fila>
              <Numero label="PTU" prefijo="$" value={k.ptu} onChange={(v) => setK({ ptu: v })} />
              <Numero label="Internet" prefijo="$" value={k.internet} onChange={(v) => setK({ internet: v })} />
              <Numero label="Bono navideño" prefijo="$" value={k.navideno} onChange={(v) => setK({ navideno: v })} />
            </Fila>
            <small className="nota">Fondo de ahorro, vale de despensa, aguinaldo y prima vacacional se calculan con las fórmulas de la plantilla.</small>
          </>
        )}
      </Seccion>

      {k && asimilado && (
        <Seccion titulo="Invoice bi-weekly">
          <Fila>
            <Numero label="Operational week cost" prefijo="$" value={k.costoOperativo} onChange={(v) => setK({ costoOperativo: v })} />
            <Numero label="Service fee (%)" value={k.serviceFee} onChange={(v) => setK({ serviceFee: v })} />
          </Fila>
          <Fila>
            <Numero label="Medical annual" prefijo="$" value={k.medicoAnual} onChange={(v) => setK({ medicoAnual: v })} />
            <Numero label="Life insurance annual" prefijo="$" value={k.seguroVidaAnual} onChange={(v) => setK({ seguroVidaAnual: v })} />
          </Fila>
          <Numero label="Tipo de cambio (MXN por USD)" value={k.tipoCambio} onChange={(v) => setK({ tipoCambio: v })} ayuda="Para mostrar el invoice en USD." />
        </Seccion>
      )}

      {h && (
        <Seccion titulo="Facturación 33 Hilos">
          <Fila>
            <Numero label="Costo de servicio (%)" value={h.servicio} onChange={(v) => setH({ servicio: v })} />
            <Numero label="Costos operativos y administrativos" prefijo="$" value={h.costosAdministrativos} onChange={(v) => setH({ costosAdministrativos: v })} />
          </Fila>
        </Seccion>
      )}

      <Seccion titulo="Conceptos que no están en la plantilla" abierta={d.pendientes.length > 0}>
        <small className="nota">
          Si la solicitud pide alguno, márcalo: queda como <strong>pendiente</strong> en la corrida y en la validación, sin inventarle fórmula.
        </small>
        <Casillas valores={d.pendientes} onChange={(v) => set({ pendientes: v } as Partial<T>)} />
      </Seccion>

      <Seccion titulo="Observaciones" abierta={false}>
        <Area label="Observaciones / instrucciones adicionales" value={d.observaciones} onChange={(v) => set({ observaciones: v } as Partial<T>)} filas={3} />
        <Texto label="Elaboró" value={d.elaboro} onChange={(v) => set({ elaboro: v } as Partial<T>)} />
      </Seccion>
    </>
  )
}
