import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

/**
 * The portfolio — deliverable 04.
 *
 * This is the owner's portfolio as it stands on socialhat.com.au/recent-work:
 * the same ten jobs, in the same order, under the same headings, with the same
 * words and the same videos and screenshots. What this adds is a filter over
 * it, so a prospect who wants to see websites does not have to read past the
 * video projects to find the ones that are theirs.
 *
 * The filter is by *kind of work*, and a job can be several. Monford was a
 * website, the social accounts and the video — it belongs under all three, and
 * splitting it into three cards to make the filter simpler would misrepresent
 * what SocialHat actually did. So `kinds` is a list and filtering is a
 * has-this-tag test. The tags are read off each job's own heading.
 *
 * Video cards show a still and only load YouTube when someone presses play.
 * Six embedded players up front would be six iframes' worth of script fighting
 * the 3D scene for the main thread, for videos most visitors never start.
 */

/* ==========================================================================
   The filter
   ========================================================================== */

const KINDS = [
  { id: 'video', label: 'Video', chip: 'var(--coral)' },
  { id: 'web', label: 'Web', chip: 'var(--lime)' },
  { id: 'signage', label: 'Signage', chip: 'var(--marigold)' },
  { id: 'social', label: 'Social', chip: 'var(--paper)' },
]

/* ==========================================================================
   The work

   Copied verbatim from socialhat.com.au/recent-work, in the order it appears
   there. `client` and `title` are the two halves of each heading on that page
   (split at the colon), `copy` is the paragraph under it, and `points` is
   Monford's bulleted list of services. The owner asked for their portfolio
   exactly, so the wording is theirs as published — spelling included.

   Stills live in public/images/work: the four website screenshots from the
   old site, and a frame from each YouTube video.
   ========================================================================== */

const still = (name) => `${import.meta.env.BASE_URL}images/work/${name}.jpg`

const WORK = [
  {
    id: 'telstra',
    client: 'Telstra',
    title: 'Business is Still Open Campaign Video',
    kinds: ['video'],
    youtube: '38LFLe2udwU',
    image: still('telstra'),
    copy:
      'SocialHat worked with Telstra to develop a nationwide campaign for its local business focus. This campaign involved filming in all Australia states, with the hero edit being a 30″ commercial for Instagram, with still photos for print media.',
  },
  {
    id: 'pact',
    client: 'PACT Construction',
    title: 'LinkedIn Campaign Video',
    kinds: ['video', 'social'],
    youtube: 'dCEjWyXvFmE',
    image: still('pact'),
    copy:
      'LinkedIn Video for PACT construction. PACT is a WA owned and operated commercial building company that has been in operation since 2004. We really enjoyed working with them and producing this amazing video to showcase their recent projects and show their target audience what they can do.',
  },
  {
    id: 'barker-whittle',
    client: 'Barker Whittle',
    title: 'Social Media Video Campaign',
    kinds: ['video', 'social'],
    youtube: 'T_oh-d9G2Ns',
    image: still('barker-whittle'),
    copy:
      'Social Media video campaign for Barker Whittle – Master Painters who are one of Perth’s most respected painting contractors. they came to us needing a video to help them generate leads and secure more clients.',
  },
  {
    id: 'utas',
    client: 'University of Tasmania',
    title: 'Instagram Video Campaign',
    kinds: ['video', 'social'],
    youtube: 'ufjAlcFnCHk',
    image: still('utas'),
    copy:
      'SocialHat made a series of video content for the University of Tasmania to attract more students and to show the amazing facilities that the campus has to offer.',
  },
  {
    id: 'sandvik',
    client: 'Sandvik',
    title: 'Social Media Video Campaign | Photos',
    kinds: ['video', 'social'],
    youtube: 'wAZGeZYa2rE',
    image: still('sandvik'),
    copy:
      'Sandvik chose SocialHat to film various promotional videos of large equipment transported from Perth. These videos were created in line with brand guidelines, with the purpose to use as promotional marketing material through various social media channels.',
  },
  {
    id: 'lhre',
    client: 'LHRE Group',
    title: 'Website Design | Copywriting | Branding',
    kinds: ['web'],
    image: still('lhre'),
    copy:
      'LHRE Group is a recruitment company that works with some of the biggest mining and construction companies in WA. They engaged Social Hat to build a website, write copy and build a brand for them to help engage current clients and talent and bring in new business.',
  },
  {
    id: 'monford',
    client: 'Monford',
    title: 'Website Development | Social Media Management | Video for Social Media',
    kinds: ['web', 'social', 'video'],
    image: still('monford'),
    copy:
      'Monford commissioned SocialHat to be it’s outsourced marketing and communications department. Services included:',
    points: [
      'Updating the existing website.',
      'Writing project profiles.',
      'Managing and posting on social media channels.',
      'Populating video and still content.',
      'Creating several social media video campaigns.',
    ],
  },
  {
    id: 'cowley',
    client: 'Cowley Sheetmetal',
    title: 'Website Design | Google Adwords | Social Media',
    kinds: ['web', 'social'],
    image: still('cowley'),
    copy:
      'Cowley Sheetmetal chose SocialHat to update its existing website with a more responsive and fresh design, highlighting its key selling points. SocialHat set up a google ad words campaign to bring in more business and managed analytics to improve sales further.',
  },
  {
    id: 'rise-pizza',
    client: 'Rise Pizza',
    title: 'Social Media Campaign Video',
    kinds: ['video', 'social'],
    youtube: 'dLGkkWi90GQ',
    image: still('rise-pizza'),
    copy:
      'Rise Pizza – City beach needed a social media campaign so we shot some video content for them showing off their amazing artisan pizzas.',
  },
  {
    id: 'brownstones',
    client: 'Brownstones',
    title: 'Social Media Video Campaign | TVC | Website Design',
    kinds: ['video', 'web', 'social'],
    image: still('brownstones'),
    copy:
      'Social Hat created a social media campaign for Brownstones, including a 30″ hero edit for broadcast, a more extended 2min version, and several 10″ cutdowns for social media. Social Hat also updated Brownstones’ existing website to a modern and fresh design.',
  },
]

/* ==========================================================================
   The section
   ========================================================================== */

export function Work() {
  const [kind, setKind] = useState(null)
  // State rather than a ref so the carousel re-renders once the slot exists.
  const [arrowSlot, setArrowSlot] = useState(null)

  const shown = useMemo(() => (kind ? WORK.filter((w) => w.kinds.includes(kind)) : WORK), [kind])

  // Counts sit on the chips so nobody picks a filter that empties the page
  // without warning — and so the one that is empty says so before it is pressed.
  const counts = useMemo(
    () =>
      Object.fromEntries(KINDS.map((k) => [k.id, WORK.filter((w) => w.kinds.includes(k.id)).length])),
    [],
  )

  return (
    <section className="section-pad work" id="work">
      <div className="wrap">
        <div className="section-head" data-reveal>
          <p className="eyebrow" style={{ '--chip': 'var(--lime)' }}>
            Recent work
          </p>
          <h2>Find the job that looks like yours.</h2>
          <p>
            Fifteen years of it, sorted. Pick the kind of work you&rsquo;re after rather than
            scrolling past nine things that aren&rsquo;t.
          </p>
        </div>

        <div className="work-filter" data-reveal role="group" aria-label="Filter work by type">
          <button
            type="button"
            className={kind === null ? 'pick on' : 'pick'}
            aria-pressed={kind === null}
            onClick={() => setKind(null)}
          >
            Everything <b>{WORK.length}</b>
          </button>
          {KINDS.map((k) => (
            <button
              type="button"
              key={k.id}
              className={kind === k.id ? 'pick on' : 'pick'}
              style={{ '--chip': k.chip }}
              aria-pressed={kind === k.id}
              onClick={() => setKind(kind === k.id ? null : k.id)}
            >
              {k.label} <b>{counts[k.id]}</b>
            </button>
          ))}
        </div>

        {/* The count is the live region, not each card: a screen reader should
            hear "showing 4 of 10" once, not ten cards arriving. It sits outside
            the carousel because the carousel remounts on every filter change,
            and a live region only announces changes to a node that persists. */}
        <div className="work-bar">
          <p className="work-count" role="status">
            {shown.length === WORK.length
              ? `All ${WORK.length} projects`
              : `${shown.length} of ${WORK.length} projects`}
          </p>
          {/* The carousel portals its arrows in here, next to the count and
              clear of the chat launcher pinned to the bottom corner. */}
          <div className="work-arrows" ref={setArrowSlot} />
        </div>

        {/* Keyed on the filter so the whole carousel remounts when it changes:
            the cards play their entrance again and the track starts back at the
            first card, rather than sitting scrolled halfway along a set that is
            now a different length.

            It is also why the cards do NOT carry `data-reveal` like the rest of
            the site. That observer is set up once, over the nodes present at
            mount — anything rendered later is never observed and would sit at
            opacity 0 forever. These animate themselves instead. */}
        {shown.length ? (
          <Carousel key={kind ?? 'all'} items={shown} arrowSlot={arrowSlot} />
        ) : (
          <Empty kind={KINDS.find((k) => k.id === kind)} />
        )}
      </div>
    </section>
  )
}

/* ==========================================================================
   The carousel
   ========================================================================== */

/**
 * A native horizontal scroller with snap points, not a transform-driven slider.
 * Swipe, trackpad, shift-wheel and the arrow keys all work because the browser
 * already does them; the buttons are for a mouse, and just scroll by one card.
 *
 * The progress bar and the buttons' disabled states are read back off the
 * scroll position, so whichever way someone moved the track, they agree with it.
 */
function Carousel({ items, arrowSlot }) {
  const track = useRef(null)
  const [pos, setPos] = useState({ start: true, end: items.length < 2, progress: 0, span: 1 })

  const measure = useCallback(() => {
    const el = track.current
    if (!el) return
    const max = el.scrollWidth - el.clientWidth
    setPos({
      start: el.scrollLeft <= 2,
      end: el.scrollLeft >= max - 2,
      progress: max > 0 ? el.scrollLeft / max : 0,
      // How much of the whole set is on screen at once — the thumb's length.
      span: el.scrollWidth ? el.clientWidth / el.scrollWidth : 1,
    })
  }, [])

  useEffect(() => {
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [measure])

  // To the next card's own position rather than "one card's width along", so
  // the target is always a snap point and a click mid-swipe cannot land the
  // track between two cards.
  const step = (dir) => {
    const el = track.current
    if (!el) return
    const cards = [...el.children]
    const pad = cards[0]?.offsetLeft ?? 0
    const current = cards.findIndex((c) => c.offsetLeft - pad >= el.scrollLeft - 2)
    const target = cards[Math.max(0, Math.min(cards.length - 1, (current < 0 ? cards.length - 1 : current) + dir))]
    if (!target) return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    el.scrollTo({ left: target.offsetLeft - pad, behavior: reduce ? 'auto' : 'smooth' })
  }

  const fits = pos.start && pos.end

  return (
    <div className="work-carousel">
      <div
        className="work-track"
        ref={track}
        onScroll={measure}
        tabIndex={0}
        role="region"
        aria-label="Recent work — scroll sideways for more"
      >
        {items.map((item, i) => (
          <Card key={item.id} item={item} index={i} />
        ))}
      </div>

      {/* Nothing to navigate when every card already fits on screen. */}
      {fits ? null : (
        <div className="work-progress" aria-hidden="true">
          <span
            style={{
              width: `${pos.span * 100}%`,
              left: `${pos.progress * (1 - pos.span) * 100}%`,
            }}
          />
        </div>
      )}

      {arrowSlot && !fits
        ? createPortal(
            <>
              <button
                type="button"
                className="work-arrow prev"
                onClick={() => step(-1)}
                disabled={pos.start}
                aria-label="Previous project"
              />
              <button
                type="button"
                className="work-arrow next"
                onClick={() => step(1)}
                disabled={pos.end}
                aria-label="Next project"
              />
            </>,
            arrowSlot,
          )
        : null}
    </div>
  )
}

/* ==========================================================================
   A card
   ========================================================================== */

function Card({ item, index }) {
  return (
    <article className="work-card" style={{ '--i': index }}>
      {item.youtube ? (
        <Video item={item} />
      ) : (
        <div className="work-shot">
          <img src={item.image} alt={`${item.client} — ${item.title}`} loading="lazy" />
        </div>
      )}

      <div className="work-body">
        <header className="work-head">
          <h3>{item.client}</h3>
        </header>

        <p className="work-title">{item.title}</p>
        <p className="work-blurb">{item.copy}</p>

        {item.points ? (
          <ul className="work-points">
            {item.points.map((point) => (
              <li key={point}>{point}</li>
            ))}
          </ul>
        ) : null}
      </div>
    </article>
  )
}

/**
 * The still until someone asks for the video, then the player in its place.
 *
 * Refiltering remounts the grid, which drops a playing video back to its
 * still. That is the right outcome: the card may not even be in the new set.
 */
function Video({ item }) {
  const [playing, setPlaying] = useState(false)

  if (playing) {
    return (
      <div className="work-shot is-video">
        <iframe
          src={`https://www.youtube-nocookie.com/embed/${item.youtube}?autoplay=1&rel=0&playsinline=1`}
          title={`${item.client} — ${item.title}`}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          referrerPolicy="strict-origin-when-cross-origin"
          allowFullScreen
        />
      </div>
    )
  }

  return (
    <button
      type="button"
      className="work-shot is-video"
      onClick={() => setPlaying(true)}
      aria-label={`Play video: ${item.client} — ${item.title}`}
    >
      <img src={item.image} alt="" loading="lazy" />
      <span className="work-play" aria-hidden="true" />
    </button>
  )
}

/* ==========================================================================
   Nothing here yet
   ========================================================================== */

/**
 * Signage is the honest gap.
 *
 * SocialHat runs screens across Perth and has a client on record saying they
 * grew off the back of them, but there is no signage case study anywhere on the
 * current site to carry across. The filter stays — it is a service they sell,
 * and hiding it would suggest they don't — and says plainly that the work is
 * there and the write-up isn't, with a way to ask instead of a dead end.
 */
function Empty({ kind }) {
  const label = kind ? kind.label.toLowerCase() : 'this'
  return (
    <div className="work-empty">
      <h3>No {label} write-ups on here yet.</h3>
      <p>
        There&rsquo;s plenty of the work — it just hasn&rsquo;t been written up. Ask and we&rsquo;ll
        walk you through what we&rsquo;ve got, screens included.
      </p>
      <a className="btn" href="#enquiry">
        Ask about {label} work
      </a>
    </div>
  )
}
