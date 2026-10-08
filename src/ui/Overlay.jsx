import { useEffect, useRef, useState } from 'react'
import { useProgress } from '@react-three/drei'
import { MODEL_MB } from '../config'
import { STATIONS } from '../three/stations'
import { rig } from '../three/rig'
import { scrollToStop } from '../hooks/useHeroScroll'

/** Full-bleed loading curtain, shown until the glTF and its textures resolve. */
export function Loader() {
  const { active, progress, item } = useProgress()
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    if (active) return
    const id = setTimeout(() => setDismissed(true), 600)
    return () => clearTimeout(id)
  }, [active])

  if (dismissed) return null

  return (
    <div className={`loader ${active ? '' : 'loader--done'}`}>
      <p className="loader__label">Loading scene</p>
      <div className="loader__track">
        <div
          className={`loader__bar ${progress === 0 ? 'loader__bar--indeterminate' : ''}`}
          style={progress > 0 ? { transform: `scaleX(${progress / 100})` } : undefined}
        />
      </div>
      <p className="loader__hint">
        {progress > 0
          ? `${Math.round(progress)}%`
          : MODEL_MB
            ? `streaming ${MODEL_MB}MB model`
            : 'streaming model'}
      </p>
      <p className="loader__item">{item}</p>
    </div>
  )
}

/**
 * The scene's own chrome: the brand and a way straight to the enquiry form up
 * top, the 01–05 rail down the right, and the scroll cue. All of it clears out
 * on the handover, so the site arrives with nothing of the scene left on it.
 *
 * The rail is the only part that moves on its own. A small rAF loop reads the
 * camera's position off the rig and marks the station it is on; nothing
 * re-renders.
 */
export function SceneChrome() {
  const rail = useRef(null)

  useEffect(() => {
    const el = rail.current
    if (!el) return
    let frame
    let last = ''
    const tick = () => {
      const stop = Math.round(rig.s)
      const station = stop >= 1 && stop <= STATIONS.length ? String(stop) : ''
      if (station !== last) {
        last = station
        el.dataset.active = station
      }
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [])

  // Straight to the form, not through the rest of the scene: a smooth scroll
  // would fly the camera past every station on its way down.
  const toEnquiry = (event) => {
    const target = document.getElementById('enquiry')
    if (!target) return
    event.preventDefault()
    let y = 0
    for (let node = target; node; node = node.offsetParent) y += node.offsetTop
    const clearance = parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) || 0
    window.scrollTo({ top: y - clearance, behavior: 'instant' })
  }

  return (
    <div className="scene-chrome">
      <header className="scene-bar">
        <a className="scene-bar__brand" href="#top" aria-label="SocialHat, back to the top">
          <span className="scene-bar__dot" aria-hidden="true" />
          SocialHat
        </a>
        <a className="scene-bar__cta" href="#enquiry" onClick={toEnquiry}>
          Start a project <span aria-hidden="true">→</span>
        </a>
      </header>

      <nav className="rail" ref={rail} aria-label="Process stations">
        <ol>
          {STATIONS.map((station, i) => (
            <li key={station.id} data-n={i + 1}>
              <button type="button" onClick={() => scrollToStop(i + 1)}>
                <span className="rail__num">{station.number}</span>
                <span className="visually-hidden">{station.label}</span>
              </button>
            </li>
          ))}
        </ol>
      </nav>

      <div className="scroll-cue" aria-hidden="true">
        <span className="scroll-cue__label">Scroll</span>
        <span className="scroll-cue__track">
          <span className="scroll-cue__spark" />
        </span>
      </div>
    </div>
  )
}
