import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Line } from '@react-three/drei'
import * as THREE from 'three'
import { COLORS, STATIONS } from './stations'
import { markTexture } from './textures'
import { clamp01, rig } from './rig'

/** Just above the ground plane, so the line never fights it for depth. */
const Y = -0.285

/** Seconds the path takes to draw itself across the scene on the intro. */
const DRAW_SECONDS = 2.6

/**
 * The dashed pink route along the floor, from a start marker by PLAN past the
 * front of every platform to DELIVER. It draws itself in as the intro builds
 * the stations up, and its dashes march toward the next station from then on.
 */
export function Path() {
  const line = useRef(null)

  const points = useMemo(() => {
    const at = (i, dx, dz) => {
      const [x, , z] = STATIONS[i].position
      return new THREE.Vector3(x + dx, Y, z + dz)
    }
    const knots = [
      at(0, -0.6, 2.6),
      at(0, 1.2, 2.1),
      at(0, 2.1, 0.4),
      at(1, -0.4, 1.9),
      at(1, 1.5, 1.6),
      at(2, -0.8, 1.9),
      at(2, 1.6, 1.6),
      at(3, -0.9, 1.8),
      at(3, 1.6, 1.4),
      at(4, -1.0, 1.9),
      at(4, 0.9, 1.9),
    ]
    return new THREE.CatmullRomCurve3(knots, false, 'centripetal').getPoints(180)
  }, [])

  const start = points[0]
  const marks = useMemo(
    () => ({
      ring: markTexture('ring', COLORS.lime).texture,
      x: markTexture('x', COLORS.pink).texture,
      asterisk: markTexture('asterisk', COLORS.lime).texture,
    }),
    [],
  )

  const segments = points.length - 1
  useFrame((_, delta) => {
    const l = line.current
    if (!l) return
    const drawn = rig.still ? 1 : clamp01((rig.time - rig.introAt) / DRAW_SECONDS)
    l.geometry.instanceCount = Math.max(0, Math.floor(segments * drawn))
    if (!rig.reducedMotion) l.material.dashOffset -= delta * 0.35
  })

  const [ex, , ez] = STATIONS[4].position

  return (
    <>
      <Line
        ref={line}
        points={points}
        color={COLORS.pink}
        lineWidth={3}
        dashed
        dashSize={0.24}
        gapSize={0.16}
        toneMapped={false}
      />
      <Mark texture={marks.ring} position={[start.x, Y + 0.005, start.z]} size={0.55} />
      <Mark texture={marks.asterisk} position={[STATIONS[2].position[0] - 1.5, Y + 0.005, STATIONS[2].position[2] + 3.4]} size={0.6} />
      <Mark texture={marks.x} position={[ex - 0.4, Y + 0.005, ez + 3.4]} size={0.75} rotation={0.4} />
    </>
  )
}

/** A hand-drawn mark lying flat on the floor. */
function Mark({ texture, position, size, rotation = 0 }) {
  return (
    <mesh position={position} rotation={[-Math.PI / 2, 0, rotation]}>
      <planeGeometry args={[size, size]} />
      <meshBasicMaterial map={texture} transparent depthWrite={false} toneMapped={false} />
    </mesh>
  )
}
