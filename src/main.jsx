import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'

// Self-hosted, latin subset, only the weights each half actually uses. Nothing
// here comes off a third party: first paint of either half should not wait on
// someone else's CDN.
//
// The film: Condensed carries every beat, label and number over the scene,
// Barlow is its reading face.
import '@fontsource/barlow-condensed/latin-400.css'
import '@fontsource/barlow-condensed/latin-500.css'
import '@fontsource/barlow-condensed/latin-600.css'
import '@fontsource/barlow-condensed/latin-700.css'
import '@fontsource/barlow/latin-400.css'
import '@fontsource/barlow/latin-500.css'
import '@fontsource/barlow/latin-600.css'

// The site: Anton shouts — one weight is all it has — Space Grotesk explains,
// and Plex Mono handles every kicker, tag and readout.
import '@fontsource/anton/latin-400.css'
import '@fontsource/space-grotesk/latin-400.css'
import '@fontsource/space-grotesk/latin-500.css'
import '@fontsource/space-grotesk/latin-700.css'
import '@fontsource/ibm-plex-mono/latin-400.css'
import '@fontsource/ibm-plex-mono/latin-600.css'

import './styles.css'
import './ui/site.css'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
