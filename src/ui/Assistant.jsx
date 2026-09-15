import { useCallback, useEffect, useRef, useState } from 'react'
import { CHAT_ENDPOINT, CHAT_GREETING, CHAT_NUDGE, CHAT_NUDGE_DELAY } from '../config'

/**
 * HatBot — deliverable 03.
 *
 * SocialHat is staffed 8am to 4pm, Monday to Friday. Every visitor outside that
 * window currently reaches a form and hears nothing back until the next
 * business morning, and most of them do not wait. This answers them, and when
 * one of them is worth a phone call it takes their details rather than letting
 * them leave.
 *
 * It knows nothing itself. The system prompt, the facts and the tools all live
 * server-side in [api/knowledge.js](../../api/knowledge.js) — none of it is in
 * this bundle, and neither is the API key.
 *
 * Two things arrive down the same stream: text, and actions. An action is the
 * model reaching out of the chat and doing something to the page — today, only
 * opening the enquiry form on the right path. They are ordered with the text,
 * so the form opens as the sentence saying so finishes.
 */

/** Openers. Fixed, not generated — they are navigation, and they cost nothing. */
const OPENERS = [
  'What do you actually do?',
  'I need a new website',
  'How do the digital screens work?',
  'Can I earn from a screen in my shop?',
]

export function Assistant({ awake }) {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState([])
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [nudge, setNudge] = useState(false)

  const log = useRef(null)
  const input = useRef(null)
  const abort = useRef(null)

  /**
   * The nudge.
   *
   * Shown once per visit, after the visitor has been reading for a while, and
   * never again after it is dismissed or the panel is opened — an offer of
   * help, not a thing that keeps reappearing. `dismissNudge` is what every exit
   * from it goes through so there is one place that remembers.
   *
   * Session storage, not local: "not now" should mean this visit, not forever.
   * It is wrapped because a private window or blocked site data makes the
   * accessor itself throw, and a nudge is not worth a white screen.
   */
  useEffect(() => {
    // Timed from the site taking the screen, not from mount. This component now
    // mounts with the page, and the film runs first — a timer started there
    // would spend most of its delay on a nudge nobody can see, and could fire
    // the moment the site arrives.
    if (!awake || read(NUDGE_KEY)) return
    const timer = setTimeout(() => setNudge(true), CHAT_NUDGE_DELAY)
    return () => clearTimeout(timer)
  }, [awake])

  const dismissNudge = useCallback(() => {
    setNudge(false)
    write(NUDGE_KEY, '1')
  }, [])

  // Follow the stream down, but never yank the page away from someone who has
  // scrolled up to read something.
  useEffect(() => {
    const el = log.current
    if (!el) return
    const near = el.scrollHeight - el.scrollTop - el.clientHeight < 120
    if (near) el.scrollTop = el.scrollHeight
  }, [messages])

  useEffect(() => {
    if (!open) return
    input.current?.focus()
    dismissNudge()
  }, [open, dismissNudge])

  // Escape closes, from anywhere — including the textarea, which would
  // otherwise swallow it.
  useEffect(() => {
    if (!open) return
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  // A request in flight when the widget unmounts is a stream nobody is reading.
  useEffect(() => () => abort.current?.abort(), [])

  const send = useCallback(
    async (text) => {
      const body = text.trim()
      if (!body || busy) return

      const outgoing = [...messages, { role: 'user', content: body }]
      // The assistant turn is appended empty and filled by the stream, so the
      // bubble is on screen — with its typing dots — before the first token.
      setMessages([...outgoing, { role: 'assistant', content: '' }])
      setDraft('')
      setBusy(true)

      const controller = new AbortController()
      abort.current = controller

      // Only the roles and text go up. The server rebuilds the shape it sends
      // to the API from this and trusts none of it.
      const wire = outgoing.map((m) => ({ role: m.role, content: m.content }))

      const append = (chunk) =>
        setMessages((prev) => {
          const next = [...prev]
          next[next.length - 1] = {
            ...next[next.length - 1],
            content: next[next.length - 1].content + chunk,
          }
          return next
        })

      try {
        const res = await fetch(CHAT_ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messages: wire }),
          signal: controller.signal,
        })
        if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`)

        for await (const event of readSSE(res.body, controller.signal)) {
          if (event.type === 'text' || event.type === 'error') append(event.text)
          else if (event.type === 'action') act(event)
        }
      } catch (error) {
        if (error.name !== 'AbortError') {
          append(
            "\n\nI've dropped out. Email info@socialhat.com.au or call 08 9285 0811 — that always works.",
          )
        }
      } finally {
        setBusy(false)
        abort.current = null
      }
    },
    [busy, messages],
  )

  const onKeyDown = (event) => {
    // Enter sends, Shift+Enter breaks a line — what every chat box does, and
    // what anyone typing into one will try first.
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      send(draft)
    }
  }

  return (
    <>
      {/* The nudge sits above the launcher and points at it, so the button it
          is asking you to press is the nearest thing to it. `role="status"`
          rather than a dialog: it announces itself once and never takes focus
          away from whatever someone was reading. */}
      {nudge && !open ? (
        <div className="ai-nudge" role="status">
          {/* The bubble is the button. One line, one thing to press, and the
              whole surface presses it — rather than a card asking you to find
              a smaller button inside it. */}
          <button type="button" className="ai-nudge-say" onClick={() => setOpen(true)}>
            <span className="ai-pip" aria-hidden="true" />
            {CHAT_NUDGE}
          </button>
          <button type="button" className="ai-nudge-x" onClick={dismissNudge} aria-label="Hide this">
            <CloseGlyph />
          </button>
        </div>
      ) : null}

      <button
        type="button"
        className={open ? 'ai-launch open' : 'ai-launch'}
        aria-expanded={open}
        aria-controls="ai-panel"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="ai-launch-icon" aria-hidden="true">
          {open ? <CloseGlyph /> : <ChatGlyph />}
        </span>
        <span className="ai-launch-text">{open ? 'Close' : 'Ask HatBot'}</span>
      </button>

      <div
        className={open ? 'ai-panel open' : 'ai-panel'}
        id="ai-panel"
        role="dialog"
        aria-label="HatBot, the SocialHat assistant"
        aria-modal="false"
        // `inert`, not `hidden`. `[hidden]` is `display: none`, and an element
        // going from `display: none` to displayed in the same frame has nothing
        // to transition from — so the panel popped open instead of animating,
        // every time. `inert` takes it out of the tab order and the
        // accessibility tree just as thoroughly while leaving it rendered, and
        // CSS below hides it with `visibility`, which transitions.
        inert={!open}
      >
        <header className="ai-head">
          <span className="ai-pip" aria-hidden="true" />
          <div>
            <strong>HatBot</strong>
            <span>{officeOpen() ? 'The team is in — I can still help' : 'Out of hours — ask me'}</span>
          </div>
          <button type="button" className="ai-x" onClick={() => setOpen(false)} aria-label="Close">
            <CloseGlyph />
          </button>
        </header>

        <div className="ai-log" ref={log} role="log" aria-live="polite" aria-atomic="false">
          <p className="ai-msg bot">{CHAT_GREETING}</p>

          {messages.map((message, i) => (
            <p key={i} className={message.role === 'user' ? 'ai-msg me' : 'ai-msg bot'}>
              {message.content || <Dots />}
            </p>
          ))}

          {messages.length === 0 ? (
            <div className="ai-openers">
              {OPENERS.map((opener) => (
                <button type="button" key={opener} className="pick" onClick={() => send(opener)}>
                  {opener}
                </button>
              ))}
            </div>
          ) : null}

          <p className="ai-fineprint">
            HatBot is an automated assistant, not a person, and it can get things wrong. For
            anything that matters, call 08 9285 0811.
          </p>
        </div>

        <form
          className="ai-composer"
          onSubmit={(e) => {
            e.preventDefault()
            send(draft)
          }}
        >
          <textarea
            ref={input}
            rows={1}
            value={draft}
            placeholder="Ask about a service, a screen, a site…"
            aria-label="Your message"
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={onKeyDown}
          />
          <button type="submit" className="ai-send" disabled={busy || !draft.trim()} aria-label="Send">
            <SendGlyph />
          </button>
        </form>
      </div>
    </>
  )
}

/* ==========================================================================
   Actions
   ========================================================================== */

/**
 * The model's reach into the page.
 *
 * Dispatched on `window` rather than passed down as a prop: the form is in a
 * different branch of the tree, and one custom event is a great deal less than
 * a context provider wrapping the whole site to carry a value that changes
 * three times a year. Enquiry.jsx listens for it.
 */
function act(event) {
  if (event.name === 'open_enquiry_form') {
    window.dispatchEvent(new CustomEvent('socialhat:enquiry', { detail: { path: event.path } }))
  }
}

/* ==========================================================================
   The stream

   `fetch` gives bytes; the endpoint speaks Server-Sent Events. EventSource
   would parse this for us and is GET-only, so it cannot carry a conversation —
   hence the small parser. An SSE frame ends at a blank line and a frame can
   arrive split across chunks, so the tail of the buffer is always held back
   until its terminator shows up.
   ========================================================================== */

async function* readSSE(body, signal) {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })

      const frames = buffer.split('\n\n')
      buffer = frames.pop() ?? ''

      for (const frame of frames) {
        const line = frame.split('\n').find((l) => l.startsWith('data:'))
        if (!line) continue
        try {
          const event = JSON.parse(line.slice(5).trim())
          if (event.type === 'done') return
          yield event
        } catch {
          // A malformed frame is one lost delta, not a reason to tear the
          // conversation down.
        }
      }
      if (signal.aborted) return
    }
  } finally {
    reader.cancel().catch(() => {})
  }
}

/* ==========================================================================
   Bits
   ========================================================================== */

const NUDGE_KEY = 'socialhat:nudged'

/**
 * Session storage, defended.
 *
 * Reading `window.sessionStorage` at all throws in a private window, with site
 * data blocked, and in some preview and thumbnail contexts — the exception is
 * on the property access, not the method — so both sides are wrapped. A failed
 * read means the nudge shows, which is the harmless way to be wrong.
 */
function read(key) {
  try {
    return window.sessionStorage.getItem(key)
  } catch {
    return null
  }
}

function write(key, value) {
  try {
    window.sessionStorage.setItem(key, value)
  } catch {
    /* Nothing to do. The nudge is dismissed for this render either way. */
  }
}

/** Perth is UTC+8 year round — no daylight saving, so no timezone library. */
function officeOpen() {
  const perth = new Date(Date.now() + 8 * 3600_000)
  const day = perth.getUTCDay()
  const hour = perth.getUTCHours()
  return day >= 1 && day <= 5 && hour >= 8 && hour < 16
}

const Dots = () => (
  <span className="ai-dots" aria-label="Thinking">
    <i />
    <i />
    <i />
  </span>
)

const ChatGlyph = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M12 3c5 0 9 3.1 9 7s-4 7-9 7c-.9 0-1.8-.1-2.6-.3L5 19l.9-3.1C4.1 14.6 3 12.9 3 11c0-3.9 4-8 9-8z" />
  </svg>
)

const CloseGlyph = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
)

const SendGlyph = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M4 12l16-8-6 8 6 8-16-8z" />
  </svg>
)
