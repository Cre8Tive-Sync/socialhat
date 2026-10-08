import { useLayoutEffect, useRef } from 'react'
import { COPY, STATIONS } from '../three/stations'
import { LAST_STOP, rig, smootherstep } from '../three/rig'

/**
 * The words over the process scene. DOM rather than geometry, so headings and
 * copy stay real, selectable and crawlable.
 *
 * Each block is present around the stops it belongs to and gone between them,
 * keyed to the camera's own position (rig.s) rather than to raw scroll, so the
 * copy lands with the shot it describes. The headline belongs to both wide
 * shots — the scene opens and closes on it.
 *
 * Nothing here re-renders. One rAF loop writes `--p` per block; CSS does the
 * rest.
 */

/** How quickly a block clears as the camera leaves its stop, in stops. */
const FALLOFF = 0.42

const presence = (stops) =>
  Math.max(...stops.map((stop) => smootherstep(1 - Math.abs(rig.s - stop) / FALLOFF)))

const BLOCKS = [
  { id: 'intro', stops: [0, LAST_STOP] },
  ...STATIONS.map((station, i) => ({ id: station.id, stops: [i + 1] })),
  { id: 'outro', stops: [LAST_STOP] },
]

export function Story() {
  const root = useRef(null)

  useLayoutEffect(() => {
    const el = root.current
    if (!el) return

    const blocks = BLOCKS.map((block) => ({
      ...block,
      node: el.querySelector(`[data-block="${block.id}"]`),
      last: -1,
    })).filter((block) => block.node)

    // The close-ups put a neighbouring platform behind the station card, so the
    // card brings a shade of the night in with it, down the left of the frame.
    let lastScrim = -1

    const paint = () => {
      let scrim = 0
      for (const block of blocks) {
        const p = presence(block.stops)
        if (block.id !== 'intro' && block.id !== 'outro') scrim = Math.max(scrim, p)
        if (Math.abs(p - block.last) <= 0.0005) continue
        block.last = p
        block.node.style.setProperty('--p', p.toFixed(4))
        block.node.style.visibility = p > 0.001 ? 'visible' : 'hidden'
      }
      if (Math.abs(scrim - lastScrim) > 0.0005) {
        lastScrim = scrim
        el.style.setProperty('--scrim', scrim.toFixed(4))
      }
    }

    // Resolve the opening frame first, then hand over to the loop, so nothing
    // paints with every block at full opacity. Until data-live is set the
    // blocks render as a plain readable stack — what a crawler or a failed
    // bundle is left with.
    paint()
    el.dataset.live = 'true'

    let frame
    const tick = () => {
      paint()
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [])

  const intro = COPY[0]
  const outro = COPY[LAST_STOP]

  return (
    <main className="story" ref={root}>
      <div className="story__scrim" aria-hidden="true" />

      <section className="block block--intro" data-block="intro">
        <p className="block__kicker">
          <span className="block__kicker-dot" aria-hidden="true" />
          {intro.kicker}
        </p>
        <h1 className="block__headline">
          <span className="block__line">{intro.lines[0]} </span>
          <span className="block__line block__line--hot">{intro.lines[1]}</span>
        </h1>
        <p className="block__body">{intro.body}</p>
      </section>

      {STATIONS.map((station, i) => (
        <section className="block block--station" data-block={station.id} key={station.id}>
          <p className="block__number">{station.number}</p>
          <h2 className="block__title">{station.label}</h2>
          <p className="block__body">{COPY[i + 1].body}</p>
        </section>
      ))}

      <section className="block block--outro" data-block="outro" aria-label="What we do">
        <p className="note">
          {outro.note.map((word, i) => (
            <span key={i} className="note__line">
              {word}{' '}
            </span>
          ))}
        </p>
        <p className="stamp">
          {outro.stamp.map((word) => (
            <span key={word}>{word} </span>
          ))}
        </p>
      </section>
    </main>
  )
}
