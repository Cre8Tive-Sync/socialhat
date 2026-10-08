import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { COLORS } from '../stations'
import { Card, Pop } from '../props'
import { photoTexture } from '../textures'
import { clamp01, rig, sinceArrival } from '../rig'

/**
 * 02 CREATE — a shoot in progress. On arrival the lights strike up (a flicker,
 * then a warm wash on the backdrop), the camera fires a flash, and the shot it
 * just took pops out as a print. The REC light pulses the whole time.
 *
 * Local frame: backdrop at z −0.64, subject at about (0.15, −0.17), tripod and
 * operator at the front, (−0.4, 0.77). Lamps at (0.74, 0.2) and (−0.9, −0.48).
 */

/** A striking lamp: a few hard flickers, then on. Returns 0…1. */
const strike = (t) => {
  if (t < 0) return 0
  if (t > 0.55) return 1
  return [1, 0, 1, 0.2, 1, 0.5][Math.floor(t / 0.09)] ?? 1
}

export function Create({ index }) {
  const print = useMemo(() => photoTexture().texture, [])

  const key = useRef(null)
  const fill = useRef(null)
  const rec = useRef(null)
  // A spotlight aims at its target's world position, so the target has to be
  // in the scene graph — not just assigned — to have one.
  const aim = useMemo(() => new THREE.Object3D(), [])

  useFrame(() => {
    const { focus, show } = rig.stations[index]
    const t = sinceArrival(index)
    const on = rig.reducedMotion ? 1 : strike(t - 0.15)
    const lit = show * on
    // The flash: one hard pop through the fill, a beat after the lights settle.
    const flash = rig.reducedMotion ? 0 : Math.max(0, 1 - Math.abs(t - 1.0) / 0.12)
    if (key.current) key.current.intensity = lit * (2.5 + focus * 5)
    if (fill.current) fill.current.intensity = lit * (2 + focus * 5) + flash * 40
    if (rec.current) {
      rec.current.emissiveIntensity = show * (Math.sin(rig.time * 5) > 0 ? 3 : 0.4)
    }
  })

  return (
    <>
      {/* Warm key on the subject from the big lamp, cool fill from the other. */}
      <primitive object={aim} position={[0.1, 0.9, -0.4]} />
      <spotLight
        ref={key}
        target={aim}
        position={[0.85, 1.6, 0.3]}
        angle={0.8}
        penumbra={0.8}
        decay={2}
        distance={5}
        color="#ffe2a8"
        intensity={0}
      />
      <pointLight ref={fill} position={[-0.9, 1.5, -0.4]} decay={2} distance={4} color="#c9d4ff" intensity={0} />

      {/* The REC light on the camera body. */}
      <mesh position={[-0.38, 1.17, 0.7]}>
        <sphereGeometry args={[0.025, 12, 12]} />
        <meshStandardMaterial ref={rec} color={COLORS.pink} emissive={COLORS.pink} emissiveIntensity={0} toneMapped={false} />
      </mesh>

      {/* The shot, just taken, popping out as a print over the set. */}
      <Pop station={index} delay={0.35} bob={0.04} position={[1.05, 1.85, -0.05]} rotation={[0, -0.4, -0.1]}>
        <Card texture={print} width={0.42} height={0.5} back={COLORS.paper} />
      </Pop>

      {/* Clapperboard on the floor of the set. */}
      <Pop station={index} delay={0.2} position={[0.95, 0.3, 0.75]} rotation={[0, -0.6, 0]}>
        <Clapper />
      </Pop>

      {/* Kit cases, as in every studio. */}
      <Pop station={index} delay={0.1} position={[-1.0, 0.28, 0.55]} rotation={[0, 0.3, 0]}>
        <mesh position={[0, 0.14, 0]} castShadow>
          <boxGeometry args={[0.5, 0.28, 0.34]} />
          <meshStandardMaterial color="#15112b" roughness={0.5} />
        </mesh>
        <mesh position={[0, 0.3, 0]} castShadow>
          <boxGeometry args={[0.2, 0.04, 0.04]} />
          <meshStandardMaterial color="#3a3360" />
        </mesh>
        <mesh position={[0.05, 0.36, 0.05]} rotation={[0, 0.4, 0]} castShadow>
          <boxGeometry args={[0.26, 0.14, 0.22]} />
          <meshStandardMaterial color={COLORS.lime} roughness={0.6} />
        </mesh>
      </Pop>
    </>
  )
}

function Clapper() {
  const top = useRef(null)
  useFrame(() => {
    // Snaps shut on a loop: open, hold, clap.
    const cycle = (rig.time % 2.4) / 2.4
    const open = cycle < 0.7 ? 0.5 : cycle < 0.78 ? 0.5 * (1 - (cycle - 0.7) / 0.08) : 0
    if (top.current) top.current.rotation.z = rig.reducedMotion ? 0.3 : open
  })
  const stripes = useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 128
    canvas.height = 16
    const ctx = canvas.getContext('2d')
    for (let i = 0; i < 8; i++) {
      ctx.fillStyle = i % 2 ? COLORS.paper : COLORS.ink
      ctx.beginPath()
      ctx.moveTo(i * 16, 16)
      ctx.lineTo(i * 16 + 8, 0)
      ctx.lineTo(i * 16 + 24, 0)
      ctx.lineTo(i * 16 + 16, 16)
      ctx.fill()
    }
    const texture = new THREE.CanvasTexture(canvas)
    texture.colorSpace = THREE.SRGBColorSpace
    return texture
  }, [])
  return (
    <group rotation={[-1.2, 0, 0]}>
      <mesh castShadow>
        <boxGeometry args={[0.3, 0.24, 0.02]} />
        <meshStandardMaterial color={COLORS.ink} />
      </mesh>
      <group ref={top} position={[-0.15, 0.12, 0]}>
        <mesh position={[0.15, 0.025, 0]} castShadow>
          <boxGeometry args={[0.3, 0.05, 0.022]} />
          <meshStandardMaterial map={stripes} />
        </mesh>
      </group>
    </group>
  )
}
