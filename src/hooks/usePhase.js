import { useEffect, useState } from 'react'

/**
 * The handover phase, read back off the root element.
 *
 * useHeroScroll writes `data-phase` there — scene → handoff → site — and CSS
 * keys the whole arrival off it. The site half needs the same signal in
 * JavaScript, because nothing down there should be spending a timer, a listener
 * or a frame while the film still owns the screen: the site is invisible for
 * all of it, and the camera scrub wants every frame it can get.
 *
 * An attribute observer rather than shared React state, because the thing
 * writing it is a scroll handler that deliberately never re-renders anything —
 * putting the phase in state would drag a component tree into a listener that
 * exists to stay out of one. This fires three times in a session.
 */
export function usePhase() {
  const [phase, setPhase] = useState(() => document.documentElement.dataset.phase ?? 'scene')

  useEffect(() => {
    const root = document.documentElement
    const sync = () => setPhase(root.dataset.phase ?? 'scene')

    // The first write can land before this effect runs.
    sync()

    const observer = new MutationObserver(sync)
    observer.observe(root, { attributes: true, attributeFilter: ['data-phase'] })
    return () => observer.disconnect()
  }, [])

  return phase
}
