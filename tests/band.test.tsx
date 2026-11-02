import { expect, test } from 'claude-code/testing'

const band = (surface: 'terminal' | 'desktop', isWorking: boolean) => ({
  plugin: 'progress-glow',
  surface,
  component: 'AbovePrompt',
  requestId: 'band',
  props: {
    hasSurvey: false,
    isWorking,
    maxRows: 20,
    bodyColumns: 120,
    scroll: { offset: 0, bodyRows: 20 },
    view: {},
  },
}) as const

const PLAN = 'mcp__ccd_turn__update_plan'

test('the band follows the task list and the live action', async ($, on) => {
  on('tool.call', () => ({ result: {} }))
  on('ui.render', ($, e) => {
    const { Box } = $.ui.resolve(e)
    return <Box />
  })

  await $.tool.call({
    tool: PLAN,
    items: [
      { content: 'Read docs', status: 'in_progress' },
      { content: 'Write mod', activeForm: 'Writing the mod', status: 'pending' },
      { content: 'Check it', status: 'pending' },
    ],
  } as never)
  await $.tool.call({ tool: PLAN, advance: true } as never)
  await $.tool.call({ tool: 'Read', file_path: '/x/register.tsx' })

  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount(band(surface, true))
    expect((await ui.find({ type: 'Text', text: /^2\/3$/ }))?.text).toBe('2/3')
    expect((await ui.find({ type: 'Text', text: /Writing the mod/ }))?.text).toContain('Writing the mod')
    expect((await ui.find({ type: 'Text', text: /Reading register/ }))?.text).toBe('Reading register.tsx')
    await ui.unmount()
  }

  await $.tool.call({ tool: 'mcp__ccd_turn__wrap_up', recap: 'x' } as never)
  const ui = await $.ui.mount(band('desktop', false))
  expect((await ui.find({ type: 'Text', text: /^3\/3$/ }))?.text).toBe('3/3')
  await ui.unmount()
})

test('with no task list the band draws nothing of its own', async ($, on) => {
  on('ui.render', ($, e) => {
    const { Text } = $.ui.resolve(e)
    return <Text>engine</Text>
  })
  const ui = await $.ui.mount(band('desktop', false))
  expect(await ui.find({ type: 'Text', text: /PROGRESS/ })).toBeUndefined()
  expect((await ui.find({ type: 'Text', text: /engine/ }))?.text).toBe('engine')
  await ui.unmount()
})
