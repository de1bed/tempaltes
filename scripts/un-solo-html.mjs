// Mete el JS y CSS de dist-artifact/ dentro de index.html → dist-artifact/cotizador.html
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const dir = 'dist-artifact'
let html = readFileSync(join(dir, 'index.html'), 'utf8')
html = html.replace(/<script type="module" crossorigin src="\/([^"]+)"><\/script>/g, (_, src) => {
  const js = readFileSync(join(dir, src), 'utf8').replace(/<\/script/gi, '<\\/script')
  return `<script type="module">${js}</script>`
})
html = html.replace(/<link rel="stylesheet" crossorigin href="\/([^"]+)">/g, (_, href) => `<style>${readFileSync(join(dir, href), 'utf8')}</style>`)
html = html.replace(/<link rel="icon"[^>]*>\n?/, '')
// El visor de artifacts pone su propio <html>/<head>/<body>: se deja solo el contenido.
html = html.replace(/<!doctype html>|<\/?html[^>]*>|<\/?head>|<\/?body>|<meta name="viewport"[^>]*>/gi, '').trim()
if (/src="\/assets|href="\/assets/.test(html)) throw new Error('Quedaron referencias externas en el HTML')
writeFileSync(join(dir, 'cotizador.html'), html)
console.log(`${join(dir, 'cotizador.html')}: ${(html.length / 1024 / 1024).toFixed(2)} MB`)
