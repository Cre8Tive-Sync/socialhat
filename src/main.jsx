import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'

// Self-hosted, latin subset, only the weights the two type systems use.
// Condensed carries every heading, label and number on the page; Barlow is the
// site's reading face.
import '@fontsource/barlow-condensed/latin-400.css'
import '@fontsource/barlow-condensed/latin-500.css'
import '@fontsource/barlow-condensed/latin-600.css'
import '@fontsource/barlow-condensed/latin-700.css'
import '@fontsource/barlow/latin-400.css'
import '@fontsource/barlow/latin-500.css'
import '@fontsource/barlow/latin-600.css'

import './styles.css'
import './ui/site.css'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
