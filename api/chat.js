import { SYSTEM_PROMPT, TOOLS } from './knowledge.js'

/**
 * The assistant's endpoint — deliverable 03.
 *
 * A Web-standard `Request` in, a Server-Sent Event stream out. That shape runs
 * unchanged on Vercel Edge, Netlify Functions v2 and Cloudflare Workers, and
 * [vite-api-plugin.js] serves it from the same file in `npm run dev`, so there
 * is one implementation rather than one per host.
 *
 * The model is reached through OpenRouter, which speaks the OpenAI chat
 * completions format for every model it carries. That is the only format this
 * file knows, so changing model is an environment variable, not a code change.
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
   goes live — and set a credit limit on the OpenRouter key as well.
   ========================================================================== */

const MAX_TURNS = 4 // assistant turns per request, so a tool loop cannot run away
const MAX_MESSAGES = 40 // conversation length a client may send back
const MAX_CHARS = 4000 // per message
const DEFAULT_MODEL = 'anthropic/claude-opus-5'
const ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions'

export default async function handler(request) {
  // No CORS handling and no OPTIONS branch on purpose. This endpoint is called
  // by the page it is deployed with, so a preflight never happens. Same-origin
  // only is also what keeps somebody else's site from running up this bill.
  if (request.method !== 'POST') return fail(405, 'Use POST.')

  const key = readEnv('OPENROUTER_API_KEY')
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

  const model = readEnv('OPENROUTER_MODEL') || DEFAULT_MODEL

  return sse(async (send) => {
    const history = [...messages]

    for (let turn = 0; turn < MAX_TURNS; turn += 1) {
      const res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${key}`,
          'Content-Type': 'application/json',
          // Optional attribution; it is how the calls are labelled in the
          // OpenRouter dashboard.
          'X-Title': 'SocialHat HatBot',
        },
        body: JSON.stringify({
          model,
          max_tokens: 2048,
          stream: true,
          // Low effort, reasoning left on. This is short-form chat over a small,
          // fixed knowledge base — the depth is not what makes it good, and low
          // effort is a third of the latency. Reasoning stays on deliberately:
          // with it off, Claude will occasionally write a tool call into its
          // visible text instead of making one, which here would mean a lead
          // that is silently never captured.
          reasoning: { effort: 'low' },
          messages: [
            {
              role: 'system',
              // The system prompt is long, fixed and byte-identical on every
              // request, which makes it the whole point of a cache breakpoint.
              // OpenRouter passes `cache_control` through to Anthropic models
              // and ignores it for providers that cache on their own.
              content: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
            },
            ...history,
          ],
          tools: TOOLS,
        }),
        // A visitor who closes the tab stops the generation they were paying for.
        signal: request.signal,
      })
      if (!res.ok || !res.body) {
        throw new Error(`OpenRouter ${res.status}: ${await res.text().catch(() => '')}`)
      }

      const reply = await relay(res.body, send)

      // The assistant turn goes back exactly as it came, reasoning included:
      // Anthropic models reject a tool result whose preceding turn has lost the
      // reasoning that led to the call.
      history.push({
        role: 'assistant',
        content: reply.text || null,
        ...(reply.reasoning.length ? { reasoning_details: reply.reasoning } : {}),
        ...(reply.calls.length ? { tool_calls: reply.calls } : {}),
      })

      // A refusal arrives as a normal 200 with no usable text, so it has to be
      // checked before the content is trusted.
      if (reply.finish === 'content_filter' || reply.finish === 'refusal') {
        send({
          type: 'text',
          text: "I can't help with that one. If it's about SocialHat's work, ask me again another way — otherwise info@socialhat.com.au will get you to a person.",
        })
        break
      }

      if (!reply.calls.length) break

      for (const call of reply.calls) {
        history.push({
          role: 'tool',
          tool_call_id: call.id,
          content: await runTool(call.function.name, call.function.arguments, send),
        })
      }
    }

    send({ type: 'done' })
  })
}

/* ==========================================================================
   The upstream stream

   OpenRouter streams OpenAI-style chunks: text arrives as `delta.content`, and
   a tool call arrives in pieces keyed by `index` — the id and name once, the
   JSON arguments as a string split across many chunks. Text is forwarded to
   the browser as it lands; tool calls and reasoning are assembled whole.
   ========================================================================== */

async function relay(body, send) {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  const calls = []
  const reasoning = []
  let text = ''
  let finish = null
  let buffer = ''

  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })

    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''

    for (const raw of lines) {
      const line = raw.trim()
      // Blank lines end frames; lines starting ':' are OpenRouter keep-alives.
      if (!line.startsWith('data:')) continue
      const data = line.slice(5).trim()
      if (data === '[DONE]') return { text, calls, reasoning, finish }

      let chunk
      try {
        chunk = JSON.parse(data)
      } catch {
        continue
      }
      // An upstream failure after streaming has started comes as a chunk, not
      // a status code.
      if (chunk.error) throw new Error(chunk.error.message ?? 'Upstream error')

      const choice = chunk.choices?.[0]
      if (!choice) continue
      const delta = choice.delta ?? {}

      if (delta.content) {
        text += delta.content
        send({ type: 'text', text: delta.content })
      }

      for (const part of delta.tool_calls ?? []) {
        const slot = (calls[part.index ?? 0] ??= {
          id: '',
          type: 'function',
          function: { name: '', arguments: '' },
        })
        if (part.id) slot.id = part.id
        if (part.function?.name) slot.function.name += part.function.name
        if (part.function?.arguments) slot.function.arguments += part.function.arguments
      }

      for (const part of delta.reasoning_details ?? []) {
        const slot = reasoning[part.index ?? 0]
        if (!slot) {
          reasoning[part.index ?? 0] = { ...part }
          continue
        }
        if (part.text) slot.text = (slot.text ?? '') + part.text
        if (part.summary) slot.summary = (slot.summary ?? '') + part.summary
        if (part.data) slot.data = (slot.data ?? '') + part.data
        if (part.signature) slot.signature = part.signature
      }

      if (choice.finish_reason) finish = choice.finish_reason
    }
  }

  return { text, calls: calls.filter(Boolean), reasoning: reasoning.filter(Boolean), finish }
}

/* ==========================================================================
   Tools
   ========================================================================== */

async function runTool(name, rawArgs, send) {
  let input
  try {
    input = JSON.parse(rawArgs || '{}')
  } catch {
    return 'The arguments were not valid JSON. Try the call again.'
  }

  if (name === 'open_enquiry_form') {
    // Nothing happens here — the browser does the work. The event goes down the
    // same stream the text does, so it lands in order with the sentence that
    // explains it.
    send({ type: 'action', name: 'open_enquiry_form', path: input.path })
    return 'The form is open on their screen with that path selected.'
  }

  if (name === 'capture_lead') {
    const lead = { ...input, source: 'assistant', at: new Date().toISOString() }
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

  return `No tool named ${name}.`
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

  // Anthropic models require the first message to be from the user.
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
