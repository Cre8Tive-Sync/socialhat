/** Everything you'll realistically want to tweak lives here. */

// Served straight from public/ — generated from scene.gltf by `npm run pack-model`.
export const MODEL_URL = `${import.meta.env.BASE_URL}models/scene.glb`

/** How many viewport-heights of scrolling the pinned hero occupies. */
export const SCROLL_PAGES = 6

/**
 * The handover — the dissolve from the film's last frame into the website —
 * takes exactly one of those viewports, the last one.
 *
 * That is not a taste call. The site rides up at scroll speed, so one viewport
 * of scroll is precisely what it needs to travel from the bottom edge of the
 * screen to the top and land there on the same frame the paper finishes fading
 * in. Any other number leaves either a strip of blank paper or a website that
 * arrives before the film has gone.
 */
export const HANDOFF_VIEWPORTS = 1

/** Where on the hero's travel the camera animation ends and the dissolve begins. */
export const HANDOFF_START = (SCROLL_PAGES - 1 - HANDOFF_VIEWPORTS) / (SCROLL_PAGES - 1)

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
