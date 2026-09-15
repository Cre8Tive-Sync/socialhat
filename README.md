# socialhat

Two acts on one page. First a React + three.js film: the page renders through
the camera baked into `scene.gltf`, scrubs that camera's animation from the
scroll position, and tells a four-beat story in DOM text keyed to the
animation's own keyframes. Then, when the animation runs out and the visitor
keeps scrolling, the film dissolves into the actual socialhat website — the
agency site, in full, on the same scroll.

```bash
npm install
npm run dev
```

`predev` packs the model automatically the first time, so `npm run dev` is all
you need from a clean checkout.

The assistant (§8) needs a key. Without one the site runs and the widget
degrades to a handoff; with one it works in dev exactly as in production:

```bash
ANTHROPIC_API_KEY=sk-ant-... npm run dev
```

## How it works

### 1. The three.js scene

[src/three/Experience.jsx](src/three/Experience.jsx) mounts a react-three-fiber
`<Canvas>` inside a `position: sticky` stage, which pins it for the length of
the hero block and then lets it scroll away. There are no lights
in the React tree: `scene.gltf` ships its own (3 point lights + a sun via
`KHR_lights_punctual`), and `GLTFLoader` instantiates them for you.

The canvas is `pointer-events: none` and `touch-action: pan-y`, so wheel and
touch gestures fall through to the document and the page keeps scrolling.

### 2. The camera comes from the glTF

[src/three/ScrollScene.jsx](src/three/ScrollScene.jsx#L24-L37) pulls
`cameras[0]` off the loaded model and hands it to R3F with `set({ camera })`.
The camera object stays parented inside the glTF scene graph, which is what
lets the animation drive it.

- **`camera.manual = true`** stops R3F from overwriting `aspect`/`fov` on every
  resize, because this file owns them instead.
- **Framing is preserved on narrow viewports.** The camera was authored at a
  1.49:1 aspect with a tight 22.9° vertical FOV. Stock three.js keeps the
  vertical FOV fixed, so a phone in portrait would crop the sides off the
  composition. Instead, when the viewport is narrower than authored, the
  vertical FOV widens to hold the same *horizontal* slice in shot. Set
  `PRESERVE_AUTHORED_FRAMING = false` in [src/config.js](src/config.js) for
  stock behaviour.

### 3. Scroll drives the animation

The clip is `CameraAction`, 7.04s, animating the `Camera` node.

Rather than *playing* it, the action is armed and then **paused**, and scroll
position sets the playhead directly:

```js
action.play()
action.paused = true          // the mixer never advances time on its own

// every frame:
action.time = scrollProgress * clip.duration
mixer.update(0)               // re-evaluate at that time, don't advance the clock
```

`mixer.update(0)` is the important part: a zero delta makes the mixer sample
the tracks at whatever `action.time` you set without stepping the clock, so
scrubbing is exact and fully reversible in both directions.

[src/hooks/useHeroScroll.js](src/hooks/useHeroScroll.js) measures scroll against
the **hero block**, not the document — the site below it must not stretch the
camera move — and returns the position as a **ref, not state**, because
re-rendering React at 60fps to move a camera would be wasted work. The render
loop reads `.current` inside `useFrame`, damps it with `THREE.MathUtils.damp`,
and publishes the result in milliseconds so the story overlay rides the same
clock as the camera.

The animation is mapped to the first `HANDOFF_START` of that travel and holds
its last frame after it. The rest is the handover, below.

**The canvas renders on demand, not on a loop.** `frameloop="demand"` means
nothing is drawn unless something asks for a frame, and only two things ever do:
the scroll listener, when the scroll has actually moved the camera somewhere
new, and `useFrame` itself, for as long as the damping has not yet arrived
(damping is asymptotic, so it snaps to the target inside 1e-4 — otherwise it
would ask for frames forever). The consequence worth having is at the other end:
once the film is over, the camera is clamped and nothing invalidates, so the
entire website scrolls with the GPU idle instead of against a 60fps redraw of
one held frame.

The same listener is written to cost as close to nothing as possible per event.
The hero's geometry is measured on resize rather than per scroll, so reading
scroll never forces a synchronous layout, and each custom property is only
written when its value actually changed — a write to `:root` invalidates the
style of everything that inherits it, which is the whole document. Past the
handover all four values are pinned, so scrolling the site costs nothing.

### 4. The story layer

[src/story.js](src/story.js) holds the beats; [src/ui/Story.jsx](src/ui/Story.jsx)
renders them.

**The frame numbers are 24fps.** `scene.gltf`'s sampler keys sit exactly 1/24s
apart and run frame 1 to 169 (169 / 24 = 7.0417s, the clip duration), so the
ranges in the brief decode as frames and are converted to milliseconds in
`story.js` via `frameToMs()`. If your source timeline was a different rate,
change `FPS` there and everything re-derives.

| Beat | Frames | Milliseconds | Scroll | Placement | Icon |
| --- | --- | --- | --- | --- | --- |
| `hero` | 0-4 | 0-167 | 0-7% | lower left | none |
| `process` | 35-74 | 1458-3083 | 16-48% | upper left | research |
| `evidence` | 90-110 | 3750-4583 | 48-70% | centre right | evidence |
| `signoff` | 156-170 | 6500-7083 | 88-100% | centred | the logo |

The listed range is the window where a beat sits at **full opacity**. The
crossfade happens in the 8 frames on either side of it, so every frame you
asked for is fully legible. `hero` starts at frame 0 and so has no room to fade
in, which is what you want from a hero: already there when the page loads.
`process` finishes fading out at 3417ms and `evidence` starts fading in at
3417ms, so the handoff is seamless with zero overlap.

**Placement is per beat, and tuned to what the camera is looking at.** Each beat
carries `place: { x, y, w }` in `story.js`, positioning the block against the
viewport so the copy sits in open space rather than across the figures in the
scene. Those are desktop compositions; below 40rem everything collapses to one
column anchored low, where a thumb is not covering it.

**There are no scrims.** All type is white, and legibility comes from a
`text-shadow` sized in `em` so it stays proportional from 84px display type down
to body copy. It is tight to the glyphs rather than a wash across the picture:
invisible against the dark room, and what separates the white type from the
white sketch paper of the opening shot.

**The type only crossfades.** No drift, no blur, no per-word reveal, no
parallax. Beats fade in and out and nothing else moves.

**The icons are the one thing that animates.** Beats 2 and 3 carry an authored
SVG mark ([src/ui/Icons.jsx](src/ui/Icons.jsx)) that draws itself in as the beat
arrives: a brief under a magnifier for the research beat, plotted results
against an axis for the evidence beat. Both are real drawn paths on one
consistent 2px stroke, no icon font and no emoji.

Every stroke carries `pathLength="1"`, which normalises it to a length of 1 and
lets the draw-on run straight off a 0-1 progress value with no measuring. A
per-stroke `data-delay` staggers them, so each mark builds in the order someone
would actually draw it. Under `prefers-reduced-motion` the icons are simply
already finished.

**Nothing in the overlay re-renders.** One rAF loop reads the shared timeline
ref and writes custom properties; CSS turns those into the choreography.

### 5. The handover

The film ends and the website begins on one continuous scroll, with no jump cut
and no dead frame in between — and it happens **at the centre of the picture,
not at its bottom edge**. Nothing slides in. Everything is keyed to custom
properties `useHeroScroll` writes onto the root element; no React render, no
second scroll listener, no rAF loop except the one that damps the reveal:

1. **The camera holds.** Scrub progress is clamped at 1, so the last frame stays
   on screen for the whole handover, and the canvas goes idle — it has nothing
   left to draw (see §3).
2. **Paper opens out of the middle of that frame.** `.hero__curtain` is a disc,
   not a sheet: a soft-edged radial gradient scaled up from the centre of the
   screen. Scale is the one thing the compositor does without repainting, so the
   flood costs nothing on the frames that need the budget most. The shot leans
   in 4.5% underneath it, so it reads as receding rather than being wiped off,
   and the story overlay is gone before the paper reaches the corners.
3. **The site comes up through it, held dead still.** It grows in from 0.96 with
   its transform origin on the centre of the screen — the same point the paper
   is flooding out of — while the top bar arrives last, once the site is
   already there.

The stillness is the part that takes the work. `<Site>` is pulled up over the
hero's last viewport so that its first rule lands flush with the top of the
screen on the frame the hero runs out; left alone, it would ride up the screen
at scroll speed for the whole handover, which is the slide this replaces. So CSS
cancels it: `--handoff-travel` is exactly how far it would travel, and a
`translate3d` of `(--handoff - 1) × --handoff-travel` holds it at the top of
the screen from the first frame of the handover to the last.

That is also why there are two numbers for one transition:

| | |
| --- | --- |
| `--handoff` | Exact, welded to the scrollbar. Drives the geometry — the hold above. Damping *here* would show up as the site drifting, which is the thing we are getting rid of. |
| `--reveal` | The same number, exponentially damped in a rAF loop. Drives the *look* — the flood, the fade, the growth. A 100px wheel notch steps `--handoff`; `--reveal` eases across it at 60fps, which is what makes a half-viewport handover read as smooth rather than as four hard steps. |

Both transforms come off the site the instant it owns the screen: a transform on
`.paper` makes it the containing block for the fixed top bar, which is harmless
while the two are pinned together and wrong the moment the page scrolls on.
`data-phase` flips to `site` only at a dead-exact `--handoff` of 1, which is
the one frame where dropping the transform costs nothing, because it is already
identity. The film's own chrome (scrub bar, scroll cue) clears out on the same
pass, and the top bar becomes interactive.

Under `prefers-reduced-motion: reduce` the hold stays — it is geometry, not
decoration — and the motion goes: the paper stops opening from the centre and
fades in flat, the frame holds still, the site does not grow.

### 6. The website

[src/ui/Site.jsx](src/ui/Site.jsx) is the second act: top bar, the case for the
work, a schedule of five services, the track record, the client list, signage,
the ask, the enquiry form and the footer. Plain semantic DOM throughout.

It runs the palette upside down from the film. Everything is scoped to `.paper`
in [src/ui/site.css](src/ui/site.css), where `--ink` is the dark mark and
`--paper` is the ground — the exact inverse of the tokens above it — so the two
halves can share one page without either one having to compromise. Rules and
marks are always Steel; only the weight varies. Sections lift into place once
each on an `IntersectionObserver`, and stay put under
`prefers-reduced-motion: reduce`.

### 7. The enquiry form

[src/ui/Enquiry.jsx](src/ui/Enquiry.jsx) replaces the four near-identical forms
the old site ran. Four different people arrive at them — an agency client,
someone who wants a website, a venue with blank wall space, an advertiser buying
screen time — and they all land looking the same, so every one of them needs a
phone call before anyone knows what they wanted.

This asks that question once, up front, then renders only the fields that path
needs and routes the result to the inbox that handles it. The shape is data:
`PATHS` drives the chooser and each path's `fields` drives its panel, so a new
question is a line in an array. A field with `showIf` that is not showing is not
part of the form at all, not merely hidden, so nothing stale is ever submitted.

Two things are deliberately absent:

- **No maths test.** The live forms ask you to solve `5 + 9 =` before they will
  send — friction paid by every real enquiry to inconvenience a bot for one
  second. In its place: an off-screen honeypot field and a three-second
  time-to-submit floor. Both trip silently, returning the success state rather
  than an error, so a bot has nothing to learn from.
- **No `New Field`.** Every field is there because the answer changes how the
  follow-up goes.

Everything answered by tapping — the path cards, the multi-picks, the single
choices — is a real `<button>` carrying `aria-pressed`, not a styled checkbox.

`ENQUIRY_ENDPOINT` in [src/config.js](src/config.js) is where the JSON POSTs.
While it is empty the form composes the same payload as a `mailto:` addressed to
the path's inbox, so it works and is testable with no server. Set the endpoint
and the fallback drops out with no other change. The routing table is the
`inbox` key on each path in `PATHS` — all four point at `info@` today because it
is the only address the business publishes.

### 8. HatBot

SocialHat is staffed 8am–4pm weekdays. Every visitor outside that window
currently reaches a form and hears nothing until the next business morning, and
most of them don't wait. [src/ui/Assistant.jsx](src/ui/Assistant.jsx) answers
them, and when one is worth a call it takes their details instead.

**Being noticed is half the job.** A corner pill only works on someone who
already reads a corner pill as "chat", and a good share of this audience —
business owners who came here for a phone number — does not. So three things
are deliberate: the launcher is larger than every other button on the site, set
in the body face rather than the uppercase mono the rest of the furniture uses,
and it keeps its label on a phone rather than collapsing to an icon. And after
`CHAT_NUDGE_DELAY` of reading, HatBot speaks first: a one-line cream speech
bubble above the launcher, notched corner aimed at it. The bubble *is* the
button — one target, the whole surface — with an × beside it, and once that is
hit the nudge does not come back that visit (`sessionStorage`, wrapped, because
the accessor itself throws in a private window). The prompt is told the same thing the CSS is: assume the reader may not
use chatbots often, never ask anyone to rephrase, guess at what they meant and
say what you assumed.

The browser half knows nothing. The system prompt, the facts and the tool
definitions all live in [api/knowledge.js](api/knowledge.js), which is never
bundled — a visitor can read the answers, not the instructions — and the API key
never leaves the function.

**The endpoint.** [api/chat.js](api/chat.js) takes a Web-standard `Request` and
returns a streaming SSE `Response`, which is the shape Vercel Edge, Netlify
Functions v2 and Cloudflare Workers all accept.
[vite-api-plugin.js](vite-api-plugin.js) adapts Connect's `(req, res)` to that
same file in `npm run dev`, so there is one implementation and no mock. Set
`ANTHROPIC_API_KEY`; without it the endpoint streams a handoff to the form and
the phone number rather than 500ing, so a keyless deploy degrades instead of
breaking.

**Two tools.** `capture_lead` records an enquiry (POSTed to `LEAD_WEBHOOK`, or
logged with the model told plainly it wasn't delivered, so it never tells a
visitor something untrue). `open_enquiry_form` reaches out of the chat and opens
§7's form on the right path, via a `socialhat:enquiry` window event — the
visitor lands on a form already filled in as far as the conversation got, rather
than a blank one.

**Model settings**, and why:

- `claude-opus-5` at `effort: "low"`. This is short-form chat over a small fixed
  knowledge base; depth isn't what makes it good, and low effort is roughly a
  third of the latency.
- Thinking stays on. With it disabled, Opus 5 occasionally writes a tool call
  into its visible text instead of emitting a `tool_use` block — here that would
  be a lead silently never captured.
- The system prompt is byte-identical every request and carries the only cache
  breakpoint; the conversation sits after it and doesn't disturb it.
- `stop_reason: "refusal"` is checked before the content is read, since a
  refusal arrives as a normal 200.

**Untrusted input.** The client replays its own history, so the server rebuilds
the shape rather than trusting it: roles narrowed to user/assistant, content
forced to a string, length and count capped, leading non-user turns dropped. A
`system` role smuggled into the array would be an operator instruction written
by a visitor. Per-IP **rate limiting is not in this code** and belongs in the
host's edge config — a public unauthenticated LLM endpoint is a standing bill.
Set one before launch.

### 9. The portfolio

The live Recent Work page is one unsorted scroll — a Telstra TVC, a recruitment
website and a pizza shop's social campaign stacked in whatever order they were
added. Someone who wants to see websites reads past nine video projects to find
the two that are theirs, and mostly doesn't.
[src/ui/Work.jsx](src/ui/Work.jsx) is the same ten jobs with a filter over them.

**A job can be several kinds.** Monford was the website, the social accounts and
the video; it belongs under all three, and splitting it into three cards to make
the filter tidier would misrepresent what was done. So `kinds` is a list and
filtering is a has-this-tag test. Counts ride inside each chip, so nobody
presses a filter and is surprised by what comes back.

**These cards do not carry `data-reveal`.** That observer is set up once over the
nodes present at mount — a card rendered after a filter change is never observed
and would sit at `opacity: 0` forever. They animate themselves instead, and the
grid is keyed on the active filter so the whole set replays its entrance when
you change it. That is not decoration: the page doesn't scroll when you filter,
so without it the only evidence anything happened is a number changing.

**Two honest gaps**, both deliberate:

- **No artwork.** Nothing has stills yet. `image` is the slot; until it is
  filled a card renders the client's name at display size rather than a grey
  rectangle apologising for itself — which is what a prospect is scanning for
  anyway.
- **No signage case study.** SocialHat runs screens across Perth and has a
  client on record crediting them, but there is no signage write-up anywhere on
  the current site to carry across. The filter stays, because hiding a service
  they sell would imply they don't, and it shows a designed empty state that
  says the work exists and the write-up doesn't, with a route to ask.

Nothing in the copy claims a result — no view counts, no lead numbers, no
awards. A case study asserting something the business can't stand behind is
worse than one that just says what was made.

### 10. The feed, and the polish

**The feed.** A social media agency whose own site shows no social quietly
undercuts everything else on the page.
[src/ui/Feed.jsx](src/ui/Feed.jsx) draws the grid;
[api/instagram.js](api/instagram.js) fetches it. It goes through the server for
two reasons: Instagram's tokens are long-lived bearer credentials for the
account, so a widget holding one in the page hands it to anyone who opens
devtools; and Instagram rate-limits per token, not per visitor, so a page
fetching directly spends the account's quota on however many people are reading.
One cached call (15 min in-process, plus `s-maxage` at the CDN) serves everyone.

The failure mode matters more here than anywhere else, because a broken feed
proves the opposite of what the feed was put there to prove. There is exactly
one thing it renders when it has no posts for any reason — a card pointing at
the real account. Always the last cell of the grid, never conditional, so with
posts it is the way out and without them it is the section. `stale-while-revalidate`
means an expired token degrades to an old feed rather than an empty one — worth
knowing, since Instagram's long-lived tokens expire at 60 days and will go wrong
quietly two months after setup.

**Speed.**

- **Plain Barlow was being downloaded by every visitor and used by nothing.**
  Three weights in two formats; `styles.css` names only "Barlow Condensed".
  Removed — about 126KB of font off every first load.
- **three / fiber / drei now build to their own chunk** (966KB) separate from the
  site's code (236KB). This does not shrink the first visit; it means a copy
  edit no longer expires a megabyte of library that a returning visitor already
  had. Note rolldown — Vite 8's bundler — accepts only the *function* form of
  `manualChunks`; the object form throws at build time.
- **A pre-boot curtain in [index.html](index.html).** Everything is React and
  React arrives behind three.js, so `#root` was empty and the first thing a
  visitor saw was a white screen until that parsed. The curtain is plain HTML
  with inline CSS, painting on the browser's first frame with nothing to fetch.
  It is removed from an effect in [App.jsx](src/App.jsx), not from the line
  after `render()` — `createRoot().render()` *schedules* the work rather than
  performing it, so the next statement can run before a single node is in the
  document and would pull the curtain to expose an empty `#root`. Its colours
  are the film's `--bg`/`--ink`, hard-coded, and have to stay in step with
  styles.css or the handover to the app's own loader flashes.

**SEO.** The head had a real bug: `og:image` was `/images/socialhat-mark.jpg` —
a path, not a URL — which every crawler resolves against its own host and none
of them find, so the site has been sharing with no image at all. Now absolute,
alongside `canonical`, `og:url`, `og:site_name`, `og:locale`, and a title and
description that name Perth and the services rather than competing on the word
"studio". The largest addition is **`ProfessionalService` JSON-LD** — address,
phone, hours, service catalogue, `sameAs` — because a Perth agency is found
through the local pack and the knowledge panel far more than through a blue
link, and both are fed by structured data the current site has none of. Plus
[robots.txt](public/robots.txt) (disallowing `/api/`, which costs money per call)
and [sitemap.xml](public/sitemap.xml).

The `<meta name="viewport">` has no `maximum-scale` and no `user-scalable=no`,
which is the fix for F5. It has to stay that way.

### 11. Why the text is DOM, not geometry

Every heading is a real `<h1>`/`<h2>`, every paragraph a real `<p>`, inside a
`<main>`: selectable, translatable, and crawlable. Verified by SSR-rendering the
component and extracting the text, which comes out as clean prose. The icons are
`aria-hidden`, since the copy beside them already says it.

- **Beats fade with `opacity`, never `display: none`,** so the copy stays in the
  DOM and the accessibility tree at all times.
- **This is still a client-rendered SPA.** Google executes JS and will see the
  copy, but the strongest signal is HTML that already contains it. If SEO is a
  priority, prerender the route with `vite-plugin-prerender` or move to a
  framework with SSR. That is the one remaining gap.

Title, description and Open Graph tags are in [index.html](index.html).

## Tuning

| Setting | Where | Default | Effect |
| --- | --- | --- | --- |
| `SCROLL_PAGES` | config | `6` | Viewport-heights the pinned hero occupies. The tail of the last one is the handover, the rest carry the 7.04s clip. Higher = slower, more deliberate camera. |
| `HANDOFF_VIEWPORTS` | config | `0.5` | Viewports of scroll the handover takes. `HANDOFF_START` and the distance the site is held against both derive from it, so it is safe to change on its own. Lower = faster. |
| `HANDOFF_SMOOTHING` | config | `9` | Damping on `--reveal`, the look of the handover. Higher tracks the scrollbar more tightly; lower glides more. The geometry is never damped. |
| `SCROLL_SMOOTHING` | config | `4` | Damping. Higher tracks the scrollbar more tightly; lower glides more. |
| `PRESERVE_AUTHORED_FRAMING` | config | `true` | Widen FOV instead of cropping on narrow viewports. |
| `LOGO_SRC` | config | `-dark.svg` | Sign-off mark. |
| `FPS` | story | `24` | Frame rate the beat numbers are interpreted at. |
| `FADE_FRAMES` | story | `8` | Crossfade length on either side of each beat. |
| `BEATS[].place` | story | per beat | `{ x, y, w }` position of the copy block. |
| `BEATS[].icon` | story | per beat | `research`, `evidence`, or omitted. |

**About the logo.** `socialhat_logo-dark.svg`, the `#1D1F20` near-black mark,
lands on the bright surface the camera finishes on. The sign-off beat carries no
scrim, so nothing darkens the plate behind it. The identical artwork in
`#F2F2F3` is at `-light.svg` if the shot ever changes.

**Want the animation to play through once on first scroll instead of
scrubbing?** In `ScrollScene`, drop the `action.paused = true` line and replace
the `useFrame` body with `mixer.update(delta)`, gated on a "has scrolled" flag.

## Typography

Barlow Condensed, self-hosted via `@fontsource`: latin subset, weights 400 /
500 / 700 only, about 65KB of woff2 total. No CDN request, no render-blocking
stylesheet. Three roles: 700 for display headings, 500 for body copy (one step
up from regular, because light-on-dark condensed type needs it), 400 for micro
labels. Headings run at `line-height: 0.94` and body at `1.32`, tight enough
that the two sit in the same rhythm.

The one contrast risk left is the hero, which is white type over the brightly
lit sketch paper. The drop shadow is what carries it. If it reads thin on your
screen, the options in order of least disruption are: deepen `--ink-shadow` in
`src/styles.css`, move that beat somewhere darker via its `place` in
`story.js`, or set it back in `--ink-deep`.

## The model

`scene.gltf` (82 MB) stores its geometry buffer and all 13 textures as base64
data URIs. That inflates the bytes ~33% and forces the browser to parse one
enormous JSON string and `atob()` it before anything can render.

`npm run pack-model` runs three steps. `scene.gltf` is untouched throughout and
remains the source of truth; everything below it is generated and gitignored.

1. [scripts/gltf-to-glb.mjs](scripts/gltf-to-glb.mjs) (zero dependencies)
   repacks it into `public/models/scene.glb` — **82 MB to 61.6 MB**, the same
   bytes stored raw instead of base64.
2. [scripts/draco-compress.mjs](scripts/draco-compress.mjs) Draco-compresses the
   geometry in place — **61.6 MB to 10.7 MB**, a 5.8x reduction.
3. [scripts/copy-draco-decoder.mjs](scripts/copy-draco-decoder.mjs) copies
   three's decoder into `public/draco/`, so the browser has something to decode
   with.

Draco earns its keep here because geometry and index data are ~88% of the file
(46.1 MB and 7.8 MB against 7.6 MB of texture). It only compresses geometry —
the textures pass through untouched, and are now the largest thing left.

The encode drops ~2000 degenerate zero-area triangles and moves vertices by at
most 0.003% of each mesh's bounding box, under the 0.0061% step that 14-bit
quantisation implies. Total surface area is unchanged. There are no skins and no
morph targets, which is where Draco quantisation normally causes visible
trouble, and the camera animation is 3 channels that Draco does not touch.

The decoder is copied out of `three` rather than loaded from drei's default
gstatic CDN, so its version cannot drift from the `three` we build against and
first paint does not depend on a third party. `DRACO_DECODER_PATH` in
`src/config.js` is passed to both `useGLTF` and `useGLTF.preload` in
`ScrollScene` — they have to match, because drei keys its cache on the URL alone.

If you need it smaller still, the textures are the remaining target, and that
means KTX2/Basis rather than Draco.

## Layout

```
scene.gltf                     source model (untouched)
scripts/gltf-to-glb.mjs        .gltf + base64 -> binary .glb packer
scripts/draco-compress.mjs     Draco geometry compression, in place
scripts/copy-draco-decoder.mjs three's Draco decoder -> public/draco/
public/models/scene.glb        generated, gitignored
public/draco/                  generated, gitignored
public/images/                 logo, dark + light
src/config.js                  scroll, camera and logo tunables
src/story.js                   beat copy, frame ranges, placement, fade curves
src/hooks/useScrollProgress.js scroll position as a ref
src/three/Experience.jsx       the Canvas
src/three/ScrollScene.jsx      model + camera swap + scroll scrub
src/ui/Story.jsx               the four narrative beats
src/ui/Icons.jsx               authored SVG marks for beats 2 and 3
src/ui/Overlay.jsx             loading curtain, scrub bar, scroll cue
src/styles.css                 tokens, type system, beat choreography
```
