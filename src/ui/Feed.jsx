import { useEffect, useRef, useState } from 'react'
import { FEED_ENDPOINT, INSTAGRAM_URL } from '../config'
import { usePhase } from '../hooks/usePhase'

/**
 * The live feed — deliverable 05, and the fix for F6.
 *
 * A social media agency whose own site shows no social. Whatever else the page
 * argues, an empty one quietly undercuts it: the strongest evidence that
 * SocialHat can run an account is SocialHat running an account.
 *
 * Which means the failure mode matters more here than anywhere else on the
 * page. A feed that renders an error, an empty box or six grey rectangles is
 * worse than no feed at all — it proves the opposite of what it was put here to
 * prove. So there is exactly one thing this renders when it has no posts, for
 * any reason: a card pointing at the real account. That is still true, still a
 * working link, and it never looks broken.
 *
 * The token lives in [api/instagram.js](../../api/instagram.js) and is never in
 * this bundle.
 */

export function Feed() {
  const [posts, setPosts] = useState([])
  const awake = usePhase() === 'site'
  const asked = useRef(false)

  useEffect(() => {
    // Not until the site has the screen.
    //
    // This section mounts with the rest of the page, which is while the film is
    // still running and streaming an 11MB model. A feed request fired then is
    // six thumbnails competing for bandwidth with the one download the visitor
    // is actually waiting on — in the deliverable that is meant to make the
    // site faster. It waits.
    //
    // `asked` rather than a dependency on `awake` alone: the phase is derived
    // from scroll position every frame, so it goes back to `scene` when someone
    // scrolls up and returns to `site` on the way back down. Without the latch
    // that is a fresh fetch every round trip.
    if (!awake || asked.current || !FEED_ENDPOINT) return
    asked.current = true

    const controller = new AbortController()

    fetch(FEED_ENDPOINT, { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setPosts(data?.posts ?? []))
      // Nothing to report. An unreachable feed is the follow card, which is
      // what an empty `posts` already renders.
      .catch(() => {})

    return () => controller.abort()
  }, [awake])

  return (
    <section className="section-pad feed" id="social">
      <div className="wrap">
        <div className="section-head" data-reveal>
          <p className="eyebrow" style={{ '--chip': 'var(--marigold)' }}>
            Live from the studio
          </p>
          <h2>We practise what we sell.</h2>
          <p>
            Straight off <a href={INSTAGRAM_URL}>@socialhat.media</a> — the same account we&rsquo;d
            be running for you.
          </p>
        </div>

        <div className="feed-grid" data-reveal>
          {posts.map((post) => (
            <a
              key={post.id}
              className="feed-tile"
              href={post.href}
              target="_blank"
              rel="noopener noreferrer"
            >
              <img
                src={post.src}
                // The caption is the alt text where there is one: it is what the
                // post is actually about, written by the people who made it, and
                // it beats anything generated from "Instagram post 3 of 6".
                alt={post.caption || 'Recent work from SocialHat on Instagram'}
                loading="lazy"
                decoding="async"
              />
              {post.video ? (
                <span className="feed-play" aria-hidden="true">
                  <svg viewBox="0 0 24 24">
                    <path d="M8 5l11 7-11 7z" />
                  </svg>
                </span>
              ) : null}
              {post.caption ? <span className="feed-cap">{post.caption}</span> : null}
            </a>
          ))}

          {/* Always last, never conditional on the feed being empty — with posts
              it is the way out of the grid, and without them it is the grid. */}
          <a className="feed-follow" href={INSTAGRAM_URL} target="_blank" rel="noopener noreferrer">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 2c2.7 0 3.1 0 4.1.1 1.1 0 1.8.2 2.5.5.6.3 1.1.6 1.6 1.1.5.5.8 1 1.1 1.6.3.7.5 1.4.5 2.5.1 1 .1 1.4.1 4.1s0 3.1-.1 4.1c0 1.1-.2 1.8-.5 2.5-.3.6-.6 1.1-1.1 1.6-.5.5-1 .8-1.6 1.1-.7.3-1.4.5-2.5.5-1 .1-1.4.1-4.1.1s-3.1 0-4.1-.1c-1.1 0-1.8-.2-2.5-.5-.6-.3-1.1-.6-1.6-1.1-.5-.5-.8-1-1.1-1.6-.3-.7-.5-1.4-.5-2.5C2 15.1 2 14.7 2 12s0-3.1.1-4.1c0-1.1.2-1.8.5-2.5.3-.6.6-1.1 1.1-1.6.5-.5 1-.8 1.6-1.1.7-.3 1.4-.5 2.5-.5C8.9 2 9.3 2 12 2zm0 5a5 5 0 100 10 5 5 0 000-10zm0 8.2A3.2 3.2 0 1112 8.8a3.2 3.2 0 010 6.4zm5.2-8.4a1.2 1.2 0 100-2.4 1.2 1.2 0 000 2.4z" />
            </svg>
            <strong>@socialhat.media</strong>
            <span>Follow along</span>
          </a>
        </div>
      </div>
    </section>
  )
}
