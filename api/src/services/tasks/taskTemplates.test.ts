import { db } from 'src/lib/db'

import {
  createTaskTemplate,
  deleteTaskTemplate,
  taskTemplates,
  updateTaskTemplate,
} from './taskTemplates'

describe('task templates', () => {
  beforeEach(async () => {
    await db.taskTemplate.deleteMany()
  })

  it('seeds built-in templates on first read', async () => {
    const list = await taskTemplates()
    expect(list.map((item) => item.name)).toEqual([
      '写周报',
      '审一次代码',
      '评估岗位',
    ])
  })

  it('creates and deletes a template', async () => {
    const created = await createTaskTemplate({
      input: {
        name: '我的模板',
        title: '按截图还原页面',
        brief: '参照截图实现页面',
        acceptance: '视觉一致',
        agentSlug: 'design-engineer-agent',
      },
    })

    expect(created.priority).toBe('P1')
    expect((await taskTemplates()).map((item) => item.name)).toContain(
      '我的模板'
    )

    await deleteTaskTemplate({ id: created.id })
    expect((await taskTemplates()).map((item) => item.name)).not.toContain(
      '我的模板'
    )
  })

  it('rejects duplicate names and empty fields', async () => {
    await createTaskTemplate({
      input: {
        name: '重复',
        title: 'a',
        brief: 'b',
        agentSlug: 'main-agent',
      },
    })

    await expect(
      createTaskTemplate({
        input: {
          name: '重复',
          title: 'a',
          brief: 'b',
          agentSlug: 'main-agent',
        },
      })
    ).rejects.toThrow('已有同名模板')

    await expect(
      createTaskTemplate({
        input: { name: '', title: 'a', brief: 'b', agentSlug: 'main-agent' },
      })
    ).rejects.toThrow('模板名不能为空')
  })
})

describe('update task template', () => {
  beforeEach(async () => {
    await db.taskTemplate.deleteMany()
  })

  it('renames and edits a template', async () => {
    const created = await createTaskTemplate({
      input: { name: '旧名', title: 'a', brief: 'b', agentSlug: 'main-agent' },
    })

    const updated = await updateTaskTemplate({
      id: created.id,
      input: { name: '新名', title: '新标题' },
    })

    expect(updated.name).toBe('新名')
    expect(updated.title).toBe('新标题')
  })

  it('rejects renaming onto an existing name', async () => {
    await createTaskTemplate({
      input: { name: 'A', title: 'a', brief: 'b', agentSlug: 'main-agent' },
    })
    const second = await createTaskTemplate({
      input: { name: 'B', title: 'a', brief: 'b', agentSlug: 'main-agent' },
    })

    await expect(
      updateTaskTemplate({ id: second.id, input: { name: 'A' } })
    ).rejects.toThrow('已有同名模板')
  })
})
