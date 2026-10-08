import { STATIONS, STOPS } from './stations'

/**
 * The one clock the scene runs on.
 *
 * A plain mutable object rather than React state, for the same reason the old
 * scroll scene wrote custom properties: it changes every frame, and nothing
 * about it should ever cause a render. Four parties share it —
 *
 *   useHeroScroll  writes `target`, the stop the scroll has asked for;
 *   Director       springs `s` toward it in *time*, and works out what each
 *                  station is doing;
 *   CameraRig      flies the camera along the path at `s`;
 *   the DOM        (copy, rail) reads `s` from its own rAF loop.
 *
 * `s` is a float position along the stops: 0 is the wide shot, 1 is PLAN, 5 is
 * DELIVER, 6 is the closing wide shot. Scroll never sets it directly, which is
 * what turns a scroll gesture into a flight rather than a scrub.
 */

const query = (name) =>
  typeof window !== 'undefined' && new URLSearchParams(window.location.search).has(name)

const reducedMotion =
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

export const LAST_STOP = STOPS.length - 1

export const rig = {
  /** Stop index the scroll has asked for. Integer, 0…LAST_STOP. */
  target: 0,
  /** Where the camera actually is along the stops. Float. */
  s: 0,
  /** d(s)/dt, for the spring. */
  v: 0,
  /** Seconds on the scene clock. */
  time: 0,
  /** Scene clock time the intro build-up starts at. Infinity until loaded. */
  introAt: Infinity,
  /**
   * 0→1, how far the camera is into one of the wide shots. The station tags
   * belong to those; in a close-up the copy names the station instead.
   */
  wide: 1,

  reducedMotion,
  /** `?cam`: orbit controls instead of the rig, for framing shots. */
  debugCamera: query('cam'),
  /** `?still`: skip the intro build-up; everything is simply there. */
  still: query('still') || reducedMotion,
  /**
   * `?view=x,y,z,tx,ty,tz,fov`: pin the camera to one exact shot. For
   * screenshots and framing work, never linked from anywhere.
   */
  view:
    typeof window !== 'undefined'
      ? new URLSearchParams(window.location.search).get('view')?.split(',').map(Number) ?? null
      : null,

  /**
   * Per station:
   *   show      0→1, how built the platform's dressing is. Linear in time;
   *             each prop eases its own slice of it, which is the stagger.
   *   focus     0→1, whether the camera is on this station. Lights key off it.
   *   arrivedAt scene time the camera last landed here. One-shot effects —
   *             confetti, the flash, the screens powering on — play from it.
   */
  stations: STATIONS.map(() => ({ show: 0, focus: 0, arrivedAt: -Infinity, landed: false })),
}

/** Seconds since a station's camera arrival, or Infinity if it never has. */
export const sinceArrival = (index) => rig.time - rig.stations[index].arrivedAt

/** Ken Perlin's smootherstep. */
export const smootherstep = (x) => {
  const t = x < 0 ? 0 : x > 1 ? 1 : x
  return t * t * t * (t * (t * 6 - 15) + 10)
}

export const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x)

/** Overshooting ease-out, for things that pop in. */
export const easeOutBack = (x, k = 1.9) => {
  const t = clamp01(x) - 1
  return 1 + (k + 1) * t * t * t + k * t * t
}

/**
 * One prop's slice of a station's `show`: 0 until `delay`, then eased with an
 * overshoot to 1. Delays in 0…0.7 give a readable cascade.
 */
export const pop = (show, delay = 0) => easeOutBack((show - delay) / (1 - delay))
