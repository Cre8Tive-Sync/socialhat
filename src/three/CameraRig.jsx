import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import { SITE_SCREEN, STOPS } from './stations'
import { clamp01, LAST_STOP, rig, smootherstep } from './rig'

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
 * Vertical FOV the handover's dive lands at. Wide, so the camera can land
 * close: BUILD's crew stand between the screen and the wide shot, and a long
 * lens would have to stop behind their heads. A flat face square-on to the lens
 * shows no wide-angle distortion, so nothing gives it away.
 */
const DIVE_FOV = 48

/** How much of the page the frame takes in on landing. Under 1, so no edge of the screen is ever in shot. */
const DIVE_COVER = 0.92

/** Where on the handover the camera lands on the screen. After it, a slow push on into the page. */
const DIVE_LANDS = 0.78

/**
 * The last stretch of the dive comes down onto the screen from out in front
 * and above — clear of the crew's heads, and square to the page at the end.
 * World units: out along the screen's normal, and up.
 */
const DIVE_OUT = 1.3
const DIVE_UP = 1.1

/** Cubic Bézier through a, b, c, d at t, into `out`. */
const bezier = (out, a, b, c, d, t) => {
  const u = 1 - t
  return out
    .set(0, 0, 0)
    .addScaledVector(a, u * u * u)
    .addScaledVector(b, 3 * u * u * t)
    .addScaledVector(c, 3 * u * t * t)
    .addScaledVector(d, t * t * t)
}

/**
 * The handover. Bends the shot in `v.pos`/`v.target` away from the closing
 * wide shot and down into BUILD's big screen — the one showing the site — until
 * the page on it is the whole frame, then pushes on into it while the real
 * site comes up over the top. Returns the vertical FOV to use, in radians.
 *
 * Read live off the screen every frame, so the shot rides its bob and lands
 * square whatever the station's swing.
 */
function dive(screen, t, aspect, vfov, v) {
  screen.updateWorldMatrix(true, false)
  const m = screen.matrixWorld
  const { width, height, chrome } = SITE_SCREEN

  // Centre of the page, below the browser bar, and the way the screen faces.
  v.face.set(0, (-height * chrome) / 2, 0).applyMatrix4(m)
  v.normal.set(0, 0, 1).transformDirection(m)

  // Back far enough that the page covers the frame at DIVE_FOV on this screen.
  const fov = THREE.MathUtils.degToRad(DIVE_FOV)
  const half = (Math.min(height * (1 - chrome), width / aspect) * m.getMaxScaleOnAxis() * DIVE_COVER) / 2
  const push = smootherstep((t - DIVE_LANDS) / (1 - DIVE_LANDS))
  const distance = (half / Math.tan(fov / 2)) * (1 - 0.3 * push)

  v.end.copy(v.face).addScaledVector(v.normal, distance)
  v.via.copy(v.end).addScaledVector(v.normal, DIVE_OUT)
  v.via.y += DIVE_UP
  v.from.copy(v.pos)
  v.lead.copy(v.from).lerp(v.via, 0.45)

  const k = smootherstep(t / DIVE_LANDS)
  bezier(v.pos, v.from, v.lead, v.via, v.end, k)
  // The eye finds the screen before the camera gets there.
  v.target.lerp(v.face, smootherstep(t / (DIVE_LANDS * 0.6)))

  return THREE.MathUtils.lerp(vfov, fov, k)
}

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
 *
 * Past the last stop, the handover takes the camera off the path entirely and
 * into BUILD's screen — see dive() above.
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
    () => ({
      pos: new THREE.Vector3(),
      target: new THREE.Vector3(),
      drift: new THREE.Vector2(),
      face: new THREE.Vector3(),
      normal: new THREE.Vector3(),
      end: new THREE.Vector3(),
      via: new THREE.Vector3(),
      from: new THREE.Vector3(),
      lead: new THREE.Vector3(),
    }),
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

    // The handover. Not under reduced motion: there the shot holds and the site
    // simply fades up over it.
    const t = rig.reducedMotion || !rig.screen ? 0 : clamp01(rig.reveal)
    if (t > 0) vfov = dive(rig.screen, t, aspect, vfov, scratch)

    // The parallax settles as the dive sets off; on the screen it would shake.
    const sway = 1 - smootherstep(t * 4)
    camera.position.copy(scratch.pos)
    camera.position.x += scratch.drift.y * 0.12 * sway
    camera.position.z += scratch.drift.x * 0.22 * sway
    camera.position.y += scratch.drift.y * 0.1 * sway
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
