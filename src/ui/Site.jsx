import { useCallback, useEffect, useRef, useState } from 'react'
import { usePhase } from '../hooks/usePhase'

/**
 * The website the film hands over to.
 *
 * Everything below the hero: the bar, the masthead, the client tickers, the
 * pile of service cards, the numbers, the crew, the ask, the footer. Plain
 * semantic DOM — real headings, real copy, real buttons — because this is the
 * half that has to be read, crawled and clicked.
 *
 * It carries its own palette on `.site`: down here Ink is the deep indigo
 * ground and Paper is the mark on it, the exact inverse of the film's tokens.
 *
 * Everything that moves in here is gated on `data-phase`. While the film is on
 * screen this block is invisible and pulled up over the last viewport of it, so
 * a marquee, a countdown or a cursor rAF running through the camera scrub is
 * work nobody can see, taken off the frame budget of the one part of the page
 * that actually needs it.
 */
export function Site({ style }) {
  const root = useRef(null)
  const awake = usePhase() === 'site'

  // Sections lift into place the first time they are reached, once each.
  useEffect(() => {
    const nodes = Array.from(root.current?.querySelectorAll('[data-reveal]') ?? [])
    if (!('IntersectionObserver' in window)) {
      nodes.forEach((node) => node.classList.add('in-view'))
      return
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue
          entry.target.classList.add('in-view')
          io.unobserve(entry.target)
        }
      },
      { threshold: 0.15 },
    )
    nodes.forEach((node) => io.observe(node))
    return () => io.disconnect()
  }, [])

  return (
    <div className="site" ref={root} style={style}>
      <div className="grain" aria-hidden="true" />
      {awake && !COARSE ? <Cursor /> : null}

      <Topbar awake={awake} />

      <main>
        <Masthead awake={awake} />
        <Clients />
        <Services awake={awake} />
        <Numbers />
        <Crew />
        <Ask />
      </main>

      <SiteFooter />
      <Console />
    </div>
  )
}

/* ==========================================================================
   Shared behaviour
   ========================================================================== */

const query = (q) => typeof window !== 'undefined' && window.matchMedia(q).matches
const REDUCED = query('(prefers-reduced-motion: reduce)')
const COARSE = query('(pointer: coarse)')

const CONFETTI = ['#FF3B5C', '#CFFF4D', '#FFB627', '#FBF2E4']

/**
 * Fourteen bits of brand, thrown from a point on the screen.
 *
 * Appended to `document.body` and driven by the Web Animations API rather than
 * React: they are born, they travel, they are gone inside a second, and none of
 * that is state anything else needs to know about.
 */
function burst(x, y) {
  if (REDUCED) return
  for (let i = 0; i < 14; i += 1) {
    const bit = document.createElement('div')
    bit.className = 'confetti-bit'
    bit.style.left = `${x}px`
    bit.style.top = `${y}px`
    bit.style.background = CONFETTI[i % CONFETTI.length]
    document.body.appendChild(bit)

    const angle = Math.random() * Math.PI * 2
    const distance = 60 + Math.random() * 90
    const dx = Math.cos(angle) * distance
    const dy = Math.sin(angle) * distance - 40

    const run = bit.animate(
      [
        { transform: 'translate(0, 0) rotate(0deg)', opacity: 1 },
        { transform: `translate(${dx}px, ${dy}px) rotate(${Math.random() * 360}deg)`, opacity: 0 },
      ],
      { duration: 700 + Math.random() * 300, easing: 'cubic-bezier(.2,.7,.3,1)' },
    )
    run.onfinish = () => bit.remove()
    run.oncancel = () => bit.remove()
  }
}

/** Confetti out of the middle of whatever was just clicked. */
function burstFrom(event) {
  const box = event.currentTarget.getBoundingClientRect()
  burst(box.left + box.width / 2, box.top + box.height / 2)
}

/**
 * Buttons that lean towards the pointer. Spread onto anything that should pull.
 * Null on a touch screen and under reduced motion, and `{...null}` is a no-op,
 * so neither case needs a branch at the call site.
 */
const MAGNETIC =
  !COARSE && !REDUCED
    ? {
        onMouseMove: (event) => {
          const el = event.currentTarget
          const box = el.getBoundingClientRect()
          const x = (event.clientX - box.left - box.width / 2) * 0.25
          const y = (event.clientY - box.top - box.height / 2) * 0.4
          el.style.transform = `translate(${x}px, ${y}px)`
        },
        onMouseLeave: (event) => {
          event.currentTarget.style.transform = ''
        },
      }
    : null

/**
 * The dot and the ring.
 *
 * Mounted only on a fine pointer and only once the site owns the screen, so
 * there is no "is this allowed" branch anywhere below. The ring lags the dot,
 * and the rAF that damps it stops the moment the two agree — a cursor is not
 * worth a permanent animation frame on a page with a canvas on it.
 */
function Cursor() {
  const dot = useRef(null)
  const ring = useRef(null)

  useEffect(() => {
    const dotEl = dot.current
    const ringEl = ring.current
    let mx = window.innerWidth / 2
    let my = window.innerHeight / 2
    let rx = mx
    let ry = my
    let frame = 0

    // Transform, never left/top: this runs on every mouse move, and a position
    // write there is a layout on each one.
    const place = (el, x, y) => {
      el.style.transform = `translate3d(${x}px, ${y}px, 0) translate(-50%, -50%)`
    }

    place(dotEl, mx, my)
    place(ringEl, rx, ry)

    const tick = () => {
      rx += (mx - rx) * 0.18
      ry += (my - ry) * 0.18
      const settled = Math.abs(mx - rx) < 0.1 && Math.abs(my - ry) < 0.1
      if (settled) {
        rx = mx
        ry = my
      }
      place(ringEl, rx, ry)
      frame = settled ? 0 : requestAnimationFrame(tick)
    }

    const move = (event) => {
      mx = event.clientX
      my = event.clientY
      place(dotEl, mx, my)
      if (!frame) frame = requestAnimationFrame(tick)
    }

    // One delegated listener instead of one pair per element: the cards and
    // buttons below mount and unmount, and this does not care.
    const over = (event) => {
      const target = event.target instanceof Element ? event.target : null
      ringEl.classList.toggle('big', Boolean(target?.closest('a, button, .service-card, [tabindex]')))
    }

    window.addEventListener('mousemove', move, { passive: true })
    window.addEventListener('mouseover', over, { passive: true })
    return () => {
      window.removeEventListener('mousemove', move)
      window.removeEventListener('mouseover', over)
      if (frame) cancelAnimationFrame(frame)
    }
  }, [])

  return (
    <>
      <div className="cursor-dot" ref={dot} aria-hidden="true" />
      <div className="cursor-ring" ref={ring} aria-hidden="true" />
    </>
  )
}

/* ==========================================================================
   Top bar
   ========================================================================== */

function Topbar({ awake }) {
  return (
    <header className="topbar">
      <div className="wrap nav-row">
        <Logo greet={awake} />
        <nav aria-label="Primary">
          <ul className="nav-links">
            <li><a href="#services">Services</a></li>
            <li><a href="#work">Work</a></li>
            <li><a href="#about">About</a></li>
            <li><a href="#contact">Contact</a></li>
          </ul>
        </nav>
        <a className="btn nav-cta" href="#contact" onClick={burstFrom} {...MAGNETIC}>
          Start a project
        </a>
      </div>
    </header>
  )
}

const WORDMARK = 'SOCIALHAT'

const LETTERS = WORDMARK.split('')

/**
 * The wordmark, one letter at a time.
 *
 * The bounce is a class on the container that the last letter takes off again
 * when its own animation ends — last because `--i` staggers the letters, so it
 * is the one that finishes. Hovering again mid-bounce is deliberately ignored
 * rather than restarting the run: restarting a CSS animation from React means
 * re-keying the letters, and swapping nodes out from under a pointer that is
 * sitting on them feeds the synthetic mouseenter that caused the swap.
 */
function Logo({ greet = false }) {
  const [bouncing, setBouncing] = useState(false)
  const play = () => setBouncing(true)

  useEffect(() => {
    if (!greet || REDUCED) return
    const id = setTimeout(play, 600)
    return () => clearTimeout(id)
  }, [greet])

  return (
    <a className="logo" href="#top" onMouseEnter={REDUCED ? undefined : play}>
      <span className="dot" aria-hidden="true" />
      <span className={bouncing ? 'logo-text bounce' : 'logo-text'}>
        {LETTERS.map((letter, i) => (
          // Index as key: the string is a constant, and the position is exactly
          // what `--i` staggers the bounce by.
          <span
            className="kletter"
            style={{ '--i': i }}
            key={i}
            onAnimationEnd={i === LETTERS.length - 1 ? () => setBouncing(false) : undefined}
          >
            {letter}
          </span>
        ))}
      </span>
    </a>
  )
}

/* ==========================================================================
   Masthead
   ========================================================================== */

function Masthead({ awake }) {
  const heading = useRef(null)

  // The headline drops a frame every so often. Off a class rather than state:
  // it is 320ms of decoration and has no business re-rendering the section.
  useEffect(() => {
    if (!awake || REDUCED) return
    let release = 0
    const id = setInterval(() => {
      const el = heading.current
      if (!el) return
      el.classList.add('glitching')
      release = setTimeout(() => el.classList.remove('glitching'), 320)
    }, 6400)
    return () => {
      clearInterval(id)
      clearTimeout(release)
    }
  }, [awake])

  return (
    <section className="masthead">
      <div className="wrap masthead-inner">
        <p className="eyebrow" style={{ '--chip': 'var(--lime)' }}>
          Perth digital marketing &amp; content agency
        </p>

        <h1 ref={heading} data-reveal>
          Stop the
          <br />
          <span className="accent">scroll.</span>
          <span className="caret" aria-hidden="true">_</span>
        </h1>

        <p className="masthead-sub" data-reveal>
          We build the sites, the ads, the videos and the screens that make people put their thumb
          down. Fifteen plus years turning WA businesses into brands people actually notice.
        </p>

        <div className="masthead-actions" data-reveal>
          <a className="btn" href="#contact" onClick={burstFrom} {...MAGNETIC}>
            Start a project
          </a>
          <a className="btn outline" href="#services" {...MAGNETIC}>
            See what we do
          </a>
        </div>

        <VectorTool />
        <Palette />
      </div>

      <Ticker items={SERVICES.map((service) => service.title)} />
    </section>
  )
}

/* ==========================================================================
   Vector tool
   The one toy on the page: an unfinished loop with a loose end. Drag it back
   onto the anchor and the shape closes.
   ========================================================================== */

const VT = {
  cx: 150,
  cy: 150,
  r: 90,
  /** Fixed anchor, top of the circle. */
  anchor: -90,
  /** How close the loose end has to get, in degrees, to count as closed. */
  snap: 10,
}

const OPEN_HINT = '// unfinished. drag the loose end to close the loop'
const CLOSED_HINT = '// there it is. bet i made ya stop scrolling'

const pointOn = (deg) => {
  const rad = (deg * Math.PI) / 180
  return { x: VT.cx + VT.r * Math.cos(rad), y: VT.cy + VT.r * Math.sin(rad) }
}

function VectorTool() {
  const svg = useRef(null)
  const arc = useRef(null)
  const node = useRef(null)
  const hit = useRef(null)
  const sparkGroup = useRef(null)

  // Where the loose end is, and whether a drag is in progress. Out of React on
  // purpose: this is rewritten on every pointermove, and it is five attribute
  // writes on nodes nothing else owns.
  const geometry = useRef({ deg: VT.anchor + 130, dragging: false })

  // Whether the loop is closed, and where the payoff has got to, are the two
  // things that are not per-move — they change twice a drag at most. They live
  // in state so a re-render from anywhere above cannot quietly undo them.
  const [won, setWon] = useState(false)
  const [beat, setBeat] = useState('idle')

  // Mirrors `won` so the crossing can be detected inside redraw without reading
  // state through a closure or firing the confetti from a state updater — which
  // StrictMode would call twice.
  const closed = useRef(false)

  const redraw = useCallback(() => {
    const here = geometry.current
    const a = pointOn(VT.anchor)
    const b = pointOn(here.deg)

    // The gap the loose end has opened, measured the way it was dragged; the
    // arc drawn is everything that is left of the circle.
    const gap = (((here.deg - VT.anchor) % 360) + 360) % 360
    const drawn = (360 - gap) % 360
    const slack = Math.min(gap, 360 - gap)

    arc.current.setAttribute(
      'd',
      `M${b.x},${b.y} A ${VT.r},${VT.r} 0 ${drawn > 180 ? 1 : 0} 1 ${a.x},${a.y}`,
    )
    node.current.setAttribute('cx', b.x)
    node.current.setAttribute('cy', b.y)
    hit.current.setAttribute('cx', b.x)
    hit.current.setAttribute('cy', b.y)
    // Not rendered from JSX, so React never fights over it.
    hit.current.setAttribute('aria-valuenow', Math.round(slack))
    sparkGroup.current.setAttribute('transform', `translate(${b.x},${b.y})`)

    const now = slack < VT.snap
    if (now === closed.current) return
    closed.current = now

    if (now) {
      // Confetti at the join, and the payoff starts.
      const box = svg.current.getBoundingClientRect()
      burst(box.left + (b.x / 300) * box.width, box.top + (b.y / 300) * box.height)
    }
    setWon(now)
    setBeat(now ? 'wink' : 'idle')
  }, [])

  // The wink holds, then hands over to the line.
  useEffect(() => {
    if (beat !== 'wink') return
    const id = setTimeout(() => setBeat('said'), 850)
    return () => clearTimeout(id)
  }, [beat])

  useEffect(() => {
    redraw()
  }, [redraw])

  const angleAt = (clientX, clientY) => {
    const box = svg.current.getBoundingClientRect()
    const x = ((clientX - box.left) / box.width) * 300
    const y = ((clientY - box.top) / box.height) * 300
    return ((Math.atan2(y - VT.cy, x - VT.cx) * 180) / Math.PI + 360) % 360
  }

  const grab = (event) => {
    event.preventDefault()
    geometry.current.dragging = true
    event.currentTarget.setPointerCapture(event.pointerId)
    geometry.current.deg = angleAt(event.clientX, event.clientY)
    redraw()
  }

  const drag = (event) => {
    if (!geometry.current.dragging) return
    geometry.current.deg = angleAt(event.clientX, event.clientY)
    redraw()
  }

  const drop = () => {
    geometry.current.dragging = false
  }

  const nudge = (event) => {
    const step = event.shiftKey ? 15 : 4
    if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      geometry.current.deg = (geometry.current.deg - step + 360) % 360
    } else if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      geometry.current.deg = (geometry.current.deg + step) % 360
    } else {
      return
    }
    event.preventDefault()
    redraw()
  }

  return (
    <div className="vector-tool">
      <svg
        ref={svg}
        viewBox="0 0 300 300"
        onPointerDown={grab}
        onPointerMove={drag}
        onPointerUp={drop}
        onPointerCancel={drop}
      >
        <circle className={won ? 'vt-full show' : 'vt-full'} cx={VT.cx} cy={VT.cy} r={VT.r} />
        {/* `d`, `cx`/`cy` and the spark's transform are deliberately absent
            from the JSX: redraw owns them, and a prop React is not rendering is
            a prop React can never reset. */}
        <path className={won ? 'vt-path hide' : 'vt-path'} ref={arc} />
        <rect className="vt-anchor" x="146" y="56" width="8" height="8" />
        <circle
          className="vt-hit"
          ref={hit}
          r="22"
          tabIndex={0}
          role="slider"
          aria-label="Drag the loose end to close the loop"
          aria-valuemin={0}
          aria-valuemax={180}
          onKeyDown={nudge}
        />
        <circle className="vt-node" ref={node} r="9" />
        <g ref={sparkGroup}>
          <path
            className={won ? 'vt-spark show' : 'vt-spark'}
            d="M0,-9 L2.4,-2.4 L9,0 L2.4,2.4 L0,9 L-2.4,2.4 L-9,0 L-2.4,-2.4 Z"
          />
        </g>
        <text
          className={beat === 'wink' ? 'vt-face show' : 'vt-face'}
          x={VT.cx}
          y={VT.cy}
          dominantBaseline="central"
          textAnchor="middle"
        >
          {'😉'}
        </text>
        <text
          className={beat === 'said' ? 'vt-message show' : 'vt-message'}
          x={VT.cx}
          y="144"
          textAnchor="middle"
        >
          That easy right?
          <tspan x={VT.cx} dy="16">
            that&rsquo;s how we do it too!
          </tspan>
        </text>
      </svg>
      <p className={won ? 'vt-hint won' : 'vt-hint'}>{won ? CLOSED_HINT : OPEN_HINT}</p>
    </div>
  )
}

/* ==========================================================================
   Palette
   ========================================================================== */

const SWATCHES = [
  ['coral', '#FF3B5C'],
  ['lime', '#CFFF4D'],
  ['marigold', '#FFB627'],
  ['paper', '#FBF2E4'],
]

function Palette() {
  const [copied, setCopied] = useState(null)

  useEffect(() => {
    if (!copied) return
    const id = setTimeout(() => setCopied(null), 1100)
    return () => clearTimeout(id)
  }, [copied])

  const copy = async (hex) => {
    try {
      await navigator.clipboard.writeText(hex)
      setCopied(hex)
    } catch {
      // No clipboard permission, or no clipboard. The tip stays as the hex, so
      // it can still be read off the screen.
    }
  }

  return (
    <div className="palette-row">
      {SWATCHES.map(([token, hex]) => (
        <button
          className="swatch"
          type="button"
          key={token}
          style={{ background: `var(--${token})` }}
          aria-label={`Copy ${hex}`}
          onClick={() => copy(hex)}
        >
          <span className={copied === hex ? 'swatch-tip copied' : 'swatch-tip'}>
            {copied === hex ? 'Copied' : hex}
          </span>
        </button>
      ))}
    </div>
  )
}

/* ==========================================================================
   Tickers
   ========================================================================== */

/** Doubled, because the marquee wraps by travelling exactly half its width. */
function Ticker({ items, tone = '', reverse = false, tilt }) {
  const lane = [...items, ...items]
  return (
    <div
      className={tone ? `ticker-strip ${tone}` : 'ticker-strip'}
      style={tilt ? { transform: `rotate(${tilt}deg)` } : undefined}
      aria-hidden="true"
    >
      <div className={reverse ? 'ticker-track reverse' : 'ticker-track'}>
        {lane.map((item, i) => (
          // Index as key, because the lane is deliberately two of the same list.
          <span key={i}>{item}</span>
        ))}
      </div>
    </div>
  )
}

function Clients() {
  return (
    <section className="clients-band" id="work">
      <Ticker items={CLIENTS_A} tone="alt" tilt={1.2} />
      <Ticker items={CLIENTS_B} tilt={-1.2} reverse />
    </section>
  )
}

/* ==========================================================================
   Services
   ========================================================================== */

function Services({ awake }) {
  return (
    <section className="section-pad" id="services">
      <div className="wrap services-layout">
        <div className="section-head" data-reveal>
          <p className="eyebrow" style={{ '--chip': 'var(--coral)' }}>
            What we do
          </p>
          <h2>Five ways we get you seen.</h2>
          <p>
            Tap a card. Every service comes with a straight answer about what&rsquo;s actually
            included, no fluff.
          </p>
        </div>

        <div className="service-stack">
          {SERVICES.map((service, i) => (
            <ServiceCard key={service.kind} service={service} index={i} awake={awake} />
          ))}
        </div>
      </div>
    </section>
  )
}

const TERM_LINE = 'npm run stop-the-scroll'
const FOLLOWERS = 128

/**
 * One sticker on the pile.
 *
 * The whole card is the click target, and `.service-more` is a real button
 * inside it that never handles its own click — the event bubbles to the card,
 * so a mouse can hit anywhere and a keyboard still gets a labelled control with
 * `aria-expanded` on it, instead of a `div` wearing `role="button"`.
 *
 * Every kind declares all five pieces of state and runs all five effects; four
 * of them return immediately. Hooks cannot be conditional, and a card each for
 * five variations of "a number that counts" is not worth the file.
 */
function ServiceCard({ service, index, awake }) {
  const [open, setOpen] = useState(false)
  const [typed, setTyped] = useState('')
  const [seconds, setSeconds] = useState(0)
  const [skip, setSkip] = useState(5)
  const [followers, setFollowers] = useState(0)
  const [hearts, setHearts] = useState([])
  const [liked, setLiked] = useState(false)

  const { kind } = service
  const detailId = `svc-${kind}`

  // 01 — the line types itself out, and again on every reopen.
  useEffect(() => {
    if (kind !== 'webdev' || !open) return
    if (REDUCED) {
      setTyped(TERM_LINE)
      return
    }
    setTyped('')
    let i = 0
    const id = setInterval(() => {
      i += 1
      setTyped(TERM_LINE.slice(0, i))
      if (i >= TERM_LINE.length) clearInterval(id)
    }, 55)
    return () => clearInterval(id)
  }, [kind, open])

  // 02 — the countdown nobody ever waits out. Runs whenever the site is on
  // screen, open or not: it is the joke that it is always counting.
  useEffect(() => {
    if (kind !== 'ads' || !awake || REDUCED) return
    const id = setInterval(() => setSkip((n) => (n <= 0 ? 5 : n - 1)), 1000)
    return () => clearInterval(id)
  }, [kind, awake])

  // 03 — timecode, rolling for as long as the card is open.
  useEffect(() => {
    if (kind !== 'content' || !open || REDUCED) return
    setSeconds(0)
    const id = setInterval(() => setSeconds((s) => s + 1), 1000)
    return () => clearInterval(id)
  }, [kind, open])

  // 04 — the follower count rolls up to a number, easing as it lands.
  useEffect(() => {
    if (kind !== 'social' || !open) return
    if (REDUCED) {
      setFollowers(FOLLOWERS)
      return
    }
    setFollowers(0)
    let current = 0
    const id = setInterval(() => {
      current += Math.ceil((FOLLOWERS - current) / 6) || 1
      if (current >= FOLLOWERS) {
        current = FOLLOWERS
        clearInterval(id)
      }
      setFollowers(current)
    }, 60)
    return () => clearInterval(id)
  }, [kind, open])

  const like = (event) => {
    // The card underneath is the toggle; a like is not a toggle.
    event.stopPropagation()
    setLiked(true)
    if (REDUCED) return
    const born = Date.now()
    setHearts((list) => [
      ...list,
      ...Array.from({ length: 5 }, (unused, i) => ({
        id: `${born}-${i}`,
        offset: 14 + Math.random() * 10,
        delay: i * 70,
      })),
    ])
  }

  const clock = [Math.floor(seconds / 3600), Math.floor((seconds % 3600) / 60), seconds % 60]
    .map((part) => String(part).padStart(2, '0'))
    .join(':')

  return (
    <div
      className={[
        'service-card',
        kind === 'content' ? 'viewfinder' : '',
        open ? 'open' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      data-kind={kind}
      data-reveal
      onClick={() => setOpen((was) => !was)}
    >
      <span className="service-num">{String(index + 1).padStart(2, '0')}</span>

      {kind === 'ads' ? (
        <span className="skip-badge">{skip === 0 ? 'Skip Ad' : `Skip Ad ${skip}`}</span>
      ) : null}

      {kind === 'content' ? (
        <span className="rec-dot" aria-hidden="true">
          <i />
          REC
        </span>
      ) : null}

      {kind === 'social' ? (
        <>
          <button
            className="heart-trigger"
            type="button"
            aria-label="Like"
            aria-pressed={liked}
            onClick={like}
          >
            {liked ? '♥' : '♡'}
          </button>
          {hearts.map((heart) => (
            <span
              className="heart-pop"
              key={heart.id}
              aria-hidden="true"
              style={{ right: `${heart.offset}px`, top: '18px', animationDelay: `${heart.delay}ms` }}
              onAnimationEnd={() => setHearts((list) => list.filter((h) => h.id !== heart.id))}
            >
              {'♥'}
            </span>
          ))}
        </>
      ) : null}

      {kind === 'signage' ? <div className="scanline" aria-hidden="true" /> : null}

      <span className="service-tag">{service.tag}</span>
      <h3>{service.title}</h3>
      <p className="blurb">{service.blurb}</p>

      <div className="service-detail" id={detailId}>
        <p>{service.detail}</p>

        {kind === 'webdev' ? (
          <div className="term-line">
            ${' '}
            <span className="type-text">{typed}</span>
          </div>
        ) : null}

        {kind === 'content' ? <div className="timecode">{clock}</div> : null}

        {kind === 'social' ? (
          <div className="follow-counter">+{followers} followers today</div>
        ) : null}
      </div>

      {/* No handler of its own: the click bubbles to the card, which owns the
          state. Enter and Space on a real button produce that same click. */}
      <button className="service-more" type="button" aria-expanded={open} aria-controls={detailId}>
        <span className="plus" aria-hidden="true">
          +
        </span>{' '}
        More detail
      </button>
    </div>
  )
}

/* ==========================================================================
   Numbers, crew, the ask
   ========================================================================== */

function Numbers() {
  return (
    <section className="stats">
      <div className="wrap section-pad">
        <div className="stats-grid">
          {STATS.map(([figure, label]) => (
            <div key={label} data-reveal>
              <div className="stat-big">{figure}</div>
              <div className="stat-label">{label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function Crew() {
  return (
    <section className="section-pad" id="about">
      <div className="wrap about-grid">
        <div data-reveal>
          <p className="eyebrow" style={{ '--chip': 'var(--marigold)' }}>
            Who we are
          </p>
          <h2 className="head-2">Video people. Photographers. Web builders. All in one crew.</h2>
        </div>

        <div className="about-copy" data-reveal>
          <p>
            We&rsquo;re a Perth crew of video makers, photographers, web builders, ad strategists
            and designers who&rsquo;ve been doing this for <strong>over 15 years</strong>. We
            started SocialHat because good marketing shouldn&rsquo;t need a marketing degree to
            understand or a bottomless budget to afford.
          </p>
          <p>
            We&rsquo;ve built for mining companies, government departments, universities and
            homegrown WA brands, and we bring the same project management and business sense to
            every one of them. No jargon, no hand waving, just work that gets seen.
          </p>
          <div className="chip-row">
            {DISCIPLINES.map((chip) => (
              <span className="chip" key={chip}>
                {chip}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

function Ask() {
  return (
    <section className="cta-band" id="contact">
      <div className="wrap" data-reveal>
        <p className="eyebrow" style={{ '--chip': 'var(--ink)' }}>
          Let&rsquo;s talk
        </p>
        <h2>
          Let&rsquo;s make
          <br />
          some noise.
        </h2>
        <p>
          Tell us what you&rsquo;re building. We&rsquo;ll tell you how to get it in front of the
          right people.
        </p>
        <div className="cta-actions">
          <a className="btn" href="mailto:info@socialhat.com.au" onClick={burstFrom} {...MAGNETIC}>
            info@socialhat.com.au
          </a>
          <a className="btn outline" href="tel:0892850811" onClick={burstFrom} {...MAGNETIC}>
            08 9285 0811
          </a>
        </div>
      </div>
    </section>
  )
}

/* ==========================================================================
   Footer
   ========================================================================== */

function SiteFooter() {
  return (
    <footer>
      <div className="wrap">
        <div className="footer-top">
          <div className="footer-brand">
            <Logo />
            <p>
              Perth&rsquo;s agency for brands who&rsquo;d rather be loud than invisible. Web, ads,
              content and signage, built to get seen.
            </p>
            <div className="socials">
              {SOCIALS.map(([label, href, path]) => (
                <a key={label} href={href} aria-label={label} target="_blank" rel="noopener noreferrer">
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d={path} />
                  </svg>
                </a>
              ))}
            </div>
          </div>

          <div className="footer-cols">
            <div className="footer-col">
              <h4>Services</h4>
              {SERVICES.map((service) => (
                <a href="#services" key={service.kind}>
                  {service.title}
                </a>
              ))}
            </div>
            <div className="footer-col">
              <h4>Studio</h4>
              <a href="#about">About</a>
              <a href="#work">Clients</a>
              <a href="#contact">Contact</a>
            </div>
            <div className="footer-col">
              <h4>Find us</h4>
              <a href="mailto:info@socialhat.com.au">info@socialhat.com.au</a>
              <a href="tel:0892850811">08 9285 0811</a>
              <a
                href="https://maps.google.com/?q=41A Kirwan Street, Floreat, Western Australia"
                target="_blank"
                rel="noopener noreferrer"
              >
                41A Kirwan St, Floreat WA
              </a>
            </div>
          </div>
        </div>

        <div className="footer-bottom">
          <span>&copy; {new Date().getFullYear()} SocialHat, Floreat, Perth WA.</span>
          <span>Image is everything, the message is the key.</span>
        </div>
      </div>
    </footer>
  )
}

/* ==========================================================================
   Console
   ========================================================================== */

console.log(
  '%c SOCIALHAT ',
  'background:#CFFF4D;color:#150E38;font-weight:bold;font-size:14px;padding:4px 8px;border-radius:4px;',
)
console.log(
  '%cnice devtools. if you can read this, come build with us: info@socialhat.com.au',
  'color:#FF3B5C;font-family:monospace;',
)

const SCRIPT = [
  '$ whoami',
  '> a Perth crew that builds, shoots and ships',
  '$ services --list',
  '> web dev, ads, content, social, signage',
  '$ status',
  '> stop-the-scroll: ACTIVE',
].join('\n')

function Console() {
  const [open, setOpen] = useState(false)
  const [typed, setTyped] = useState('')
  const done = typed.length >= SCRIPT.length

  useEffect(() => {
    if (!open || done) return
    if (REDUCED) {
      setTyped(SCRIPT)
      return
    }
    let i = typed.length
    const id = setInterval(() => {
      i += 1
      setTyped(SCRIPT.slice(0, i))
      if (i >= SCRIPT.length) clearInterval(id)
    }, 18)
    return () => clearInterval(id)
    // `typed` is read once, to resume where it left off, and deliberately kept
    // out of the deps: re-arming on it would tear the timer down and rebuild it
    // on every letter.
  }, [open, done]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <button
        className="egg-tag"
        type="button"
        aria-expanded={open}
        aria-controls="egg-panel"
        onClick={() => setOpen((was) => !was)}
      >
        &lt;/&gt;
      </button>
      <div className={open ? 'egg-panel open' : 'egg-panel'} id="egg-panel" role="dialog" aria-label="Console">
        <div className="egg-chrome" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
        <div className="egg-body">
          {typed}
          {done ? <span className="egg-cursor">_</span> : null}
        </div>
      </div>
    </>
  )
}

/* ==========================================================================
   Copy
   ========================================================================== */

const SERVICES = [
  {
    kind: 'webdev',
    tag: 'Build',
    title: 'Web Development',
    blurb: 'Sites that convert, not just sit there looking pretty.',
    detail:
      'New builds, redesigns and rescues for sites that stopped pulling their weight. Fast, mobile first, built to actually rank.',
  },
  {
    kind: 'ads',
    tag: 'Grow',
    title: 'Advertising Campaigns',
    blurb: 'Leads on tap, minus the guesswork.',
    detail:
      'Google Ads and commercial campaigns run by people who read the numbers every day, not once a month.',
  },
  {
    kind: 'content',
    tag: 'Create',
    title: 'Content Creation',
    blurb: 'Video and photo built to stop thumbs mid scroll.',
    detail:
      'Shoots, edits and campaigns designed for the platforms your customers are already glued to.',
  },
  {
    kind: 'social',
    tag: 'Amplify',
    title: 'Social Media Acceleration',
    blurb: 'A following that actually shows up when you post.',
    detail:
      'Strategy, set up and day to day management across every platform that matters to your audience.',
  },
  {
    kind: 'signage',
    tag: 'Display',
    title: 'Digital Signage',
    blurb: 'Your message, live, in the real world.',
    detail:
      'Screens across Perth ready to carry your campaign, plus the option to host a screen of your own and earn from it.',
  },
]

const CLIENTS_A = [
  'Sandvik',
  'Wesfarmers',
  'Curtin University',
  'City of Vincent',
  'Mount Gibson',
  'Monadelphous',
]

const CLIENTS_B = [
  'Georgiou',
  'Probuild',
  'Pindan',
  'Gold Roads',
  'Summit Homes',
  'Dept of Communities',
  'Dept of Health & Aged Care',
]

const STATS = [
  ['15+', 'Years in business'],
  ['5', 'Services under one roof'],
  ['WA', 'Born, raised, still here'],
  ['1', 'Team that handles it all'],
]

const DISCIPLINES = ['Floreat, WA', 'Video', 'Photo', 'Web', 'Ads', 'Signage']

const SOCIALS = [
  [
    'Facebook',
    'https://www.facebook.com/socialhat/',
    'M13 22v-9h3l1-4h-4V7c0-1.1.3-1.8 1.9-1.8H17V1.1C16.7 1 15.6 1 14.4 1 11.8 1 10 2.6 10 5.4V9H7v4h3v9h3z',
  ],
  [
    'Instagram',
    'https://www.instagram.com/socialhat.media',
    'M12 2c2.7 0 3.1 0 4.1.1 1.1 0 1.8.2 2.5.5.6.3 1.1.6 1.6 1.1.5.5.8 1 1.1 1.6.3.7.5 1.4.5 2.5.1 1 .1 1.4.1 4.1s0 3.1-.1 4.1c0 1.1-.2 1.8-.5 2.5-.3.6-.6 1.1-1.1 1.6-.5.5-1 .8-1.6 1.1-.7.3-1.4.5-2.5.5-1 .1-1.4.1-4.1.1s-3.1 0-4.1-.1c-1.1 0-1.8-.2-2.5-.5-.6-.3-1.1-.6-1.6-1.1-.5-.5-.8-1-1.1-1.6-.3-.7-.5-1.4-.5-2.5C2 15.1 2 14.7 2 12s0-3.1.1-4.1c0-1.1.2-1.8.5-2.5.3-.6.6-1.1 1.1-1.6.5-.5 1-.8 1.6-1.1.7-.3 1.4-.5 2.5-.5C8.9 2 9.3 2 12 2zm0 5a5 5 0 100 10 5 5 0 000-10zm0 8.2A3.2 3.2 0 1112 8.8a3.2 3.2 0 010 6.4zm5.2-8.4a1.2 1.2 0 100-2.4 1.2 1.2 0 000 2.4z',
  ],
  [
    'YouTube',
    'https://www.youtube.com/channel/UCCzxGJ2iy8-uyA-4VwaThCA/featured',
    'M23 12s0-3.4-.4-5c-.3-.9-1-1.6-1.9-1.9C19 4.7 12 4.7 12 4.7s-7 0-8.7.4c-.9.3-1.6 1-1.9 1.9C1 8.6 1 12 1 12s0 3.4.4 5c.3.9 1 1.6 1.9 1.9 1.7.4 8.7.4 8.7.4s7 0 8.7-.4c.9-.3 1.6-1 1.9-1.9.4-1.6.4-5 .4-5zM9.8 15.3V8.7l5.7 3.3-5.7 3.3z',
  ],
]
