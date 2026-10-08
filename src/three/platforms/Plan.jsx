import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { COLORS } from '../stations'
import { Card, Pop } from '../props'
import { briefStackTexture, photoTexture, stickyTexture } from '../textures'
import { clamp01, rig, sinceArrival } from '../rig'

/**
 * 01 PLAN — the whiteboard writes itself on, sticky notes slap onto the board,
 * the brief stack and a reference print pop up beside it.
 *
 * Local frame: the board stands at z −0.62 facing +Z, 2.26 wide, its centre
 * 1.53 up; the table is in front of it at z ≈ 0.5.
 */

const WRITE_SECONDS = 2.4

const NOTES = [
  { color: COLORS.pink, at: [0.8, 1.98], rot: -0.1, delay: 0.25 },
  { color: COLORS.lime, at: [0.84, 1.62], rot: 0.12, delay: 0.32 },
  { color: '#ffe36b', at: [0.3, 1.08], rot: -0.06, delay: 0.4 },
  { color: COLORS.lime, at: [0.72, 1.1], rot: 0.08, delay: 0.47 },
]

export function Plan({ index, whiteboard }) {
  const notes = useMemo(() => NOTES.map((note, i) => ({ ...note, texture: stickyTexture(note.color, i + 1).texture })), [])
  const brief = useMemo(() => briefStackTexture().texture, [])
  const photo = useMemo(() => photoTexture().texture, [])

  // The board writes on from each arrival. Redrawn only while it is actually
  // writing; once finished, the canvas is left alone.
  const written = useRef(1)
  useFrame(() => {
    const t = sinceArrival(index)
    const p = rig.reducedMotion ? 1 : clamp01((t - 0.2) / WRITE_SECONDS)
    if (Math.abs(p - written.current) < 0.004) return
    written.current = p
    whiteboard.redraw(p)
  })

  return (
    <>
      {notes.map((note, i) => (
        <Note key={i} index={index} note={note} />
      ))}

      {/* The stack of briefs on the front corner of the platform. */}
      <Pop station={index} delay={0.15} position={[-1.05, 0.28, 0.95]} rotation={[0, 0.5, 0]}>
        {[0, 1, 2, 3].map((i) => (
          <mesh key={i} position={[0, 0.03 + i * 0.045, 0]} rotation={[0, i * 0.07, 0]} castShadow>
            <boxGeometry args={[0.46, 0.04, 0.6]} />
            <meshStandardMaterial color={i % 2 ? '#e9e2d2' : COLORS.paper} roughness={0.9} />
          </mesh>
        ))}
        <Card
          texture={brief}
          width={0.5}
          height={0.5}
          depth={0.02}
          back={COLORS.paper}
          position={[0.02, 0.48, 0.05]}
          rotation={[-0.25, 0, 0.05]}
        />
      </Pop>

      {/* A pinned reference print off the board's right edge. */}
      <Pop station={index} delay={0.45} bob={0.03} position={[-1.42, 1.62, -0.35]} rotation={[0, 0.4, -0.1]}>
        <Card texture={photo} width={0.38} height={0.46} back={COLORS.pink} />
      </Pop>
    </>
  )
}

/**
 * One sticky note. It pops on with the station, and slaps onto the board again
 * on each arrival: a quick drop from in front of the board onto its face.
 */
function Note({ index, note }) {
  const ref = useRef(null)
  useFrame(() => {
    const group = ref.current
    if (!group) return
    const t = sinceArrival(index) - note.delay * 2
    const slap = rig.reducedMotion ? 1 : clamp01(t / 0.35)
    const ease = 1 - (1 - slap) ** 3
    group.position.z = -0.55 + (1 - ease) * 0.45
    group.rotation.z = note.rot + (1 - ease) * 0.6
  })
  return (
    <Pop station={index} delay={note.delay} position={[note.at[0], note.at[1], 0]}>
      <group ref={ref} position={[0, 0, -0.55]}>
        <mesh castShadow>
          <boxGeometry args={[0.24, 0.24, 0.012]} />
          <meshStandardMaterial map={note.texture} roughness={0.85} />
        </mesh>
      </group>
    </Pop>
  )
}
