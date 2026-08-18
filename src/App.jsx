import { useRef } from 'react'
import { Experience } from './three/Experience'
import { Story } from './ui/Story'
import { Site } from './ui/Site'
import { Loader, SceneChrome } from './ui/Overlay'
import { useHeroScroll } from './hooks/useHeroScroll'
import { HANDOFF_VIEWPORTS, SCROLL_PAGES } from './config'

/**
 * Two acts on one page.
 *
 * The hero is a tall block with a pinned stage inside it: the camera scrubs
 * while it holds the screen. When the animation runs out, a sheet of paper
 * dissolves over the last frame while the site rises through it — the film and
 * the website cross on the same scroll, and what is left is the actual site.
 */

/**
 * The site is pulled up over the tail of the hero by the length of the
 * dissolve, so its first rule crosses the bottom of the screen on the frame the
 * paper starts fading in and lands flush at the top on the frame it finishes.
 * Without this the handover ends on a viewport of blank paper.
 */
const OVERLAP_VH = HANDOFF_VIEWPORTS * 100
export default function App() {
  const hero = useRef(null)
  const { progress } = useHeroScroll(hero)

  // Position on the camera animation, in milliseconds. Written by the render
  // loop inside the Canvas, read by the story overlay outside it — so the words
  // are locked to the damped camera time rather than to raw scroll.
  const timelineRef = useRef(0)

  return (
    <>
      <span id="top" />

      <div className="hero" ref={hero} style={{ height: `${SCROLL_PAGES * 100}vh` }}>
        {/* Pinned for the length of the block, then released. */}
        <div className="hero__stage">
          <Experience progress={progress} timelineRef={timelineRef} />
          <Story timelineRef={timelineRef} />

          {/* The handover: the scene dissolves into the site's own ground. */}
          <div className="hero__curtain" aria-hidden="true" />
        </div>

        <SceneChrome />
      </div>

      <Site style={{ marginTop: `-${OVERLAP_VH}vh` }} />

      <Loader />
    </>
  )
}
