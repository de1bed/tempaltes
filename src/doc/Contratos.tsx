import type { ReactNode } from 'react'
import { ligar } from '../lib/edicion'
import { fechaEn, fechaEs, traductor } from '../lib/formato'
import type { ContratoLicenciaData, Idioma, NdaData } from '../lib/modelo'
import { finDeVigencia, TESTIGO_TREVE, textoVigencia } from '../lib/contratos'
import { rellenar } from '../lib/modelo'
import { Editable, LineaEditable } from './Editable'
import { Paginado, type Bloque } from './Paginado'

const LETRAS = 'abcdefghijklmnopqrstuvwxyz'

/** Fecha larga según idioma: "24 de septiembre de 2026" / "September 24, 2026". */
const fechaLarga = (idioma: Idioma, iso: string) => (idioma === 'es' ? fechaEs(iso) : fechaEn(iso))

/**
 * Convierte el cuerpo de un contrato en bloques editables:
 * "## " cláusula numerada, "### " subtítulo, "- " inciso a), b)…, otra línea = párrafo.
 */
function bloquesCuerpo(cuerpo: string, onCambio: (v: string) => void, vars: Record<string, string>, idioma: Idioma): Bloque[] {
  const t = traductor(idioma)
  const items = cuerpo.split('\n')
  let clausula = 0
  let inciso = 0
  return items.map((l, i) => {
    // **texto** en negritas; Ctrl+B / ⌘B en la hoja.
    const comun = { items, i, onCambio, id: 'cuerpo', vars, marcado: true }
    if (l.startsWith('## ')) {
      clausula++
      inciso = 0
      return {
        key: `l${i}`,
        conSiguiente: true,
        nodo: (
          <div className="clausula">
            {clausula}. <LineaEditable {...comun} prefijo="## " placeholder={t('Título de la cláusula', 'Clause title')} />
          </div>
        ),
      }
    }
    if (l.startsWith('### ')) {
      inciso = 0
      return {
        key: `l${i}`,
        conSiguiente: true,
        nodo: (
          <div className="subclausula">
            <LineaEditable {...comun} prefijo="### " placeholder={t('Subtítulo', 'Subtitle')} />
          </div>
        ),
      }
    }
    if (l.startsWith('- ')) {
      const letra = LETRAS[inciso++ % LETRAS.length]
      return {
        key: `l${i}`,
        nodo: (
          <div className="inciso">
            <span className="letra">{letra})</span>
            <span>
              <LineaEditable {...comun} prefijo="- " placeholder={t('Inciso', 'Item')} />
            </span>
          </div>
        ),
      }
    }
    inciso = 0
    return {
      key: `l${i}`,
      nodo: (
        <p className={l.trim() ? 'parrafo' : 'parrafo vacio'}>
          <LineaEditable {...comun} placeholder={t('Párrafo', 'Paragraph')} />
        </p>
      ),
    }
  })
}

/** El último bloque del cuerpo va junto con las firmas: las firmas nunca quedan solas en una hoja. */
function conFirmas(bloques: Bloque[]): Bloque[] {
  return bloques.map((b, i) => (i === bloques.length - 1 ? { ...b, conSiguiente: true } : b))
}

/** Logotipo Feedbak recortado de la hoja membretada, línea superior y pie con número de hoja. */
const fondoFeedbak = (
  <>
    <div className="logo-feedbak" aria-label="Feedbak" />
    <div className="linea-sup" />
  </>
)

function Pie({ izquierda, hoja, total, idioma }: { izquierda?: ReactNode; hoja: number; total: number; idioma: Idioma }) {
  return (
    <div className="pie">
      <span>{izquierda}</span>
      <span>{idioma === 'es' ? `Página ${hoja} de ${total}` : `Page ${hoja} of ${total}`}</span>
    </div>
  )
}

function Firma({ nombre, detalle }: { nombre: ReactNode; detalle: ReactNode }) {
  return (
    <div className="firma">
      <div className="firma-nombre">{nombre}</div>
      <div className="firma-detalle">{detalle}</div>
    </div>
  )
}

/* ───────── Contrato de licencia y servicios ───────── */

export function ContratoLicencia({ d, set }: { d: ContratoLicenciaData; set: (p: Partial<ContratoLicenciaData>) => void }) {
  const t = traductor(d.idioma)
  const c$ = ligar(d, set)
  const fechaRenovacion = fechaLarga(d.idioma, finDeVigencia(d))
  const duracion = textoVigencia(d, d.idioma)
  const vars = {
    cliente: d.empresa.trim() || t('[NOMBRE DEL CLIENTE O RAZÓN SOCIAL]', '[CLIENT NAME OR CORPORATE NAME]'),
    proveedor: d.proveedor,
    representanteProveedor: d.firmante,
    vigencia: duracion,
    inicio: fechaLarga(d.idioma, d.fecha),
    renovacion: fechaRenovacion,
  }

  const bloques: Bloque[] = [
    {
      key: 'titulo',
      nodo: (
        <p className="titulo-doc">
          <Editable {...c$('titulo')} mostrar={rellenar(d.titulo, vars)} placeholder={t('Título del contrato', 'Agreement title')} />
        </p>
      ),
    },
    // En el texto, las fechas de inicio y terminación de la vigencia van en negritas.
    ...conFirmas(bloquesCuerpo(d.cuerpo, (v) => set({ cuerpo: v }), { ...vars, inicio: `**${vars.inicio}**`, renovacion: `**${vars.renovacion}**` }, d.idioma)),
    {
      key: 'vigencia-resaltada',
      conSiguiente: true,
      nodo: (
        <table className="vigencia-resaltada">
          <tbody>
            <tr>
              <td>
                <strong>{t('Vigencia del contrato:', 'Agreement term:')}</strong>{' '}
                {t(
                  `Desde ${vars.inicio} hasta ${fechaRenovacion} (${duracion.replace(/^de /, '')})`,
                  `From ${vars.inicio} until ${fechaRenovacion} (${duracion})`,
                )}
              </td>
            </tr>
          </tbody>
        </table>
      ),
    },
    {
      key: 'firmas',
      nodo: (
        <div className="firmas">
          <Firma
            nombre={<Editable {...c$('contacto')} placeholder={t('Representante del cliente', 'Client representative')} />}
            detalle={<Editable {...c$('empresa')} placeholder={t('Razón social del cliente', 'Client corporate name')} />}
          />
          <Firma
            nombre={<Editable {...c$('firmante')} placeholder={t('Representante de Feedbak', 'Feedbak representative')} />}
            detalle={<Editable {...c$('proveedor')} placeholder={t('Razón social del proveedor', 'Provider corporate name')} />}
          />
          <Firma
            nombre={<Editable {...c$('testigoCliente')} placeholder={t('Nombre del testigo', 'Witness name')} />}
            detalle={t('Testigo', 'Witness')}
          />
          <Firma
            nombre={
              <Editable
                {...c$('testigoProveedor')}
                mostrar={d.testigoProveedor.trim() || TESTIGO_TREVE}
                placeholder={TESTIGO_TREVE}
              />
            }
            detalle={`${t('Testigo Treve', 'Treve witness')} · ${d.proveedor}`}
          />
        </div>
      ),
    },
  ]

  return (
    <Paginado
      clase="contrato"
      bloques={bloques}
      fondo={fondoFeedbak}
      pie={(hoja, total) => (
        <Pie
          idioma={d.idioma}
          hoja={hoja}
          total={total}
          izquierda={
            <>
              {t('Contrato número: ', 'Agreement number: ')}
              <Editable {...c$('numero')} placeholder="FEED-CON-00-00000" />
            </>
          }
        />
      )}
    />
  )
}

/* ───────── Contrato de confidencialidad (NDA) ───────── */

export function Nda({ d, set }: { d: NdaData; set: (p: Partial<NdaData>) => void }) {
  const t = traductor(d.idioma)
  const c$ = ligar(d, set)
  const cliente = d.empresa.trim() || t('[RAZÓN SOCIAL]', '[CORPORATE NAME]')
  const vars = {
    cliente,
    proveedor: d.proveedor,
    representante: d.contacto.trim() || t('[REPRESENTANTE LEGAL]', '[LEGAL REPRESENTATIVE]'),
    representantesProveedor: d.representantesProveedor,
    direccionProveedor: d.direccionProveedor,
    direccionCliente: d.direccionCliente.trim() || t('[DIRECCIÓN DEL CLIENTE]', '[CLIENT ADDRESS]'),
    fecha: fechaLarga(d.idioma, d.fecha),
  }

  const bloques: Bloque[] = [
    {
      key: 'titulo',
      nodo: (
        <div className="nda-encabezado">
          <div className="nda-titulo">
            <Editable {...c$('titulo')} placeholder={t('Título', 'Title')} />
          </div>
          <div className="nda-subtitulo">
            <Editable {...c$('subtitulo')} placeholder={t('Subtítulo (opcional)', 'Subtitle (optional)')} />
          </div>
          <div className="nda-datos">
            <div>
              <strong>{t('Fecha de entrada en vigencia:', 'Effective date:')}</strong> {vars.fecha}
            </div>
            <div>
              <strong>{t('Cliente (la Compañía):', 'Client (the Company):')}</strong>{' '}
              <Editable {...c$('empresa')} placeholder={t('Razón social', 'Corporate name')} />
            </div>
          </div>
        </div>
      ),
    },
    ...conFirmas(bloquesCuerpo(d.cuerpo, (v) => set({ cuerpo: v }), vars, d.idioma)),
    {
      key: 'firmas',
      nodo: (
        <div className="firmas">
          <Firma
            nombre={<Editable {...c$('firmante')} placeholder={t('Representante del proveedor', 'Provider representative')} />}
            detalle={
              <>
                {t('Representante legal', 'Legal representative')}
                <br />
                {t('Por el proveedor: ', 'For the provider: ')}
                {d.proveedor}
              </>
            }
          />
          <Firma
            nombre={<Editable {...c$('contacto')} placeholder={t('Representante del cliente', 'Client representative')} />}
            detalle={
              <>
                {t('Representante legal', 'Legal representative')}
                <br />
                {t('Por el Cliente: ', 'For the Client: ')}
                {cliente}
              </>
            }
          />
          <Firma nombre={<Editable {...c$('testigo')} placeholder={t('Nombre del testigo', 'Witness name')} />} detalle={t('Testigo', 'Witness')} />
        </div>
      ),
    },
  ]

  return (
    <Paginado
      clase="contrato"
      bloques={bloques}
      fondo={fondoFeedbak}
      pie={(hoja, total) => <Pie idioma={d.idioma} hoja={hoja} total={total} izquierda={t('Contrato de confidencialidad', 'Confidentiality agreement')} />}
    />
  )
}
