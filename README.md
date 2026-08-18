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
and no dead frame in between. Three things move together, all off two custom
properties (`--scene`, `--handoff`) that `useHeroScroll` writes onto the root
element — no React render, no second scroll listener, no rAF loop:

1. **The camera holds.** Scrub progress is clamped at 1, so the last frame stays
   on screen for the whole handover.
2. **A sheet of Paper fades in over it** (`.hero__curtain`), and the story
   overlay fades out with it, so the sign-off mark dissolves along with the shot
   it was set against.
3. **The site rides up through it.** `<Site>` is pulled up over the tail of the
   hero by exactly one viewport, so its first rule crosses the bottom of the
   screen on the frame the paper starts fading in.

The one-viewport overlap is not a taste call. The site rises at scroll speed, so
one viewport of scroll is precisely what it needs to travel from the bottom edge
to the top and land flush there on the frame the paper reaches full opacity. Any
other number leaves either a strip of blank paper or a website that arrives
before the film has gone. `HANDOFF_VIEWPORTS` in
[src/config.js](src/config.js) states it once and `HANDOFF_START` derives from
it, so changing `SCROLL_PAGES` cannot break the geometry.

The top bar is absent for the whole film — that shot swings from white sketch
paper to a dark room, and no single treatment survives both — and fades in with
the paper. It only becomes interactive once `data-phase` on the root flips to
`site`, and the film's own chrome (scrub bar, scroll cue) clears out on the same
value.

### 6. The website

[src/ui/Site.jsx](src/ui/Site.jsx) is the second act: top bar, the case for the
work, a schedule of five services, the track record, the client list, signage,
the site office and its form, and the footer. Plain semantic DOM throughout.

It runs the palette upside down from the film. Everything is scoped to `.paper`
in [src/ui/site.css](src/ui/site.css), where `--ink` is the dark mark and
`--paper` is the ground — the exact inverse of the tokens above it — so the two
halves can share one page without either one having to compromise. Rules and
marks are always Steel; only the weight varies. Sections lift into place once
each on an `IntersectionObserver`, and stay put under
`prefers-reduced-motion: reduce`.

### 7. Why the text is DOM, not geometry

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
| `SCROLL_PAGES` | config | `6` | Viewport-heights the pinned hero occupies. One of them is the handover, the rest carry the 7.04s clip. Higher = slower, more deliberate camera. |
| `HANDOFF_VIEWPORTS` | config | `1` | Viewports of scroll the dissolve takes. `HANDOFF_START` derives from it; the site's overlap matches it. |
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

`npm run pack-model` ([scripts/gltf-to-glb.mjs](scripts/gltf-to-glb.mjs), zero
dependencies) repacks it into `public/models/scene.glb`: **82 MB to 61.6 MB**,
with the same bytes stored raw. `scene.gltf` is untouched and remains the
source of truth; the `.glb` is generated and gitignored.

It's still a 61 MB download. If you need it materially smaller, run the output
through Draco or Meshopt compression:

```bash
npx @gltf-transform/cli optimize public/models/scene.glb public/models/scene.glb --compress meshopt
```

then enable the matching loader (`useGLTF(url, true)` for Draco, or drei's
meshopt support) in `ScrollScene`.

## Layout

```
scene.gltf                     source model (untouched)
scripts/gltf-to-glb.mjs        .gltf + base64 -> binary .glb packer
public/models/scene.glb        generated, gitignored
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
