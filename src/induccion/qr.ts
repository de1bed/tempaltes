import { useEffect, useState } from 'react'

/** QR en SVG (la librería se carga solo cuando hace falta). */
export function useQr(texto: string) {
  const [svg, setSvg] = useState('')
  useEffect(() => {
    let vivo = true
    import('qrcode').then((QR) =>
      QR.toString(texto, { type: 'svg', margin: 1, errorCorrectionLevel: 'M', color: { dark: '#0b4c5e', light: '#ffffff' } }).then((s) => vivo && setSvg(s)),
    )
    return () => {
      vivo = false
    }
  }, [texto])
  return svg
}
