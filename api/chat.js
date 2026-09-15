import Anthropic from '@anthropic-ai/sdk'
import { SYSTEM_PROMPT, TOOLS } from './knowledge.js'

/**
 * The assistant's endpoint — deliverable 03.
 *
 * A Web-standard `Request` in, a Server-Sent Event stream out. That shape runs
 * unchanged on Vercel Edge, Netlify Functions v2 and Cloudflare Workers, and
 * [vite-api-plugin.js] serves it from the same file in `npm run dev`, so there
 * is one implementation rather than one per host.
 *
 * The key is read from the environment and never leaves this process. There is
 * no configuration in which it reaches the browser.
 *
 * Streaming is not a nicety here. A non-streaming reply is several seconds of a
 * blank box on a phone, which reads as broken; a streamed one starts moving
 * almost immediately.
 */

export const config = { runtime: 'edge' }

/* ==========================================================================
   Limits

   This endpoint is public and unauthenticated, and every call costs money. The
   caps below are the cheap half of that problem — they bound one request. The
   other half is rate limiting per IP, which belongs in the host's edge config
   (Vercel Firewall, Netlify rate limits, a Cloudflare rule) rather than in
   application code that a bot can simply call in parallel. Set one before this
   goes live.
   ========================================================================== */

const MAX_TURNS = 4 // assistant turns per request, so a tool loop cannot run away
const MAX_MESSAGES = 40 // conversation length a client may send back
const MAX_CHARS = 4000 // per message
const MODEL = 'claude-opus-5'

export default async function handler(request) {
  // No CORS handling and no OPTIONS branch on purpose. This endpoint is called
  // by the page it is deployed with, so a preflight never happens — and the
  // preflight that used to be answered here replied with the SSE content type
  // and no `Access-Control-Allow-*` header at all, which would not have
  // permitted a cross-origin call anyway. Same-origin only is also what keeps
  // somebody else's site from running up this bill.
  if (request.method !== 'POST') return fail(405, 'Use POST.')

  const key = readEnv('ANTHROPIC_API_KEY')
  if (!key) {
    // Deployed without a key. Say so in the stream rather than returning a 500
    // the widget would render as a crash — the visitor gets a working handoff
    // to the form and the phone number, which is the fallback anyway.
    return sse(async (send) => {
      send({
        type: 'text',
        text: "I'm not switched on yet. Email info@socialhat.com.au or call 08 9285 0811, or use the enquiry form just below and it'll reach the right desk.",
      })
      send({ type: 'done' })
    })
  }

  let messages
  try {
    messages = sanitise((await request.json())?.messages)
  } catch {
    return fail(400, 'Expected JSON.')
  }
  if (!messages.length) return fail(400, 'No messages.')

  const client = new Anthropic({ apiKey: key })

  return sse(async (send) => {
    const history = [...messages]

    for (let turn = 0; turn < MAX_TURNS; turn += 1) {
      const stream = client.messages.stream({
        model: MODEL,
        max_tokens: 2048,
        // Low effort, thinking left on. This is short-form chat over a small,
        // fixed knowledge base — the depth is not what makes it good, and low
        // effort is a third of the latency. Thinking stays on deliberately:
        // with it disabled, Opus 5 will occasionally write a tool call into its
        // visible text instead of emitting a tool_use block, which here would
        // mean a lead that is silently never captured.
        thinking: { type: 'adaptive' },
        output_config: { effort: 'low' },
        // The system prompt is long, fixed and byte-identical on every request,
        // which makes it the whole point of a cache breakpoint. Volatile
        // content — the conversation — sits after it and does not disturb it.
        system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
        tools: TOOLS,
        messages: history,
      })

      stream.on('text', (delta) => send({ type: 'text', text: delta }))

      const final = await stream.finalMessage()
      history.push({ role: 'assistant', content: final.content })

      // A refusal arrives as a normal 200 with no usable text, so it has to be
      // checked before the content is trusted.
      if (final.stop_reason === 'refusal') {
        send({
          type: 'text',
          text: "I can't help with that one. If it's about SocialHat's work, ask me again another way — otherwise info@socialhat.com.au will get you to a person.",
        })
        break
      }

      if (final.stop_reason !== 'tool_use') break

      const results = []
      for (const block of final.content) {
        if (block.type !== 'tool_use') continue
        results.push({
          type: 'tool_result',
          tool_use_id: block.id,
          content: await runTool(block, send),
        })
      }
      // Every tool_result for a turn goes back in one user message. Splitting
      // them teaches the model to stop calling tools in parallel.
      history.push({ role: 'user', content: results })
    }

    send({ type: 'done' })
  })
}

/* ==========================================================================
   Tools
   ========================================================================== */

async function runTool(block, send) {
  if (block.name === 'open_enquiry_form') {
    // Nothing happens here — the browser does the work. The event goes down the
    // same stream the text does, so it lands in order with the sentence that
    // explains it.
    send({ type: 'action', name: 'open_enquiry_form', path: block.input.path })
    return 'The form is open on their screen with that path selected.'
  }

  if (block.name === 'capture_lead') {
    const lead = { ...block.input, source: 'assistant', at: new Date().toISOString() }
    const hook = readEnv('LEAD_WEBHOOK')

    if (!hook) {
      // No destination configured. Logged so it is at least recoverable from
      // the host's function logs, and the model is told plainly that it was not
      // delivered — so it does not tell the visitor something untrue.
      console.log('[lead]', JSON.stringify(lead))
      console.warn('[lead] LEAD_WEBHOOK is not set — this lead was logged, not delivered.')
      return 'Recorded, but no delivery destination is configured on this deployment. Tell them it is logged, and give them info@socialhat.com.au as the certain route.'
    }

    try {
      const res = await fetch(hook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(lead),
      })
      if (!res.ok) throw new Error(String(res.status))
      send({ type: 'action', name: 'lead_captured' })
      return 'Sent. It will be in the inbox for the next business morning.'
    } catch {
      console.log('[lead]', JSON.stringify(lead))
      return "That didn't send. Apologise briefly and give them info@socialhat.com.au and 08 9285 0811 so they are not left with nothing."
    }
  }

  return `No tool named ${block.name}.`
}

/* ==========================================================================
   Input

   Everything from the browser is hostile until it has been through here. The
   client's own history is what it replays, so the server re-derives the shape
   rather than trusting it: roles are narrowed to user/assistant, content is
   forced to a string, and both length and count are capped. A `system` role
   smuggled into the array would be an operator instruction from a visitor.
   ========================================================================== */

function sanitise(raw) {
  if (!Array.isArray(raw)) return []
  const clean = raw
    .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
    .map((m) => ({ role: m.role, content: m.content.slice(0, MAX_CHARS) }))
    .filter((m) => m.content.trim())
    .slice(-MAX_MESSAGES)

  // The API requires the first message to be from the user.
  while (clean.length && clean[0].role !== 'user') clean.shift()
  return clean
}

/* ==========================================================================
   Plumbing
   ========================================================================== */

/**
 * `no-transform` matters: some proxies and CDNs buffer or recompress a response
 * they think is plain text, which for a stream means the whole reply arriving
 * at once — the exact thing streaming is here to avoid.
 */
const SSE_HEADERS = {
  'Content-Type': 'text/event-stream; charset=utf-8',
  'Cache-Control': 'no-cache, no-transform',
  Connection: 'keep-alive',
}

/** Works under Vercel/Netlify (process.env) and Cloudflare/Deno (globalThis). */
function readEnv(name) {
  if (typeof process !== 'undefined' && process.env?.[name]) return process.env[name]
  return globalThis[name] ?? undefined
}

function fail(status, message) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

/**
 * Runs `work` inside a ReadableStream, handing it a `send` that frames objects
 * as SSE. Anything thrown becomes a final `error` event rather than a dropped
 * connection, so the widget can say something useful instead of hanging.
 */
function sse(work) {
  const encode = new TextEncoder()
  const body = new ReadableStream({
    async start(controller) {
      const send = (obj) => controller.enqueue(encode.encode(`data: ${JSON.stringify(obj)}\n\n`))
      try {
        await work(send)
      } catch (error) {
        console.error('[chat]', error)
        send({
          type: 'error',
          text: "Something went wrong at my end. Email info@socialhat.com.au or call 08 9285 0811 and you'll get a person.",
        })
      } finally {
        controller.close()
      }
    },
  })
  return new Response(body, { headers: SSE_HEADERS })
}
