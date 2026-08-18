/** Everything you'll realistically want to tweak lives here. */

// Served straight from public/ — generated from scene.gltf by `npm run pack-model`.
export const MODEL_URL = `${import.meta.env.BASE_URL}models/scene.glb`

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
 * Sign-off logo. This is the file you asked for — the #1D1F20 near-black mark.
 * If it disappears against the final shot, swap `-dark` for `-light` here: the
 * light file is the same artwork in #F2F2F3.
 */
export const LOGO_SRC = `${import.meta.env.BASE_URL}images/socialhat_logo-dark.svg`
export const LOGO_ALT = 'socialhat'
