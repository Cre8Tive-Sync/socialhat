/**
 * The Instagram feed — deliverable 05.
 *
 * A social media agency whose own website shows no social. This fixes that, and
 * it goes through the server for one reason: the token. Instagram's access
 * tokens are long-lived bearer credentials for the account, and a feed widget
 * that puts one in the page hands anybody who opens devtools the ability to read
 * that account's media as the account. So the browser asks us, and we ask
 * Instagram.
 *
 * The second reason is rate limits. Instagram counts calls per token, not per
 * visitor, so a page that fetched directly would spend the account's quota on
 * however many people happened to be reading. One cached call serves everyone.
 *
 * Same Web-standard shape as api/chat.js, so it runs on the same hosts and is
 * served in dev by the same plugin.
 */

export const config = { runtime: 'edge' }

/** Posts to show. Six is two rows of three, which is what the grid is built for. */
const LIMIT = 6

/**
 * How long a fetched feed is reused.
 *
 * Fifteen minutes. An agency posts a few times a week, so this is already far
 * finer-grained than the content changes — and the thing being protected is the
 * token's rate limit, not the freshness of a photograph.
 */
const TTL = 15 * 60 * 1000

/**
 * Warm-invocation cache.
 *
 * Module scope, so it survives between requests that land on the same instance
 * and is simply absent on a cold start. That is the right trade for this: no
 * infrastructure, no eviction policy, and the worst case is one extra upstream
 * call. The `Cache-Control` header below does the heavier lifting — the host's
 * CDN will serve most requests without ever reaching this function.
 */
let cache = { at: 0, payload: null }

export default async function handler(request) {
  if (request.method !== 'GET') return json({ error: 'Use GET.' }, 405)

  const token = readEnv('INSTAGRAM_TOKEN')
  const handle = readEnv('INSTAGRAM_HANDLE') || 'socialhat.media'

  // No token: say so in the payload rather than failing. The grid then renders
  // its follow card, which is a working link to a real account — worse than a
  // live feed, much better than an empty box or an error.
  if (!token) return json({ handle, posts: [], reason: 'unconfigured' })

  if (cache.payload && Date.now() - cache.at < TTL) {
    return json(cache.payload, 200, 'HIT')
  }

  try {
    const url = new URL('https://graph.instagram.com/v21.0/me/media')
    url.searchParams.set(
      'fields',
      'id,caption,media_type,media_url,permalink,thumbnail_url,timestamp',
    )
    url.searchParams.set('limit', String(LIMIT))
    url.searchParams.set('access_token', token)

    const res = await fetch(url, { signal: AbortSignal.timeout(6000) })
    const data = await res.json()

    if (!res.ok || data.error) {
      // The overwhelmingly common failure here is an expired token: Instagram's
      // long-lived tokens last 60 days and must be refreshed, so this will go
      // wrong roughly two months after it is set up and then stay wrong
      // quietly. Logged loudly for that reason.
      console.error('[instagram]', data.error ?? `HTTP ${res.status}`)
      return stale({ handle, posts: [], reason: 'upstream' })
    }

    const payload = {
      handle,
      reason: null,
      posts: (data.data ?? []).map(shape).filter((p) => p.src),
    }

    cache = { at: Date.now(), payload }
    return json(payload, 200, 'MISS')
  } catch (error) {
    console.error('[instagram]', error)
    return stale({ handle, posts: [], reason: 'upstream' })
  }
}

/**
 * Only what the grid draws.
 *
 * Instagram's own objects carry more than the page needs, and passing them
 * through whole would mean shipping every field they add to every visitor.
 * Captions are trimmed here rather than in CSS so the bytes are not sent at all.
 */
function shape(post) {
  return {
    id: post.id,
    // A video's `media_url` is the video file. The thumbnail is what belongs in
    // a grid — nobody wants six autoplaying clips — so it wins where it exists.
    src: post.media_type === 'VIDEO' ? (post.thumbnail_url ?? null) : (post.media_url ?? null),
    video: post.media_type === 'VIDEO',
    href: post.permalink,
    caption: (post.caption ?? '').split('\n')[0].slice(0, 140),
    at: post.timestamp ?? null,
  }
}

/**
 * Upstream failed. If there is anything cached at all — even past its TTL — it
 * is better than nothing: a feed that is an hour stale still proves the account
 * is alive, which is the entire point of putting it on the page.
 */
function stale(fallback) {
  if (cache.payload?.posts?.length) return json(cache.payload, 200, 'STALE')
  return json(fallback, 200, 'MISS')
}

function readEnv(name) {
  if (typeof process !== 'undefined' && process.env?.[name]) return process.env[name]
  return globalThis[name] ?? undefined
}

function json(payload, status = 200, cacheState) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'Content-Type': 'application/json',
      // The CDN holds it for the same window the function does, and will keep
      // serving the old copy for a day while it revalidates — so an expired
      // token degrades to a stale feed rather than to an empty one.
      'Cache-Control': 'public, s-maxage=900, stale-while-revalidate=86400',
      ...(cacheState ? { 'X-Feed-Cache': cacheState } : {}),
    },
  })
}
