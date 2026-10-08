import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import { COLORS, STATIONS } from './stations'
import { pop, rig } from './rig'

/**
 * Small building blocks the stations are dressed with.
 */

/**
 * A group that pops in with its station's `show`, at its own `delay` in the
 * cascade, and optionally bobs while it is there. Everything a station adds to
 * the GLB sits in one of these.
 */
export function Pop({ station, delay = 0, bob = 0, speed = 1.3, spin = 0, children, position = [0, 0, 0], ...props }) {
  const ref = useRef(null)
  const phase = useMemo(() => position[0] * 3.1 + position[2] * 1.7, [position])

  useFrame(() => {
    const group = ref.current
    if (!group) return
    const k = pop(rig.stations[station].show, delay)
    group.visible = k > 0.002
    group.scale.setScalar(Math.max(k, 0.002))
    if (bob && !rig.reducedMotion) {
      group.position.y = position[1] + Math.sin(rig.time * speed + phase) * bob
    }
    if (spin && !rig.reducedMotion) group.rotation.y += spin * 0.016
  })

  return (
    <group ref={ref} position={position} {...props}>
      {children}
    </group>
  )
}

/**
 * A flat card: a printed face on a thin backing slab, standing in its local XY
 * plane and facing +Z. `glow` makes the face emit, for screens.
 */
export function Card({ texture, width, height, depth = 0.025, back = COLORS.ink, glow = 0, materialRef, ...props }) {
  return (
    <group {...props}>
      <mesh castShadow position={[0, 0, -depth / 2]}>
        <boxGeometry args={[width * 1.03, height * 1.03, depth]} />
        <meshStandardMaterial color={back} roughness={0.7} />
      </mesh>
      <mesh position={[0, 0, 0.001]}>
        <planeGeometry args={[width, height]} />
        <meshStandardMaterial
          ref={materialRef}
          map={texture}
          roughness={0.55}
          emissive={glow ? '#ffffff' : '#000000'}
          emissiveMap={glow ? texture : null}
          emissiveIntensity={glow}
        />
      </mesh>
    </group>
  )
}

/** A rounded app tile, standing up and facing +Z. */
export function Tile({ texture, size = 0.32, ...props }) {
  return (
    <group {...props}>
      <mesh castShadow position={[0, 0, -0.025]}>
        <boxGeometry args={[size * 0.96, size * 0.96, 0.05]} />
        <meshStandardMaterial color={COLORS.ink} roughness={0.6} />
      </mesh>
      <mesh position={[0, 0, 0.001]}>
        <planeGeometry args={[size, size]} />
        <meshStandardMaterial map={texture} transparent alphaTest={0.5} roughness={0.5} />
      </mesh>
    </group>
  )
}

/**
 * The station's tag — the dashed-ring number and the strip of lime tape with
 * its name on. DOM, so the type is real Anton at any size; positioned in 3D by
 * drei's Html and popped in by a custom property written per frame.
 */
export function StationLabel({ index, position }) {
  const ref = useRef(null)
  const station = STATIONS[index]
  let last = -1

  useFrame(() => {
    const el = ref.current
    if (!el) return
    const { show, focus } = rig.stations[index]
    const k = pop(Math.min(show, rig.wide), 0.05)
    // Only touch the style when it changed: this is DOM, not a uniform.
    const value = Math.round(k * 1000) / 1000
    const lit = focus > 0.5
    if (value !== last) {
      last = value
      el.style.setProperty('--pop', value)
    }
    if ((el.dataset.lit === 'true') !== lit) el.dataset.lit = lit
  })

  return (
    <Html position={position} center zIndexRange={[4, 0]} style={{ pointerEvents: 'none' }}>
      <div className="tag" ref={ref} aria-hidden="true">
        <span className="tag__num">{station.number}</span>
        <span className="tag__tape">{station.label}</span>
      </div>
    </Html>
  )
}

/**
 * A per-station light that comes up when the camera is on its station and
 * settles back to `base` when it is not, so the active platform always reads
 * as the lit one.
 */
export function FocusLight({ index, base = 2, boost = 10, ...props }) {
  const ref = useRef(null)
  useFrame(() => {
    if (ref.current) ref.current.intensity = base + boost * rig.stations[index].focus
  })
  return <pointLight ref={ref} decay={2} distance={9} {...props} />
}

/**
 * Rough rock slab, so the platforms sit on chunks of ground rather than float.
 * One displaced icosahedron, shaded flat.
 */
export function useRockGeometry(seed = 1) {
  return useMemo(() => {
    const geometry = new THREE.IcosahedronGeometry(1, 2)
    const position = geometry.attributes.position
    const v = new THREE.Vector3()
    let s = seed * 9301
    const rand = () => ((s = (s * 16807) % 2147483647) / 2147483647)
    // Same-position vertices must move together or the slab tears open, so
    // displacement is keyed on the rounded position rather than the index.
    const offsets = new Map()
    for (let i = 0; i < position.count; i++) {
      v.fromBufferAttribute(position, i)
      const key = `${v.x.toFixed(3)},${v.y.toFixed(3)},${v.z.toFixed(3)}`
      if (!offsets.has(key)) offsets.set(key, 0.82 + rand() * 0.3)
      v.multiplyScalar(offsets.get(key))
      // Flat top, so it reads as a cut slab.
      if (v.y > 0.35) v.y = 0.35 + (v.y - 0.35) * 0.15
      position.setXYZ(i, v.x, v.y, v.z)
    }
    geometry.computeVertexNormals()
    return geometry
  }, [seed])
}
