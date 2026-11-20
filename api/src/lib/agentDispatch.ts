import { spawn } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { closeSync, existsSync, mkdirSync, openSync } from 'node:fs'
import path from 'node:path'

import {
  probeBinary,
  type RoleEvaluationToolId,
} from 'src/lib/roleEvaluationDispatch'

export type AgentToolId = RoleEvaluationToolId

export type TaskMode = 'auto' | 'plan' | 'execute'

export type TaskPromptInput = {
  title: string
  brief: string
  acceptance: string
  agentSlug: string
  readOnly: boolean
  mode?: TaskMode
  planPath?: string | null
  revisionNote?: string | null
  reviewNote?: string | null
  previousSummary?: string | null
  previousArtifacts?: string[]
  knowledge?: string
}

/**
 * 首行固定 `My request:`，让会话标题解析能取到任务标题；
 * 末尾给出产物约定行，便于任务结束时登记产物。
 */
export const buildTaskPrompt = ({
  title,
  brief,
  acceptance,
  agentSlug,
  readOnly,
  mode = 'auto',
  planPath,
  revisionNote,
  reviewNote,
  previousSummary,
  previousArtifacts = [],
  knowledge,
}: TaskPromptInput) => {
  const lines = [
    `My request: ${title}`,
    '你是个人数字团队的执行岗位，本次由团队系统派发的任务。',
    '',
    `执行岗位：${agentSlug}`,
    `岗位规则：agents/${agentSlug}/AGENTS.md`,
    '',
    '## 任务需求',
    brief,
    '',
    '## 验收标准',
    acceptance || '（未填写，按常规质量标准交付）',
  ]

  if (reviewNote || previousSummary || previousArtifacts.length) {
    lines.push('', '## 上一轮的结果（不要重复已完成的部分）')
    if (previousSummary) lines.push(`交付摘要：${previousSummary}`)
    if (previousArtifacts.length) {
      lines.push('上轮产物：')
      for (const file of previousArtifacts.slice(0, 20)) {
        lines.push(`- ${file}`)
      }
    }
    if (reviewNote) lines.push('', `打回原因：${reviewNote}`)
    lines.push('请在上轮基础上继续，只补未完成或被打回的部分。')
  }

  if (mode === 'plan') {
    lines.push(
      '',
      '## 工作方式：计划模式（本次不要改代码）',
      '先产出可执行方案，交给用户确认后再实施。方案请包含：',
      '1. 问题与目标（含不做什么）',
      '2. 方案设计（关键取舍与备选）',
      '3. 影响文件清单（预计新增/修改哪些文件）',
      '4. 实施步骤（可照着执行的顺序）',
      '5. 验收标准与验证方式',
      '6. 风险与回滚',
      '',
      '最终回复直接返回完整 Markdown 方案正文，不要压缩成摘要。',
      '本次只读：不得修改任何仓库文件。系统会保存方案，无需自行写文件或输出 artifact: 路径。'
    )

    if (revisionNote) {
      lines.push(
        '',
        '## 这是第二版及以后的方案',
        '用户在上一版基础上提出了修正意见，请据此重写，保留仍然成立的部分：',
        revisionNote
      )
    }
  }

  if (mode === 'execute' && planPath) {
    lines.push(
      '',
      '## 工作方式：按已确认的方案执行',
      `已确认的方案在：${planPath}`,
      '请严格按该方案实施；如发现方案与实际不符，先说明差异再调整，不要擅自扩大范围。'
    )
  }

  lines.push(
    '',
    readOnly || mode === 'plan'
      ? '## 边界\n本次是只读任务：不得修改仓库文件，只输出结论与建议。'
      : '## 边界\n可以修改仓库文件；改动应最小、可回退，并在结束语说明改了哪些文件。',
    '',
    '## 结束要求',
    mode === 'plan'
      ? '1. 最终回复仅包含完整方案正文，包含上述六部分；被阻塞时说明原因，不冒充方案。'
      : '1. 用 3 行以内说明结果、改动范围和验证情况。',
    mode === 'plan'
      ? '2. 方案由系统保存，不声明尚未生成的文件产物。'
      : '2. 每个交付物单独一行，格式固定为：artifact: <相对仓库根的路径或链接>',
    '3. 若被阻塞或需要人工确认，明确写出「待确认：<问题>」。'
  )

  if (knowledge) lines.push('', '## 本轮外部知识参考', knowledge)
  return lines.join('\n')
}

/** 思源凭证只能留在 NAS；新检索配置不继承到执行子进程。 */
export const taskAgentEnv = (env: NodeJS.ProcessEnv = process.env) =>
  Object.fromEntries(
    Object.entries(env).filter(
      ([key]) => !/^(KNOWLEDGE_|SIYUAN_|RAG_BRIDGE_)/i.test(key)
    )
  )

export const buildTaskCommand = ({
  tool,
  bin,
  projectRoot,
  prompt,
  readOnly,
  images = [],
}: {
  tool: AgentToolId
  bin: string
  projectRoot: string
  prompt: string
  readOnly: boolean
  images?: string[]
}): { command: string; args: string[] } => {
  if (tool === 'codex') {
    const imageArgs = images.flatMap((file) => ['-i', file])
    return {
      command: bin,
      args: [
        'exec',
        '-C',
        projectRoot,
        '--skip-git-repo-check',
        '-s',
        readOnly ? 'read-only' : 'workspace-write',
        '--color',
        'never',
        ...imageArgs,
        '--json',
        prompt,
      ],
    }
  }

  return {
    command: bin,
    args: [
      '--profile',
      'headless',
      ...(readOnly
        ? ['--patch', path.join(projectRoot, 'dsh/task-readonly.patch.yml')]
        : []),
      '--json',
      prompt,
    ],
  }
}

export type SpawnedAgent = {
  pid: number
  command: string
  args: string[]
  logAbsolute: string
}

export const spawnTaskAgent = ({
  tool,
  projectRoot,
  prompt,
  logAbsolute,
  readOnly,
  images = [],
}: {
  tool: AgentToolId
  projectRoot: string
  prompt: string
  logAbsolute: string
  readOnly: boolean
  images?: string[]
}): SpawnedAgent => {
  const probe = probeBinary(tool)
  if (!('bin' in probe)) throw new Error(probe.reason)

  if (tool === 'deepseek-harness' && readOnly) {
    if (!existsSync(path.join(projectRoot, 'dsh/task-readonly.patch.yml'))) {
      throw new Error('Harness 只读配置不存在，已阻止派发')
    }
  }

  const { command, args } = buildTaskCommand({
    tool,
    bin: probe.bin,
    projectRoot,
    prompt,
    readOnly,
    images,
  })

  mkdirSync(path.dirname(logAbsolute), { recursive: true })
  const logHandle = openSync(logAbsolute, 'a')
  let child
  try {
    child = spawn(command, args, {
      cwd: projectRoot,
      detached: true,
      stdio: ['ignore', logHandle, logHandle],
      env: taskAgentEnv(),
    })
  } finally {
    closeSync(logHandle)
  }

  if (!child.pid) throw new Error('执行进程未能启动')

  child.unref()
  return { pid: child.pid, command, args, logAbsolute }
}

/** 每轮使用独立日志，避免快速重试读到上一轮输出。 */
export const taskLogPath = (taskId: string, at: Date = new Date()) => {
  const pad = (value: number) => String(value).padStart(2, '0')
  const stamp = `${at.getFullYear()}${pad(at.getMonth() + 1)}${pad(
    at.getDate()
  )}-${pad(at.getHours())}${pad(at.getMinutes())}${pad(at.getSeconds())}`
  return `docs/tasks/logs/${taskId}-${stamp}-${randomUUID()}.log`
}
