import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// Poppins incluida en la app (no desde Google Fonts) para que el PDF generado siempre la use.
import '@fontsource/poppins/latin-300.css'
import '@fontsource/poppins/latin-ext-300.css'
import '@fontsource/poppins/latin-400.css'
import '@fontsource/poppins/latin-ext-400.css'
import '@fontsource/poppins/latin-500.css'
import '@fontsource/poppins/latin-ext-500.css'
import '@fontsource/poppins/latin-600.css'
import '@fontsource/poppins/latin-ext-600.css'
import '@fontsource/poppins/latin-700.css'
import '@fontsource/poppins/latin-ext-700.css'
import '@fontsource/poppins/latin-400-italic.css'
import './index.css'
import App from './App.tsx'
import { Acceso } from './auth/Acceso'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Acceso>{(perfil, salir) => <App perfil={perfil} salir={salir} />}</Acceso>
  </StrictMode>,
)
