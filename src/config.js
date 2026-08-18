/** Everything you'll realistically want to tweak lives here. */

// Served straight from public/ — generated from scene.gltf by `npm run pack-model`.
export const MODEL_URL = `${import.meta.env.BASE_URL}models/scene.glb`

/** How many viewport-heights of scrolling map to the full animation. */
export const SCROLL_PAGES = 5

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
