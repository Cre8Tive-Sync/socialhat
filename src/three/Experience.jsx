import { Suspense } from 'react'
import { Canvas } from '@react-three/fiber'
import { ScrollScene } from './ScrollScene'

export function Experience({ progress, timelineRef }) {
  return (
    <Canvas
      dpr={[1, 2]}
      gl={{ antialias: true, powerPreference: 'high-performance' }}
      // Let vertical touch drags scroll the page — R3F otherwise sets
      // `touch-action: none` on the canvas, which kills scrolling on mobile.
      style={{ touchAction: 'pan-y' }}
      // Placeholder only: ScrollScene swaps in the glTF's camera on load.
      camera={{ fov: 23, near: 0.1, far: 1000, position: [0, 1.35, 3] }}
    >
      <Suspense fallback={null}>
        <ScrollScene progress={progress} timelineRef={timelineRef} />
      </Suspense>
    </Canvas>
  )
}
