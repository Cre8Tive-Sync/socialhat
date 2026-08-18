import { useEffect, useRef } from 'react'
import { HANDOFF_SMOOTHING, HANDOFF_START } from '../config'

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v)

/**
 * Scroll, measured against the pinned hero rather than the whole document.
 *
 * The page is two things stacked: a film, then a website. Reading document
 * scroll would stretch the camera animation across the site's sections too, so
 * everything here is normalised to the hero element's own travel.
 *
 * Three numbers come out of it, all written straight onto the root element as
 * custom properties. None of them is React state: they update on every scroll
 * event, and re-rendering to drive a three.js value or an opacity would be pure
 * waste. The render loop reads `.current`; CSS does the rest.
 *
 *   --scene   — 0 to 1 across the camera animation, reaching 1 at HANDOFF_START
 *               and holding there while the last frame sits on screen.
 *   --handoff — 0 until the animation finishes, then 0 to 1 across the handover.
 *               Exact, and welded to the scrollbar: this is the number that
 *               holds the site still under the scroll, and a damped value there
 *               would show up as the site drifting.
 *   --reveal  — the same 0 to 1, damped. This is the *look* of the handover —
 *               the paper flooding out of the centre, the site coming up
 *               through it — so it is smooth in time rather than as coarse as
 *               the wheel. A 100px wheel notch steps `--handoff`; `--reveal`
 *               eases across it at 60fps.
 *
 * `data-phase` on the root goes scene → handoff → site, which is what the two
 * sets of chrome key off: the film's retires, the site's arrives, and the site
 * drops its transform entirely once it owns the screen.
 *
 * Everything below is written to cost as close to nothing as possible per
 * scroll event, because by the time the visitor is reading the website this
 * listener is still the thing running on every one of their scrolls:
 *
 *   - the hero's geometry is measured on resize, never per scroll, so reading
 *     scroll never forces a synchronous layout;
 *   - a custom property is only written when its value actually changed. A
 *     write to `:root` invalidates the style of every element that inherits it,
 *     which is the whole document — and once the site owns the screen all four
 *     of these values are pinned, so the scroll costs nothing at all.
 */
export function useHeroScroll(heroRef, onSceneMove) {
  const progress = useRef(0)
  const handoff = useRef(0)
  const reveal = useRef(0)

  // Kept in a ref so a caller passing an inline function can't re-subscribe the
  // listeners on every render.
  const wake = useRef(onSceneMove)
  wake.current = onSceneMove

  useEffect(() => {
    const root = document.documentElement
    let frame = 0
    let last = 0
    // First read of the session snaps rather than animates: a reload halfway
    // down the page should arrive on the site, not play the handover at it.
    let primed = false

    // Last value actually written for each, so unchanged frames stay silent.
    const written = { '--scene': '', '--handoff': '', '--reveal': '' }

    const write = (property, value) => {
      if (written[property] === value) return
      written[property] = value
      root.style.setProperty(property, value)
    }

    // Measured here, not in read(): offsetTop/offsetHeight are layout reads,
    // and doing them next to a style write on every scroll event is the classic
    // way to force a synchronous layout 60 times a second.
    let heroTop = 0
    let heroTravel = 0

    const measure = () => {
      const hero = heroRef.current
      if (!hero) return
      heroTop = hero.offsetTop
      heroTravel = hero.offsetHeight - window.innerHeight
    }

    const paint = () => write('--reveal', reveal.current.toFixed(4))

    const tick = (now) => {
      // Floored at 0 because a rAF timestamp is the time the *frame* began,
      // which can predate the performance.now() taken in the scroll handler
      // that started this loop — a negative step would run the damping
      // backwards. Ceilinged so a backgrounded tab doesn't resume with one
      // enormous step.
      const dt = Math.min(Math.max((now - last) / 1000, 0), 1 / 20)
      last = now

      const target = handoff.current
      reveal.current += (target - reveal.current) * (1 - Math.exp(-HANDOFF_SMOOTHING * dt))
      if (Math.abs(target - reveal.current) < 0.001) reveal.current = target

      paint()
      frame = reveal.current === target ? 0 : requestAnimationFrame(tick)
    }

    const read = () => {
      if (!heroRef.current) return

      const raw = heroTravel > 0 ? clamp01((window.scrollY - heroTop) / heroTravel) : 0
      const moved = progress.current

      progress.current = clamp01(raw / HANDOFF_START)
      handoff.current = clamp01((raw - HANDOFF_START) / (1 - HANDOFF_START))

      write('--scene', progress.current.toFixed(4))
      write('--handoff', handoff.current.toFixed(4))

      // `site` only at a dead-exact 1, because that is the frame the site's
      // hold-still transform is identity — anywhere earlier and dropping it
      // would jump the page by whatever was left of the handover.
      const phase = handoff.current >= 1 ? 'site' : handoff.current > 0 ? 'handoff' : 'scene'
      if (root.dataset.phase !== phase) root.dataset.phase = phase

      // Only when the camera actually has somewhere new to be. The scene is on
      // demand: it renders when this says so and idles the rest of the time, so
      // the website is never scrolling against a 60fps redraw of a still frame.
      if (progress.current !== moved) wake.current?.()

      if (!primed) {
        primed = true
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
    window.addEventListener('resize', remeasure)
    // Late-arriving fonts and images can still move the hero's own top edge.
    window.addEventListener('load', remeasure)
    return () => {
      window.removeEventListener('scroll', read)
      window.removeEventListener('resize', remeasure)
      window.removeEventListener('load', remeasure)
      if (frame) cancelAnimationFrame(frame)
    }
  }, [heroRef])

  return { progress, handoff }
}
