import { existsSync, realpathSync } from 'node:fs'
import path from 'node:path'

import { UserInputError } from '@cedarjs/graphql-server'

import { assertAuthenticated } from 'src/directives/requireAuth/requireAuth'
import { db } from 'src/lib/db'
import { resolveRepoRoot } from 'src/lib/roleEvaluationDispatch'
import { sessionIdFromLog } from 'src/lib/roleEvaluationSessions'
import {
  parseSessionReference,
  readSessionTurnTrace,
} from 'src/lib/sessionTrace'
import { taskKnowledgeView } from 'src/lib/taskKnowledge'
import { parseTaskRunOutput } from 'src/lib/taskOutput'

export const taskRunKnowledge = async (
  { taskId, runId }: { taskId: string; runId: string },
  { context }: { context?: { currentUser?: { id?: string } | null } } = {}
) => {
  assertAuthenticated(context)
  const run = await db.taskRun.findFirst({
    where: { id: runId, taskId },
    include: { events: { orderBy: { sequence: 'asc' } } },
  })
  if (!run) throw new UserInputError('任务与执行记录不匹配')
  const event = run.events.find((item) =>
    ['task.dispatched', 'task.dispatch_failed'].includes(item.eventType)
  )
  const repoRoot = resolveRepoRoot()
  const reference = parseSessionReference(run.externalReference)
  let sessionId = reference.sessionId
  let answer: string | undefined
  if (run.logPath) {
    const absolute = path.resolve(repoRoot, run.logPath)
    if (existsSync(absolute)) {
      const real = realpathSync(absolute)
      if (path.relative(repoRoot, real).startsWith('docs/tasks/logs/')) {
        // 旧的会话发现可能关联到同时运行的另一会话；本次日志中的 ID 更准确。
        sessionId =
          sessionIdFromLog(
            real,
            run.platform as 'codex' | 'deepseek-harness'
          ) || sessionId
        const output = parseTaskRunOutput({
          logPath: real,
          tool: run.platform as 'codex' | 'deepseek-harness',
        })
        if (output.completed && !output.error) answer = output.finalText
      }
    }
  }
  const trace = sessionId
    ? await readSessionTurnTrace({
        tool: run.platform,
        sessionId,
        turn: reference.turn,
        projectRoot: repoRoot,
        limits: { messages: 40, tools: 0, messageChars: 60_000 },
      })
    : null
  return taskKnowledgeView({
    evidence: event?.evidence,
    prompts: trace?.messages
      .filter((message) => message.role === 'user')
      .map((message) => message.content),
    answer,
  })
}
