// Draws the README pictures from the mod's own art code, so they match what
// the band draws. Run from the repo root: `bun scripts/previews.ts`.
import { mkdirSync, writeFileSync } from 'node:fs'

import { crabSvg, fieldPx, fieldSvg } from '../hooks/art'
import type { Step } from '../types'

type Theme = 'dark' | 'light'

// Close to the desktop app's own colours for the theme keys the band uses.
const INK: Record<Theme, Record<string, string>> = {
  dark: { bg: '#262624', frame: '#4a4945', edge: '#3a3936', text: '#e8e6dc', muted: '#9c9a92', dim: '#6f6d66', accent: '#af87ff' },
  light: { bg: '#faf9f5', frame: '#d9d5cb', edge: '#e6e2d8', text: '#1f1e1d', muted: '#73726c', dim: '#b0aea5', accent: '#8700ff' },
}

const STEPS: Step[] = [
  { content: 'Read the docs', status: 'completed' },
  { content: 'Sketch the band', status: 'completed' },
  { content: 'Draw the crab', status: 'completed' },
  { content: 'Write the mod', activeForm: 'Writing the mod', status: 'in_progress' },
  { content: 'Test both themes', status: 'pending' },
  { content: 'Share it', status: 'pending' },
]
const ACTION = 'Editing register.tsx'
const FONT = 'ui-sans-serif,system-ui,-apple-system,sans-serif'
const W = 800

// The art follows the viewer's colour scheme; a picture is pinned to one.
const pin = (svg: string, theme: Theme): string =>
  svg.replaceAll('@media (prefers-color-scheme:light)', theme === 'light' ? '@media all' : '@media not all')

const place = (svg: string, x: number, y: number, scale = 1): string =>
  svg.replace(
    /^<svg ([^>]*)width="([\d.]+)" height="([\d.]+)"/,
    (_m, attrs: string, w: string, h: string) =>
      `<svg ${attrs}x="${x}" y="${y}" width="${Number(w) * scale}" height="${Number(h) * scale}"`,
  )

const text = (x: number, y: number, fill: string, body: string, extra = ''): string =>
  `<text x="${x}" y="${y}" fill="${fill}" font-family="${FONT}" font-size="13"${extra}>${body}</text>`

const page = (w: number, h: number, body: string): string =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">${body}</svg>\n`

function band(theme: Theme, isOpen: boolean): string {
  const c = INK[theme]
  const rowY = 32
  const cardRows = isOpen ? STEPS.length : 0
  const frameH = 40 + (cardRows ? cardRows * 20 + 24 : 0)
  const H = frameH + 24
  const done = STEPS.filter(s => s.status === 'completed').length
  const at = STEPS.findIndex(s => s.status === 'in_progress')
  const name = STEPS[at]?.activeForm ?? ''

  const parts = [
    `<rect x=".5" y=".5" width="${W - 1}" height="${H - 1}" rx="10" fill="${c.bg}" stroke="${c.edge}"/>`,
    `<rect x="12.5" y="12.5" width="${W - 25}" height="${frameH - 1}" rx="8" fill="none" stroke="${c.frame}"/>`,
    place(pin(crabSvg(true), theme), 24, rowY - 12),
    // The field starts one step behind, so the pill slides and the new
    // stretch lights up once when the picture loads.
    place(pin(fieldSvg(STEPS, done - 1, fieldPx(42)), theme), 64, rowY - 10),
    text(408, rowY + 4.5, c.accent, `${at + 1}/${STEPS.length}`, ' font-weight="700"'),
    text(434, rowY + 4.5, c.text, name),
    text(552, rowY + 4.5, c.accent, '⟡'),
    text(568, rowY + 4.5, c.muted, ACTION),
    `<rect x="720.5" y="${rowY - 10.5}" width="55" height="21" rx="6" fill="none" stroke="${c.frame}"/>`,
    text(748, rowY + 4.5, c.text, isOpen ? 'Hide' : 'Show', ' text-anchor="middle"'),
  ]

  STEPS.forEach((step, i) => {
    if (!isOpen) return
    const y = 76 + i * 20
    const isNow = step.status === 'in_progress'
    const mark = step.status === 'completed' ? '✓' : isNow ? '◆' : '○'
    const markFill = step.status === 'pending' ? c.dim : c.accent
    const fill = isNow ? c.text : step.status === 'completed' ? c.muted : c.dim
    parts.push(text(32, y, markFill, mark, ' font-weight="700"'))
    parts.push(text(50, y, fill, isNow ? (step.activeForm ?? step.content) : step.content, isNow ? ' font-weight="700"' : ''))
  })

  return page(W, H, parts.join(''))
}

function crab(theme: Theme): string {
  return page(160, 120, `<g shape-rendering="crispEdges">${place(pin(crabSvg(true), theme), 0, 0, 5)}</g>`)
}

mkdirSync('assets', { recursive: true })
for (const theme of ['dark', 'light'] as const) {
  writeFileSync(`assets/band-${theme}.svg`, band(theme, false))
  writeFileSync(`assets/steps-${theme}.svg`, band(theme, true))
  writeFileSync(`assets/crab-${theme}.svg`, crab(theme))
}
console.log('Wrote 6 pictures to assets/')
