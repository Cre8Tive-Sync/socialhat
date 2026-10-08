import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { COLORS } from '../stations'
import { Card, Pop } from '../props'
import { boardTexture } from '../textures'
import { rig, sinceArrival } from '../rig'

/**
 * 05 DELIVER — the launch. The results board stands behind the team; on
 * arrival confetti goes up over the platform and the team jumps for it.
 *
 * Local frame: the three of them in a row across the front, about z 0, from
 * x −0.5 to 0.6. The board goes behind them.
 */

const CONFETTI = 160
const CONFETTI_SECONDS = 3.2
const GRAVITY = 2.4

/** The three of them, by their names in the export. */
const TEAM = ['Low poly man wearing suit', 'Low poly man wearing suit.002', 'Low poly doctor woman']

export function Deliver({ index, group }) {
  const board = useMemo(() => boardTexture().texture, [])

  // Each of the team, with where they stand, so a jump can return them there.
  const team = useMemo(
    () =>
      TEAM.map((name) => group.getObjectByName(THREE.PropertyBinding.sanitizeNodeName(name)))
        .filter(Boolean)
        .map((object) => ({ object, rest: object.position.y })),
    [group],
  )

  useFrame(() => {
    const t = sinceArrival(index)
    team.forEach(({ object, rest }, i) => {
      // Two hops each, staggered, on arrival — and still afterwards.
      const local = t - 0.25 - i * 0.12
      const hop = !rig.reducedMotion && local > 0 && local < 1.1 ? Math.abs(Math.sin((local / 1.1) * Math.PI * 2)) * 0.16 : 0
      object.position.y = rest + hop
    })
  })

  return (
    <>
      {/* The results board on its easel, behind the team. */}
      <Pop station={index} delay={0.1} position={[0.05, 0.2, -0.85]}>
        <Card texture={board} width={1.5} height={1.0} back={COLORS.paper} position={[0, 1.42, 0]} rotation={[-0.06, 0, 0]} />
        {[-0.55, 0.55].map((x) => (
          <mesh key={x} position={[x, 0.55, -0.06]} rotation={[0.08, 0, x > 0 ? -0.05 : 0.05]} castShadow>
            <boxGeometry args={[0.05, 1.1, 0.05]} />
            <meshStandardMaterial color={COLORS.ink} />
          </mesh>
        ))}
      </Pop>

      {/* The trophy table: a lime plinth and a stack of finished work. */}
      <Pop station={index} delay={0.3} position={[-1.0, 0.2, 0.55]} rotation={[0, 0.4, 0]}>
        <mesh position={[0, 0.17, 0]} castShadow>
          <boxGeometry args={[0.42, 0.34, 0.42]} />
          <meshStandardMaterial color={COLORS.lime} roughness={0.6} />
        </mesh>
        <mesh position={[0, 0.4, 0]} castShadow>
          <boxGeometry args={[0.3, 0.1, 0.36]} />
          <meshStandardMaterial color={COLORS.paper} roughness={0.8} />
        </mesh>
        <mesh position={[0, 0.48, 0]} rotation={[0, 0.3, 0]} castShadow>
          <boxGeometry args={[0.28, 0.06, 0.32]} />
          <meshStandardMaterial color={COLORS.pink} roughness={0.7} />
        </mesh>
      </Pop>

      <Pop station={index} delay={0.4} position={[1.05, 0.2, -0.45]}>
        <mesh position={[0, 0.14, 0]} castShadow>
          <cylinderGeometry args={[0.13, 0.1, 0.28, 16]} />
          <meshStandardMaterial color={COLORS.pink} roughness={0.7} />
        </mesh>
        {[0, 1, 2, 3, 4].map((i) => (
          <mesh
            key={i}
            position={[Math.cos(i * 1.25) * 0.05, 0.44, Math.sin(i * 1.25) * 0.05]}
            rotation={[Math.cos(i * 1.25) * 0.55, i, Math.sin(i * 1.25) * 0.55]}
            castShadow
          >
            <coneGeometry args={[0.055, 0.45, 4]} />
            <meshStandardMaterial color="#2c6b3f" roughness={0.8} flatShading />
          </mesh>
        ))}
      </Pop>

      <Confetti index={index} />
    </>
  )
}

/**
 * Confetti as one instanced mesh. Each piece has a launch velocity and a spin
 * and is placed analytically from the time since arrival — no simulation
 * state, so scrubbing back and forth can never leave it in a strange place.
 * Between bursts a few pieces hang in the air over the board, so the wide shot
 * still reads as a celebration.
 */
function Confetti({ index }) {
  const mesh = useRef(null)
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const pieces = useMemo(() => {
    let s = 4242
    const rand = () => ((s = (s * 16807) % 2147483647) / 2147483647)
    const palette = [COLORS.lime, COLORS.pink, COLORS.paper, '#ffe36b']
    return Array.from({ length: CONFETTI }, () => {
      const angle = rand() * Math.PI * 2
      const speed = 0.6 + rand() * 1.2
      return {
        v: new THREE.Vector3(Math.cos(angle) * speed * 0.7, 2.6 + rand() * 1.6, Math.sin(angle) * speed * 0.5),
        spin: new THREE.Vector3(rand() * 12, rand() * 12, rand() * 12),
        drift: rand() * Math.PI * 2,
        hang: new THREE.Vector3((rand() - 0.5) * 2.4, 1.9 + rand() * 1.0, (rand() - 0.5) * 1.6),
        color: new THREE.Color(palette[Math.floor(rand() * palette.length)]),
        idle: rand() < 0.22,
      }
    })
  }, [])

  const geometry = useMemo(() => new THREE.PlaneGeometry(0.05, 0.08), [])

  useFrame(() => {
    if (!mesh.current) return
    const { show } = rig.stations[index]
    const t = sinceArrival(index)
    const bursting = !rig.reducedMotion && t >= 0 && t < CONFETTI_SECONDS

    pieces.forEach((piece, i) => {
      if (bursting) {
        // Launched from just above the team, slowed by drag, falling back.
        const k = 1 - Math.exp(-1.6 * t)
        dummy.position.set(
          piece.v.x * k + Math.sin(t * 3 + piece.drift) * 0.05,
          // Comes to rest on the platform rather than falling through it.
          Math.max(0.24, 1.6 + (piece.v.y * k) / 1.6 - 0.5 * GRAVITY * t * t * 0.55),
          piece.v.z * k,
        )
        dummy.rotation.set(piece.spin.x * t, piece.spin.y * t, piece.spin.z * t)
        const fade = Math.min(1, (CONFETTI_SECONDS - t) / 0.6)
        dummy.scale.setScalar(Math.max(0.001, fade * show))
      } else if (piece.idle) {
        const time = rig.time + piece.drift
        dummy.position.set(
          piece.hang.x + Math.sin(time * 0.7) * 0.05,
          piece.hang.y + Math.sin(time * 1.1) * 0.06,
          piece.hang.z,
        )
        dummy.rotation.set(time * 0.8, time * 0.6, piece.drift)
        dummy.scale.setScalar(Math.max(0.001, show))
      } else {
        dummy.scale.setScalar(0.001)
      }
      dummy.updateMatrix()
      mesh.current.setMatrixAt(i, dummy.matrix)
    })
    mesh.current.instanceMatrix.needsUpdate = true
  })

  return (
    <instancedMesh
      ref={(el) => {
        mesh.current = el
        if (el && !el.instanceColor) pieces.forEach((piece, i) => el.setColorAt(i, piece.color))
      }}
      args={[geometry, null, CONFETTI]}
      frustumCulled={false}
    >
      <meshStandardMaterial side={THREE.DoubleSide} roughness={0.6} emissive="#ffffff" emissiveIntensity={0.08} />
    </instancedMesh>
  )
}
