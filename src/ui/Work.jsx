import { useMemo, useState } from 'react'

/**
 * The portfolio — deliverable 04.
 *
 * The live Recent Work page is one unsorted scroll: a Telstra TVC, a
 * recruitment website and a pizza shop's social campaign stacked in the order
 * they happened to be added. A prospect who wants to see websites has to read
 * past nine video projects to find the two that are theirs, and mostly doesn't.
 * This is the same ten jobs with a filter over them.
 *
 * The filter is by *kind of work*, and a job can be several. Monford was a
 * website, the social accounts and the video — it belongs under all three, and
 * splitting it into three cards to make the filter simpler would misrepresent
 * what SocialHat actually did. So `kinds` is a list and filtering is a
 * has-this-tag test.
 *
 * Cards are built to carry a still and to work without one. Nothing here has
 * artwork yet; `image` is the slot, and until it is filled a card is a
 * typographic tile rather than a grey rectangle apologising for itself.
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

   Every line below is from socialhat.com.au/recent-work — the clients, the
   briefs and the service breakdowns are theirs, tightened into a sentence that
   says what the job was and what it was for. Nothing invented: no view counts,
   no lead numbers, no awards. A case study that claims a result the business
   cannot stand behind is worse than one that just says what was made.
   ========================================================================== */

const WORK = [
  {
    id: 'telstra',
    client: 'Telstra',
    title: 'Business Is Still Open',
    kinds: ['video'],
    services: ['30″ TVC', 'Stills'],
    scale: 'National',
    blurb:
      'A nationwide campaign about local business, shot across every Australian state and cut to a 30-second commercial with a stills set alongside it.',
  },
  {
    id: 'brownstones',
    client: 'Brownstones',
    title: 'Broadcast hero and a new site',
    kinds: ['video', 'web', 'social'],
    services: ['TVC', 'Social edits', 'Website design'],
    blurb:
      'A 30″ hero edit for broadcast, longer cuts for social, and a redesign of the website the campaign sent everybody to.',
  },
  {
    id: 'monford',
    client: 'Monford',
    title: 'The outsourced marketing department',
    kinds: ['web', 'social', 'video'],
    services: ['Website build', 'Social management', 'Video'],
    scale: 'Ongoing',
    blurb:
      'Not a project so much as a standing arrangement — SocialHat runs the website, the social accounts and the video as Monford’s marketing and communications department.',
  },
  {
    id: 'cowley',
    client: 'Cowley Sheetmetal',
    title: 'Rebuild, then bring the traffic',
    kinds: ['web', 'social'],
    services: ['Website redesign', 'Google Ads', 'Social'],
    blurb:
      'A redesigned website and a Google Ads campaign pointed at it, so the new site had something arriving at it from day one.',
  },
  {
    id: 'lhre',
    client: 'LHRE Group',
    title: 'A brand from nothing',
    kinds: ['web'],
    services: ['Website design', 'Copywriting', 'Branding'],
    blurb:
      'A recruitment firm that needed the whole front end of a business: the brand, the words and the website to put them on.',
  },
  {
    id: 'pact',
    client: 'PACT Construction',
    title: 'Projects, on LinkedIn',
    kinds: ['video', 'social'],
    services: ['LinkedIn video'],
    blurb:
      'Video built for the one platform where construction clients actually are, showing the projects rather than describing them.',
  },
  {
    id: 'sandvik',
    client: 'Sandvik',
    title: 'Moving the big equipment',
    kinds: ['video', 'social'],
    services: ['Video', 'Photography'],
    blurb:
      'Promotional video and stills following heavy equipment out of Perth — the kind of scale that only reads properly on camera.',
  },
  {
    id: 'utas',
    client: 'University of Tasmania',
    title: 'Instagram, for prospective students',
    kinds: ['video', 'social'],
    services: ['Video series', 'Instagram campaign'],
    blurb:
      'A run of video content showing the facilities to the people deciding where to study, in the place they were already looking.',
  },
  {
    id: 'barker-whittle',
    client: 'Barker Whittle',
    title: 'Video that had to generate leads',
    kinds: ['video', 'social'],
    services: ['Social video campaign'],
    blurb:
      'A social video campaign with a single job: bring enquiries in, not impressions.',
  },
  {
    id: 'rise-pizza',
    client: 'Rise Pizza',
    title: 'Artisan pizza, shot properly',
    kinds: ['video', 'social'],
    services: ['Social video'],
    blurb:
      'Food content made to stop a thumb — the product doing the selling, which with pizza is most of the work.',
  },
]

/* ==========================================================================
   The section
   ========================================================================== */

export function Work() {
  const [kind, setKind] = useState(null)

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

        {/* The list is the live region, not each card: a screen reader should
            hear "showing 4 of 10" once, not ten cards arriving. */}
        <p className="work-count" role="status">
          {shown.length === WORK.length
            ? `All ${WORK.length} projects`
            : `${shown.length} of ${WORK.length} projects`}
        </p>

        {/* Keyed on the filter so the whole grid remounts when it changes, and
            the cards play their entrance again. That is not decoration: the
            page does not move when you filter, so without it the only evidence
            anything happened is a count changing above the fold of the grid.

            It is also why the cards do NOT carry `data-reveal` like the rest of
            the site. That observer is set up once, over the nodes present at
            mount — anything rendered later is never observed and would sit at
            opacity 0 forever. These animate themselves instead. */}
        {shown.length ? (
          <div className="work-grid" key={kind ?? 'all'}>
            {shown.map((item, i) => (
              <Card key={item.id} item={item} index={i} />
            ))}
          </div>
        ) : (
          <Empty kind={KINDS.find((k) => k.id === kind)} />
        )}
      </div>
    </section>
  )
}

/* ==========================================================================
   A card
   ========================================================================== */

function Card({ item, index }) {
  return (
    <article className="work-card" style={{ '--i': index }}>
      {/* The still, when there is one. Until then the tile carries the client's
          name at size, which is the thing a prospect is scanning for anyway. */}
      <div className="work-shot" aria-hidden="true">
        {item.image ? <img src={item.image} alt="" loading="lazy" /> : <span>{item.client}</span>}
      </div>

      <div className="work-body">
        <header className="work-head">
          <h3>{item.client}</h3>
          {item.scale ? <span className="work-scale">{item.scale}</span> : null}
        </header>

        <p className="work-title">{item.title}</p>
        <p className="work-blurb">{item.blurb}</p>

        <ul className="work-services">
          {item.services.map((service) => (
            <li key={service}>{service}</li>
          ))}
        </ul>
      </div>
    </article>
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
