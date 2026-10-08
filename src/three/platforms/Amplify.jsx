import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { COLORS } from '../stations'
import { Card, Pop, Tile } from '../props'
import { postTexture, tileTexture } from '../textures'
import { clamp01, rig, sinceArrival } from '../rig'

/**
 * 04 AMPLIFY — the one station the export does not have, built here. Posts fan
 * out over the platform, app tiles pop and bob around them, a megaphone pumps
 * out rings, and hearts stream up off the feed. Arriving fans the posts out
 * afresh and fires a burst of hearts.
 *
 * Local frame: the cloned slab at the origin; one of the crew at (−0.55, 0.15)
 * watching the feed, another at (0.55, −0.35) cheering.
 */

const HEARTS = 14

export function Amplify({ index }) {
  const posts = useMemo(() => [postTexture(0).texture, postTexture(1).texture, postTexture(0).texture], [])
  const tiles = useMemo(
    () => ({
      instagram: tileTexture('instagram').texture,
      tiktok: tileTexture('tiktok').texture,
      play: tileTexture('play').texture,
      chart: tileTexture('chart').texture,
    }),
    [],
  )

  return (
    <>
      <Fan index={index} posts={posts} />

      <Pop station={index} delay={0.35} bob={0.05} speed={1.7} position={[1.15, 1.95, -0.3]}>
        <Tile texture={tiles.instagram} size={0.28} rotation={[0, -0.25, 0.1]} />
      </Pop>
      <Pop station={index} delay={0.42} bob={0.06} speed={1.4} position={[-1.05, 1.85, -0.2]}>
        <Tile texture={tiles.tiktok} size={0.26} rotation={[0, 0.3, -0.12]} />
      </Pop>
      <Pop station={index} delay={0.5} bob={0.05} speed={2} position={[-0.95, 1.2, 0.5]}>
        <Tile texture={tiles.play} size={0.28} rotation={[0, 0.35, 0.05]} />
      </Pop>
      <Pop station={index} delay={0.58} bob={0.04} speed={1.6} position={[1.05, 0.75, 0.75]}>
        <Tile texture={tiles.chart} size={0.3} rotation={[0, -0.4, 0]} />
      </Pop>

      <Pop station={index} delay={0.3} position={[0.85, 1.4, 0.25]} rotation={[0, -0.6, 0.35]}>
        <Megaphone index={index} />
      </Pop>

      <Hearts index={index} />

      {/* A floor lamp of a plant, so the set is not all screens. */}
      <Pop station={index} delay={0.15} position={[-1.0, 0.2, -0.65]}>
        <Plant />
      </Pop>
    </>
  )
}

/** Three posts that fan out from a stack on each arrival. */
function Fan({ index, posts }) {
  const cards = useRef([])
  const layout = [
    { x: -0.62, y: 1.48, z: -0.75, rot: 0.32, tilt: 0.06 },
    { x: 0.02, y: 1.6, z: -0.85, rot: 0, tilt: -0.02 },
    { x: 0.66, y: 1.44, z: -0.7, rot: -0.3, tilt: -0.07 },
  ]

  useFrame(() => {
    const t = sinceArrival(index)
    const spread = rig.reducedMotion ? 1 : 1 - (1 - clamp01((t - 0.15) / 0.7)) ** 3
    cards.current.forEach((card, i) => {
      if (!card) return
      const to = layout[i]
      card.position.set(to.x * spread, to.y + Math.sin(rig.time * 1.3 + i) * 0.025, to.z)
      card.rotation.set(0, to.rot * spread, to.tilt * spread)
    })
  })

  return (
    <Pop station={index} delay={0.1}>
      {layout.map((_, i) => (
        <group key={i} ref={(el) => (cards.current[i] = el)}>
          <Card texture={posts[i]} width={0.56} height={0.7} back="#d8d2c4" />
        </group>
      ))}
    </Pop>
  )
}

/** A megaphone and the rings it sends out. */
function Megaphone({ index }) {
  const rings = useRef([])
  useFrame(() => {
    const { show } = rig.stations[index]
    rings.current.forEach((ring, i) => {
      if (!ring) return
      const phase = rig.reducedMotion ? 0.5 : (rig.time * 0.9 + i / 3) % 1
      ring.scale.setScalar(0.6 + phase * 1.4)
      ring.material.opacity = show * (1 - phase) * 0.9
    })
  })

  return (
    <group rotation={[0, 0, -Math.PI / 2]}>
      {/* Bell. */}
      <mesh castShadow>
        <cylinderGeometry args={[0.07, 0.2, 0.36, 24, 1, true]} />
        <meshStandardMaterial color={COLORS.paper} roughness={0.5} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0, 0.17, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.2, 0.02, 8, 32]} />
        <meshStandardMaterial color={COLORS.pink} roughness={0.5} />
      </mesh>
      <mesh position={[0, -0.22, 0]} castShadow>
        <cylinderGeometry args={[0.07, 0.07, 0.1, 16]} />
        <meshStandardMaterial color={COLORS.pink} roughness={0.5} />
      </mesh>
      <mesh position={[0.1, -0.12, 0]} rotation={[0, 0, 0.3]} castShadow>
        <boxGeometry args={[0.05, 0.16, 0.05]} />
        <meshStandardMaterial color={COLORS.ink} />
      </mesh>
      {/* Sound, as arcs leaving the bell. */}
      {[0, 1, 2].map((i) => (
        <mesh key={i} ref={(el) => (rings.current[i] = el)} position={[0, 0.32, 0]} rotation={[0, 0, Math.PI / 2]}>
          <torusGeometry args={[0.22, 0.014, 6, 24, Math.PI * 0.7]} />
          <meshBasicMaterial color={COLORS.lime} transparent toneMapped={false} depthWrite={false} />
        </mesh>
      ))}
    </group>
  )
}

/**
 * Hearts rising off the feed, as one instanced mesh. A steady trickle while the
 * station is shown, and a burst of them on arrival.
 */
function Hearts({ index }) {
  const mesh = useRef(null)
  const geometry = useMemo(() => {
    const shape = new THREE.Shape()
    shape.moveTo(0, -0.5)
    shape.bezierCurveTo(-0.9, 0.1, -0.5, 0.9, 0, 0.45)
    shape.bezierCurveTo(0.5, 0.9, 0.9, 0.1, 0, -0.5)
    const g = new THREE.ExtrudeGeometry(shape, { depth: 0.25, bevelEnabled: true, bevelSize: 0.06, bevelThickness: 0.06, bevelSegments: 2 })
    g.center()
    g.scale(0.12, 0.12, 0.12)
    return g
  }, [])
  const seeds = useMemo(
    // Behind and around the posts rather than in front of them, so they never
    // sit over the type on the cards.
    () =>
      Array.from({ length: HEARTS }, (_, i) => ({
        x: Math.sin(i * 12.9) * 0.9,
        z: -0.95 - Math.abs(Math.cos(i * 4.1)) * 0.35,
        offset: i / HEARTS,
        speed: 0.22 + (i % 4) * 0.05,
      })),
    [],
  )
  const dummy = useMemo(() => new THREE.Object3D(), [])

  useFrame(() => {
    if (!mesh.current) return
    const { show } = rig.stations[index]
    const t = sinceArrival(index)
    const burst = rig.reducedMotion ? 0 : clamp01(1 - t / 1.6)
    seeds.forEach((seed, i) => {
      const phase = (rig.time * seed.speed + seed.offset) % 1
      const rise = rig.reducedMotion ? 0.4 : phase
      // On arrival the whole set launches together from the feed.
      const b = burst > 0 ? clamp01((1 - burst) * 1.3 - seed.offset * 0.3) : rise
      const y = 1.1 + b * 1.3
      const fade = Math.sin(Math.PI * b)
      dummy.position.set(seed.x + Math.sin(b * 6 + i) * 0.08, y, seed.z)
      dummy.rotation.set(0, Math.sin(rig.time + i) * 0.5, Math.sin(b * 4 + i) * 0.3)
      dummy.scale.setScalar(Math.max(0.001, show * fade * (0.8 + (i % 3) * 0.2)))
      dummy.updateMatrix()
      mesh.current.setMatrixAt(i, dummy.matrix)
    })
    mesh.current.instanceMatrix.needsUpdate = true
  })

  return (
    <instancedMesh ref={mesh} args={[geometry, null, HEARTS]} castShadow frustumCulled={false}>
      <meshStandardMaterial color={COLORS.pink} emissive={COLORS.pink} emissiveIntensity={0.35} roughness={0.4} />
    </instancedMesh>
  )
}

function Plant() {
  return (
    <group>
      <mesh position={[0, 0.14, 0]} castShadow>
        <cylinderGeometry args={[0.13, 0.1, 0.28, 16]} />
        <meshStandardMaterial color={COLORS.lime} roughness={0.7} />
      </mesh>
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <mesh
          key={i}
          position={[Math.cos(i * 1.05) * 0.06, 0.48, Math.sin(i * 1.05) * 0.06]}
          rotation={[Math.cos(i * 1.05) * 0.5, i, Math.sin(i * 1.05) * 0.5]}
          castShadow
        >
          <coneGeometry args={[0.06, 0.5, 4]} />
          <meshStandardMaterial color="#2c6b3f" roughness={0.8} flatShading />
        </mesh>
      ))}
    </group>
  )
}
