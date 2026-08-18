import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'

// Self-hosted, latin subset, only the three weights the type system uses.
import '@fontsource/barlow-condensed/latin-400.css'
import '@fontsource/barlow-condensed/latin-500.css'
import '@fontsource/barlow-condensed/latin-700.css'

import './styles.css'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
