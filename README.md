# socialhat

A React + three.js scroll experience. The page renders through the camera baked
into `scene.gltf`, scrubs that camera's animation from the scroll position, and
tells a four-beat story in DOM text keyed to the animation's own keyframes.

```bash
npm install
npm run dev
```

`predev` packs the model automatically the first time, so `npm run dev` is all
you need from a clean checkout.

## How it works

### 1. The three.js scene

[src/three/Experience.jsx](src/three/Experience.jsx) mounts a react-three-fiber
`<Canvas>`, pinned full-screen behind the scrollable page. There are no lights
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

[src/hooks/useScrollProgress.js](src/hooks/useScrollProgress.js) returns scroll
position as a **ref, not state**, because re-rendering React at 60fps to move a
camera would be wasted work. The render loop reads `.current` inside `useFrame`,
damps it with `THREE.MathUtils.damp`, and publishes the result in milliseconds
so the story overlay rides the same clock as the camera.

### 4. The story layer

[src/story.js](src/story.js) holds the beats; [src/ui/Story.jsx](src/ui/Story.jsx)
renders them.

**The frame numbers are 24fps.** `scene.gltf`'s sampler keys sit exactly 1/24s
apart and run frame 1 to 169 (169 / 24 = 7.0417s, the clip duration), so the
ranges in the brief decode as frames and are converted to milliseconds in
`story.js` via `frameToMs()`. If your source timeline was a different rate,
change `FPS` there and everything re-derives.

| Beat | Frames | Milliseconds | Scroll | Placement | Ink |
| --- | --- | --- | --- | --- | --- |
| `hero` | 0–4 | 0–167 | 0–7% | lower left | dark |
| `process` | 35–74 | 1458–3083 | 16–48% | upper left | light |
| `evidence` | 90–110 | 3750–4583 | 48–70% | centre right | light |
| `signoff` | 156–170 | 6500–7083 | 88–100% | centred | the logo |

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

**There are no scrims.** Ink is chosen per beat instead. The opening shot is a
sheet of white sketch paper, so that beat is set in the brand's dark ink and the
scene stays completely unobscured; the middle beats sit against the dark room
and are set light. A soft halo `text-shadow` holds the edges over pencil marks
and light blooms without laying a gradient across the picture.

**Motion.** One language across all four beats: the block drifts into place
while its heading assembles **word by word**, each word masked in its own box so
it still works when a heading wraps. Body copy trails the heading slightly, so
the sentence lands just after the headline resolves. Amplitude and direction
change per beat, so the sequence reads as edited rather than looped. Blur is
composited only while a beat is in transit, never as a `blur(0)` layer at rest.

**Pointer parallax.** The type counter-drifts a few pixels against the cursor,
heavily damped, so it sits *in* the scene rather than on a pane of glass in
front of it. Desktop only, and off under `prefers-reduced-motion`, which keeps
the crossfade (it *is* the storytelling) and drops the travel.

**Nothing in the overlay re-renders.** One rAF loop reads the shared timeline
ref and writes custom properties; CSS turns those into the choreography.

### 5. Why the text is DOM, not geometry

Every heading is a real `<h1>`/`<h2>`, every paragraph a real `<p>`, inside a
`<main>`: selectable, translatable, and crawlable. Verified by SSR-rendering the
component and extracting the text, which comes out as clean prose even with the
per-word mask spans in place.

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
| `SCROLL_PAGES` | config | `5` | Viewport-heights of scrolling mapped to the full 7.04s clip. Higher = slower, more deliberate camera. |
| `SCROLL_SMOOTHING` | config | `4` | Damping. Higher tracks the scrollbar more tightly; lower glides more. |
| `PRESERVE_AUTHORED_FRAMING` | config | `true` | Widen FOV instead of cropping on narrow viewports. |
| `LOGO_SRC` | config | `-dark.svg` | Sign-off mark. |
| `FPS` | story | `24` | Frame rate the beat numbers are interpreted at. |
| `FADE_FRAMES` | story | `8` | Crossfade length on either side of each beat. |
| `BEATS[].place` | story | per beat | `{ x, y, w }` position of the copy block. |
| `BEATS[].tone` | story | per beat | `dark` or `light` ink for that shot. |

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

Both body inks were measured against shades sampled from the actual shots and
clear 4.5:1 across the realistic range in each. Where a backdrop lands on a
mid-tone that favours neither ink, the halo carries the edge.

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
src/ui/Overlay.jsx             loading curtain, scrub bar, scroll cue
src/styles.css                 tokens, type system, beat choreography
```
