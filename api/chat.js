import { SYSTEM_PROMPT, TOOLS } from './knowledge.js'
import { builtinReply } from './fallback.js'

/**
 * The assistant's endpoint — deliverable 03.
 *
 * A Web-standard `Request` in, a Server-Sent Event stream out. This file is
 * what `npm run dev` runs, through [vite-api-plugin.js]. The live site is on
 * SiteGround, which runs PHP and not Node, so production is the port in
 * server/public/api/chat.php — same contract, same provider chain, same
 * fallback. A change to the behaviour here has to be made there as well; the
 * prompt, tools and built-in answers are shared and need changing only once.
 *
 * The model is reached through a chain of free providers — Groq, NVIDIA,
 * then OpenRouter — which all speak the OpenAI chat completions format.
 * Each has its own free allowance; when one is rate-limited or down, the next
 * one answers. When every one of them fails, api/fallback.js answers from the
 * site's own facts with no model at all, so a visitor is never left with an
 * apology.
 *
 * The keys are read from the environment and never leave this process. There
 * is no configuration in which they reach the browser.
 *
 * Streaming is not a nicety here. A non-streaming reply is several seconds of a
 * blank box on a phone, which reads as broken; a streamed one starts moving
 * almost immediately.
 */

/* ==========================================================================
   Limits

   This endpoint is public and unauthenticated, and every call costs money. The
   caps below are the cheap half of that problem — they bound one request. The
   other half is rate limiting per IP. That is not in this file, which only
   ever serves a developer's own machine; on the live site it is in chat.php,
   which keeps a per-IP count on disk. The keys are all free tiers, so the
   worst a flood can do is spend today's allowance — and then the built-in
   answers take over.
   ========================================================================== */

const MAX_TURNS = 4 // assistant turns per request, so a tool loop cannot run away
const MAX_MESSAGES = 40 // conversation length a client may send back
const MAX_CHARS = 4000 // per message

/* ==========================================================================
   Providers

   Tried in this order, each model in turn. A provider whose key is not set is
   skipped, so the chain is whatever keys the deployment has. Every list can be
   replaced from the environment (GROQ_MODELS, NVIDIA_MODELS,
   OPENROUTER_MODELS — comma-separated) when a free roster changes, without a
   code change.

   Free limits are per model on Groq, so several of its models before moving on
   is several separate allowances, not the same one asked twice.
   ========================================================================== */

const PROVIDERS = [
  {
    name: 'groq',
    endpoint: 'https://api.groq.com/openai/v1/chat/completions',
    keyEnv: 'GROQ_API_KEY',
    // Checked against HatBot's prompt and tools in September 2026: all three
    // answered in about a second and opened the form correctly.
    models: ['openai/gpt-oss-120b', 'qwen/qwen3.8-27b', 'openai/gpt-oss-20b'],
    // Groq's daily caps are per model: one model spending its day leaves the
    // others untouched, so a daily limit benches that model, not all of Groq.
    perModelLimits: true,
  },
  {
    name: 'nvidia',
    endpoint: 'https://integrate.api.nvidia.com/v1/chat/completions',
    keyEnv: 'NVIDIA_API_KEY',
    // GPT-OSS 20B answered in about 4s; Nemotron Super works but threw the
    // occasional 500. DeepSeek (20–30s) and Gemma (timed out) were too slow.
    models: ['openai/gpt-oss-20b', 'nvidia/nemotron-3-super-120b-a12b'],
  },
  {
    name: 'openrouter',
    endpoint: 'https://openrouter.ai/api/v1/chat/completions',
    keyEnv: 'OPENROUTER_API_KEY',
    // Checked against HatBot's prompt and tools in September 2026: Ling
    // answered in about 2s, the Nemotrons in 15–60s and often overloaded.
    models: [
      'inclusionai/ling-3.0-flash-sante:free',
      'nvidia/nemotron-3-super-120b-a12b:free',
      'nvidia/nemotron-3-ultra-550b-a55b:free',
    ],
    // Optional attribution; it is how the calls are labelled in the
    // OpenRouter dashboard.
    headers: { 'X-Title': 'SocialHat HatBot' },
  },
]

// A model that has not produced its first byte by now is treated as down.
// Once it is streaming it has as long as it needs.
const FIRST_BYTE_MS = 12000
// The whole search for a working model, so a bad day upstream costs the
// visitor seconds, not a minute, before the built-in answer takes over.
const BUDGET_MS = 30000
// How long a model that said "rate limited" or "overloaded" is left alone.
// Module state, so it lasts as long as a warm instance does — which is
// exactly when the same limit would be hit again.
const COOLDOWN_MS = 60000
// A spent daily allowance will not come back in a minute.
const DAILY_COOLDOWN_MS = 60 * 60 * 1000
const cooling = new Map()

export default async function handler(request) {
  // No CORS handling and no OPTIONS branch on purpose. This endpoint is called
  // by the page it is deployed with, so a preflight never happens. Same-origin
  // only is also what keeps somebody else's site from running up this bill.
  if (request.method !== 'POST') return fail(405, 'Use POST.')

  let messages
  try {
    messages = sanitise((await request.json())?.messages)
  } catch {
    return fail(400, 'Expected JSON.')
  }
  if (!messages.length) return fail(400, 'No messages.')

  // No keys at all is not an outage worth announcing: the built-in answers
  // are the same fallback every other failure ends at.
  const candidates = candidateChain()

  return sse(async (send) => {
    const history = [...messages]
    const deadline = Date.now() + BUDGET_MS
    const toolsRun = []

    for (let turn = 0; turn < MAX_TURNS; turn += 1) {
      let reply
      try {
        reply = await complete({ candidates, history, send, signal: request.signal, deadline })
      } catch (error) {
        if (request.signal?.aborted) return
        console.error('[chat] every provider failed:', error?.message ?? error)
        answerWithoutModel(messages, toolsRun, send)
        break
      }

      // The assistant turn goes back with its tool calls. Reasoning is not
      // carried: the next turn may land on a different provider, and none of
      // these free models need their reasoning replayed to accept a tool result.
      history.push({
        role: 'assistant',
        content: reply.text || null,
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
        toolsRun.push(call.function.name)
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
   One assistant turn, with retries
   ========================================================================== */

/**
 * Every (provider, model) pair this deployment can try, in order. Providers
 * without a key drop out here, and so does anything still cooling off.
 */
function candidateChain() {
  const list = []
  for (const provider of PROVIDERS) {
    const key = readEnv(provider.keyEnv)
    if (!key) continue
    const override = readEnv(`${provider.name.toUpperCase()}_MODELS`)
    const models = override ? override.split(',').map((m) => m.trim()).filter(Boolean) : provider.models
    for (const model of models) list.push({ provider, key, model })
  }
  const now = Date.now()
  const warm = list.filter((c) => !(cooling.get(id(c)) > now))
  // If everything is cooling, try anyway — a stale cooldown is cheaper to
  // ignore than a visitor sent to the fallback for no reason.
  return warm.length ? warm : list
}

const id = (c) => `${c.provider.name}:${c.model}`

class UpstreamError extends Error {
  constructor(provider, status, detail) {
    super(`${provider} ${status}: ${String(detail).slice(0, 500)}`)
    this.provider = provider
    this.status = status
    this.detail = String(detail)
  }
}

/**
 * What a failure means for the rest of the chain. A bad key rules out the
 * whole provider; a spent daily allowance rules out the provider, or just that
 * model where limits are per model; a rate limit or overload rules out that
 * model for a minute; anything else just moves on to the next one.
 */
function classify(error) {
  if (!(error instanceof UpstreamError)) return 'model'
  if (error.status === 401 || error.status === 403 || error.status === 402) return 'provider'
  if (/per-day|per day|daily|\bTPD\b|\bRPD\b/i.test(error.detail)) return 'daily'
  if (error.status === 429 || error.status === 503 || /overload|rate.?limit|capacity/i.test(error.detail)) return 'cool'
  return 'model'
}

/** The body each provider takes. They all speak the OpenAI format, near enough. */
function requestBody(candidate, history) {
  const body = {
    model: candidate.model,
    max_tokens: 1024,
    stream: true,
    messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...history],
    tools: TOOLS,
  }
  if (candidate.provider.name === 'openrouter') {
    // Low effort, reasoning left on: short-form chat over a small, fixed
    // knowledge base, where depth is not what makes an answer good.
    body.reasoning = { effort: 'low' }
  } else {
    // Groq and NVIDIA reject a `strict` flag some of their models do not
    // support. The schemas are simple enough that the handler's own JSON
    // parse is the check that matters.
    body.tools = TOOLS.map(({ type, function: { strict, ...fn } }) => ({ type, function: fn }))
  }
  return body
}

async function complete({ candidates, history, send, signal, deadline }) {
  let lastError = new Error('No providers configured')
  const ruledOut = new Set()

  for (const candidate of candidates) {
    if (ruledOut.has(candidate.provider.name)) continue
    if (Date.now() > deadline) break

    // Text already on the visitor's screen from a failed attempt has to be
    // taken back before the next one writes its own, or the bubble reads as
    // two half-answers glued together.
    let streamed = 0
    const tracked = (event) => {
      if (event.type === 'text') streamed += event.text.length
      send(event)
    }

    const stall = new AbortController()
    const timer = setTimeout(() => stall.abort(), Math.min(FIRST_BYTE_MS, Math.max(1000, deadline - Date.now())))
    const onAbort = () => stall.abort()
    signal?.addEventListener('abort', onAbort)

    try {
      const res = await fetch(candidate.provider.endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${candidate.key}`,
          'Content-Type': 'application/json',
          ...candidate.provider.headers,
        },
        body: JSON.stringify(requestBody(candidate, history)),
        // A visitor who closes the tab stops the generation; a model that
        // never starts is abandoned for the next one.
        signal: stall.signal,
      })
      if (!res.ok || !res.body) {
        throw new UpstreamError(candidate.provider.name, res.status, await res.text().catch(() => ''))
      }

      const reply = await relay(res.body, tracked, () => clearTimeout(timer), candidate.provider.name)
      if (!reply.text.trim() && !reply.calls.length && reply.finish !== 'content_filter' && reply.finish !== 'refusal') {
        throw new UpstreamError(candidate.provider.name, 0, 'Empty reply')
      }
      send({ type: 'meta', model: id(candidate) })
      return reply
    } catch (error) {
      if (signal?.aborted) throw error
      lastError = stall.signal.aborted
        ? new UpstreamError(candidate.provider.name, 0, `No response within ${FIRST_BYTE_MS}ms`)
        : error
      console.warn(`[chat] ${id(candidate)} failed:`, lastError.message)
      if (streamed) send({ type: 'rewind', chars: streamed })

      const verdict = classify(lastError)
      if (verdict === 'daily' && candidate.provider.perModelLimits) {
        cooling.set(id(candidate), Date.now() + DAILY_COOLDOWN_MS)
      } else if (verdict === 'daily' || verdict === 'provider') {
        // A spent allowance or a bad key applies to every model on that key,
        // so the next visitor skips straight past all of them.
        const until = Date.now() + (verdict === 'daily' ? DAILY_COOLDOWN_MS : COOLDOWN_MS)
        ruledOut.add(candidate.provider.name)
        for (const c of candidates) if (c.provider === candidate.provider) cooling.set(id(c), until)
      } else if (verdict === 'cool') {
        cooling.set(id(candidate), Date.now() + COOLDOWN_MS)
      }
    } finally {
      clearTimeout(timer)
      signal?.removeEventListener('abort', onAbort)
    }
  }

  throw lastError
}

/**
 * The end of the line: every provider failed. If a tool already ran this
 * request, the visitor only needs that confirmed; otherwise the built-in
 * answers take the question.
 */
function answerWithoutModel(messages, toolsRun, send) {
  if (toolsRun.includes('capture_lead')) {
    send({ type: 'text', text: "Thanks — that's with the team, and they'll be in touch next business day." })
    return
  }
  if (toolsRun.includes('open_enquiry_form')) {
    send({ type: 'text', text: "I've opened the enquiry form for you — fill it in and the team will come back to you." })
    return
  }
  const reply = builtinReply(messages)
  if (reply.action) send({ type: 'action', ...reply.action })
  send({ type: 'text', text: reply.text })
  send({ type: 'meta', model: 'builtin' })
}

/* ==========================================================================
   The upstream stream

   Every provider streams OpenAI-style chunks: text arrives as `delta.content`, and
   a tool call arrives in pieces keyed by `index` — the id and name once, the
   JSON arguments as a string split across many chunks. Text is forwarded to
   the browser as it lands; tool calls and reasoning are assembled whole.
   ========================================================================== */

async function relay(body, send, onFirstByte, provider) {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  const calls = []
  const reasoning = []
  let text = ''
  let finish = null
  let model = null
  let buffer = ''
  let started = false

  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    if (!started) {
      started = true
      onFirstByte?.()
    }
    buffer += decoder.decode(value, { stream: true })

    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''

    for (const raw of lines) {
      const line = raw.trim()
      // Blank lines end frames; lines starting ':' are OpenRouter keep-alives.
      if (!line.startsWith('data:')) continue
      const data = line.slice(5).trim()
      if (data === '[DONE]') {
        return { text, calls: calls.filter(Boolean), reasoning: reasoning.filter(Boolean), finish, model }
      }

      let chunk
      try {
        chunk = JSON.parse(data)
      } catch {
        continue
      }
      // An upstream failure after streaming has started comes as a chunk, not
      // a status code.
      if (chunk.error) {
        throw new UpstreamError(provider, chunk.error.code ?? 0, chunk.error.message ?? JSON.stringify(chunk.error))
      }
      if (chunk.model) model = chunk.model

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

  // A stream that closes with no finish reason was cut off, not finished.
  if (!finish) throw new UpstreamError(provider, 0, 'Stream ended early')
  return { text, calls: calls.filter(Boolean), reasoning: reasoning.filter(Boolean), finish, model }
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

/** Reads from process.env, which vite.config.js fills from .env in dev. */
function readEnv(name) {
  // Trimmed, because a key pasted into a dashboard with a trailing space or
  // newline fails upstream as "missing authentication", which says nothing
  // about the real cause.
  const raw = typeof process !== 'undefined' && process.env?.[name] ? process.env[name] : globalThis[name]
  return typeof raw === 'string' ? raw.trim() || undefined : undefined
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
