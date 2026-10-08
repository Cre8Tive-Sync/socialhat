import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import { STOPS } from './stations'
import { LAST_STOP, rig, smootherstep } from './rig'

/** The aspect the shots in stations.js are framed at. */
const AUTHORED_ASPECT = 16 / 9

/** The aspect the `portrait` shots are framed at: a phone held upright. */
const PORTRAIT_ASPECT = 0.5

/** Screens narrower than this fly the portrait shots. */
const PORTRAIT_BELOW = 0.85

/**
 * Widest vertical FOV a narrow screen is allowed before the camera backs off
 * instead. Past this the shot starts to look like a fisheye.
 */
const MAX_FOV = 58

const canHover = typeof window !== 'undefined' && window.matchMedia('(hover: hover)').matches

/**
 * Flies the camera along the stops.
 *
 * Positions and look-targets each run on their own Catmull-Rom spline through
 * every stop, so a flight between neighbours curves naturally and a fling
 * across several stations travels the whole path through them instead of
 * cutting a chord across the scene. `rig.s` is the parameter: integer values
 * land exactly on a stop.
 *
 * Portrait screens fly a second set of shots (each stop's `portrait`), framed
 * for a tall screen with the copy underneath. Either set keeps its authored
 * *horizontal* framing on screens narrower than it was framed for: the
 * vertical FOV opens up to hold the same slice, and past MAX_FOV the camera
 * backs away along its line of sight instead.
 */
export function CameraRig() {
  const camera = useThree((state) => state.camera)
  const size = useThree((state) => state.size)

  const shots = useMemo(() => {
    const build = (pick) => {
      const spline = (key) =>
        new THREE.CatmullRomCurve3(
          STOPS.map((stop) => new THREE.Vector3(...pick(stop)[key])),
          false,
          'centripetal',
        )
      return { pos: spline('pos'), target: spline('target'), fov: STOPS.map((stop) => pick(stop).fov) }
    }
    return {
      landscape: { ...build((stop) => stop), aspect: AUTHORED_ASPECT },
      portrait: { ...build((stop) => stop.portrait ?? stop), aspect: PORTRAIT_ASPECT },
    }
  }, [])

  const scratch = useMemo(
    () => ({ pos: new THREE.Vector3(), target: new THREE.Vector3(), drift: new THREE.Vector2() }),
    [],
  )

  useFrame((state, delta) => {
    if (rig.debugCamera) return
    if (rig.view) {
      const [x, y, z, tx, ty, tz, fov = 34] = rig.view
      camera.position.set(x, y, z)
      camera.lookAt(tx, ty, tz)
      camera.fov = fov
      camera.updateProjectionMatrix()
      return
    }

    const aspect = size.width / size.height
    const shot = aspect < PORTRAIT_BELOW ? shots.portrait : shots.landscape

    const s = THREE.MathUtils.clamp(rig.s, 0, LAST_STOP)
    const u = s / LAST_STOP
    shot.pos.getPoint(u, scratch.pos)
    shot.target.getPoint(u, scratch.target)

    const i = Math.min(Math.floor(s), LAST_STOP - 1)
    const fov = THREE.MathUtils.lerp(shot.fov[i], shot.fov[i + 1], smootherstep(s - i))

    // Hold the authored horizontal slice on narrower screens.
    let vfov = THREE.MathUtils.degToRad(fov)
    let dolly = 1
    if (aspect < shot.aspect) {
      const halfWidth = Math.tan(vfov / 2) * shot.aspect
      vfov = 2 * Math.atan(halfWidth / aspect)
      const cap = THREE.MathUtils.degToRad(MAX_FOV)
      if (vfov > cap) {
        dolly = Math.tan(vfov / 2) / Math.tan(cap / 2)
        vfov = cap
      }
    }

    // A breath of parallax off the pointer, so a held shot is still alive.
    // Not on touch, where the "pointer" is wherever the last tap landed.
    if (!rig.reducedMotion && canHover) {
      const k = 1 - Math.exp(-3 * delta)
      scratch.drift.x += (state.pointer.x - scratch.drift.x) * k
      scratch.drift.y += (state.pointer.y - scratch.drift.y) * k
    }

    scratch.pos.sub(scratch.target).multiplyScalar(dolly).add(scratch.target)
    camera.position.copy(scratch.pos)
    camera.position.x += scratch.drift.y * 0.12
    camera.position.z += scratch.drift.x * 0.22
    camera.position.y += scratch.drift.y * 0.1
    camera.lookAt(scratch.target)

    const deg = THREE.MathUtils.radToDeg(vfov)
    if (Math.abs(camera.fov - deg) > 1e-4) {
      camera.fov = deg
      camera.updateProjectionMatrix()
    }
  })

  return rig.debugCamera ? <DebugCamera /> : null
}

/**
 * `?cam`: free orbit for framing shots. Every time a drag ends, the shot is
 * logged in the shape STOPS in stations.js takes, ready to paste.
 */
function DebugCamera() {
  const controls = useRef(null)
  const camera = useThree((state) => state.camera)

  useEffect(() => {
    const stop = STOPS[Math.round(rig.s)]
    camera.position.set(...stop.pos)
    camera.fov = stop.fov
    camera.updateProjectionMatrix()
    controls.current?.target.set(...stop.target)
    controls.current?.update()
  }, [camera])

  const log = () => {
    const r = (v) => v.toArray().map((n) => +n.toFixed(2))
    console.log(
      `pos: [${r(camera.position)}], target: [${r(controls.current.target)}], fov: ${Math.round(camera.fov)}`,
    )
  }

  return <OrbitControls ref={controls} makeDefault onEnd={log} />
}
