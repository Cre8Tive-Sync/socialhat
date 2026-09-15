/** Everything you'll realistically want to tweak lives here. */

// Served straight from public/ — generated from scene.gltf by `npm run pack-model`.
export const MODEL_URL = `${import.meta.env.BASE_URL}models/scene.glb`

/**
 * Where DRACOLoader fetches its decoder from.
 *
 * The model's geometry is Draco-compressed, so nothing renders until this
 * loads. drei would otherwise pull it off Google's gstatic CDN — we copy it out
 * of three at build time instead (scripts/copy-draco-decoder.mjs), so the
 * decoder always matches the three we built against and first paint does not
 * depend on a third party. Must keep the trailing slash: DRACOLoader
 * concatenates filenames onto it.
 */
export const DRACO_DECODER_PATH = `${import.meta.env.BASE_URL}draco/`

/**
 * Size of the model in whole MB, measured by vite.config.js at build time.
 *
 * Shown on the loading curtain before the first progress event arrives, which
 * is the one moment a visitor is staring at a bar that has not moved yet. It is
 * derived rather than typed because the last hand-written figure went stale
 * silently. 0 means the .glb was missing at build time — the curtain then just
 * says it is loading, rather than claiming a size it does not know.
 */
export const MODEL_MB = __MODEL_MB__

/** How many viewport-heights of scrolling the pinned hero occupies. */
export const SCROLL_PAGES = 6

/**
 * The handover — the moment the film's last frame becomes the website.
 *
 * It does not slide: the site is held still at the top of the screen and comes
 * up out of the centre of the frame, so the two halves cross at the middle of
 * the picture rather than at its bottom edge. Nothing has to travel a viewport,
 * which is why this is a fraction of one and not the whole thing — half a
 * screen of scroll is enough to read as deliberate and still land fast.
 */
export const HANDOFF_VIEWPORTS = 0.5

/** Where on the hero's travel the camera animation ends and the handover begins. */
export const HANDOFF_START = (SCROLL_PAGES - 1 - HANDOFF_VIEWPORTS) / (SCROLL_PAGES - 1)

/**
 * Damping on the reveal itself, so the transition is smooth in *time* rather
 * than tied to how coarsely the wheel reports.
 *
 * The geometry — the site pinned dead still under the scroll — stays welded to
 * the raw scroll position, because any lag there is visible as drift. Only the
 * dissolve is damped: a wheel notch that jumps 100px mid-handover moves the
 * reveal a step, and this eases across it. Higher = tighter to the scrollbar.
 */
export const HANDOFF_SMOOTHING = 9

/** Scrub smoothing. Higher = the camera tracks the scrollbar more tightly. */
export const SCROLL_SMOOTHING = 4

/**
 * The camera was authored at a 1.49:1 aspect. On narrower viewports, widen the
 * vertical FOV so the intended horizontal framing survives instead of being
 * cropped off the sides. Set false for stock three.js behaviour (fixed yfov).
 */
export const PRESERVE_AUTHORED_FRAMING = true

/**
 * Where the enquiry form POSTs its JSON.
 *
 * Empty until the host is decided — the form then falls back to composing the
 * same payload as a `mailto:` to the inbox its path routes to, so it works and
 * is testable today without a server. Set this (Netlify/Vercel function,
 * Formspree, whatever) and the fallback drops out with no other change.
 */
export const ENQUIRY_ENDPOINT = ''

/**
 * Where the assistant talks to [api/chat.js](../api/chat.js).
 *
 * Absolute on purpose. `base` is './' so the built page can live under a path,
 * but the function is always mounted at the origin root by every host that runs
 * it. Set to '' to leave the assistant off the page entirely — which is what a
 * static host with no functions should do, rather than shipping a widget whose
 * every message fails.
 */
export const CHAT_ENDPOINT = '/api/chat'

/**
 * The line in the bubble before anyone has said anything. Not a greeting the
 * model generates — a fixed first turn costs a request, a second of latency and
 * a few cents to say the same thing every time.
 */
export const CHAT_GREETING =
  "Hi, I'm HatBot. Ask me anything about what SocialHat does, or just tell me what you're trying to get done, and I'll point you the right way."

/**
 * The nudge, and how long the visitor gets before it appears.
 *
 * The launcher alone is not enough. It reads as a chat button to anyone who
 * already knows what a chat button is, and as decoration to everyone else —
 * which on this site is a real share of the audience, since a good number of
 * SocialHat's prospects are business owners who came looking for a phone
 * number. So HatBot says something first, in plain words, instead of waiting to
 * be recognised.
 *
 * The delay is long enough to be an offer of help rather than an interruption:
 * the visitor has read something and is still here. It is measured from the
 * moment the site takes the screen, not from page load, because the film runs
 * first and none of that time was spent reading.
 */
export const CHAT_NUDGE_DELAY = 14000

export const CHAT_NUDGE = "Hi, I'm HatBot. Got a question? Just ask me."

/**
 * Where the feed reads from, and where it points.
 *
 * Absolute, for the same reason as CHAT_ENDPOINT: `base` is relative but the
 * function is always mounted at the origin root. Set FEED_ENDPOINT to '' on a
 * host with no functions — the section then renders the follow card alone,
 * which is a working link rather than a grid that never fills.
 */
export const FEED_ENDPOINT = '/api/instagram'
export const INSTAGRAM_URL = 'https://www.instagram.com/socialhat.media'

/**
 * Sign-off logo. This is the file you asked for — the #1D1F20 near-black mark.
 * If it disappears against the final shot, swap `-dark` for `-light` here: the
 * light file is the same artwork in #F2F2F3.
 */
export const LOGO_SRC = `${import.meta.env.BASE_URL}images/socialhat_logo-dark.svg`
export const LOGO_ALT = 'socialhat'

/**
 * The brand mark — the SH monogram badge, cream on the indigo ground. Square
 * and self-contained, so it doubles as the favicon and the share card image.
 */
export const MARK_SRC = `${import.meta.env.BASE_URL}images/socialhat-mark.jpg`
