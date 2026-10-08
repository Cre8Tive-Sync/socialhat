import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { COLORS } from '../stations'
import { Card, Pop, Tile } from '../props'
import { codeTexture, tileTexture, websiteTexture } from '../textures'
import { clamp01, rig, sinceArrival } from '../rig'

/**
 * 03 BUILD — screens float up over the desk. On arrival they power on, a
 * flicker and then the glow, the site mockup first and the editors after; the
 * code types itself in.
 *
 * Local frame: desk at the back, about (0, 0.8, −0.25); the two developers
 * stand in front of it with their backs to the camera.
 */

const TYPE_SECONDS = 2.2

/** CRT-ish power on: off, a flash, a dip, then on. 0…1. */
const powerOn = (t) => {
  if (t < 0) return 0
  if (t < 0.08) return 1.4
  if (t < 0.18) return 0.15
  if (t < 0.4) return 0.6 + (t - 0.18) * 1.8
  return 1
}

export function Build({ index }) {
  const site = useMemo(() => websiteTexture().texture, [])
  const editors = useMemo(() => [codeTexture(1), codeTexture(2)], [])
  const code = useMemo(() => tileTexture('code').texture, [])

  const screens = [useRef(null), useRef(null), useRef(null)]
  const typed = useRef(1)

  useFrame(() => {
    const t = sinceArrival(index)
    screens.forEach((ref, i) => {
      if (!ref.current) return
      const on = rig.reducedMotion ? 1 : powerOn(t - 0.25 - i * 0.22)
      ref.current.emissiveIntensity = 0.85 * on
      ref.current.color.setScalar(0.15 + 0.85 * Math.min(on, 1))
    })

    const p = rig.reducedMotion ? 1 : clamp01((t - 0.6) / TYPE_SECONDS)
    if (Math.abs(p - typed.current) > 0.01 || (p === 1 && typed.current !== 1)) {
      typed.current = p
      editors.forEach((editor) => editor.redraw(p))
    }
  })

  return (
    <>
      {/* The site, big, behind the desk. */}
      <Pop station={index} delay={0.1} bob={0.025} position={[0.05, 1.78, -0.9]} rotation={[0.04, 0, 0]}>
        <Card texture={site} width={1.36} height={0.85} glow={0.85} materialRef={screens[0]} />
      </Pop>

      {/* Editors either side, angled in. */}
      <Pop station={index} delay={0.25} bob={0.03} position={[-1.05, 1.5, -0.55]} rotation={[0, 0.5, 0]}>
        <Card texture={editors[0].texture} width={0.72} height={0.54} glow={0.85} materialRef={screens[1]} />
      </Pop>
      <Pop station={index} delay={0.38} bob={0.03} position={[1.1, 1.62, -0.6]} rotation={[0, -0.5, 0]}>
        <Card texture={editors[1].texture} width={0.66} height={0.5} glow={0.85} materialRef={screens[2]} />
      </Pop>

      <Pop station={index} delay={0.5} bob={0.06} speed={1.8} position={[1.4, 1.2, 0.25]}>
        <Tile texture={code} size={0.3} rotation={[0, -0.3, 0.08]} />
      </Pop>

      {/* Books, a mug, the clutter of a working desk. */}
      <Pop station={index} delay={0.2} position={[-0.95, 0.2, 0.75]} rotation={[0, 0.4, 0]}>
        {[0, 1, 2, 3, 4].map((i) => (
          <mesh key={i} position={[0, 0.04 + i * 0.075, 0]} rotation={[0, (i % 3) * 0.12, 0]} castShadow>
            <boxGeometry args={[0.42 - i * 0.02, 0.07, 0.3]} />
            <meshStandardMaterial color={['#3a2f6e', COLORS.paper, '#241d47', COLORS.lime, '#3a2f6e'][i]} roughness={0.85} />
          </mesh>
        ))}
      </Pop>
      <Pop station={index} delay={0.3} position={[0.62, 0.84, -0.08]}>
        <mesh castShadow>
          <cylinderGeometry args={[0.045, 0.04, 0.1, 16]} />
          <meshStandardMaterial color={COLORS.paper} roughness={0.6} />
        </mesh>
      </Pop>
    </>
  )
}
