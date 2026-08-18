import { useLayoutEffect, useRef } from 'react'
import { TIMELINE, beatPresence, drawStagger } from '../story'
import { BeatIcon } from './Icons'
import { LOGO_ALT, LOGO_SRC } from '../config'

/**
 * The narrative layer. Deliberately DOM text rather than geometry in the canvas:
 * headings and copy stay real, selectable, translatable and crawlable.
 *
 * The type itself only ever crossfades. The one thing that animates is the icon
 * on each middle beat, which draws itself in as the beat arrives.
 *
 * Nothing here re-renders. One rAF loop reads the shared timeline position and
 * writes custom properties; CSS turns those into the choreography.
 */
export function Story({ timelineRef }) {
  const root = useRef(null)

  // Layout effect, not effect: this has to land before the first paint, or the
  // page shows one frame of the stacked fallback layout before the overlay
  // takes over.
  useLayoutEffect(() => {
    const el = root.current
    if (!el) return

    // Resolve the nodes once instead of querying the DOM every frame, and parse
    // each stroke's stagger delay here rather than reading it back per frame.
    const beats = TIMELINE.map((beat) => {
      const node = el.querySelector(`[data-beat="${beat.id}"]`)
      return {
        beat,
        node,
        strokes: node
          ? Array.from(node.querySelectorAll('[data-draw], [data-pop]')).map((element) => ({
              element,
              delay: Number(element.dataset.delay) || 0,
            }))
          : [],
        last: -1,
      }
    }).filter((entry) => entry.node)

    const paint = (ms) => {
      for (const entry of beats) {
        const presence = beatPresence(entry.beat, ms)
        // Skip the write entirely when nothing moved, which is most frames.
        if (Math.abs(presence - entry.last) <= 0.0005) continue
        entry.last = presence
        entry.node.style.setProperty('--p', presence.toFixed(4))
        for (const { element, delay } of entry.strokes) {
          element.style.setProperty('--dp', drawStagger(presence, delay).toFixed(4))
        }
      }
    }

    // Resolve the opening frame first, then hand the choreography to JS, so the
    // overlay never paints with every beat at full opacity. Until data-live is
    // set the beats render as a plain readable stack, which is what a crawler
    // or a failed bundle is left with.
    paint(timelineRef.current)
    el.dataset.live = 'true'

    let frame
    const tick = () => {
      paint(timelineRef.current)
      frame = requestAnimationFrame(tick)
    }

    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [timelineRef])

  return (
    <main className="story" ref={root}>
      {TIMELINE.map((beat) => (
        <section
          className="beat"
          key={beat.id}
          data-beat={beat.id}
          data-centred={beat.centred ? 'true' : undefined}
        >
          <div
            className="beat__inner"
            style={
              beat.place
                ? { '--x': beat.place.x, '--y': beat.place.y, '--w': beat.place.w }
                : undefined
            }
          >
            {beat.icon && <BeatIcon name={beat.icon} />}
            {beat.heading && <BeatHeading heading={beat.heading} />}
            {beat.body && <p className="beat__body">{beat.body}</p>}
            {beat.logo && (
              <img
                className="beat__logo"
                src={LOGO_SRC}
                alt={LOGO_ALT}
                width="550"
                height="276"
                decoding="async"
              />
            )}
          </div>
        </section>
      ))}
    </main>
  )
}

/**
 * The line breaks are authored, not left to the browser, so each heading lands
 * as the two-line shape it was written to be.
 */
function BeatHeading({ heading }) {
  const Tag = heading.tag
  return (
    <Tag className="beat__heading">
      {heading.lines.map((line, i) => (
        <span className="beat__line" key={i}>
          {line}{' '}
        </span>
      ))}
    </Tag>
  )
}
