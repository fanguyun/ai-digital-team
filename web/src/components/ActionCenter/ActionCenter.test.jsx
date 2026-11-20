import { fireEvent, render, screen } from '@cedarjs/testing/web'

import ActionCenter from './ActionCenter'
import { buildActionCenterModel } from './actionItems'

it.each([
  ['AWAITING_APPROVAL', '审阅方案', 'plan'],
  ['AWAITING_REVIEW', '验收成果', 'review'],
  ['FAILED', '查看失败原因', 'runs'],
])('opens the exact %s task and section', (status, label, section) => {
  const onNavigate = jest.fn()
  const model = buildActionCenterModel({
    tasks: [
      {
        id: 'outside-board-filter',
        title: '指定任务',
        agentSlug: 'main-agent',
        priority: 'P1',
        status,
        updatedAt: new Date().toISOString(),
      },
    ],
  })
  render(<ActionCenter model={model} onNavigate={onNavigate} />)
  fireEvent.click(screen.getByRole('button', { name: label }))
  expect(onNavigate).toHaveBeenCalledWith('tasks', {
    taskId: 'outside-board-filter',
    section,
  })
})
