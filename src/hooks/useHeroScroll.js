import { useEffect, useRef } from 'react'
import { HANDOFF_START } from '../config'

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v)

/**
 * Scroll, measured against the pinned hero rather than the whole document.
 *
 * The page is now two things stacked: a film, then a website. Reading document
 * scroll would stretch the camera animation across the site's sections too, so
 * everything here is normalised to the hero element's own travel.
 *
 * Two numbers come out of it:
 *
 *   progress — 0 to 1 across the camera animation, reaching 1 at HANDOFF_START
 *              and holding there while the last frame sits on screen.
 *   handoff  — 0 until the animation finishes, then 0 to 1 across the dissolve
 *              that hands the screen over to the site.
 *
 * Both are refs, not state: they update on every scroll event, and re-rendering
 * React to drive a three.js value or an opacity would be pure waste. The render
 * loop reads `.current`; the DOM side gets `--handoff` written straight onto the
 * root element, so CSS can do the rest without a single React render.
 */
export function useHeroScroll(heroRef) {
  const progress = useRef(0)
  const handoff = useRef(0)

  useEffect(() => {
    const root = document.documentElement

    const read = () => {
      const hero = heroRef.current
      if (!hero) return

      // The hero is pinned for its whole height minus the one viewport that is
      // actually on screen — that difference is the scroll it answers to.
      const travel = hero.offsetHeight - window.innerHeight
      const raw = travel > 0 ? clamp01((window.scrollY - hero.offsetTop) / travel) : 0

      progress.current = clamp01(raw / HANDOFF_START)
      handoff.current = clamp01((raw - HANDOFF_START) / (1 - HANDOFF_START))

      // The film's chrome is pure CSS off these two: no React render, no
      // second scroll listener, no rAF loop to keep a progress bar honest.
      root.style.setProperty('--scene', progress.current.toFixed(4))
      root.style.setProperty('--handoff', handoff.current.toFixed(4))
      // Phase is what the chrome keys off: the film's UI retires once the site
      // has the screen, and the site's own top bar takes over.
      root.dataset.phase = handoff.current > 0.98 ? 'site' : 'scene'
    }

    read()
    window.addEventListener('scroll', read, { passive: true })
    window.addEventListener('resize', read)
    return () => {
      window.removeEventListener('scroll', read)
      window.removeEventListener('resize', read)
    }
  }, [heroRef])

  return { progress, handoff }
}
