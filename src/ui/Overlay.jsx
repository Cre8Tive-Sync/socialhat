import { useEffect, useState } from 'react'
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
 * Scrub bar and scroll cue — the film's own chrome, and nothing else's.
 *
 * Not a line of JavaScript here: useHeroScroll writes `--scene` and `--handoff`
 * onto the root element, and CSS turns them into a bar width, a cue that retires
 * once the visitor has taken the hint, and chrome that clears out of the way
 * when the site takes the screen.
 *
 * The cue is set in the brand's dark ink because the opening shot is a sheet of
 * white sketch paper, and that is the only thing it has to compete with.
 */
export function SceneChrome() {
  return (
    <div className="scene-chrome" aria-hidden="true">
      <div className="scrubber">
        <div className="scrubber__fill" />
      </div>

      <div className="scroll-cue">
        <span className="scroll-cue__label">Scroll</span>
        <span className="scroll-cue__track">
          <span className="scroll-cue__spark" />
        </span>
      </div>
    </div>
  )
}
