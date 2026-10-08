/** Everything you'll realistically want to tweak lives here. */

// Served straight from public/ — built from socialhat.glb by `npm run pack-model`.
export const MODEL_URL = `${import.meta.env.BASE_URL}models/socialhat.glb`

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

/**
 * Camera stops in the process scene: the wide shot, five stations, the wide
 * shot again. Must match STOPS in src/three/stations.js.
 */
export const STOP_COUNT = 7

/**
 * The handover — the moment the film's last frame becomes the website.
 *
 * It is a camera move: from the closing wide shot the camera swoops down into
 * the big screen on BUILD, which is showing the site, until the screen is the
 * whole frame — and the real site comes up through it. The site itself is held
 * still at the top of the screen throughout, never sliding. A flight across the
 * scene wants real scroll to play out over, so this is a viewport and a half.
 */
export const HANDOFF_VIEWPORTS = 1.5

/**
 * How many viewport-heights of scrolling the pinned hero occupies: one viewport
 * between each pair of stops, then the handover. The extra one is the hero's
 * own last screen, which the site overlaps.
 */
export const SCROLL_PAGES = STOP_COUNT + HANDOFF_VIEWPORTS

/** Where on the hero's travel the camera animation ends and the handover begins. */
export const HANDOFF_START = (SCROLL_PAGES - 1 - HANDOFF_VIEWPORTS) / (SCROLL_PAGES - 1)

/**
 * Damping on the reveal itself, so the transition is smooth in *time* rather
 * than tied to how coarsely the wheel reports.
 *
 * The geometry — the site pinned dead still under the scroll — stays welded to
 * the raw scroll position, because any lag there is visible as drift. Only the
 * camera's dive and the dissolve are damped: a wheel notch that jumps 100px
 * mid-handover moves the reveal a step, and this eases across it. Higher =
 * tighter to the scrollbar.
 */
export const HANDOFF_SMOOTHING = 9

/**
 * How far into the gap between two stops a scroll has to go before it counts
 * as asking for the next one, as a fraction of that gap. Below it, letting go
 * settles back where you were; past it, the camera is already flying and the
 * page settles on the next stop.
 */
export const STOP_COMMIT = 0.14

/**
 * Stiffness of the camera's flight between stops — the natural frequency of a
 * critically damped spring, in rad/s. 5 lands a one-stop flight in about 1.1s.
 */
export const FLIGHT_STIFFNESS = 5

/**
 * Where the enquiry form POSTs its JSON.
 *
 * On SiteGround that is server/public/api/enquiry.php, which emails it to the
 * path's inbox; in `npm run dev`, api/enquiry.js, which prints it. Absolute,
 * like CHAT_ENDPOINT. Set to '' and the form falls back to composing the same
 * payload as a `mailto:` — the right setting for a host with no backend.
 */
export const ENQUIRY_ENDPOINT = '/api/enquiry'

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

/**
 * The privacy policy: a plain page in public/, at the URL the WordPress policy
 * had. Linked from the footer and from both places the site collects details —
 * the enquiry form and HatBot — which is where the notice is owed.
 */
export const PRIVACY_URL = `${import.meta.env.BASE_URL}privacy-policy/`
export const INSTAGRAM_URL = 'https://www.instagram.com/socialhat.media'

/**
 * The brand mark — the SH monogram badge, cream on the indigo ground. Square
 * and self-contained, so it doubles as the favicon and the share card image.
 */
export const MARK_SRC = `${import.meta.env.BASE_URL}images/socialhat-mark.jpg`
