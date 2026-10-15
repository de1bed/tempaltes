// Tipo de cambio del dólar que publica el Diario Oficial de la Federación (FIX de Banxico para
// solventar obligaciones en dólares). Se consulta el servicio público de indicadores del DOF (SIDOF).
// Para una fecha de pago regresa el valor publicado ese día o, si no hubo publicación (fin de
// semana o día inhábil), el último publicado antes.

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
/** Indicador 158 del DOF: "DÓLAR". */
const SIDOF = 'https://sidof.segob.gob.mx/dof/sidof/indicadores/158'

function responder(cuerpo: unknown, estado = 200) {
  return new Response(JSON.stringify(cuerpo), { status: estado, headers: { ...CORS, 'Content-Type': 'application/json' } })
}

/** "2026-10-14" ↔ "14-10-2026" */
const aSidof = (iso: string) => iso.split('-').reverse().join('-')
const deSidof = (f: string) => f.split('-').reverse().join('-')

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return responder({ error: 'Método no permitido' }, 405)
  const cuerpo = (await req.json().catch(() => ({}))) as { fecha?: unknown }
  const fecha = typeof cuerpo.fecha === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(cuerpo.fecha) ? cuerpo.fecha : new Date().toISOString().slice(0, 10)
  const desde = new Date(Date.parse(`${fecha}T12:00:00Z`) - 20 * 86400000).toISOString().slice(0, 10)
  try {
    const r = await fetch(`${SIDOF}/${aSidof(desde)}/${aSidof(fecha)}`, { signal: AbortSignal.timeout(10_000) })
    if (!r.ok) throw new Error(`El DOF respondió ${r.status}`)
    const j = (await r.json()) as { ListaIndicadores?: { fecha: string; valor: string }[] }
    const lista = (j.ListaIndicadores ?? [])
      .map((x) => ({ fecha: deSidof(x.fecha), valor: Number(x.valor) }))
      .filter((x) => x.valor > 0 && x.fecha <= fecha)
      .sort((a, b) => a.fecha.localeCompare(b.fecha))
    const ultimo = lista.at(-1)
    if (!ultimo) return responder({ error: `El DOF no tiene tipo de cambio publicado entre ${desde} y ${fecha}.` }, 404)
    return responder({ fecha: ultimo.fecha, valor: ultimo.valor, pedido: fecha, recientes: lista.slice(-8).reverse(), fuente: 'Diario Oficial de la Federación (SIDOF, indicador DÓLAR)' })
  } catch (e) {
    console.error(e)
    return responder({ error: 'No se pudo consultar el DOF en este momento. Escribe el tipo de cambio a mano.' }, 502)
  }
})
