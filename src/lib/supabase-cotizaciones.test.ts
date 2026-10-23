import { describe, expect, it } from 'vitest'
import { datosIniciales } from './modelo'
import { filaCotizacionFeedbak, mensajeErrorCotizacion } from './supabase'
import { cotizarFeedbak } from './tabuladores'

describe('historial de cotizaciones Feedbak', () => {
  it('arma la fila con datos de muestra (cliente, folio y total de la primera factura)', () => {
    const d = {
      ...datosIniciales().feedbak,
      empresa: 'Acme Industrial S.A. de C.V.',
      producto: 'mk-checador' as const,
      colaboradores: '100',
      administradores: '2',
      moneda: 'MXN' as const,
    }
    const esperado = cotizarFeedbak({
      producto: d.producto,
      colaboradores: 100,
      administradores: 2,
      moneda: 'MXN',
      tipoCambio: 17,
    })
    expect(filaCotizacionFeedbak(d, 'Cotizacion Feedbak Mi Kiosko + Checador - Acme - 2026-10-23')).toEqual({
      plantilla: 'feedbak',
      cliente: 'Acme Industrial S.A. de C.V.',
      folio: 'Cotizacion Feedbak Mi Kiosko + Checador - Acme - 2026-10-23',
      total: Math.round(esperado.primeraFactura * 100) / 100,
    })
  })

  it('deja cliente y folio vacíos como null', () => {
    const d = { ...datosIniciales().feedbak, empresa: '   ' }
    const fila = filaCotizacionFeedbak(d, '  ')
    expect(fila.cliente).toBeNull()
    expect(fila.folio).toBeNull()
    expect(fila.plantilla).toBe('feedbak')
    expect(typeof fila.total).toBe('number')
  })

  it('avisa de iniciar sesión de nuevo si la sesión expiró', () => {
    expect(mensajeErrorCotizacion(null)).toBeNull()
    expect(mensajeErrorCotizacion({ message: 'JWT expired', code: 'PGRST301' })).toBe(
      'Tu sesión expiró. Vuelve a iniciar sesión para guardar el historial.',
    )
    expect(mensajeErrorCotizacion({ status: 401, message: 'Invalid token' })).toBe(
      'Tu sesión expiró. Vuelve a iniciar sesión para guardar el historial.',
    )
    expect(mensajeErrorCotizacion({ message: 'permission denied' })).toBe('No se pudo guardar la cotización en el historial.')
  })
})
