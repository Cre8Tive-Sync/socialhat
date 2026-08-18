import { useEffect, useRef, useState } from 'react'

/**
 * The website the film hands over to.
 *
 * Everything below the hero: the top bar, the case for the work, the schedule
 * of services, the client list, signage, the site office, the footer. Plain
 * semantic DOM — real headings, real copy, real form controls — because this is
 * the half that has to be read, crawled and filled in.
 *
 * It carries its own palette on `.paper`: down here ink is the dark mark and the
 * ground is Paper, the exact inverse of the film's tokens.
 */
export function Site({ style }) {
  const root = useRef(null)

  // Sections lift into place the first time they are reached, once each.
  useEffect(() => {
    const nodes = Array.from(root.current?.querySelectorAll('.rise') ?? [])
    if (!('IntersectionObserver' in window)) {
      nodes.forEach((node) => node.classList.add('in'))
      return
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue
          entry.target.classList.add('in')
          io.unobserve(entry.target)
        }
      },
      { threshold: 0.15 },
    )
    nodes.forEach((node) => io.observe(node))
    return () => io.disconnect()
  }, [])

  return (
    <div className="paper" ref={root} style={style}>
      <Topbar />

      <main id="site">
        <div className="wrap">
          <section className="thesis rise" id="work">
            <div className="dim">
              <span>
                Marketing · <b>built to last</b>
              </span>
            </div>
            <h2>
              Great marketing is <em>engineering.</em> We plan the structure, lay the foundation,
              and build campaigns that hold up.
            </h2>
            <p>
              For over fifteen years we&rsquo;ve helped Perth businesses grow with content that
              stops the scroll and advertising that actually brings in work. No fluff — just the
              framework, done properly.
            </p>
          </section>

          <section className="rise" id="services">
            <div className="dim">
              <span>
                Services ── schedule / <b>05 items</b>
              </span>
            </div>
            <div className="svc-grid">
              {SERVICES.map((service) => (
                <div className={service.wide ? 'svc wide' : 'svc'} key={service.code}>
                  <div className="tag">{service.code}</div>
                  <div className="go">↗</div>
                  <h3>{service.title}</h3>
                  <p>{service.body}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="exp rise">
            <div>
              <div className="big">
                15<span>+</span>
              </div>
            </div>
            <div>
              <div className="dim" style={{ marginBottom: '20px' }}>
                <span>Track record</span>
              </div>
              <p className="lead">
                <b>Years building Perth businesses through content.</b> Trusted by government,
                mining, education and homegrown brands to deliver work that performs.
              </p>
            </div>
          </section>

          <section className="rise">
            <div className="dim">
              <span>
                Trusted by ── <b>selected clients</b>
              </span>
            </div>
            <div className="clients">
              {CLIENTS.map((client) => (
                <div key={client}>{client}</div>
              ))}
            </div>
          </section>

          <section className="rise" id="signage">
            <div className="signage">
              <div className="body">
                <h3>Digital signage that meets people where they are.</h3>
                <p>
                  Put your message on screens around Perth — or turn your own space into a revenue
                  stream by hosting one.
                </p>
                <div className="opts">
                  <a className="btn btn-primary" href="#contact">
                    Advertise with us
                  </a>
                  <a className="btn btn-ghost" href="#contact">
                    Become a host
                  </a>
                </div>
              </div>
              <div className="aside mlbl">
                {SIGNAGE_SPEC.map(([key, value]) => (
                  <div className="row" key={key}>
                    <span>{key}</span>
                    <b>{value}</b>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <ContactSection />
        </div>

        <footer>
          <div className="wrap foot">
            <a className="brand" href="#top">
              <span className="mark" />
              SocialHat
            </a>
            <div className="tag">Image is everything, the message is the key.</div>
            <div className="cr">© SocialHat 2026 · Floreat, Perth WA</div>
          </div>
        </footer>
      </main>
    </div>
  )
}

/**
 * Fixed, and deliberately absent for the whole film: that shot swings from white
 * sketch paper to a dark room, and no single treatment survives both. It arrives
 * with the paper on the handover, driven from CSS by `--handoff`.
 */
function Topbar() {
  return (
    <header className="topbar">
      <a className="brand" href="#top">
        <span className="mark" />
        SocialHat
      </a>
      <nav className="navlinks">
        <a href="#work">Work</a>
        <a href="#services">Services</a>
        <a href="#signage">Signage</a>
        <a href="#contact">Contact</a>
      </nav>
      <a className="nav-cta" href="#contact">
        Get a quote
      </a>
    </header>
  )
}

function ContactSection() {
  const [sent, setSent] = useState(false)

  return (
    <section className="contact rise" id="contact">
      <div>
        <div className="dim">
          <span>
            Site office ── <b>get in touch</b>
          </span>
        </div>
        <h2>Not sure where to start?</h2>
        <div className="info">
          <div className="item">
            <div className="k">Email</div>
            <div className="v">
              <a href="mailto:info@socialhat.com.au">info@socialhat.com.au</a>
            </div>
          </div>
          <div className="item">
            <div className="k">Phone</div>
            <div className="v">
              <a href="tel:0892850811">08 9285 0811</a>
            </div>
          </div>
          <div className="item">
            <div className="k">Studio</div>
            <div className="v">41A Kirwan Street, Floreat, WA</div>
          </div>
          <div className="item">
            <div className="k">Follow</div>
            <div className="socials">
              {SOCIALS.map(([label, href]) => (
                <a key={label} href={href} target="_blank" rel="noopener noreferrer">
                  {label}
                </a>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div>
        <form
          className="msg"
          onSubmit={(event) => {
            event.preventDefault()
            event.currentTarget.reset()
            setSent(true)
          }}
        >
          <div className="field">
            <label htmlFor="msg-name">Name</label>
            <input id="msg-name" name="name" type="text" required placeholder="Your name" />
          </div>
          <div className="field">
            <label htmlFor="msg-email">Email</label>
            <input
              id="msg-email"
              name="email"
              type="email"
              required
              placeholder="you@business.com"
            />
          </div>
          <div className="field">
            <label htmlFor="msg-phone">Phone</label>
            <input id="msg-phone" name="phone" type="tel" placeholder="Optional" />
          </div>
          <div className="field">
            <label htmlFor="msg-body">Message</label>
            <textarea
              id="msg-body"
              name="message"
              required
              placeholder="Tell us what you'd like to build."
            />
          </div>
          <button className="btn btn-primary" type="submit" style={{ alignSelf: 'flex-start' }}>
            Send message
          </button>
          <div className="sent" role="status" hidden={!sent}>
            Thanks — we&rsquo;ll be in touch shortly.
          </div>
        </form>
      </div>
    </section>
  )
}

const SERVICES = [
  {
    code: 'SVC-01',
    title: 'Web Development',
    body: 'Websites that convert, not just decorate. New builds or a refit of what you’ve got.',
  },
  {
    code: 'SVC-02',
    title: 'Advertising Campaigns',
    body: 'Leads on tap across Google and Meta, so you never worry about where the next job comes from.',
  },
  {
    code: 'SVC-03',
    title: 'Content Creation',
    body: 'World-class video and visuals that put you on the map and stop the scroll.',
  },
  {
    code: 'SVC-04',
    title: 'Social Media',
    body: 'Grow your following and keep your audience engaged across every platform.',
  },
  {
    code: 'SVC-05',
    title: 'Digital Signage',
    body: 'Reach people in the real world, in real time — traditional reach with modern targeting.',
    wide: true,
  },
]

const CLIENTS = [
  'Dept. of Communities',
  'Sandvik',
  'Mount Gibson',
  'Curtin University',
  'Monadelphous',
  'Georgiou',
  'Wesfarmers',
  'Summit Homes',
  'City of Vincent',
  'Dept. of Health',
  'Goldroad',
  'Pindan',
]

const SIGNAGE_SPEC = [
  ['Format', 'DIGI-SCREEN'],
  ['Reach', 'REAL-WORLD'],
  ['Targeting', 'LOCAL'],
  ['Status', 'LIVE'],
]

const SOCIALS = [
  ['Facebook', 'https://www.facebook.com/socialhat/'],
  ['Instagram', 'https://www.instagram.com/socialhat.media'],
  ['YouTube', 'https://www.youtube.com/channel/UCCzxGJ2iy8-uyA-4VwaThCA/featured'],
]
