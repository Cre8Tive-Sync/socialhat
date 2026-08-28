import { useRef } from 'react'
import { invalidate } from '@react-three/fiber'
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
 * while it holds the screen. When the animation runs out, the last frame opens
 * from the middle — the site's own ground floods out of the centre of the shot
 * and the site comes up through it, held dead still, never sliding. The film
 * and the website cross at the centre of the picture, and what is left is the
 * actual site.
 */

/**
 * The site is pulled up over the last viewport of the hero, so that on the
 * frame the hero runs out its top bar is flush with the top of the screen.
 * That overlap is always one viewport — it is the hero's own last screen — and
 * has nothing to do with how long the handover takes.
 *
 * What the handover length does control is how far the site would drift during
 * it, and that drift is exactly what `--handoff-travel` cancels: CSS holds the
 * site dead still at the top of the screen for the whole handover, so it comes
 * up out of the centre of the frame instead of sliding in from the bottom edge.
 */
const OVERLAP_VH = 100
const HANDOFF_TRAVEL_VH = HANDOFF_VIEWPORTS * 100

export default function App() {
  const hero = useRef(null)
  // The canvas renders on demand. `invalidate` is how the scroll listener says
  // the camera has somewhere new to be — and by not calling it once the film is
  // over, it is also how the website gets a completely idle GPU to scroll on.
  const { progress } = useHeroScroll(hero, invalidate)

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

          {/* The handover: the site's own ground floods out of the centre. */}
          <div className="hero__curtain" aria-hidden="true" />
        </div>

        <SceneChrome />
      </div>

      <Site
        style={{ marginTop: `-${OVERLAP_VH}vh`, '--handoff-travel': `${HANDOFF_TRAVEL_VH}vh` }}
      />

      <Loader />
    </>
  )
}
