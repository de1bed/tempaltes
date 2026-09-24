import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// `vite build --mode artifact` genera dist-artifact/: imágenes embebidas como data URI
// para empaquetar todo en un solo HTML (ver scripts/un-solo-html.mjs).
export default defineConfig(({ mode }) => ({
  plugins: [react()],
  build:
    mode === 'artifact'
      ? { outDir: 'dist-artifact', assetsInlineLimit: () => true, cssCodeSplit: false }
      : undefined,
}))
