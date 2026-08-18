import { Fragment, useLayoutEffect, useRef } from 'react'
import { TIMELINE, beatPresence, bodyReveal, wordReveal } from '../story'
import { LOGO_ALT, LOGO_SRC } from '../config'

/**
 * The narrative layer. Deliberately DOM text rather than geometry in the canvas:
 * headings and copy stay real, selectable, translatable and crawlable.
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

    // Resolve the nodes once instead of querying the DOM every frame.
    const beats = TIMELINE.map((beat) => {
      const node = el.querySelector(`[data-beat="${beat.id}"]`)
      return {
        beat,
        node,
        words: node ? Array.from(node.querySelectorAll('[data-word]')) : [],
        last: -1,
      }
    }).filter((entry) => entry.node)

    const paint = (ms) => {
      for (const entry of beats) {
        const presence = beatPresence(entry.beat, ms)
        // Skip the write entirely when nothing moved — most frames, at rest.
        if (Math.abs(presence - entry.last) <= 0.0005) continue
        entry.last = presence
        entry.node.style.setProperty('--p', presence.toFixed(4))
        // Lets CSS drop the blur and mask compositing once a beat settles,
        // rather than layering them over the 3D scene every frame.
        entry.node.dataset.moving = presence > 0 && presence < 1 ? 'true' : 'false'
        entry.node.style.setProperty('--bp', bodyReveal(presence).toFixed(4))
        const total = entry.words.length
        entry.words.forEach((word, i) => {
          word.style.setProperty('--wp', wordReveal(presence, i, total).toFixed(4))
        })
      }
    }

    // Pointer parallax. A few pixels of counter-drift is enough to sit the type
    // in the scene rather than on a pane of glass in front of it.
    const pointer = { x: 0, y: 0, tx: 0, ty: 0 }
    const fine = window.matchMedia('(pointer: fine)')
    const still = window.matchMedia('(prefers-reduced-motion: reduce)')
    const wantsParallax = () => fine.matches && !still.matches

    const onMove = (event) => {
      pointer.tx = (event.clientX / window.innerWidth) * 2 - 1
      pointer.ty = (event.clientY / window.innerHeight) * 2 - 1
    }
    if (wantsParallax()) window.addEventListener('pointermove', onMove, { passive: true })

    // Resolve the opening frame first, then hand the choreography to JS, so the
    // overlay never paints with every beat at full opacity. Until data-live is
    // set the beats render as a plain readable stack, which is what a crawler
    // or a failed bundle is left with.
    paint(timelineRef.current)
    el.dataset.live = 'true'

    let frame
    const tick = () => {
      paint(timelineRef.current)

      if (wantsParallax()) {
        // Heavy damping: the type trails the cursor instead of tracking it.
        pointer.x += (pointer.tx - pointer.x) * 0.045
        pointer.y += (pointer.ty - pointer.y) * 0.045
        el.style.setProperty('--px', pointer.x.toFixed(4))
        el.style.setProperty('--py', pointer.y.toFixed(4))
      }

      frame = requestAnimationFrame(tick)
    }

    frame = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('pointermove', onMove)
    }
  }, [timelineRef])

  return (
    <main className="story" ref={root}>
      {TIMELINE.map((beat) => (
        <section
          className="beat"
          key={beat.id}
          data-beat={beat.id}
          data-tone={beat.tone}
          data-centred={beat.centred ? 'true' : undefined}
        >
          <div
            className="beat__inner"
            style={beat.place ? { '--x': beat.place.x, '--y': beat.place.y, '--w': beat.place.w } : undefined}
          >
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

function BeatHeading({ heading }) {
  const Tag = heading.tag
  return (
    <Tag className="beat__heading">
      {heading.lines.map((line, lineIndex) => (
        <span className="beat__line" key={lineIndex}>
          {/* Each word is its own masked element so the heading assembles
              word by word. The spaces are real text nodes between them, which
              keeps the heading readable to anything parsing the DOM. */}
          {line.split(' ').map((word, i) => (
            <Fragment key={i}>
              {i > 0 && ' '}
              <span className="beat__word" data-word>
                <span className="beat__word-inner">{word}</span>
              </span>
            </Fragment>
          ))}{' '}
        </span>
      ))}
    </Tag>
  )
}
