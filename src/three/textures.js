import * as THREE from 'three'
import { COLORS } from './stations'

/**
 * Everything printed in the scene — the whiteboard, the screens, the social
 * posts, the board on the last platform — drawn to canvases at runtime.
 *
 * Drawn rather than shipped as images because it is all type, and the type is
 * the site's own: Anton and Plex Mono are already on the page, so the scene
 * costs no extra bytes for it and stays in step with the copy if it changes.
 *
 * A canvas drawn before its web font has loaded silently falls back to a system
 * face, so each texture draws once immediately and again when the fonts land.
 */

const FONTS = ['400 64px Anton', '400 24px "IBM Plex Mono"', '600 24px "IBM Plex Mono"', '700 32px "Barlow Condensed"']

const fontsReady =
  typeof document !== 'undefined' && document.fonts
    ? Promise.all(FONTS.map((font) => document.fonts.load(font))).catch(() => {})
    : Promise.resolve()

const ANTON = (px) => `400 ${px}px Anton, Impact, sans-serif`
const MONO = (px, weight = 400) => `${weight} ${px}px "IBM Plex Mono", ui-monospace, monospace`
const HAND = (px) => `700 ${px}px "Barlow Condensed", "Arial Narrow", sans-serif`

/**
 * A canvas-backed texture. `draw(ctx, w, h, progress)` paints it; `redraw(p)`
 * repaints at a new progress, which is how the whiteboard writes itself on and
 * the code types itself in.
 */
function canvasTexture(width, height, draw) {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 4

  let last = 1
  const redraw = (progress = last) => {
    last = progress
    ctx.save()
    ctx.clearRect(0, 0, width, height)
    draw(ctx, width, height, progress)
    ctx.restore()
    texture.needsUpdate = true
  }

  redraw(1)
  fontsReady.then(() => redraw())
  return { texture, redraw }
}

const roundRect = (ctx, x, y, w, h, r) => {
  ctx.beginPath()
  ctx.roundRect(x, y, w, h, r)
}

/** Deterministic noise, so a texture comes out the same every load. */
const seeded = (seed) => () => {
  seed = (seed * 16807) % 2147483647
  return (seed - 1) / 2147483646
}

/* --------------------------------------------------------------------------
   PLAN
   -------------------------------------------------------------------------- */

/**
 * The whiteboard. `progress` writes it on, one item after another.
 *
 * This one is mapped onto the export's own plane, whose UVs follow the glTF
 * convention (origin top-left), so it must not be flipped the way a texture on
 * three's own geometry is.
 */
export function whiteboardTexture() {
  const board = whiteboardCanvas()
  board.texture.flipY = false
  return board
}

function whiteboardCanvas() {
  const items = [
    { kind: 'text', text: 'BRIEF', x: 70, y: 150, size: 92, rot: -0.04 },
    { kind: 'arrow', x: 300, y: 118, w: 150 },
    { kind: 'target', x: 640, y: 128, r: 92 },
    { kind: 'text', text: '- STRATEGY', x: 62, y: 280, size: 70, rot: -0.03 },
    { kind: 'text', text: '- AUDIENCE', x: 74, y: 380, size: 70, rot: -0.025 },
    { kind: 'text', text: '- GOALS', x: 86, y: 480, size: 70, rot: -0.03 },
    { kind: 'squiggle', x: 520, y: 330 },
  ]

  return canvasTexture(1024, 576, (ctx, w, h, progress) => {
    ctx.fillStyle = '#f5f2ea'
    ctx.fillRect(0, 0, w, h)
    // A little grime at the edges, so it reads as a board and not a UI panel.
    const vignette = ctx.createRadialGradient(w / 2, h / 2, h * 0.35, w / 2, h / 2, w * 0.7)
    vignette.addColorStop(0, 'rgba(0,0,0,0)')
    vignette.addColorStop(1, 'rgba(40,30,80,0.14)')
    ctx.fillStyle = vignette
    ctx.fillRect(0, 0, w, h)

    ctx.strokeStyle = ctx.fillStyle = '#1d1a2e'
    ctx.lineCap = ctx.lineJoin = 'round'

    const slice = 1 / items.length
    items.forEach((item, i) => {
      const p = Math.min(1, Math.max(0, (progress - i * slice * 0.85) / (slice * 1.6)))
      if (p <= 0) return
      ctx.save()
      if (item.kind === 'text') {
        ctx.font = HAND(item.size)
        const width = ctx.measureText(item.text).width
        ctx.beginPath()
        ctx.rect(item.x - 10, item.y - item.size, (width + 20) * p, item.size * 1.3)
        ctx.clip()
        ctx.translate(item.x, item.y)
        ctx.rotate(item.rot)
        ctx.fillText(item.text, 0, 0)
      } else if (item.kind === 'arrow') {
        ctx.lineWidth = 9
        const end = item.x + item.w * p
        ctx.beginPath()
        ctx.moveTo(item.x, item.y)
        ctx.lineTo(end, item.y - 6 * p)
        ctx.stroke()
        if (p > 0.9) {
          ctx.beginPath()
          ctx.moveTo(end - 30, item.y - 28)
          ctx.lineTo(end, item.y - 6)
          ctx.lineTo(end - 30, item.y + 18)
          ctx.stroke()
        }
      } else if (item.kind === 'target') {
        ctx.lineWidth = 9
        ;[1, 0.66, 0.33].forEach((k, ring) => {
          const rp = Math.min(1, Math.max(0, p * 3 - ring))
          if (rp <= 0) return
          ctx.strokeStyle = ring === 1 ? COLORS.pink : '#1d1a2e'
          ctx.beginPath()
          ctx.arc(item.x, item.y, item.r * k, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * rp)
          ctx.stroke()
        })
        if (p > 0.8) {
          // The dart, in.
          ctx.strokeStyle = '#1d1a2e'
          ctx.beginPath()
          ctx.moveTo(item.x + 6, item.y - 6)
          ctx.lineTo(item.x + 110, item.y - 100)
          ctx.stroke()
          ctx.fillStyle = COLORS.pink
          ctx.beginPath()
          ctx.moveTo(item.x + 100, item.y - 110)
          ctx.lineTo(item.x + 132, item.y - 120)
          ctx.lineTo(item.x + 122, item.y - 88)
          ctx.fill()
        }
      } else if (item.kind === 'squiggle') {
        ctx.lineWidth = 7
        ctx.beginPath()
        for (let t = 0; t <= p; t += 0.02) {
          const x = item.x + t * 380
          const y = item.y + Math.sin(t * 22) * 14 + t * 40
          t === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
        }
        ctx.stroke()
        if (p > 0.95) {
          ctx.font = HAND(54)
          ctx.fillText('!', item.x + 400, item.y + 70)
        }
      }
      ctx.restore()
    })
  })
}

/** A sticky note with a few scribbled lines. */
export function stickyTexture(color, seed = 1) {
  const rand = seeded(seed * 977)
  return canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = color
    ctx.fillRect(0, 0, w, h)
    ctx.fillStyle = 'rgba(0,0,0,0.08)'
    ctx.fillRect(0, 0, w, 34)
    ctx.strokeStyle = 'rgba(23,18,47,0.75)'
    ctx.lineWidth = 9
    ctx.lineCap = 'round'
    for (let i = 0; i < 3; i++) {
      const y = 82 + i * 52
      ctx.beginPath()
      ctx.moveTo(34, y)
      ctx.lineTo(34 + 120 + rand() * 70, y + (rand() - 0.5) * 8)
      ctx.stroke()
    }
  })
}

/** The paper stack on PLAN's corner: everything the brief will cover. */
export function briefStackTexture() {
  return canvasTexture(512, 512, (ctx, w, h) => {
    ctx.fillStyle = COLORS.paper
    ctx.fillRect(0, 0, w, h)
    ctx.fillStyle = COLORS.ink
    ctx.font = HAND(84)
    ;['BRAND', 'CONTENT', 'SOCIAL', 'WEB', 'ADS'].forEach((word, i) => {
      ctx.save()
      ctx.translate(48, 108 + i * 88)
      ctx.rotate(-0.06)
      ctx.fillText(word, 0, 0)
      ctx.restore()
    })
  })
}

/* --------------------------------------------------------------------------
   CREATE
   -------------------------------------------------------------------------- */

/** A polaroid of a portrait on a pink ground — the shot the crew just took. */
export function photoTexture() {
  return canvasTexture(320, 384, (ctx, w, h) => {
    ctx.fillStyle = COLORS.paper
    ctx.fillRect(0, 0, w, h)
    ctx.fillStyle = COLORS.pink
    ctx.fillRect(22, 22, w - 44, h - 110)
    ctx.fillStyle = '#2a1640'
    // Head and shoulders.
    ctx.beginPath()
    ctx.arc(w / 2, 140, 48, 0, Math.PI * 2)
    ctx.fill()
    ctx.beginPath()
    ctx.ellipse(w / 2, 290, 96, 82, 0, Math.PI, 0)
    ctx.fill()
  })
}

/* --------------------------------------------------------------------------
   BUILD
   -------------------------------------------------------------------------- */

/** The website on the big screen. */
export function websiteTexture() {
  return canvasTexture(1024, 640, (ctx, w, h) => {
    ctx.fillStyle = COLORS.paper
    ctx.fillRect(0, 0, w, h)
    // Browser chrome.
    ctx.fillStyle = '#e4ded1'
    ctx.fillRect(0, 0, w, 44)
    ;['#ff5f57', '#febc2e', '#28c840'].forEach((c, i) => {
      ctx.fillStyle = c
      ctx.beginPath()
      ctx.arc(26 + i * 22, 22, 7, 0, Math.PI * 2)
      ctx.fill()
    })
    ctx.fillStyle = '#fff'
    roundRect(ctx, 110, 11, 420, 22, 11)
    ctx.fill()

    // Page.
    ctx.fillStyle = COLORS.ink
    ctx.fillRect(0, 44, w, h - 44)
    ctx.fillStyle = 'rgba(255,255,255,0.4)'
    ctx.font = MONO(15, 600)
    ctx.fillText('● SOCIALHAT', 44, 86)
    ;['WORK', 'SERVICES', 'CONTACT'].forEach((t, i) => ctx.fillText(t, 560 + i * 120, 86))

    ctx.font = ANTON(92)
    ctx.fillStyle = COLORS.paper
    ctx.fillText('MODERN', 44, 210)
    ctx.fillText('BRANDS.', 44, 310)
    ctx.fillStyle = COLORS.pink
    ctx.fillText('REAL PEOPLE.', 44, 410)

    ctx.fillStyle = COLORS.lime
    roundRect(ctx, 44, 460, 200, 52, 26)
    ctx.fill()
    ctx.fillStyle = COLORS.ink
    ctx.font = MONO(17, 600)
    ctx.fillText('START A PROJECT', 66, 492)

    // Hero image: a figure on a peak against a violet sky.
    const gx = 600
    const grad = ctx.createLinearGradient(0, 120, 0, 600)
    grad.addColorStop(0, '#5b3fc4')
    grad.addColorStop(1, '#170f3a')
    ctx.fillStyle = grad
    roundRect(ctx, gx, 120, 380, 470, 18)
    ctx.fill()
    ctx.fillStyle = '#0d0822'
    ctx.beginPath()
    ctx.moveTo(gx, 590)
    ctx.lineTo(gx + 150, 360)
    ctx.lineTo(gx + 230, 440)
    ctx.lineTo(gx + 300, 330)
    ctx.lineTo(gx + 380, 470)
    ctx.lineTo(gx + 380, 590)
    ctx.fill()
    ctx.fillStyle = COLORS.lime
    ctx.beginPath()
    ctx.arc(gx + 300, 300, 12, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillRect(gx + 293, 310, 14, 26)
  })
}

/** A code editor. `progress` types the lines in. */
export function codeTexture(seed = 1) {
  const rand = seeded(seed * 7919)
  const palette = [COLORS.lime, COLORS.pink, '#a99bff', '#f1ece1', '#7cd6ff']
  const lines = Array.from({ length: 13 }, () => ({
    indent: Math.floor(rand() * 4),
    tokens: Array.from({ length: 1 + Math.floor(rand() * 4) }, () => ({
      w: 30 + rand() * 110,
      c: palette[Math.floor(rand() * palette.length)],
    })),
  }))

  return canvasTexture(512, 384, (ctx, w, h, progress) => {
    ctx.fillStyle = '#120d2a'
    ctx.fillRect(0, 0, w, h)
    ctx.fillStyle = '#1d1640'
    ctx.fillRect(0, 0, w, 30)
    ;['#ff5f57', '#febc2e', '#28c840'].forEach((c, i) => {
      ctx.fillStyle = c
      ctx.beginPath()
      ctx.arc(18 + i * 16, 15, 5, 0, Math.PI * 2)
      ctx.fill()
    })
    ctx.fillStyle = 'rgba(255,255,255,0.18)'
    ctx.fillRect(0, 30, 34, h - 30)

    const shown = progress * lines.length
    lines.forEach((line, i) => {
      if (i >= shown) return
      const partial = Math.min(1, shown - i)
      let x = 50 + line.indent * 22
      const y = 50 + i * 25
      ctx.fillStyle = 'rgba(255,255,255,0.3)'
      ctx.font = MONO(12)
      ctx.fillText(String(i + 1), 8, y + 8)
      line.tokens.forEach((token, t) => {
        if (t / line.tokens.length > partial) return
        ctx.fillStyle = token.c
        roundRect(ctx, x, y, token.w, 9, 4)
        ctx.fill()
        x += token.w + 12
      })
    })
    // Cursor.
    if (progress < 1) {
      const i = Math.min(lines.length - 1, Math.floor(shown))
      ctx.fillStyle = COLORS.lime
      ctx.fillRect(50 + lines[i].indent * 22, 46 + i * 25, 8, 17)
    }
  })
}

/* --------------------------------------------------------------------------
   AMPLIFY
   -------------------------------------------------------------------------- */

/** A social post card. `variant` picks the artwork. */
export function postTexture(variant = 0) {
  return canvasTexture(400, 500, (ctx, w, h) => {
    ctx.fillStyle = '#faf8f3'
    ctx.fillRect(0, 0, w, h)
    // Header.
    ctx.fillStyle = variant === 1 ? COLORS.pink : COLORS.lime
    ctx.beginPath()
    ctx.arc(36, 36, 16, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#c9c3d8'
    roundRect(ctx, 62, 26, 130, 9, 4)
    ctx.fill()
    roundRect(ctx, 62, 42, 80, 7, 4)
    ctx.fill()

    // Artwork.
    const top = 70
    const art = h - 150
    ctx.fillStyle = '#1b1240'
    ctx.fillRect(16, top, w - 32, art)
    if (variant === 1) {
      ctx.font = ANTON(52)
      ctx.fillStyle = COLORS.paper
      ctx.fillText('MORE', 34, top + 70)
      ctx.fillText('REACH.', 34, top + 128)
      ctx.fillText('BIGGER', 34, top + 186)
      ctx.fillStyle = COLORS.pink
      ctx.fillText('IMPACT.', 34, top + 244)
    } else {
      // Faceted lime shape on violet.
      ctx.fillStyle = '#3c2a8a'
      ctx.fillRect(16, top, w - 32, art)
      ctx.fillStyle = COLORS.lime
      ctx.beginPath()
      ctx.moveTo(110, top + 230)
      ctx.lineTo(180, top + 70)
      ctx.lineTo(290, top + 120)
      ctx.lineTo(310, top + 250)
      ctx.lineTo(200, top + 300)
      ctx.fill()
      ctx.fillStyle = '#8fc21c'
      ctx.beginPath()
      ctx.moveTo(180, top + 70)
      ctx.lineTo(290, top + 120)
      ctx.lineTo(220, top + 170)
      ctx.fill()
    }

    // Footer: heart, comment, share, and a caption.
    ctx.fillStyle = COLORS.pink
    heart(ctx, 38, h - 56, 13)
    ctx.strokeStyle = '#6d6585'
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.arc(84, h - 58, 11, 0, Math.PI * 2)
    ctx.stroke()
    ctx.fillStyle = '#c9c3d8'
    roundRect(ctx, 24, h - 30, 220, 8, 4)
    ctx.fill()
  })
}

function heart(ctx, x, y, r) {
  ctx.beginPath()
  ctx.moveTo(x, y + r * 0.9)
  ctx.bezierCurveTo(x - r * 1.6, y - r * 0.2, x - r * 0.7, y - r * 1.4, x, y - r * 0.5)
  ctx.bezierCurveTo(x + r * 0.7, y - r * 1.4, x + r * 1.6, y - r * 0.2, x, y + r * 0.9)
  ctx.fill()
}

/**
 * Square app tiles: 'instagram', 'tiktok', 'play', 'chart', 'code', 'heart'.
 * Drawn on a 256 canvas with a rounded ground in the tile's colour.
 */
export function tileTexture(kind) {
  const grounds = {
    instagram: '#faf8f3',
    tiktok: '#faf8f3',
    play: COLORS.lime,
    chart: COLORS.lime,
    code: COLORS.lime,
    heart: COLORS.pink,
  }
  return canvasTexture(256, 256, (ctx, w) => {
    ctx.fillStyle = grounds[kind]
    roundRect(ctx, 0, 0, w, w, 54)
    ctx.fill()
    ctx.strokeStyle = ctx.fillStyle = COLORS.ink
    ctx.lineWidth = 16
    ctx.lineCap = ctx.lineJoin = 'round'
    const c = w / 2
    if (kind === 'instagram') {
      roundRect(ctx, 58, 58, 140, 140, 40)
      ctx.stroke()
      ctx.beginPath()
      ctx.arc(c, c, 34, 0, Math.PI * 2)
      ctx.stroke()
      ctx.beginPath()
      ctx.arc(172, 84, 9, 0, Math.PI * 2)
      ctx.fill()
    } else if (kind === 'tiktok') {
      ctx.fillStyle = COLORS.pink
      ctx.font = ANTON(150)
      ctx.textAlign = 'center'
      ctx.fillText('♪', c + 4, 192)
    } else if (kind === 'play') {
      roundRect(ctx, 46, 66, 164, 124, 26)
      ctx.stroke()
      ctx.beginPath()
      ctx.moveTo(110, 100)
      ctx.lineTo(160, 128)
      ctx.lineTo(110, 156)
      ctx.closePath()
      ctx.fill()
    } else if (kind === 'chart') {
      ;[0.35, 0.6, 0.9].forEach((k, i) => {
        ctx.fillRect(62 + i * 50, 196 - 130 * k, 32, 130 * k)
      })
    } else if (kind === 'code') {
      ctx.font = ANTON(96)
      ctx.textAlign = 'center'
      ctx.fillText('</>', c, 164)
    } else if (kind === 'heart') {
      ctx.fillStyle = COLORS.paper
      heart(ctx, c, c + 4, 62)
    }
  })
}

/* --------------------------------------------------------------------------
   DELIVER
   -------------------------------------------------------------------------- */

/** The board the team is celebrating in front of. */
export function boardTexture() {
  return canvasTexture(1024, 680, (ctx, w, h) => {
    ctx.fillStyle = COLORS.paper
    ctx.fillRect(0, 0, w, h)
    ctx.fillStyle = COLORS.ink
    ctx.fillRect(18, 18, w - 36, h - 36)

    ctx.font = ANTON(118)
    ctx.fillStyle = COLORS.paper
    ctx.fillText('GREAT', 60, 170)
    ctx.fillText('WORK.', 60, 290)
    ctx.fillText('REAL', 60, 410)
    ctx.fillStyle = COLORS.pink
    ctx.fillText('RESULTS.', 60, 530)

    ctx.fillStyle = COLORS.lime
    roundRect(ctx, 60, 572, 170, 34, 17)
    ctx.fill()

    // Image panel: a peak with a lime orbit round it.
    const x = 560
    const grad = ctx.createLinearGradient(0, 60, 0, 620)
    grad.addColorStop(0, '#6a4bd6')
    grad.addColorStop(1, '#1a1040')
    ctx.fillStyle = grad
    ctx.fillRect(x, 60, 404, 560)
    ctx.fillStyle = '#0d0822'
    ctx.beginPath()
    ctx.moveTo(x, 620)
    ctx.lineTo(x + 180, 300)
    ctx.lineTo(x + 260, 400)
    ctx.lineTo(x + 330, 330)
    ctx.lineTo(x + 404, 450)
    ctx.lineTo(x + 404, 620)
    ctx.fill()
    ctx.strokeStyle = COLORS.lime
    ctx.lineWidth = 7
    ctx.beginPath()
    ctx.ellipse(x + 190, 300, 150, 46, -0.25, 0, Math.PI * 2)
    ctx.stroke()
  })
}

/* --------------------------------------------------------------------------
   Ground marks
   -------------------------------------------------------------------------- */

/** Hand-drawn marks on the floor: 'x', 'asterisk', 'ring'. */
export function markTexture(kind, color) {
  return canvasTexture(256, 256, (ctx, w) => {
    ctx.strokeStyle = color
    ctx.lineCap = 'round'
    ctx.lineWidth = 26
    const c = w / 2
    if (kind === 'x') {
      ctx.beginPath()
      ctx.moveTo(50, 60)
      ctx.lineTo(206, 196)
      ctx.moveTo(200, 54)
      ctx.lineTo(56, 202)
      ctx.stroke()
    } else if (kind === 'asterisk') {
      ctx.lineWidth = 14
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI
        ctx.beginPath()
        ctx.moveTo(c - Math.cos(a) * 90, c - Math.sin(a) * 90)
        ctx.lineTo(c + Math.cos(a) * 90, c + Math.sin(a) * 90)
        ctx.stroke()
      }
    } else if (kind === 'ring') {
      ctx.lineWidth = 14
      ctx.beginPath()
      ctx.arc(c, c, 86, 0, Math.PI * 2)
      ctx.stroke()
      ctx.fillStyle = color
      ctx.beginPath()
      ctx.arc(c, c, 34, 0, Math.PI * 2)
      ctx.fill()
    }
  })
}
