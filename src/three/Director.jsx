import { useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import { FLIGHT_STIFFNESS } from '../config'
import { LAST_STOP, rig } from './rig'

/** Fastest the camera may travel, in stops per second, however far it is asked to go. */
const MAX_SPEED = 3.2

/** Seconds a station takes to build up, and to clear away. */
const BUILD_SECONDS = 1.15
const CLEAR_SECONDS = 0.55

/** Stagger between stations on the intro build-up, in seconds. */
const INTRO_STAGGER = 0.32

const approach = (value, target, step) =>
  value < target ? Math.min(target, value + step) : Math.max(target, value - step)

/**
 * Runs first every frame and moves the shared clock on: springs the camera's
 * position along the stops toward whatever the scroll asked for, and decides
 * what each station is doing. Renders nothing.
 *
 * A station is *shown* — its props, labels and screens built up — when the
 * camera is on it, and on the wide shots, where all five sit dressed like the
 * reference frame. Flying from one station to the next clears the one behind
 * and builds the one ahead, so arriving anywhere is something happening rather
 * than a cut to a still life.
 */
export function Director() {
  useEffect(() => {
    // The loader curtain takes ~600ms to clear once the model resolves; the
    // build-up starts as it lifts, not underneath it.
    rig.introAt = rig.still ? -Infinity : rig.time + 0.7
  }, [])

  useFrame((_, delta) => {
    const dt = Math.min(delta, 1 / 20)
    rig.time += dt

    // --- Flight: critically damped spring on `s` -------------------------
    const k = FLIGHT_STIFFNESS * (rig.reducedMotion ? 2.5 : 1)
    const x = rig.s - rig.target
    rig.v += (-k * k * x - 2 * k * rig.v) * dt
    rig.v = Math.max(-MAX_SPEED, Math.min(MAX_SPEED, rig.v))
    rig.s += rig.v * dt
    if (Math.abs(rig.s - rig.target) < 0.0005 && Math.abs(rig.v) < 0.002) {
      rig.s = rig.target
      rig.v = 0
    }

    // --- Stations --------------------------------------------------------
    const wide = rig.s < 0.5 || rig.s > LAST_STOP - 0.5
    rig.wide = approach(rig.wide, wide ? 1 : 0, dt / (wide ? 0.7 : 0.3))

    rig.stations.forEach((station, i) => {
      const distance = Math.abs(rig.s - (i + 1))
      const active = distance < 0.5
      const introAt = rig.introAt + i * INTRO_STAGGER
      const ready = rig.time >= introAt

      const wanted = ready && (wide || active) ? 1 : 0
      if (rig.still && wanted) station.show = 1
      station.show = approach(
        station.show,
        wanted,
        dt / (wanted ? BUILD_SECONDS : CLEAR_SECONDS),
      )
      station.focus = approach(station.focus, active ? 1 : 0, dt / 0.6)

      // The intro is an arrival too: every station plays its one-shot effects
      // once as the wide shot builds up.
      if (!station.introduced && ready) {
        station.introduced = true
        station.arrivedAt = introAt + 0.45
      }

      // Landing is latched: it fires once as the camera settles in and re-arms
      // only after it has properly left.
      if (!station.landed && distance < 0.22) {
        station.landed = true
        station.arrivedAt = rig.time
      } else if (station.landed && distance > 0.6) {
        station.landed = false
      }
    })
  })

  return null
}
