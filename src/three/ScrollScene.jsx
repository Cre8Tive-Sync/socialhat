import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { useAnimations, useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { MODEL_URL, PRESERVE_AUTHORED_FRAMING, SCROLL_SMOOTHING } from '../config'

export function ScrollScene({ progress, timelineRef }) {
  const { scene, animations, cameras } = useGLTF(MODEL_URL)
  const { actions, mixer } = useAnimations(animations, scene)

  const gltfCamera = cameras[0]
  const set = useThree((state) => state.set)
  const size = useThree((state) => state.size)
  // `get` reads current store state without subscribing this component to it.
  const get = useThree((state) => state.get)

  // The FOV/aspect the artist actually framed the shot at. Stashed on the object
  // itself because useGLTF caches the camera globally — on a remount we'd
  // otherwise re-capture the values our own resize handler already overwrote.
  const authored = useMemo(() => {
    if (!gltfCamera) return null
    gltfCamera.userData.authoredProjection ??= {
      fov: gltfCamera.fov,
      aspect: gltfCamera.aspect,
    }
    return gltfCamera.userData.authoredProjection
  }, [gltfCamera])

  // --- 1. Make the glTF's own camera the one we render through --------------
  useLayoutEffect(() => {
    if (!gltfCamera) {
      console.warn(`[ScrollScene] no camera found in ${MODEL_URL}`)
      return
    }
    // `manual` tells R3F to keep its hands off aspect/fov — we own them below.
    gltfCamera.manual = true
    const previous = get().camera
    set({ camera: gltfCamera })
    return () => set({ camera: previous })
  }, [gltfCamera, get, set])

  // --- 2. Keep the projection correct across viewport sizes -----------------
  useLayoutEffect(() => {
    if (!gltfCamera || !authored) return
    const viewport = size.width / size.height
    gltfCamera.aspect = viewport

    if (PRESERVE_AUTHORED_FRAMING && viewport < authored.aspect) {
      // Narrower than authored: widen yfov so the same horizontal slice stays
      // in shot, rather than letting the sides get cropped away.
      const halfWidth = Math.tan(THREE.MathUtils.degToRad(authored.fov) / 2) * authored.aspect
      gltfCamera.fov = THREE.MathUtils.radToDeg(2 * Math.atan(halfWidth / viewport))
    } else {
      gltfCamera.fov = authored.fov
    }
    gltfCamera.updateProjectionMatrix()
  }, [gltfCamera, authored, size])

  // --- 3. Arm every clip as a paused, scrubbable action ---------------------
  const duration = useMemo(
    () => animations.reduce((longest, clip) => Math.max(longest, clip.duration), 0),
    [animations],
  )

  useEffect(() => {
    const list = Object.values(actions)
    list.forEach((action) => {
      action.reset()
      action.play()
      // Paused means the mixer never advances time on its own; scroll does.
      action.paused = true
      action.clampWhenFinished = true
      action.setLoop(THREE.LoopOnce, 1)
    })
    return () => list.forEach((action) => action.stop())
  }, [actions])

  // --- 4. Scroll position -> animation time --------------------------------
  const scrubbed = useRef(0)

  useFrame((_, delta) => {
    // Damp toward the raw scroll value so flicks and trackpad jitter come out
    // as smooth camera moves instead of snapping frame to frame.
    scrubbed.current = THREE.MathUtils.damp(
      scrubbed.current,
      progress.current,
      SCROLL_SMOOTHING,
      delta,
    )

    const time = scrubbed.current * duration
    // Publish the damped position so the DOM story beats sit on exactly the
    // same clock as the camera, not on raw scroll.
    if (timelineRef) timelineRef.current = time * 1000

    for (const action of Object.values(actions)) {
      action.time = THREE.MathUtils.clamp(time, 0, action.getClip().duration)
    }
    // Delta of 0: don't advance the clock, just re-evaluate at the time we set.
    mixer.update(0)
  })

  return <primitive object={scene} />
}

useGLTF.preload(MODEL_URL)
