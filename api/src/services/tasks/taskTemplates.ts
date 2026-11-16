import { UserInputError } from '@cedarjs/graphql-server'

import { db } from 'src/lib/db'

const DEFAULTS = [
  {
    name: '写周报',
    title: '整理本周工作周报',
    brief:
      '汇总本周完成的任务、关键产出与遗留问题，按「已完成 / 进行中 / 风险」三段整理。',
    acceptance: '每段有具体条目；风险项写明影响与下一步。',
    agentSlug: 'main-agent',
    priority: 'P1',
  },
  {
    name: '审一次代码',
    title: '审查最近的代码改动',
    brief:
      '检查最近提交的改动：正确性、边界条件、错误处理、可读性与测试覆盖；列出必须修和可选修。',
    acceptance: '输出问题清单，每条带文件位置与建议修法。',
    agentSlug: 'qa-security-engineer-agent',
    priority: 'P1',
  },
  {
    name: '评估岗位',
    title: '评估岗位能力与 Skill 缺口',
    brief:
      '按岗位规则检查职责边界、关联 Skill 与最新实践，输出升级建议与实施方案。',
    acceptance: '包含能力差距、P0/P1/P2 建议、验证方式。',
    agentSlug: 'role-development-agent',
    priority: 'P2',
  },
]

const text = (value: unknown, max: number, label: string) => {
  const raw = typeof value === 'string' ? value.trim() : ''
  if (raw.length > max)
    throw new UserInputError(`${label}不能超过 ${max} 个字符`)
  return raw
}

/** 首次访问时写入内置模板，开箱可用 */
export const taskTemplates = async () => {
  const count = await db.taskTemplate.count()
  if (!count) {
    await db.taskTemplate.createMany({ data: DEFAULTS })
  }
  return db.taskTemplate.findMany({ orderBy: { createdAt: 'asc' } })
}

export const createTaskTemplate = async ({
  input,
}: {
  input: {
    name: string
    title: string
    brief: string
    acceptance?: string | null
    agentSlug: string
    priority?: string | null
    readOnly?: boolean | null
  }
}) => {
  const name = text(input?.name, 60, '模板名')
  if (!name) throw new UserInputError('模板名不能为空')
  const title = text(input?.title, 120, '标题')
  if (!title) throw new UserInputError('标题不能为空')
  const brief = text(input?.brief, 4000, '需求')
  if (!brief) throw new UserInputError('需求不能为空')
  const agentSlug = text(input?.agentSlug, 120, '岗位')
  if (!agentSlug) throw new UserInputError('请选择执行岗位')

  const existing = await db.taskTemplate.findUnique({ where: { name } })
  if (existing) throw new UserInputError(`已有同名模板「${name}」`)

  return db.taskTemplate.create({
    data: {
      name,
      title,
      brief,
      acceptance: text(input?.acceptance, 2000, '验收标准'),
      agentSlug,
      priority: text(input?.priority || 'P1', 8, '优先级') || 'P1',
      readOnly: Boolean(input?.readOnly),
    },
  })
}

export const updateTaskTemplate = async ({
  id,
  input,
}: {
  id: string
  input: {
    name?: string | null
    title?: string | null
    brief?: string | null
    acceptance?: string | null
    agentSlug?: string | null
    priority?: string | null
    readOnly?: boolean | null
  }
}) => {
  const row = await db.taskTemplate.findUnique({ where: { id } })
  if (!row) throw new UserInputError('模板不存在')

  const data: Record<string, unknown> = {}
  if (input?.name !== undefined) {
    const name = text(input.name, 60, '模板名')
    if (!name) throw new UserInputError('模板名不能为空')
    if (name !== row.name) {
      const clash = await db.taskTemplate.findUnique({ where: { name } })
      if (clash) throw new UserInputError(`已有同名模板「${name}」`)
    }
    data.name = name
  }
  if (input?.title !== undefined) data.title = text(input.title, 120, '标题')
  if (input?.brief !== undefined) data.brief = text(input.brief, 4000, '需求')
  if (input?.acceptance !== undefined) {
    data.acceptance = text(input.acceptance, 2000, '验收标准')
  }
  if (input?.agentSlug !== undefined) {
    data.agentSlug = text(input.agentSlug, 120, '岗位')
  }
  if (input?.priority !== undefined) data.priority = input.priority
  if (input?.readOnly !== undefined) data.readOnly = Boolean(input.readOnly)

  return db.taskTemplate.update({ where: { id }, data })
}

export const deleteTaskTemplate = async ({ id }: { id: string }) => {
  const row = await db.taskTemplate.findUnique({ where: { id } })
  if (!row) throw new UserInputError('模板不存在')
  await db.taskTemplate.delete({ where: { id } })
  return row
}
