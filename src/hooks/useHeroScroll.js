import { useEffect, useRef } from 'react'
import { HANDOFF_SMOOTHING, HANDOFF_START, STOP_COMMIT, STOP_COUNT } from '../config'
import { LAST_STOP, rig } from '../three/rig'

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v)

/**
 * How far through the handover the site starts taking clicks. Its opacity
 * reaches 1 at a *damped* reveal of 0.6, so this sits past that with room for
 * the damping to catch up — nothing is clickable before it is fully visible.
 */
const LIVE_AT = 0.75

/**
 * The hero's geometry, shared with scrollToStop() below so the rail can jump
 * to a stop without measuring anything itself. Written on resize only.
 */
const geometry = { top: 0, travel: 0 }

/** Document scroll offset at which a stop sits exactly. STOP_COUNT is the site. */
const stopY = (stop) =>
  stop >= STOP_COUNT
    ? geometry.top + geometry.travel
    : geometry.top + (stop / LAST_STOP) * HANDOFF_START * geometry.travel

const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

/** Scroll the page so the camera flies to `stop`. Used by the stop rail. */
export function scrollToStop(stop) {
  window.scrollTo({ top: stopY(stop), behavior: prefersReducedMotion() ? 'instant' : 'smooth' })
}

/**
 * Which stop a scroll position is asking for, given the way it is moving.
 *
 * `pos` is the scroll as a float position along the stops. Going down, a stop
 * is committed to once the scroll is STOP_COMMIT of the way into the gap toward
 * it; going up, likewise in reverse. That is what makes a small nudge enough to
 * send the camera on to the next station, while jitter at rest does nothing.
 */
const committed = (pos, dir) => {
  if (dir > 0) return Math.ceil(pos - STOP_COMMIT)
  if (dir < 0) return Math.floor(pos + STOP_COMMIT)
  return Math.round(pos)
}

/**
 * Scroll, measured against the pinned hero rather than the whole document.
 *
 * The page is two things stacked: a process scene, then a website. Everything
 * here is normalised to the hero element's own travel.
 *
 * The scene does not scrub. Scroll position is turned into a *stop request*
 * (rig.target) and the camera flies there on its own clock, so one gesture is
 * one move from station to station however coarse or fast the wheel is. When
 * scrolling comes to rest inside the hero, the page settles itself onto the
 * stop it committed to, so the scrollbar and the picture always agree.
 *
 * Three numbers are written straight onto the root element as custom
 * properties — none of them React state:
 *
 *   --scene   — 0 to 1 across the stops, reaching 1 at HANDOFF_START.
 *   --handoff — 0 until the last stop, then 0 to 1 across the handover. Exact,
 *               and welded to the scrollbar: it holds the site still under the
 *               scroll, and a damped value there would show up as drift.
 *   --reveal  — the same 0 to 1, damped. The *look* of the handover.
 *
 * `data-phase` on the root goes scene → handoff → site, which is what the two
 * sets of chrome key off.
 *
 * Per scroll event this stays close to free: geometry is measured on resize,
 * never per scroll, and a custom property is only written when it changed.
 */
export function useHeroScroll(heroRef) {
  const progress = useRef(0)
  const handoff = useRef(0)
  const reveal = useRef(0)

  useEffect(() => {
    const root = document.documentElement
    let frame = 0
    let last = 0
    let primed = false
    let lastY = window.scrollY
    let dir = 0
    let settleTimer = 0

    const written = { '--scene': '', '--handoff': '', '--reveal': '' }

    const write = (property, value) => {
      if (written[property] === value) return
      written[property] = value
      root.style.setProperty(property, value)
    }

    const measure = () => {
      const hero = heroRef.current
      if (!hero) return
      geometry.top = hero.offsetTop
      geometry.travel = hero.offsetHeight - window.innerHeight
    }

    const paint = () => write('--reveal', reveal.current.toFixed(4))

    const tick = (now) => {
      const dt = Math.min(Math.max((now - last) / 1000, 0), 1 / 20)
      last = now

      const target = handoff.current
      reveal.current += (target - reveal.current) * (1 - Math.exp(-HANDOFF_SMOOTHING * dt))
      if (Math.abs(target - reveal.current) < 0.001) reveal.current = target

      paint()
      frame = reveal.current === target ? 0 : requestAnimationFrame(tick)
    }

    /** Raw 0–1 through the hero's whole travel. */
    const raw = () =>
      geometry.travel > 0 ? clamp01((window.scrollY - geometry.top) / geometry.travel) : 0

    /** The scroll as a float along the stops; LAST_STOP + 1 is the site. */
    const position = () =>
      handoff.current > 0 ? LAST_STOP + handoff.current : progress.current * LAST_STOP

    /**
     * Scrolling has stopped. If it stopped between two stops inside the hero,
     * finish the move the gesture started. Past the hero this does nothing: the
     * website scrolls freely.
     */
    const settle = () => {
      settleTimer = 0
      if (raw() >= 1) return
      const y = stopY(committed(position(), dir))
      if (Math.abs(window.scrollY - y) < 1.5) return
      window.scrollTo({ top: y, behavior: prefersReducedMotion() ? 'instant' : 'smooth' })
    }

    const read = () => {
      if (!heroRef.current) return

      const y = window.scrollY
      if (Math.abs(y - lastY) > 0.5) dir = Math.sign(y - lastY)
      lastY = y

      const r = raw()
      progress.current = clamp01(r / HANDOFF_START)
      handoff.current = clamp01((r - HANDOFF_START) / (1 - HANDOFF_START))

      rig.target = Math.min(committed(position(), dir), LAST_STOP)

      write('--scene', progress.current.toFixed(4))
      write('--handoff', handoff.current.toFixed(4))

      const phase = handoff.current >= 1 ? 'site' : handoff.current > 0 ? 'handoff' : 'scene'
      if (root.dataset.phase !== phase) root.dataset.phase = phase

      const live = handoff.current >= LIVE_AT
      if ((root.dataset.live === '') !== live) {
        if (live) root.dataset.live = ''
        else delete root.dataset.live
      }

      // Browsers without `scrollend` get a debounce standing in for it.
      if (!('onscrollend' in window)) {
        clearTimeout(settleTimer)
        settleTimer = setTimeout(settle, 160)
      }

      if (!primed) {
        primed = true
        // A reload partway down lands on the stop it was nearest, with the
        // camera already there rather than flying in from the wide shot.
        rig.s = rig.target
        reveal.current = handoff.current
        paint()
        return
      }

      if (!frame && reveal.current !== handoff.current) {
        last = performance.now()
        frame = requestAnimationFrame(tick)
      }
    }

    const remeasure = () => {
      measure()
      read()
    }

    measure()
    read()
    window.addEventListener('scroll', read, { passive: true })
    window.addEventListener('scrollend', settle)
    window.addEventListener('resize', remeasure)
    window.addEventListener('load', remeasure)
    return () => {
      window.removeEventListener('scroll', read)
      window.removeEventListener('scrollend', settle)
      window.removeEventListener('resize', remeasure)
      window.removeEventListener('load', remeasure)
      clearTimeout(settleTimer)
      if (frame) cancelAnimationFrame(frame)
    }
  }, [heroRef])

  return { progress }
}
