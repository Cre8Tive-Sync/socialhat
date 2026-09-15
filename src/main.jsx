import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'

// Self-hosted, latin subset, only the weights each half actually uses. Nothing
// here comes off a third party: first paint of either half should not wait on
// someone else's CDN.
//
// The film: Condensed carries every beat, label and number over the scene.
//
// Plain Barlow used to be loaded here as its reading face and was never
// referenced by a single rule — styles.css names only "Barlow Condensed". Three
// weights, in two formats, downloaded by every visitor and used by nothing.
import '@fontsource/barlow-condensed/latin-400.css'
import '@fontsource/barlow-condensed/latin-500.css'
import '@fontsource/barlow-condensed/latin-600.css'
import '@fontsource/barlow-condensed/latin-700.css'

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
