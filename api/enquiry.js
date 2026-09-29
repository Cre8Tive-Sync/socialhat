/**
 * The enquiry endpoint, for `npm run dev` and function hosts.
 *
 * Production is SiteGround, where server/public/api/enquiry.php emails the
 * enquiry. This is its stand-in wherever Node runs: in dev it prints the
 * enquiry to the terminal and reports success, so the form's whole flow can be
 * exercised without sending mail; on a function host it forwards to
 * ENQUIRY_WEBHOOK, and with none set it says so with a 503 rather than
 * pretending — the form then shows the visitor the phone and email instead.
 */

export const config = { runtime: 'edge' }

const PATHS = ['marketing', 'website', 'host', 'advertise']

export default async function handler(request) {
  if (request.method !== 'POST') return json({ error: 'Use POST.' }, 405)

  let enquiry
  try {
    enquiry = await request.json()
  } catch {
    return json({ error: 'Expected JSON.' }, 400)
  }
  if (!PATHS.includes(enquiry?.path)) return json({ error: 'Unknown enquiry type.' }, 400)
  if (!enquiry.name?.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(enquiry.email ?? '')) {
    return json({ error: 'A name and a valid email are needed.' }, 400)
  }

  const hook = typeof process !== 'undefined' ? process.env.ENQUIRY_WEBHOOK?.trim() : undefined
  if (hook) {
    const res = await fetch(hook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(enquiry),
    }).catch(() => null)
    return res?.ok ? json({ ok: true }) : json({ error: 'Not delivered.' }, 502)
  }

  // Vite's dev server loads this through ssrLoadModule, which sets DEV.
  if (import.meta.env?.DEV) {
    console.log('[enquiry] (dev — not sent)\n' + JSON.stringify(enquiry, null, 2))
    return json({ ok: true })
  }

  console.warn('[enquiry] ENQUIRY_WEBHOOK is not set — enquiry not delivered.')
  return json({ error: 'Not delivered.' }, 503)
}

function json(payload, status = 200) {
  return new Response(JSON.stringify(payload), { status, headers: { 'Content-Type': 'application/json' } })
}
