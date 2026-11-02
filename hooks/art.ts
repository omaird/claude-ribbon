import type { Step } from '../types'

export const EMPTY = '#4a4358'
export const PURPLE = '#a855f7'

// Below WIDE_AT columns the live action is left out; below NARROW_AT the
// dot field is too.
export const WIDE_AT = 90
export const NARROW_AT = 50

const NO_MOTION = '@media (prefers-reduced-motion:reduce){*{animation:none!important}}'

const doc = (w: number, h: number, style: string, defs: string, body: string): string =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}"><style>${style}${NO_MOTION}</style><defs>${defs}</defs>${body}</svg>`

const GLOW = (id: string, blur: number) =>
  `<filter id="${id}" x="-100%" y="-100%" width="300%" height="300%"><feGaussianBlur stdDeviation="${blur}" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>`

// The crab: Claude's orange pixel mascot in a pirate costume for
// Halloween: a tricorn with a skull and gold trim, an eye patch, a gold
// earring. While Claude works it sways and bobs, its hat tilts, and its
// legs lift in turn; it blinks now and then, working or not.
const HAT = ['....HHHHHH....', '...HHHSHHHH...', '.GHHHHHHHHHHG.']
const BODY = ['...XXXPXXXX...', '...PPPXXXEX...', '.XXPPPXXXEXXX.', '.XXXXXXXXXXXX.', '...XXXXXXXXG..']
const LEGS_OUT = ['...X......X...', '...X......X...']
const LEGS_IN = ['.....X..X.....', '.....X..X.....']
const COLOR: Record<string, string> = {
  X: '#d97757', // Claude orange
  E: '#2a1a14', // the eye
  P: '#151218', // patch and strap
  H: '#5a5370', // hat, lighter on dark; darker on light below
  S: '#f5f0e6', // skull
  G: '#e8b04b', // gold
}
const U = 2
export const CRAB_W = 14 * U + 4
export const CRAB_H = 10 * U + 4

const pixelRows = (rows: string[], top: number, only?: string): string =>
  rows
    .flatMap((row, y) =>
      [...row].map((c, x) =>
        c === '.' || (only !== undefined && c !== only) || (only === undefined && c === 'E')
          ? ''
          : `<rect x="${2 + x * U}" y="${2 + (top + y) * U}" width="${U}" height="${U}" fill="${COLOR[c]}"/>`,
      ),
    )
    .join('')

export function crabSvg(isWorking: boolean): string {
  const motion = isWorking
    ? '.sway{animation:sway 3.2s ease-in-out infinite}@keyframes sway{0%,100%{transform:translateX(-.6px)}50%{transform:translateX(.6px)}}' +
      '.bob{animation:bob 1.6s ease-in-out infinite}@keyframes bob{0%,100%{transform:translateY(0)}50%{transform:translateY(-.5px)}}' +
      '.hat{transform-box:fill-box;transform-origin:50% 100%;animation:tilt 3.2s ease-in-out infinite}@keyframes tilt{0%,100%{transform:rotate(-3deg)}50%{transform:rotate(3deg)}}' +
      '.out,.in{animation:lift 1.6s ease-in-out infinite}.in{animation-delay:-.8s}@keyframes lift{0%,40%,100%{transform:translateY(0)}20%{transform:translateY(-.8px)}}'
    : ''
  const hat = '@media (prefers-color-scheme:light){.hat rect[fill="#5a5370"]{fill:#2f2a3a}}'
  const blink =
    '.eye{transform-box:fill-box;transform-origin:center;animation:blink 4.5s ease-in-out infinite}@keyframes blink{0%,94%,100%{transform:scaleY(1)}97%{transform:scaleY(.15)}}'
  return doc(
    CRAB_W,
    CRAB_H,
    motion + blink + hat,
    '',
    `<g class="sway"><g class="out">${pixelRows(LEGS_OUT, 8)}</g><g class="in">${pixelRows(LEGS_IN, 8)}</g>` +
      `<g class="bob">${pixelRows(BODY, 3)}<g class="eye">${pixelRows(BODY, 3, 'E')}</g><g class="hat">${pixelRows(HAT, 0)}</g></g></g>`,
  )
}

// Same input, same picture: a cheap hash in place of Math.random, so a
// redraw does not reshuffle the dots.
const hash = (x: number, y: number): number => {
  let h = (x * 374761393 + y * 668265263) | 0
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}

const SHINE =
  '<linearGradient id="sheen" x1="0" x2="1"><stop offset="0" stop-color="#f3e8ff" stop-opacity="0"/><stop offset=".5" stop-color="#f3e8ff" stop-opacity=".45"/><stop offset="1" stop-color="#f3e8ff" stop-opacity="0"/></linearGradient>'

// The field: a slim grid of dots in the row, like a scoreboard.
// Done work is lit purple from the left, dense near the front edge and
// scattered behind it; ahead a scattered few faint grey dots wait. A wave
// of light runs up to the front edge, and the stretch a step just finished lights up
// left to right.
const FIELD_PITCH = 6
const FIELD_ROWS = 3
const FIELD_R = 1.5

export function fieldHeight(): number {
  return FIELD_ROWS * FIELD_PITCH + 2
}

// Pixels for `cells` columns of the band, capped so the drawing stays
// well under the 131072-character limit.
export function fieldPx(cells: number): number {
  return Math.min(2400, Math.max(96, cells * 8))
}

export function fieldSvg(steps: Step[], fromDone: number, W: number): string {
  const n = steps.length
  const H = fieldHeight()
  const cols = Math.floor((W - 4) / FIELD_PITCH)
  const done = steps.filter(s => s.status === 'completed').length
  const edge = Math.round((done / n) * cols)
  const was = Math.round((Math.min(fromDone, n) / n) * cols)
  const groups: string[] = []

  // The pill rides the front edge: done work behind it, pending ahead.
  // No dot is drawn under it, so it needs no background of its own.
  const label = `Tasks ${done}/${n}`
  const pillW = Math.round(label.length * 6.4 + 20)
  const pillH = 16
  const pillY = (H - pillH) / 2
  const pillX = (at: number) => Math.min(W - pillW - 2, Math.max(2, 2 + at * FIELD_PITCH - pillW))
  const toX = pillX(edge)
  const fromX = pillX(was)
  const isUnderPill = (cx: number) => cx > toX - 4 && cx < toX + pillW + 4

  for (let x = 0; x < cols; x++) {
    const dots: string[] = []
    const cx = 2 + FIELD_PITCH / 2 + x * FIELD_PITCH
    if (isUnderPill(cx)) continue
    for (let y = 0; y < FIELD_ROWS; y++) {
      const cy = 1 + FIELD_PITCH / 2 + y * FIELD_PITCH
      const roll = hash(x, y)
      if (x < edge) {
        // Denser toward the front edge, like light spreading.
        const near = 0.45 + 0.55 * ((x + 1) / edge)
        if (roll < near) {
          const tone = roll < near * 0.1 ? 'b' : roll < near * 0.45 ? 'm' : 'l'
          const tw = tone === 'b' || hash(y, x) < 0.12 ? ` style="animation-delay:${(hash(x + 7, y) * 3).toFixed(2)}s" class="${tone === 'b' ? 'b' : `${tone} tw`}"` : ` class="${tone}"`
          dots.push(`<circle${tw} cx="${cx}" cy="${cy}" r="${FIELD_R}"/>`)
        } else {
          dots.push(`<circle class="g" cx="${cx}" cy="${cy}" r="${FIELD_R}"/>`)
        }
      } else if (roll < 0.35) {
        // Only a scattered few of the waiting dots show.
        dots.push(`<circle class="o" cx="${cx}" cy="${cy}" r="${FIELD_R}"/>`)
      }
    }
    const isNew = x >= was && x < edge
    const cls = isNew ? 'col pop' : x < edge ? 'col' : ''
    const delay = isNew ? (((x - was) / Math.max(1, edge - was)) * 0.9).toFixed(2) : ((x / Math.max(1, edge)) * 1.4).toFixed(2)
    groups.push(cls ? `<g class="${cls}" style="animation-delay:${delay}s">${dots.join('')}</g>` : dots.join(''))
  }

  const slide = fromX === toX
    ? ''
    : `<animateTransform attributeName="transform" type="translate" from="${fromX - toX} 0" to="0 0" dur="0.9s" calcMode="spline" keySplines="0.22 1 0.36 1" keyTimes="0;1" fill="freeze"/>`
  const pill =
    `<g>${slide}` +
    `<rect class="halo" x="${toX}" y="${pillY}" width="${pillW}" height="${pillH}" rx="${pillH / 2}" fill="${PURPLE}" filter="url(#soft)"/>` +
    `<rect x="${toX}" y="${pillY}" width="${pillW}" height="${pillH}" rx="${pillH / 2}" fill="url(#pill)"/>` +
    `<clipPath id="pc"><rect x="${toX}" y="${pillY}" width="${pillW}" height="${pillH}" rx="${pillH / 2}"/></clipPath>` +
    `<g clip-path="url(#pc)"><rect class="sweep" x="${toX - 30}" y="${pillY}" width="30" height="${pillH}" fill="url(#sheen)"/></g>` +
    `<text x="${toX + pillW / 2}" y="${pillY + 11.8}" text-anchor="middle" font-family="ui-sans-serif,system-ui,-apple-system,sans-serif" font-size="11" font-weight="700" fill="#fff">${label}</text>` +
    '</g>'

  const style =
    `.g{fill:${EMPTY};opacity:.5}.o{fill:#8a8399;opacity:.4}.l{fill:${PURPLE}}.m{fill:#c084fc}.b{fill:#e9d5ff;animation:fade 3.2s ease-in-out infinite}@keyframes fade{0%,100%{opacity:.15}50%{opacity:.7}}` +
    '.col{animation:wave 2.8s ease-in-out infinite}@keyframes wave{0%,100%{opacity:.8}12%{opacity:1}24%{opacity:.8}}' +
    '.col.pop{animation:light .7s ease-out both}@keyframes light{from{opacity:0}60%{opacity:1}to{opacity:1}}' +
    '.tw{animation:tw 3s ease-in-out infinite}@keyframes tw{0%,100%{opacity:.45}50%{opacity:1}}' +
    '.halo{animation:halo 2.2s ease-in-out infinite}@keyframes halo{0%,100%{opacity:.3}50%{opacity:.75}}' +
    `.sweep{animation:sweep 2.6s cubic-bezier(.45,0,.55,1) infinite}@keyframes sweep{from{transform:translateX(0)}to{transform:translateX(${pillW + 30}px)}}` +
    // Waiting dots (.o) are a scattered few, faint grey; gaps among the lit
    // dots (.g) stay faint. On a light background: greys flip, purples deepen.
    '@media (prefers-color-scheme:light){.g{fill:#e4dfec;opacity:1}.o{fill:#c9c2d6;opacity:.7}.l{fill:#9333ea}.m{fill:#a855f7}.b{fill:#7c3aed}}'

  return doc(
    W,
    H,
    style,
    GLOW('g', 2.2) +
      '<filter id="soft" x="-30%" y="-100%" width="160%" height="300%"><feGaussianBlur stdDeviation="5"/></filter>' +
      '<linearGradient id="pill" x1="0" x2="1"><stop offset="0" stop-color="#8b5cf6"/><stop offset="1" stop-color="#b48cff"/></linearGradient>' +
      SHINE,
    `<g filter="url(#g)">${groups.join('')}</g>${pill}`,
  )
}
