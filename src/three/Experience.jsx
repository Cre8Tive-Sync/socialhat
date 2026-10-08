import { Suspense, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { PerformanceMonitor } from '@react-three/drei'
import { Bloom, EffectComposer, ToneMapping, Vignette } from '@react-three/postprocessing'
import { ToneMappingMode } from 'postprocessing'
import { ProcessScene } from './ProcessScene'
import { CameraRig } from './CameraRig'
import { COLORS } from './stations'
import { usePhase } from '../hooks/usePhase'

/**
 * Phones and small tablets get the scene without shadows or post-processing.
 * Both are fill-rate costs, and fill rate is exactly what a phone GPU pushing
 * a 3x-density screen does not have.
 */
const lite =
  typeof window !== 'undefined' &&
  (window.matchMedia('(pointer: coarse)').matches || window.innerWidth < 768)

export function Experience() {
  // The scene animates continuously while it is on screen — things bob, the
  // path marches, the camera flies on its own clock — so it renders every
  // frame. Once the site owns the screen the canvas is gone behind it, and the
  // loop stops dead: the website scrolls on an idle GPU.
  const phase = usePhase()
  const [dpr, setDpr] = useState(lite ? 1.5 : 1.75)

  return (
    <Canvas
      dpr={[1, dpr]}
      shadows={lite ? false : 'percentage'}
      gl={{ antialias: lite, powerPreference: 'high-performance' }}
      frameloop={phase === 'site' ? 'never' : 'always'}
      // Let vertical touch drags scroll the page — R3F otherwise sets
      // `touch-action: none` on the canvas, which kills scrolling on mobile.
      style={{ touchAction: 'pan-y' }}
      camera={{ fov: 34, near: 0.1, far: 120, position: [-9.6, 9.4, -3.4] }}    >
      <color attach="background" args={[COLORS.night]} />
      <fog attach="fog" args={[COLORS.night, 24, 52]} />

      <PerformanceMonitor onDecline={() => setDpr(1)} />

      <Suspense fallback={null}>
        <ProcessScene />
      </Suspense>
      <CameraRig />

      {!lite && (
        <EffectComposer multisampling={4}>
          <Bloom mipmapBlur luminanceThreshold={0.95} luminanceSmoothing={0.2} intensity={0.55} />
          <Vignette offset={0.32} darkness={0.55} />
          <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
        </EffectComposer>
      )}
    </Canvas>
  )
}
