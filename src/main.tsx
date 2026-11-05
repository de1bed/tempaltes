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
// Nombres en bienvenidas y despedidas (como en la plantilla original).
import '@fontsource/montserrat-alternates/latin-400.css'
import '@fontsource/montserrat-alternates/latin-ext-400.css'
import './index.css'
import App from './App.tsx'
import { Acceso } from './auth/Acceso'
import { Externo } from './salas/Externo'
import { Participante } from './induccion/Participante'

// Externos (sin cuenta) llegan con el QR de una sala y los nuevos ingresos con el código de su
// inducción: esas páginas no piden iniciar sesión.
const ruta = window.location.hash.slice(1)
const publica = ruta.startsWith('externo/') ? <Externo ruta={ruta} /> : ruta === 'induccion' || ruta.startsWith('induccion/') ? <Participante ruta={ruta} /> : null

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {publica ?? <Acceso>{(perfil, salir) => <App perfil={perfil} salir={salir} />}</Acceso>}
  </StrictMode>,
)
