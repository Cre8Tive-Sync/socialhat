/**
 * The narrative beats, keyed to the camera animation's own keyframes.
 *
 * scene.gltf was authored at 24fps: its sampler keys sit exactly 1/24s apart,
 * running frame 1 to frame 169 (169 / 24 = 7.0417s, the clip duration). The
 * frame ranges from the brief are converted to milliseconds here, so every
 * timing below is expressed in ms against that same 7041.67ms timeline.
 */
export const FPS = 24

export const frameToMs = (frame) => (frame / FPS) * 1000

/** Frames of crossfade on either side of a beat's fully-visible window. */
export const FADE_FRAMES = 8

/**
 * `frames` is the window where the beat sits at full opacity; the fade happens
 * outside it, so a beat is fully legible for every frame that was asked for.
 *
 * `place` positions the block against the viewport: x/y are the top-left corner
 * as percentages, w is its width. The values are tuned against what the camera
 * is actually looking at on each beat, so the copy sits in open space instead
 * of across the figures in the scene.
 */
const BEATS = [
  {
    id: 'hero',
    frames: [0, 4],
    place: { x: '4.5%', y: '60%', w: '40rem' },
    heading: { tag: 'h1', lines: ['Great marketing', 'starts on paper.'] },
    body: 'socialhat is a digital marketing studio. We start every brand with a pencil, a blank page and a hundred questions.',
  },
  {
    id: 'process',
    frames: [35, 74],
    // Top-left: clear of the three figures standing around the table.
    place: { x: '5.5%', y: '9%', w: '36rem' },
    icon: 'research',
    heading: { tag: 'h2', lines: ['The plan gets argued', 'before anything is drawn.'] },
    body:
      'We research the market, study the audience, and put the strategy in front of the room. ' +
      'It only leaves that table once it survives the questions.',
  },
  {
    id: 'evidence',
    frames: [90, 110],
    // Centre-right of frame: past the figure on the left, below the light bloom,
    // and short of the shape at the right edge.
    place: { x: '37%', y: '44%', w: '32rem' },
    icon: 'evidence',
    heading: { tag: 'h2', lines: ['Built on evidence,', 'not on taste.'] },
    body:
      'The timing that earns a click. The logic that carries someone from scroll to decision. ' +
      'We design against how people actually behave, not how a moodboard says they should.',
  },
  {
    id: 'signoff',
    frames: [156, 170],
    centred: true,
    logo: true,
  },
]

/** Beats with their fade windows resolved to milliseconds. */
export const TIMELINE = BEATS.map((beat) => {
  const fade = frameToMs(FADE_FRAMES)
  const from = frameToMs(beat.frames[0])
  const to = frameToMs(beat.frames[1])
  return {
    ...beat,
    enterFrom: Math.max(0, from - fade),
    enterTo: from,
    exitFrom: to,
    exitTo: to + fade,
  }
})

/** Ken Perlin's smootherstep: a filmic crossfade with no seam at either end. */
const smootherstep = (p) => p * p * p * (p * (p * 6 - 15) + 10)

/**
 * How present a beat is at a given moment on the timeline, 0 to 1.
 * The copy uses this for a straight crossfade and nothing else. The icons use
 * it to draw themselves in.
 */
export function beatPresence(beat, ms) {
  if (ms < beat.enterFrom || ms >= beat.exitTo) return 0
  if (ms < beat.enterTo) {
    const span = beat.enterTo - beat.enterFrom
    return span > 0 ? smootherstep((ms - beat.enterFrom) / span) : 1
  }
  if (ms < beat.exitFrom) return 1
  const span = beat.exitTo - beat.exitFrom
  return span > 0 ? smootherstep(1 - (ms - beat.exitFrom) / span) : 0
}

/**
 * Staggered progress for one stroke of an icon, so the drawing builds in the
 * order someone would actually sketch it rather than arriving all at once.
 */
export function drawStagger(presence, delay) {
  if (!delay) return presence
  return Math.min(1, Math.max(0, (presence - delay) / (1 - delay)))
}
