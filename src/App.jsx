import { useEffect, useRef } from 'react'
import { Experience } from './three/Experience'
import { Story } from './ui/Story'
import { Site } from './ui/Site'
import { Loader, SceneChrome } from './ui/Overlay'
import { useHeroScroll } from './hooks/useHeroScroll'
import { HANDOFF_VIEWPORTS, SCROLL_PAGES } from './config'

/**
 * Two acts on one page.
 *
 * The hero is a tall block with a pinned stage inside it: the process scene,
 * one viewport of scroll per stop, the camera flying station to station as the
 * page moves. After the closing wide shot, the frame opens from the middle —
 * the site's own ground floods out of the centre of the shot and the site comes
 * up through it, held dead still, never sliding.
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
  // Writes the stop the scroll is asking for onto the shared rig; the scene,
  // the copy and the rail all read the camera's position back off it.
  useHeroScroll(hero)

  // The pre-boot curtain in index.html has done its job: it held the screen from
  // the browser's first frame until this bundle parsed, so nobody watched a
  // white page while three.js downloaded. The app's own loader takes over here.
  //
  // Removed from an effect rather than straight after `render()` in main.jsx.
  // `createRoot().render()` schedules the work, it does not perform it, so the
  // line after it can run before a single node is in the document — which would
  // pull the curtain to expose an empty `#root`. An effect runs after the tree
  // is committed, which is the guarantee this needs.
  useEffect(() => {
    document.getElementById('boot')?.remove()
  }, [])

  // Arriving on a link to a section — /#enquiry, /#work, and every old
  // WordPress page, which redirects to one of these. The browser tries to jump
  // to the fragment while #root is still empty, finds nothing, and leaves the
  // visitor at the top of the process scene. So the jump is made here, once the
  // sections exist, and instantly: `scroll-behavior: smooth` would play the
  // whole film past them on the way down.
  //
  // Measured through offsetTop, not getBoundingClientRect. At the top of the
  // page the site is transformed for the handover, and a transformed box is not
  // where the section will sit once the page is scrolled there.
  useEffect(() => {
    const el = document.getElementById(decodeURIComponent(window.location.hash.slice(1)))
    if (!el) return
    let y = 0
    for (let node = el; node; node = node.offsetParent) y += node.offsetTop
    const clearance = parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) || 0
    requestAnimationFrame(() => window.scrollTo({ top: y - clearance, behavior: 'instant' }))
  }, [])

  return (
    <>
      <span id="top" />

      <div className="hero" ref={hero} style={{ height: `${SCROLL_PAGES * 100}vh` }}>
        {/* Pinned for the length of the block, then released. */}
        <div className="hero__stage">
          <Experience />
          <Story />

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
