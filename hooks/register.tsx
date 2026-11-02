import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import type { Plan, Step, StepStatus } from '../types'
import { CRAB_H, CRAB_W, NARROW_AT, WIDE_AT, crabSvg, fieldHeight, fieldPx, fieldSvg } from './art'

// Theme keys, so the words follow the app's light or dark mode.
const ACCENT = 'merged'
const TEXT = 'text'
const MUTED = 'subtle'
const DIM = 'inactive'

const plan = atom({ plugin: 'progress-glow', key: 'plan' } as const, null)
const action = atom({ plugin: 'progress-glow', key: 'action' } as const, null)
const isOpen = atom({ plugin: 'progress-glow', key: 'isOpen' } as const, false)

const PLAN_TOOL = 'mcp__ccd_turn__update_plan'
const WRAP_TOOL = 'mcp__ccd_turn__wrap_up'

type Args = Record<string, unknown>

function asStatus(value: unknown): StepStatus {
  return value === 'completed' || value === 'in_progress' ? value : 'pending'
}

function asSteps(value: unknown): Step[] | undefined {
  if (!Array.isArray(value)) return undefined
  return value.map((item: Args) => ({
    content: String(item.content ?? ''),
    activeForm: typeof item.activeForm === 'string' ? item.activeForm : undefined,
    status: asStatus(item.status),
  }))
}

function doneCount(steps: Step[]): number {
  return steps.filter(s => s.status === 'completed').length
}

function setStatus(steps: Step[], i: number, status: StepStatus): Step[] {
  return steps.map((s, j) => (j === i ? { ...s, status } : s))
}

// update_plan: `items` replaces the list; `advance` completes the running
// step and starts the next; `done` (1-based) completes steps; `start` starts one.
function applyPlan(old: Plan | null, args: Args): Plan | null {
  const drawnDone = old ? doneCount(old.steps) : 0
  const items = asSteps(args.items)
  if (items) return { steps: items, drawnDone: Math.min(drawnDone, doneCount(items)) }
  if (!old) return old

  let steps = old.steps
  if (args.advance === true) {
    const running = steps.findIndex(s => s.status === 'in_progress')
    if (running >= 0) steps = setStatus(steps, running, 'completed')
    const next = steps.findIndex(s => s.status === 'pending')
    if (next >= 0) steps = setStatus(steps, next, 'in_progress')
  }
  if (Array.isArray(args.done)) {
    for (const n of args.done) {
      if (typeof n === 'number') steps = setStatus(steps, n - 1, 'completed')
    }
  }
  if (typeof args.start === 'number') {
    steps = setStatus(steps, args.start - 1, 'in_progress')
  }
  return { steps, drawnDone }
}

function finishAll(old: Plan | null): Plan | null {
  if (!old) return old
  return {
    steps: old.steps.map(s => ({ ...s, status: 'completed' as const })),
    drawnDone: doneCount(old.steps),
  }
}

function base(path: unknown): string {
  return typeof path === 'string' ? (path.split('/').pop() ?? path) : ''
}

function describe(tool: string, args: Args): string {
  switch (tool) {
    case 'Read':
      return `Reading ${base(args.file_path)}`
    case 'Edit':
    case 'Write':
      return `Editing ${base(args.file_path)}`
    case 'Bash':
      return typeof args.description === 'string' ? args.description : 'Running a command'
    case 'Grep':
    case 'Glob':
      return 'Searching the code'
    case 'Agent':
      return 'Working with a helper agent'
    case 'WebSearch':
    case 'WebFetch':
      return 'Looking on the web'
    case 'Skill':
      return `Loading the ${String(args.skill ?? '')} skill`
    case 'AskUserQuestion':
      return 'Waiting for your answer'
    default:
      return tool.startsWith('mcp__') ? `Using ${tool.split('__').pop()}` : `Using ${tool}`
  }
}

export const register: Register = on => {
  // The bar only watches: a failed write never blocks the tool.
  on('tool.call', async ($, e, next) => {
    const args = e as unknown as Args
    try {
      if (e.tool === PLAN_TOOL) {
        await update($, plan, old => applyPlan(old, args))
      } else if (e.tool === WRAP_TOOL) {
        await update($, plan, finishAll)
      } else if (!e.agentId) {
        await update($, action, () => describe(e.tool, args))
      }
    } catch {}
    return next(e)
  }).catch(($, e, next) => next(e))

  on('turn.complete', async ($, e, next) => {
    await update($, action, () => null)
    return next(e)
  })

  // A finished list clears when the next prompt starts new work.
  on('prompt.submit', async ($, e, next) => {
    try {
      await update($, plan, old =>
        old && old.steps.every(s => s.status === 'completed') ? null : old,
      )
    } catch {}
    return next(e)
  }).catch(($, e, next) => next(e))

  // One line at the bottom of the band: crab, dot field with its pill, the
  // step, the live action, Show. The field takes what the words leave.
  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const below = await next(e)
    const current = await read($, plan)
    if (e.props.hasSurvey || !current || current.steps.length === 0) {
      return below
    }

    const ui = $.ui.resolve(e)
    const { Box, Button, Text } = ui
    const Svg = e.surface !== 'terminal' && 'Svg' in ui ? ui.Svg : null
    const steps = current.steps
    const n = steps.length
    const done = doneCount(steps)
    const isDone = done === n
    const isWorking = e.props.isWorking && !isDone
    const running = steps.findIndex(s => s.status === 'in_progress')
    const at = Math.min(running >= 0 ? running : done, n - 1)
    const name = isDone ? 'all done' : (steps[at]?.activeForm ?? steps[at]?.content ?? '')
    const now = isWorking ? await read($, action) : null
    const open = Svg !== null && (await read($, isOpen))
    const columns = e.props.bodyColumns ?? 100
    // Fit the width: the live action goes first, then the dot field; the
    // words truncate, and the field box clips, so Show always shows.
    const hasLive = columns >= WIDE_AT && now !== null
    const hasField = columns >= NARROW_AT
    const nameCells = Math.min(28, Math.ceil(name.length * 0.8) + 1)
    const liveCells = hasLive ? Math.min(24, Math.ceil((now ?? '').length * 0.8) + 2) : 0
    const fieldCells = Math.max(14, Math.min(120, columns - 16 - nameCells - liveCells))

    const progress = Svg ? (
      <Svg
        key="field"
        source={fieldSvg(steps, current.drawnDone, fieldPx(fieldCells))}
        alt={`Tasks ${done} of ${n} done`}
        width={fieldPx(fieldCells)}
        height={fieldHeight()}
        isInteractive
      />
    ) : (
      <Text key="field">
        <Text color={ACCENT}>{'●'.repeat(done)}</Text>
        <Text color={DIM}>{'·'.repeat(n - done)}</Text>
      </Text>
    )

    const row = (
      <Box key="row" flexDirection="row" alignItems="center" paddingX={1} overflow="hidden">
        {Svg ? (
          <Box flexShrink={0} marginRight={1}>
            <Svg key="crab" source={crabSvg(isWorking)} alt={isWorking ? 'Claude crab, scuttling' : 'Claude crab, resting'} width={CRAB_W} height={CRAB_H} isInteractive />
          </Box>
        ) : null}
        {hasField || !Svg ? (
          <Box flexShrink={1} minWidth={0} overflow="hidden" marginRight={1}>{progress}</Box>
        ) : null}
        <Box flexShrink={0}>
          <Text color={ACCENT} bold>{isDone ? `${n}/${n}` : `${at + 1}/${n}`}</Text>
        </Box>
        <Box flexShrink={1} marginRight={1}>
          <Text color={TEXT} wrap="truncate-end"> {name}</Text>
        </Box>
        {hasLive ? (
          <Box key="live" flexDirection="row" flexShrink={2}>
            <Text color={ACCENT}>⟡ </Text>
            <Text color={MUTED} wrap="truncate-end">{now}</Text>
          </Box>
        ) : null}
        <Box flexGrow={1} />
        {Svg ? (
          <Box flexShrink={0} marginLeft={1}>
            <Button key="fold" label={open ? 'Hide' : 'Show'} onPress={() => update($, isOpen, o => !o)} />
          </Box>
        ) : null}
      </Box>
    )

    const card = open ? (
      <Box key="card" flexDirection="column" paddingX={2} paddingY={1}>
        {steps.map((step, i) => {
          const isNow = step.status === 'in_progress'
          const mark = step.status === 'completed' ? '✓' : isNow ? '◆' : '○'
          const color = step.status === 'completed' ? MUTED : isNow ? ACCENT : DIM
          return (
            <Box key={`s-${i}`} flexDirection="row">
              <Text color={step.status === 'completed' ? ACCENT : color} bold>{mark} </Text>
              <Text color={isNow ? TEXT : color} bold={isNow}>
                {isNow ? (step.activeForm ?? step.content) : step.content}
              </Text>
            </Box>
          )
        })}
      </Box>
    ) : null

    // Below whatever the other mods draw, in its own frame.
    return (
      <Box flexDirection="column">
        {below}
        <Box flexDirection="column" borderStyle="round" borderColor="subtle" borderDimColor>
          {row}
          {card}
        </Box>
      </Box>
    )
  })
}
