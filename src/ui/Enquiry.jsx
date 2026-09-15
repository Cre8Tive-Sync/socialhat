import { useEffect, useMemo, useRef, useState } from 'react'
import { ENQUIRY_ENDPOINT } from '../config'

/**
 * The smart enquiry form — deliverable 02.
 *
 * The live site funnels four different people through near-identical plain
 * forms: an agency client, someone who wants a website, a venue with blank wall
 * space, and an advertiser buying screen time. They arrive indistinguishable,
 * so every one of them needs a phone call before anyone knows what they wanted.
 *
 * This asks that question first and once, then shows only the questions that
 * path actually needs and routes the result to the inbox that handles it.
 *
 * Two things are deliberately absent. There is no maths test — the live forms
 * ask you to solve "5 + 9 =" before they will send, which is friction paid by
 * every real enquiry to inconvenience a bot for one second. It is replaced by a
 * honeypot and a time-to-submit floor, which cost the visitor nothing. And
 * there is no "New Field" — every field below is here because an answer to it
 * changes how SocialHat follows up.
 *
 * The shape of it is data, not markup: PATHS drives the chooser, each path's
 * `fields` drives its panel. Adding a question is a line in the array.
 */

/* ==========================================================================
   The four paths
   ========================================================================== */

/**
 * `inbox` is the routing table, and the only line that needs changing when
 * SocialHat wants signage enquiries somewhere other than the general inbox.
 * Everything points at info@ today because it is the only address the business
 * publishes; the split is already wired, it just needs the addresses.
 */
const PATHS = [
  {
    id: 'marketing',
    idx: '01',
    label: 'Marketing my business',
    blurb: 'Social, content, video, ads — get my brand in front of more people.',
    chip: 'var(--coral)',
    inbox: 'info@socialhat.com.au',
    fields: [
      {
        name: 'services',
        type: 'chips',
        label: 'What are you after?',
        hint: 'Pick as many as you like.',
        options: [
          'Social media management',
          'Content creation',
          'Video production',
          'Photography',
          'Google Ads & campaigns',
          'Drone footage',
          'SEO',
          'Copywriting',
          'Marketing strategy',
          'Not sure yet',
        ],
      },
      {
        name: 'stage',
        type: 'choice',
        label: 'Where are you up to?',
        options: [
          'Starting from scratch',
          'Doing it in-house, want help',
          'With another agency, looking to move',
        ],
      },
      {
        name: 'budget',
        type: 'select',
        label: 'Monthly budget',
        options: [
          'Under $1,000',
          '$1,000 – $3,000',
          '$3,000 – $5,000',
          '$5,000+',
          'Not sure yet',
        ],
      },
    ],
  },
  {
    id: 'website',
    idx: '02',
    label: 'A website',
    blurb: 'A new site, a redesign, or fixes to the one I already have.',
    chip: 'var(--lime)',
    inbox: 'info@socialhat.com.au',
    fields: [
      {
        name: 'work',
        type: 'choice',
        label: 'What kind of job is it?',
        options: ['Brand new website', 'Redesign of my current site', 'Fixes to my current site'],
      },
      {
        name: 'currentUrl',
        type: 'text',
        label: 'Your current website',
        placeholder: 'yourbusiness.com.au',
        showIf: (a) => a.work === 'Redesign of my current site' || a.work === 'Fixes to my current site',
      },
      {
        name: 'goals',
        type: 'chips',
        label: 'What does it need to do?',
        options: [
          'Generate leads',
          'Sell products',
          'Take bookings',
          'Show a portfolio',
          'Rank on Google',
          'Just look credible',
        ],
      },
      {
        name: 'budget',
        type: 'select',
        label: 'Budget for the build',
        options: ['Under $3,000', '$3,000 – $8,000', '$8,000 – $15,000', '$15,000+', 'Not sure yet'],
      },
    ],
  },
  {
    id: 'host',
    idx: '03',
    label: 'Host a screen',
    blurb: 'I have wall space in my venue and I want to earn from it.',
    chip: 'var(--marigold)',
    inbox: 'info@socialhat.com.au',
    fields: [
      {
        name: 'situation',
        type: 'choice',
        label: 'Which sounds like you?',
        options: ['I have blank screens already', 'I need a screen installed', 'Just exploring it'],
      },
      {
        name: 'venue',
        type: 'select',
        label: 'What kind of venue?',
        options: ['Hospitality', 'Retail', 'Healthcare', 'Education', 'Gym or fitness', 'Other'],
      },
      {
        name: 'suburb',
        type: 'text',
        label: 'Where is it?',
        placeholder: 'Suburb, e.g. Floreat',
      },
      {
        name: 'screens',
        type: 'select',
        label: 'How many screens?',
        options: ['1', '2 – 3', '4 or more', 'Not sure yet'],
      },
    ],
  },
  {
    id: 'advertise',
    idx: '04',
    label: 'Advertise on screens',
    blurb: 'I want my campaign running on screens around Perth.',
    chip: 'var(--paper)',
    inbox: 'info@socialhat.com.au',
    fields: [
      {
        name: 'promoting',
        type: 'text',
        label: 'What are you promoting?',
        placeholder: 'A product, an event, an opening…',
      },
      {
        name: 'reach',
        type: 'text',
        label: 'Who do you want to reach?',
        placeholder: 'Suburbs, or the kind of customer',
      },
      {
        name: 'length',
        type: 'select',
        label: 'How long for?',
        options: ['One-off event', '1 month', '3 months', '6 months or more', 'Not sure yet'],
      },
      {
        name: 'artwork',
        type: 'choice',
        label: 'Do you have artwork?',
        options: ['Ready to go', 'Needs creating', 'Not sure'],
      },
    ],
  },
]

/* ==========================================================================
   The section
   ========================================================================== */

export function Enquiry() {
  const [path, setPath] = useState(null)
  const [answers, setAnswers] = useState({})
  const [errors, setErrors] = useState({})
  const [status, setStatus] = useState('idle')

  // Spam control, in place of the maths test. A bot fills every field it finds
  // and submits the instant it can; a person cannot do either.
  const trap = useRef('')
  const openedAt = useRef(Date.now())

  const active = useMemo(() => PATHS.find((p) => p.id === path) ?? null, [path])

  // Only the fields this path shows — `showIf` fields that are hidden are not
  // just invisible, they are not part of the form, so nothing stale is sent.
  const visible = useMemo(
    () => (active ? active.fields.filter((f) => !f.showIf || f.showIf(answers)) : []),
    [active, answers],
  )

  const choose = (next) => {
    setPath(next)
    setAnswers({})
    setErrors({})
    setStatus('idle')
    // Both halves of the spam check reset with the form. The clock restarts
    // because this is a new form, and the trap clears because it is a new form
    // too — a stray value left in it would silently swallow every later
    // enquiry from a real person who happened to touch it once.
    openedAt.current = Date.now()
    trap.current = ''
  }

  /**
   * The assistant's handoff.
   *
   * When a chat gets long enough that a form is the better tool, the assistant
   * calls `open_enquiry_form` and the server sends the path down its stream;
   * Assistant.jsx turns it into this event. The visitor arrives here with their
   * path already chosen rather than at a blank form having to explain
   * themselves a second time.
   *
   * A window event rather than shared state: these two components sit in
   * different branches of the tree, and the alternative is a context provider
   * wrapping the whole site to carry one string.
   */
  useEffect(() => {
    const onHandoff = (event) => {
      const wanted = event.detail?.path
      if (!PATHS.some((p) => p.id === wanted)) return
      choose(wanted)
      // After paint, so the section is at its full height before it is measured.
      requestAnimationFrame(() => {
        document.getElementById('enquiry')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      })
    }
    window.addEventListener('socialhat:enquiry', onHandoff)
    return () => window.removeEventListener('socialhat:enquiry', onHandoff)
  }, [])

  const set = (name, value) => {
    setAnswers((prev) => ({ ...prev, [name]: value }))
    setErrors((prev) => (prev[name] ? { ...prev, [name]: undefined } : prev))
  }

  const toggle = (name, option) => {
    setAnswers((prev) => {
      const picked = prev[name] ?? []
      return {
        ...prev,
        [name]: picked.includes(option)
          ? picked.filter((o) => o !== option)
          : [...picked, option],
      }
    })
  }

  const submit = async (event) => {
    event.preventDefault()
    if (status === 'sending') return

    const next = {}
    if (!answers.name?.trim()) next.name = 'We need a name to reply to.'
    if (!answers.email?.trim()) next.email = 'We need somewhere to send the reply.'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(answers.email.trim())) {
      next.email = 'That email address looks incomplete.'
    }
    setErrors(next)
    if (Object.keys(next).length) return

    // Silently succeed for a bot: no error to learn from, no retry.
    if (trap.current || Date.now() - openedAt.current < 3000) {
      setStatus('sent')
      return
    }

    setStatus('sending')
    const payload = buildPayload(active, visible, answers)

    if (!ENQUIRY_ENDPOINT) {
      // No server yet — hand the same payload to the visitor's mail client,
      // addressed to the inbox this path routes to.
      window.location.href = mailtoFor(active, payload)
      setStatus('sent')
      return
    }

    try {
      const res = await fetch(ENQUIRY_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      setStatus(res.ok ? 'sent' : 'error')
    } catch {
      setStatus('error')
    }
  }

  return (
    <section className="enquiry" id="enquiry">
      <div className="wrap">
        <div className="section-head" data-reveal>
          <p className="eyebrow" style={{ '--chip': 'var(--marigold)' }}>
            Start here
          </p>
          <h2>Tell us what you need.</h2>
          <p>
            One question first, so the rest of the form is only the bits that apply to you — and so
            your enquiry lands with the person who handles it.
          </p>
        </div>

        <div className="enquiry-shell" data-reveal>
          {status === 'sent' ? (
            <Sent path={active} onReset={() => choose(null)} />
          ) : (
            <form className="enquiry-form" onSubmit={submit} noValidate>
              <fieldset className="picker">
                <legend className="field-label">What brings you here?</legend>
                <div className="picker-grid">
                  {PATHS.map((p) => (
                    <button
                      type="button"
                      key={p.id}
                      className={p.id === path ? 'path-card on' : 'path-card'}
                      style={{ '--chip': p.chip }}
                      aria-pressed={p.id === path}
                      onClick={() => choose(p.id)}
                    >
                      <span className="path-idx">{p.idx}</span>
                      <span className="path-label">{p.label}</span>
                      <span className="path-blurb">{p.blurb}</span>
                    </button>
                  ))}
                </div>
              </fieldset>

              {active ? (
                <div className="enquiry-rest" key={active.id}>
                  <div className="field-grid">
                    {visible.map((field) => (
                      <Field
                        key={field.name}
                        field={field}
                        value={answers[field.name]}
                        onSet={set}
                        onToggle={toggle}
                      />
                    ))}
                  </div>

                  <div className="field-grid">
                    <Text
                      name="name"
                      label="Your name"
                      required
                      value={answers.name}
                      error={errors.name}
                      onSet={set}
                    />
                    <Text
                      name="business"
                      label="Business name"
                      value={answers.business}
                      onSet={set}
                    />
                    <Text
                      name="email"
                      label="Email"
                      type="email"
                      required
                      value={answers.email}
                      error={errors.email}
                      onSet={set}
                    />
                    <Text
                      name="phone"
                      label="Phone"
                      type="tel"
                      value={answers.phone}
                      onSet={set}
                    />
                  </div>

                  <label className="field full">
                    <span className="field-label">Anything else we should know?</span>
                    <textarea
                      rows={4}
                      value={answers.message ?? ''}
                      onChange={(e) => set('message', e.target.value)}
                      placeholder="Optional — a deadline, a link, the thing that made you get in touch."
                    />
                  </label>

                  {/* The honeypot. Off-screen rather than display:none, which
                      some bots check for, and never focusable or announced. */}
                  <div className="trap" aria-hidden="true">
                    <label htmlFor="company-website">Company website</label>
                    <input
                      id="company-website"
                      name="company_website"
                      type="text"
                      tabIndex={-1}
                      autoComplete="off"
                      onChange={(e) => {
                        trap.current = e.target.value
                      }}
                    />
                  </div>

                  <div className="enquiry-foot">
                    <button className="btn" type="submit" disabled={status === 'sending'}>
                      {status === 'sending' ? 'Sending…' : 'Send enquiry'}
                    </button>
                    <p className="enquiry-note">
                      No maths test. Straight to the {active.label.toLowerCase()} desk, usually
                      answered the same working day.
                    </p>
                  </div>

                  {status === 'error' ? (
                    <p className="enquiry-error" role="alert">
                      That didn&rsquo;t send. Email{' '}
                      <a href={`mailto:${active.inbox}`}>{active.inbox}</a> or call{' '}
                      <a href="tel:0892850811">08 9285 0811</a> and we&rsquo;ll pick it up from
                      there.
                    </p>
                  ) : null}
                </div>
              ) : null}
            </form>
          )}
        </div>
      </div>
    </section>
  )
}

/* ==========================================================================
   Fields
   ========================================================================== */

function Field({ field, value, onSet, onToggle }) {
  if (field.type === 'chips') {
    const picked = value ?? []
    return (
      <fieldset className="field full">
        <legend className="field-label">
          {field.label}
          {field.hint ? <span className="field-hint">{field.hint}</span> : null}
        </legend>
        <div className="chip-row">
          {field.options.map((option) => (
            <button
              type="button"
              key={option}
              className={picked.includes(option) ? 'pick on' : 'pick'}
              aria-pressed={picked.includes(option)}
              onClick={() => onToggle(field.name, option)}
            >
              {option}
            </button>
          ))}
        </div>
      </fieldset>
    )
  }

  if (field.type === 'choice') {
    return (
      <fieldset className="field full">
        <legend className="field-label">{field.label}</legend>
        <div className="chip-row">
          {field.options.map((option) => (
            <button
              type="button"
              key={option}
              className={value === option ? 'pick on' : 'pick'}
              aria-pressed={value === option}
              onClick={() => onSet(field.name, option)}
            >
              {option}
            </button>
          ))}
        </div>
      </fieldset>
    )
  }

  if (field.type === 'select') {
    return (
      <label className="field">
        <span className="field-label">{field.label}</span>
        <select value={value ?? ''} onChange={(e) => onSet(field.name, e.target.value)}>
          <option value="">Select one</option>
          {field.options.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </label>
    )
  }

  return (
    <Text
      name={field.name}
      label={field.label}
      placeholder={field.placeholder}
      value={value}
      onSet={onSet}
    />
  )
}

function Text({ name, label, type = 'text', required, placeholder, value, error, onSet }) {
  return (
    <label className={error ? 'field bad' : 'field'}>
      <span className="field-label">
        {label}
        {required ? <b aria-hidden="true">*</b> : null}
      </span>
      <input
        name={name}
        type={type}
        required={required}
        placeholder={placeholder}
        value={value ?? ''}
        aria-invalid={error ? 'true' : undefined}
        onChange={(e) => onSet(name, e.target.value)}
      />
      {error ? <span className="field-error">{error}</span> : null}
    </label>
  )
}

/* ==========================================================================
   Sent
   ========================================================================== */

function Sent({ path, onReset }) {
  return (
    <div className="enquiry-sent" role="status">
      <p className="eyebrow">Sent</p>
      <h3>Got it. Thanks.</h3>
      <p>
        Your enquiry is on its way to the {path ? path.label.toLowerCase() : ''} desk with the
        detail already attached, so the reply you get back should be a real answer rather than a
        round of questions.
      </p>
      <div className="cta-actions">
        <button className="btn outline" type="button" onClick={onReset}>
          Send another
        </button>
      </div>
    </div>
  )
}

/* ==========================================================================
   Payload
   ========================================================================== */

/** Flat, readable, and the same shape whether it goes over HTTP or by mail. */
function buildPayload(path, visible, answers) {
  const detail = {}
  for (const field of visible) {
    const value = answers[field.name]
    if (value == null || value === '' || (Array.isArray(value) && !value.length)) continue
    detail[field.label] = Array.isArray(value) ? value.join(', ') : value
  }

  return {
    path: path.id,
    pathLabel: path.label,
    route: path.inbox,
    name: answers.name?.trim() ?? '',
    business: answers.business?.trim() ?? '',
    email: answers.email?.trim() ?? '',
    phone: answers.phone?.trim() ?? '',
    message: answers.message?.trim() ?? '',
    detail,
    submittedAt: new Date().toISOString(),
  }
}

function mailtoFor(path, payload) {
  const lines = [
    `Enquiry type: ${payload.pathLabel}`,
    '',
    ...Object.entries(payload.detail).map(([label, value]) => `${label}: ${value}`),
    '',
    `Name: ${payload.name}`,
    payload.business ? `Business: ${payload.business}` : null,
    `Email: ${payload.email}`,
    payload.phone ? `Phone: ${payload.phone}` : null,
    payload.message ? `\n${payload.message}` : null,
  ].filter((line) => line !== null)

  const subject = `Website enquiry — ${payload.pathLabel}`
  return `mailto:${path.inbox}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(
    lines.join('\n'),
  )}`
}
