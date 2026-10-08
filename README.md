# socialhat

Two acts on one page. First a React + three.js process scene: five dioramas —
01 PLAN, 02 CREATE, 03 BUILD, 04 AMPLIFY, 05 DELIVER — laid out along a dashed
route, which the camera visits one scroll at a time while each station's
effects pop up around it. Then, after the closing wide shot, the scene
dissolves into the actual socialhat website — the agency site, in full, on the
same scroll.

```bash
npm install
npm run dev
```

`predev` builds the model automatically the first time, so `npm run dev` is all
you need from a clean checkout.

The assistant (§8) needs an OpenRouter key. Without one the site runs and the
widget degrades to a handoff; with one it works in dev exactly as in production.
Put it in `.env` (copy `.env.example`; `.env` is gitignored), or set it in the
shell:

```bash
OPENROUTER_API_KEY=sk-or-... npm run dev
```

On Windows PowerShell:

```powershell
$env:OPENROUTER_API_KEY = "sk-or-..."; npm run dev
```

## How it works

### 1. The scene

[src/three/Experience.jsx](src/three/Experience.jsx) mounts a react-three-fiber
`<Canvas>` inside a `position: sticky` stage, which pins it for the length of
the hero block and then lets it scroll away. The canvas is `touch-action: pan-y`,
so touch gestures fall through to the document and the page keeps scrolling.

`socialhat.glb` is a Blender blockout: four platforms with their figures and
props, no camera, no animation, no lights. Everything that makes it a scene is
in code:

- **Re-placed stations.** The export's platforms face every which way along a
  line. [src/three/ProcessScene.jsx](src/three/ProcessScene.jsx) lifts each one
  into its own group, turns it so its *front* — the whiteboard's face, the far
  side of the desk from the screens — faces the viewer, and sets it down on a
  diagonal that climbs away to the right. Every station then shares one local
  frame (origin at the platform, front toward +Z), which is what its props and
  close-up shot are written in. Where each one goes is data, in
  [src/three/stations.js](src/three/stations.js).
- **AMPLIFY is built from scratch.** The export stops at four platforms, so the
  fourth station is a cloned slab and two cloned figures, dressed entirely in
  code.
- **Restyled materials.** Clay figures, indigo platforms, glowing lamp tubes;
  rock slabs and lime/pink accents are added under each platform.
- **Lighting.** A hemisphere, a warm key with soft shadows, a pink rim, and one
  light per station that comes up when the camera is on it.
- **Post.** Bloom (only emissives cross the threshold), vignette, ACES tone
  mapping. Skipped on phones, along with shadows.

### 2. Scroll asks for a stop; the camera flies there

There are seven stops: the wide shot, the five stations, the wide shot again.
The page gives each one a viewport of scroll, but **the camera does not scrub**.

[src/hooks/useHeroScroll.js](src/hooks/useHeroScroll.js) turns the scroll
position into a *stop request*. Going down, a stop is committed to once the
scroll is `STOP_COMMIT` (14%) of the way into the gap toward it. Going up,
the same in reverse. So a single wheel notch, a short swipe or PageDown is
enough to send the camera on, and jitter at rest does nothing. When scrolling
comes to rest between stops, the page settles itself onto the stop it
committed to (`scrollend`, with a debounce fallback), so the scrollbar and the
picture always agree.

[src/three/Director.jsx](src/three/Director.jsx) springs a float `s` toward that
stop **in time**, on a critically damped spring (`FLIGHT_STIFFNESS`). One
gesture is one flight of about a second, however coarse or fast the wheel. A
fling across several stops chains through them.
[src/three/CameraRig.jsx](src/three/CameraRig.jsx) flies the camera along
Catmull-Rom splines through every stop's position and look-target, with `s` as
the parameter, so a flight curves through the scene rather than cutting across
it.

All of this shares one mutable object, [src/three/rig.js](src/three/rig.js).
Scroll writes it, the render loop and the DOM overlay read it, and nothing in
it ever causes a React render.

**Narrow screens.** Phones fly a second set of shots (each stop's `portrait`):
the wide shot looks down the line from behind PLAN, so the stations climb up
the screen; close-ups centre the platform above the copy. Either set holds its
authored horizontal framing on screens narrower than it was framed for.

**The canvas only runs while it is on screen.** `frameloop` is `always` while
the scene owns the screen, since things bob, the route marches and the camera
flies on its own clock. It is `never` once `data-phase` reaches `site`, so the
website scrolls on an idle GPU.

### 3. The stations

Each station has a `show` value (0→1) and an `arrivedAt` time, both kept by the
Director:

- **`show`** builds a station's dressing up. It is 1 on the wide shots, where
  all five sit dressed like the reference frame, and on whichever station the
  camera is at. Every prop pops in on its own slice of it (`<Pop delay>` in
  [src/three/props.jsx](src/three/props.jsx)), which is the stagger. Flying on
  clears the station behind and builds the one ahead.
- **`arrivedAt`** is when the camera last landed there. One-shot effects play
  from it, and also once during the intro build-up:

| Station | On arrival |
| --- | --- |
| 01 PLAN | The whiteboard writes itself on (a canvas redrawn only while writing); sticky notes slap onto the board. |
| 02 CREATE | Lamps strike up with a flicker, a flash fires; the REC light pulses and the clapper snaps. |
| 03 BUILD | Floating screens power on, site mockup first; the code types itself in. |
| 04 AMPLIFY | Posts fan out from a stack, a burst of hearts goes up; the megaphone pumps out rings. |
| 05 DELIVER | Confetti goes up (instanced, placed analytically from the arrival time) and the team jumps. |

Everything printed in the scene — the whiteboard, screens, posts, board — is
drawn to canvases at runtime ([src/three/textures.js](src/three/textures.js)) in
the site's own Anton and Plex Mono, so it costs no image bytes.

The station tags (dashed number, lime tape) are DOM, positioned in 3D by
drei's `<Html>`. They belong to the wide shots; in a close-up the copy names
the station instead.

### 4. The copy

[src/ui/Story.jsx](src/ui/Story.jsx) renders the words as real DOM: the
"Big ideas. Real output." headline over both wide shots, a card for each
station low on the left, and the taped note and stamp on the closing shot.
Each block's presence is keyed to the camera's position `s`, not to raw scroll,
so the copy lands with the shot it describes. While a station card is up, a
gradient scrim comes in down the left of the frame, so the copy never sits
straight on a neighbouring platform.

The copy lives in `COPY` in [src/three/stations.js](src/three/stations.js).
One rAF loop writes `--p` per block; CSS does the rest.

[src/ui/Overlay.jsx](src/ui/Overlay.jsx) carries the scene's own chrome: brand
and "Start a project" across the top (which jumps straight to the form rather
than flying past every station), the 01–05 rail down the right (click to fly
to a station), and the scroll cue.

### 5. The handover

The scene ends and the website begins on one continuous scroll, with no jump cut
and no dead frame in between — and it is **a camera move**, not a wipe. Nothing
slides in. Everything is keyed to custom properties `useHeroScroll` writes onto
the root element (and the same damped number onto `rig.reveal` for the camera);
no React render, no second scroll listener, no rAF loop except the one that
damps the reveal. The handover is `HANDOFF_VIEWPORTS` (1.5) of scroll:

1. **The camera dives into the site.** From the closing wide shot, `dive()` in
   `CameraRig` swoops down into the big screen on BUILD — the one showing a
   mock of the site — on a Bézier whose last stretch comes in from in front and
   above, clear of the crew's heads. It lands with the page filling the frame
   (by 78% of the handover), then keeps pushing in. The station tags and the
   story overlay clear out as it sets off. Under reduced motion the camera
   holds on the wide shot instead.
2. **The site comes up through the screen, held dead still.** It fades in only
   once the camera has landed, growing from 0.96 with its transform origin on
   the centre of the screen — the point the camera is pushing in on — while the
   top bar arrives last, once the site is already there.

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
| `--reveal` | The same number, exponentially damped in a rAF loop. Drives the *look* — the camera's dive, the fade, the growth. A 100px wheel notch steps `--handoff`; `--reveal` eases across it at 60fps, which is what makes the flight read as smooth rather than as a run of hard steps. |

Both transforms come off the site the instant it owns the screen: a transform on
`.paper` makes it the containing block for the fixed top bar, which is harmless
while the two are pinned together and wrong the moment the page scrolls on.
`data-phase` flips to `site` only at a dead-exact `--handoff` of 1, which is
the one frame where dropping the transform costs nothing, because it is already
identity. The scene's own chrome (top bar, rail, scroll cue) clears out on the same
pass, and the top bar becomes interactive.

Under `prefers-reduced-motion: reduce` the hold stays — it is geometry, not
decoration — and the motion goes: the paper stops opening from the centre and
fades in flat, the frame holds still, the site does not grow.

### 6. The website

[src/ui/Site.jsx](src/ui/Site.jsx) is the second act: top bar, the case for the
work, a schedule of five services, the track record, the client list, signage,
the ask, the enquiry form and the footer. Plain semantic DOM throughout.

It runs its own palette alongside the scene's. Everything is scoped to `.paper`
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

`ENQUIRY_ENDPOINT` in [src/config.js](src/config.js) is where the JSON POSTs:
`/api/enquiry`, which on SiteGround emails it to the path's inbox (§12) and in
`npm run dev` prints it to the terminal. Set it to `''` and the form composes the
same payload as a `mailto:` instead, for a host with no backend. The inbox is
chosen on the server from the path id — never from anything the browser sends —
via `ENQUIRY_TO` and its per-path overrides; the `inbox` key on each path in
`PATHS` is only what the `mailto:` fallback and the error message show.

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
same file in `npm run dev`, so there is one implementation and no mock.

The model is reached through [OpenRouter](https://openrouter.ai), in its
OpenAI-compatible chat completions format, with plain `fetch` — no SDK. Set
`OPENROUTER_API_KEY`; without it the endpoint streams a handoff to the form and
the phone number rather than 500ing, so a keyless deploy degrades instead of
breaking. `OPENROUTER_MODEL` picks the model (default `anthropic/claude-opus-5`)
— any tool-calling model on OpenRouter works without a code change.

**Two tools.** `capture_lead` records an enquiry (POSTed to `LEAD_WEBHOOK`, or
logged with the model told plainly it wasn't delivered, so it never tells a
visitor something untrue). `open_enquiry_form` reaches out of the chat and opens
§7's form on the right path, via a `socialhat:enquiry` window event — the
visitor lands on a form already filled in as far as the conversation got, rather
than a blank one.

**Model settings**, and why:

- `anthropic/claude-opus-5` at `reasoning: { effort: "low" }`. This is
  short-form chat over a small fixed knowledge base; depth isn't what makes it
  good, and low effort is roughly a third of the latency.
- Reasoning stays on. With it disabled, Opus 5 occasionally writes a tool call
  into its visible text instead of making one — here that would be a lead
  silently never captured. Its `reasoning_details` are sent back with the turn
  that made a tool call, because Anthropic models reject a tool result without
  them.
- The system prompt is byte-identical every request and carries the only cache
  breakpoint (`cache_control`, passed through by OpenRouter); the conversation
  sits after it and doesn't disturb it.
- A `content_filter` finish is checked before the content is trusted, since a
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
  are the scene's `--bg`/`--ink`, hard-coded, and have to stay in step with
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

### 12. Hosting on SiteGround

socialhat.com.au is on SiteGround, whose shared hosting runs PHP and not Node,
so `api/*.js` cannot run there. [server/public/](server/public/) holds their PHP
ports, and `npm run build:siteground` builds the site and copies them into
`dist/` ([scripts/stage-php.mjs](scripts/stage-php.mjs)):

| URL | Dev / function hosts | SiteGround |
| --- | --- | --- |
| `/api/chat` | `api/chat.js` | `api/chat.php` |
| `/api/instagram` | `api/instagram.js` | `api/instagram.php` |
| `/api/enquiry` | `api/enquiry.js` (prints it) | `api/enquiry.php` (emails it) |

The `.htaccess` maps the extensionless URLs onto the `.php` files, so the
frontend is identical on every host.

**One source of truth for HatBot.** The system prompt, tools and built-in
answers stay in `api/knowledge.js` and `api/fallback.js`. The build exports them
to `dist/api/_knowledge.php` and the PHP reads that, so there is no second copy
to drift. The fallback table is plain data (regexes and strings) for exactly
this reason. Edit the JS; rebuild.

**Secrets live outside the web root**, in `private/secrets.php` beside
`public_html` — template in [server/secrets.example.php](server/secrets.example.php).
Nothing there is web-reachable, and a deploy never touches it. The file-based
cache (feed, model cooldowns, rate-limit counters) lives in `private/cache/`.

**What PHP adds.** A per-IP rate limit (40 chat requests per 10 minutes, 6
enquiries per hour) — the host-level limit §8 asked for, which SiteGround has no
setting for. A visitor over the chat limit still gets an answer, from the
built-in table, at no cost. HatBot leads with no `LEAD_WEBHOOK` are emailed
rather than only logged. And the Instagram token renews itself: the one in
`secrets.php` is only the seed, swapped weekly for a fresh one kept in the
cache, so the 60-day expiry §10 warns about no longer arrives. Pasting a new
token into `secrets.php` takes over from the stored one.

**Mail needs SMTP.** The domain's mail is Microsoft 365 and its SPF record ends
`-all`, so PHP's own `mail()` from a SiteGround server, sending as
@socialhat.com.au, hard-fails SPF and is treated as spoofing. Set `SMTP_*` in
the secrets file — an M365 mailbox with SMTP AUTH enabled, or a relay whose
SPF/DKIM is added to the domain.

**Streaming** has to get past PHP's output buffer, Apache's gzip and
SiteGround's nginx; `chat.php` and the `.htaccess` switch each off. Confirm on
the real host that replies arrive word by word, not all at once.

**Deploying.** [.github/workflows/deploy-siteground.yml](.github/workflows/deploy-siteground.yml)
builds and rsyncs `dist/` to the staging subdomain on every push to `main`, once
the `SITEGROUND_*` variables and SSH key are set (listed in the file). It refuses
any target that is not a `public_html` or that contains WordPress, because
`--delete` pointed at the live site would wipe it. To check a deploy:

```bash
node scripts/smoke-chat.mjs --url https://new.socialhat.com.au
```

**The live site is a separate, manual workflow**,
[deploy-production.yml](.github/workflows/deploy-production.yml), with four
actions: `status`, `prepare`, `go-live` and `rollback`. `prepare` uploads a
build to `release-next/` beside `public_html`; `go-live` swaps it in by rename
([server/release.sh](server/release.sh)) and keeps what was live — the first
time, the whole WordPress site — so `rollback` is the same rename in reverse.
The old media library is carried across with hard links and served as plain
files, so links to `/wp-content/uploads/…` keep working. The step-by-step is in
[GO-LIVE.md](GO-LIVE.md).

## Tuning

| Setting | Where | Default | Effect |
| --- | --- | --- | --- |
| `STOP_COUNT` | config | `7` | Camera stops. Must match `STOPS` in stations.js. `SCROLL_PAGES` derives from it: one viewport per stop. |
| `STOP_COMMIT` | config | `0.14` | How far into the gap toward the next stop a scroll must go to commit to it. Lower = twitchier; higher = needs a bigger push. |
| `FLIGHT_STIFFNESS` | config | `5` | Natural frequency of the camera's spring, rad/s. 5 lands a one-stop flight in about 1.1s. |
| `HANDOFF_VIEWPORTS` | config | `0.5` | Viewports of scroll the handover takes. `HANDOFF_START` and the distance the site is held against both derive from it. |
| `HANDOFF_SMOOTHING` | config | `9` | Damping on `--reveal`, the look of the handover. The geometry is never damped. |
| `STATIONS[]` | stations.js | per station | `position`, `turn` (where each sits and how far it swings off square-on), `front` (which way the export's set is meant to be seen from). |
| `STOPS[]` | stations.js | per stop | Camera `pos`, `target`, `fov`, plus `portrait` for phones. Close-ups come from `closeUp()`; pass a `tweak` to nudge one. |
| `COPY[]` | stations.js | per stop | The words over each stop. |
| `COLORS` | stations.js | | Scene palette. The DOM's lives in styles.css tokens. |

**Framing a shot.** Open the page with `?cam` and the rig is swapped for orbit
controls starting at the current stop. Every time a drag ends, the shot is
logged to the console in `STOPS` shape, ready to paste. `?still` skips the
intro build-up; `?view=x,y,z,tx,ty,tz,fov` pins the camera to one exact shot.

**Dressing a station.** Each station's props are a component in
[src/three/platforms/](src/three/platforms/), written in the station's local
frame (origin at the platform, front toward +Z). Wrap anything new in
`<Pop station={index} delay={…}>` and it joins the cascade.

## Typography

Self-hosted via `@fontsource`, latin subset, only the weights in use. No CDN
request, no render-blocking stylesheet. The scene shares the site's faces:
Anton for the headline, station titles and tape labels; IBM Plex Mono for
kickers, body copy and readouts; Barlow Condensed for the handwritten-feeling
note and the whiteboard. Type over the scene is cream on indigo, kept legible
by an `em`-sized `--ink-shadow` and, behind the station cards, the scrim.

## The model

`socialhat.glb` (61 MB) is the Blender export, and the source of truth. It is
committed and never modified. Everything built from it is generated and
gitignored.

`npm run pack-model` runs two steps:

1. [scripts/optimize-model.mjs](scripts/optimize-model.mjs) writes
   `public/models/socialhat.glb` — **762k triangles to 134k, 61 MB to 3.4 MB.**
   Almost all of the export's weight is eight sculpted figures at 90–110k
   triangles each. They come out flat-shaded, every triangle carrying its own
   three vertices, so no edge is shared and nothing can be simplified.
   The script drops their normals so `weld()` can stitch each one back into a
   single surface, simplifies to 10% with meshoptimizer, and regenerates
   smooth normals, which is also the soft clay look the scene wants. Everything
   else passes through as authored. Then the whole file is Draco-encoded.
2. [scripts/copy-draco-decoder.mjs](scripts/copy-draco-decoder.mjs) copies
   three's decoder into `public/draco/`, so the browser has something to decode
   with.

The decoder is copied out of `three` rather than loaded from drei's default
gstatic CDN, so its version cannot drift from the `three` we build against and
first paint does not depend on a third party. `DRACO_DECODER_PATH` in
`src/config.js` is passed to both `useGLTF` and `useGLTF.preload` — they have to
match, because drei keys its cache on the URL alone.

Re-exporting from Blender: keep the node names in `STATIONS[].nodes`, overwrite
`socialhat.glb`, and `npm run dev` rebuilds it (the build is skipped while the
output is newer than the source).

## Layout

```
socialhat.glb                     source model (Blender export, untouched)
scripts/optimize-model.mjs        simplify figures + Draco -> public/models/
scripts/copy-draco-decoder.mjs    three's Draco decoder -> public/draco/
public/models/socialhat.glb       generated, gitignored
public/draco/                     generated, gitignored
src/config.js                     scroll, stop and handover tunables
src/hooks/useHeroScroll.js        scroll -> stop request, settle, handover vars
src/three/stations.js             stations, camera stops, copy, palette
src/three/rig.js                  the shared clock everything reads
src/three/Director.jsx            camera spring + station show/arrival state
src/three/CameraRig.jsx           spline flight, portrait shots, ?cam
src/three/ProcessScene.jsx        model load, restyle, re-placing, lights
src/three/platforms/*.jsx         each station's props and effects
src/three/props.jsx               Pop, Card, Tile, tags, focus lights, rock
src/three/textures.js             canvas-drawn screens, boards, posts, tiles
src/three/Path.jsx                the dashed route and floor marks
src/three/Experience.jsx          the Canvas, post-processing
src/ui/Story.jsx                  copy over each stop
src/ui/Overlay.jsx                loading curtain, top bar, rail, scroll cue
src/styles.css                    tokens, copy, tags, chrome
```
