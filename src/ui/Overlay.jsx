import { useEffect, useRef, useState } from 'react'
import { useProgress } from '@react-three/drei'

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
        {progress > 0 ? `${Math.round(progress)}%` : 'streaming 60MB model'}
      </p>
      <p className="loader__item">{item}</p>
    </div>
  )
}

/**
 * Scrub bar plus the scroll cue. Both write to the DOM directly from the scroll
 * listener, so scrolling never triggers a React render.
 *
 * The cue is set in the brand's dark ink because the opening shot is a sheet of
 * white sketch paper, and it is the only thing on screen that has to compete
 * with that. It retires as soon as the visitor has taken the hint.
 */
export function ScrollProgressBar() {
  const bar = useRef(null)
  const cue = useRef(null)

  useEffect(() => {
    const update = () => {
      const scrollable = document.documentElement.scrollHeight - window.innerHeight
      const value = scrollable > 0 ? window.scrollY / scrollable : 0
      if (bar.current) bar.current.style.transform = `scaleX(${value})`
      if (cue.current) cue.current.style.opacity = value > 0.015 ? '0' : '1'
    }
    update()
    window.addEventListener('scroll', update, { passive: true })
    window.addEventListener('resize', update)
    return () => {
      window.removeEventListener('scroll', update)
      window.removeEventListener('resize', update)
    }
  }, [])

  return (
    <>
      <div className="scrubber">
        <div className="scrubber__fill" ref={bar} />
      </div>

      <div className="scroll-cue" ref={cue}>
        <span className="scroll-cue__label">Scroll</span>
        <span className="scroll-cue__track">
          <span className="scroll-cue__spark" />
        </span>
      </div>
    </>
  )
}
