import { dinero, miles, num, pct } from '../lib/formato'
import type { BonosData, FeedbakData, GmmData, PayrollData, ServiciosData } from '../lib/modelo'
import { PORTADAS } from '../lib/imagenes'
import { cotizarFeedbak, PRODUCTOS, type ProductoFeedbak } from '../lib/tabuladores'
import { Area, Fecha, Fila, Lista, Numero, Opciones, Seccion, Texto } from './campos'

interface Props<T> {
  d: T
  set: (parcial: Partial<T>) => void
}

const TRATAMIENTOS = [
  ['Estimada', 'Estimada'],
  ['Estimado', 'Estimado'],
  ['Estimados', 'Estimados'],
] as const

function Destinatario<T extends { contacto: string; empresa: string; fecha: string }>({ d, set, ciudad }: Props<T> & { ciudad?: boolean }) {
  const dd = d as T & { ciudad?: string; puesto?: string; tratamiento?: string; idioma?: string }
  const s = set as unknown as (p: Record<string, string>) => void
  return (
    <Seccion titulo="Cliente y fecha">
      <Fila>
        <Texto label="Nombre del contacto" value={d.contacto} onChange={(v) => s({ contacto: v })} placeholder="Luz Gómez" />
        {dd.idioma === 'es' && dd.tratamiento !== undefined && (
          <Opciones label="Saludo" value={dd.tratamiento} onChange={(v) => s({ tratamiento: v })} opciones={TRATAMIENTOS} />
        )}
      </Fila>
      {dd.puesto !== undefined && <Texto label="Puesto" value={dd.puesto} onChange={(v) => s({ puesto: v })} placeholder="HR Manager" />}
      <Texto label="Empresa" value={d.empresa} onChange={(v) => s({ empresa: v })} placeholder="APTIV" />
      <Fila>
        {ciudad && dd.ciudad !== undefined && <Texto label="Ciudad" value={dd.ciudad} onChange={(v) => s({ ciudad: v })} />}
        <Fecha label="Fecha" value={d.fecha} onChange={(v) => s({ fecha: v })} />
      </Fila>
    </Seccion>
  )
}

/* ───────── Feedbak ───────── */

const PRODUCTO_OPCIONES = (Object.keys(PRODUCTOS) as ProductoFeedbak[]).map((k) => [k, PRODUCTOS[k].nombre] as const)

export function FormFeedbak({ d, set }: Props<FeedbakData>) {
  const c = cotizarFeedbak({
    producto: d.producto,
    colaboradores: num(d.colaboradores),
    administradores: num(d.administradores),
    moneda: d.moneda,
    tipoCambio: num(d.tipoCambio),
  })
  return (
    <>
      <Seccion titulo="Portada">
        <div className="portadas">
          {(['1', '2', '3', 'ninguna'] as const).map((p) => (
            <button
              key={p}
              type="button"
              className={d.portada === p ? 'portada activa' : 'portada'}
              onClick={() => set({ portada: p })}
              aria-pressed={d.portada === p}
            >
              {p === 'ninguna' ? <span>Sin portada</span> : <img src={PORTADAS[p]} alt={`Portada ${p}`} />}
            </button>
          ))}
        </div>
      </Seccion>

      <Seccion titulo="Tabulador">
        <Opciones label="Plataforma" value={d.producto} onChange={(v) => set({ producto: v })} opciones={PRODUCTO_OPCIONES} />
        <Fila>
          <Numero label="Colaboradores" value={d.colaboradores} min={1} step="1" onChange={(v) => set({ colaboradores: v })} />
          <Numero
            label="Administradores requeridos"
            value={d.administradores}
            step="1"
            onChange={(v) => set({ administradores: v })}
            ayuda={`${c.adminsIncluidos} incluidos sin costo`}
          />
        </Fila>
        <Fila>
          <Opciones
            label="Moneda"
            value={d.moneda}
            onChange={(v) => set({ moneda: v })}
            opciones={[
              ['MXN', 'Pesos (MXN)'],
              ['USD', 'Dólares (USD)'],
            ]}
          />
          {d.moneda === 'USD' && (
            <Numero label="Tipo de cambio" prefijo="$" value={d.tipoCambio} onChange={(v) => set({ tipoCambio: v })} ayuda="Pesos por dólar" />
          )}
        </Fila>
        <dl className="resumen">
          <dt>Precio mensual por usuario</dt>
          <dd>{dinero(c.precioUsuario)}</dd>
          <dt>Total mensual</dt>
          <dd>{dinero(c.totalMensual)}</dd>
          <dt>Configuración inicial</dt>
          <dd>{c.setup > 0 ? dinero(c.setup) : 'Sin costo'}</dd>
          <dt>Admins incluidos / extra</dt>
          <dd>
            {c.adminsIncluidos} / {c.adminsExtra} × {dinero(c.precioAdminExtra)}
          </dd>
          <dt>Semestral (−{pct(c.descuentoSemestral)})</dt>
          <dd>{dinero(c.semestral)}</dd>
          <dt>Anual (−{pct(c.descuentoAnual)})</dt>
          <dd>{dinero(c.anual)}</dd>
        </dl>
        <small className="nota">Precios fijos del tabulador para {miles(c.colaboradores)} colaboradores.</small>
      </Seccion>

      <Destinatario d={d} set={set} ciudad />

      <Seccion titulo="Alcance" abierta={false}>
        <Fila>
          <Texto label="Capacitación (hrs)" value={d.capacitacionHoras} onChange={(v) => set({ capacitacionHoras: v })} />
          <Texto label="Horas de soporte incluidas" value={d.horasSoporte} onChange={(v) => set({ horasSoporte: v })} />
        </Fila>
        <Texto label="Costo por hora de soporte adicional" value={d.costoHoraAdicional} onChange={(v) => set({ costoHoraAdicional: v })} />
      </Seccion>

      <Seccion titulo="Carta y términos" abierta={false}>
        <Area label="Carta" value={d.intro} filas={5} onChange={(v) => set({ intro: v })} ayuda="Un párrafo por línea. {plataformas} se sustituye." />
        <Texto label="Título" value={d.titulo} onChange={(v) => set({ titulo: v })} />
        <Texto label="Nota de montos" value={d.notaMontos} onChange={(v) => set({ notaMontos: v })} ayuda="{Moneda} se sustituye." />
        <Area
          label="Términos y condiciones"
          value={d.terminos}
          filas={10}
          onChange={(v) => set({ terminos: v })}
          ayuda='Un punto por línea. Las líneas que empiezan con "## " son títulos de sección. {moneda} y {precioAdmin} se sustituyen.'
        />
      </Seccion>

      <Seccion titulo="Firma" abierta={false}>
        <Fila>
          <Texto label="Firmante" value={d.firmante} onChange={(v) => set({ firmante: v })} />
          <Texto label="Empresa del firmante" value={d.firmanteEmpresa} onChange={(v) => set({ firmanteEmpresa: v })} />
        </Fila>
      </Seccion>
    </>
  )
}

/* ───────── Staffvia ───────── */

const AYUDA_TERMINOS = 'Un punto por línea.'

export function FormServicios({ d, set }: Props<ServiciosData>) {
  return (
    <>
      <Seccion titulo="Portada">
        <Texto label="Título de la portada" value={d.tituloPortada} onChange={(v) => set({ tituloPortada: v })} />
      </Seccion>
      <Destinatario d={d} set={set} ciudad />
      <Seccion titulo="Servicios">
        <Area label="Introducción" value={d.intro} filas={3} onChange={(v) => set({ intro: v })} ayuda="{empresa} se sustituye por el nombre de la empresa." />
        <Lista
          etiqueta="Servicio"
          items={d.servicios}
          onChange={(servicios) => set({ servicios })}
          nuevo={() => ({ cantidad: '1', descripcion: '', precio: '0' })}
          render={(s, cambiar) => (
            <>
              <Texto label="Descripción" value={s.descripcion} onChange={(v) => cambiar({ descripcion: v })} />
              <Fila>
                <Numero label="Cantidad" value={s.cantidad} step="1" onChange={(v) => cambiar({ cantidad: v })} />
                <Numero label="Precio unitario" prefijo="$" value={s.precio} onChange={(v) => cambiar({ precio: v })} />
              </Fila>
            </>
          )}
        />
        <Fila>
          <Numero label="IVA (%)" value={d.iva} onChange={(v) => set({ iva: v })} />
        </Fila>
        <Texto label="Nota de precios" value={d.notaPrecios} onChange={(v) => set({ notaPrecios: v })} />
        <Area label="Detalle de la propuesta" value={d.detalle} onChange={(v) => set({ detalle: v })} ayuda={AYUDA_TERMINOS} />
        <Area label="Notas" value={d.notas} filas={2} onChange={(v) => set({ notas: v })} />
      </Seccion>
      <Seccion titulo="Términos y firma" abierta={false}>
        <Area label="Términos y condiciones" value={d.terminos} filas={8} onChange={(v) => set({ terminos: v })} ayuda={AYUDA_TERMINOS} />
        <Texto label="Firmante" value={d.firmante} onChange={(v) => set({ firmante: v })} />
      </Seccion>
    </>
  )
}

export function FormPayroll({ d, set }: Props<PayrollData>) {
  return (
    <>
      <Seccion titulo="Portada">
        <Texto label="Título (puesto)" value={d.tituloPortada} onChange={(v) => set({ tituloPortada: v })} />
        <Texto label="Cliente en portada" value={d.clientePortada} onChange={(v) => set({ clientePortada: v })} placeholder="TREVE – 33 Threads" />
      </Seccion>
      <Destinatario d={d} set={set} ciudad />
      <Seccion titulo="Cotización">
        <Area label="Introducción" value={d.intro} filas={3} onChange={(v) => set({ intro: v })} ayuda="{empresa} y {puesto} se sustituyen automáticamente." />
        <Texto label="Puesto" value={d.puesto} onChange={(v) => set({ puesto: v })} />
        <Fila>
          <Numero label="Número de personas" value={d.headcount} step="1" onChange={(v) => set({ headcount: v })} />
          <Texto label="Frecuencia de nómina" value={d.frecuencia} onChange={(v) => set({ frecuencia: v })} />
        </Fila>
        <Numero label="Cuota de servicio (%)" value={d.fee} onChange={(v) => set({ fee: v })} />
        <Numero label="Sueldo bruto (semanal)" prefijo="$" value={d.salario} onChange={(v) => set({ salario: v })} />
        <Numero label="Cuotas patronales (semanal)" prefijo="$" value={d.impuestos} onChange={(v) => set({ impuestos: v })} />
        <Numero label="Vacaciones, aguinaldo y prima (semanal)" prefijo="$" value={d.prestaciones} onChange={(v) => set({ prestaciones: v })} />
        <small className="nota">Mensual = semanal × 4.33 (52 semanas / 12 meses). La cuota de servicio se calcula sobre la suma.</small>
      </Seccion>
      <Seccion titulo="Términos y firma" abierta={false}>
        <Area label="Términos y condiciones" value={d.terminos} filas={8} onChange={(v) => set({ terminos: v })} ayuda={`${AYUDA_TERMINOS} {fee} se sustituye por la cuota de servicio.`} />
        <Texto label="Firmante" value={d.firmante} onChange={(v) => set({ firmante: v })} />
      </Seccion>
    </>
  )
}

export function FormGmm({ d, set }: Props<GmmData>) {
  return (
    <>
      <Seccion titulo="Portada">
        <Texto label="Cliente en portada" value={d.clientePortada} onChange={(v) => set({ clientePortada: v })} placeholder="TREVE – 33 Threads" />
      </Seccion>
      <Destinatario d={d} set={set} />
      <Seccion titulo="Póliza">
        <Fila>
          <Fecha label="Vigencia desde" value={d.inicio} onChange={(v) => set({ inicio: v })} />
          <Fecha label="Hasta" value={d.fin} onChange={(v) => set({ fin: v })} />
        </Fila>
        <Lista
          etiqueta="Empleado"
          items={d.empleados}
          onChange={(empleados) => set({ empleados })}
          nuevo={() => ({ nombre: '', edad: '', menorMensual: '0', menorAnual: '0', mayorMensual: '0', mayorAnual: '0' })}
          render={(e, cambiar) => (
            <>
              <Fila>
                <Texto label="Nombre" value={e.nombre} onChange={(v) => cambiar({ nombre: v })} />
                <Numero label="Edad" value={e.edad} step="1" onChange={(v) => cambiar({ edad: v })} />
              </Fila>
              <Fila>
                <Numero label="Menor · mensual" prefijo="$" value={e.menorMensual} onChange={(v) => cambiar({ menorMensual: v })} />
                <Numero label="Menor · anual" prefijo="$" value={e.menorAnual} onChange={(v) => cambiar({ menorAnual: v })} />
              </Fila>
              <Fila>
                <Numero label="Mayor · mensual" prefijo="$" value={e.mayorMensual} onChange={(v) => cambiar({ mayorMensual: v })} />
                <Numero label="Mayor · anual" prefijo="$" value={e.mayorAnual} onChange={(v) => cambiar({ mayorAnual: v })} />
              </Fila>
            </>
          )}
        />
      </Seccion>
      <Seccion titulo="Términos y firma" abierta={false}>
        <Area label="Términos y condiciones" value={d.terminos} filas={8} onChange={(v) => set({ terminos: v })} ayuda={AYUDA_TERMINOS} />
        <Texto label="Firmante" value={d.firmante} onChange={(v) => set({ firmante: v })} />
      </Seccion>
    </>
  )
}

export function FormBonos({ d, set }: Props<BonosData>) {
  return (
    <>
      <Seccion titulo="Portada">
        <Texto label="Título" value={d.tituloPortada} onChange={(v) => set({ tituloPortada: v })} />
        <Texto label="Cliente en portada" value={d.clientePortada} onChange={(v) => set({ clientePortada: v })} placeholder="TREVE – 33 Threads" />
      </Seccion>
      <Destinatario d={d} set={set} ciudad />
      <Seccion titulo="Bonos">
        <Area label="Introducción" value={d.intro} filas={4} onChange={(v) => set({ intro: v })} ayuda="Un párrafo por línea. {empresa} y {titulo} se sustituyen." />
        <Lista
          etiqueta="Empleado"
          items={d.empleados}
          onChange={(empleados) => set({ empleados })}
          nuevo={() => ({ nombre: '', bruto: '0', neto: '0', costo: '0' })}
          render={(e, cambiar) => (
            <>
              <Texto label="Nombre" value={e.nombre} onChange={(v) => cambiar({ nombre: v })} />
              <Fila>
                <Numero label="Bono bruto" prefijo="$" value={e.bruto} onChange={(v) => cambiar({ bruto: v })} />
                <Numero label="Bono neto" prefijo="$" value={e.neto} onChange={(v) => cambiar({ neto: v })} />
                <Numero label="Costo de nómina" prefijo="$" value={e.costo} onChange={(v) => cambiar({ costo: v })} />
              </Fila>
            </>
          )}
        />
        <small className="nota">Total por empleado = bono bruto + costo de nómina.</small>
      </Seccion>
      <Seccion titulo="Términos y firma" abierta={false}>
        <Area label="Términos y condiciones" value={d.terminos} filas={8} onChange={(v) => set({ terminos: v })} ayuda={AYUDA_TERMINOS} />
        <Texto label="Firmante" value={d.firmante} onChange={(v) => set({ firmante: v })} />
      </Seccion>
    </>
  )
}
