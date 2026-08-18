import { useRef } from 'react'
import { Experience } from './three/Experience'
import { Story } from './ui/Story'
import { Loader, ScrollProgressBar } from './ui/Overlay'
import { useScrollProgress } from './hooks/useScrollProgress'
import { SCROLL_PAGES } from './config'

export default function App() {
  const progress = useScrollProgress()

  // Position on the camera animation, in milliseconds. Written by the render
  // loop inside the Canvas, read by the story overlay outside it — so the words
  // are locked to the damped camera time rather than to raw scroll.
  const timelineRef = useRef(0)

  return (
    <>
      {/* Pinned canvas. The page scrolls behind it; the camera reacts. */}
      <div className="stage">
        <Experience progress={progress} timelineRef={timelineRef} />
      </div>

      <Story timelineRef={timelineRef} />

      {/* The only job of this element is to give the document something to scroll. */}
      <div className="scroll-track" style={{ height: `${SCROLL_PAGES * 100}vh` }} />

      <Loader />
      <ScrollProgressBar />
    </>
  )
}
