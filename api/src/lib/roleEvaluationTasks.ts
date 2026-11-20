import { db } from 'src/lib/db'
import { logger } from 'src/lib/logger'
import { failureReasonFromLog } from 'src/lib/roleEvaluationLog'

const TITLE_MAX = 120
const BRIEF_MAX = 4000
const ACCEPTANCE_MAX = 2000
const NOTE_MAX = 500

/** 评估任务与评估记录的时间容差：派发时两者几乎同时创建 */
const ADOPT_WINDOW_MS = 5 * 60 * 1000
/** 没有评估记录可对的评估任务，超过这个时长自动收尾，避免永远"执行中" */
const ORPHAN_TIMEOUT_MS = 30 * 60 * 1000

/** 岗位评估在任务看板里的统一前缀，便于识别自动登记的任务 */
export const EVALUATION_TASK_PREFIX = '岗位评估 · '

const clip = (value: string, max: number) =>
  value.length > max ? `${value.slice(0, max - 1)}…` : value

export const evaluationTaskTitle = (agentName: string) =>
  clip(`${EVALUATION_TASK_PREFIX}${agentName}`, TITLE_MAX)

export const evaluationTaskBrief = (input: {
  agentSlug: string
  agentName: string
  tool: string
  reportPath: string
  logPath: string
}) =>
  clip(
    [
      `评估「${input.agentName}」（${input.agentSlug}）的岗位能力、Skill 与规则是否符合当前团队需要。`,
      `执行工具：${input.tool}`,
      `评估报告：${input.reportPath}`,
      `运行日志：${input.logPath}`,
      '由「岗位评估更新」自动登记，跑完进入待验收。',
    ].join('\n'),
    BRIEF_MAX
  )

/**
 * 派发岗位评估时同步登记一条任务：任务看板可见、跑完待验收，
 * 评估进程本身就是执行者，不会再二次派发。
 */
export const createTaskForEvaluation = async (input: {
  agentSlug: string
  agentName: string
  tool: string
  reportPath: string
  logPath: string
}): Promise<string | null> => {
  try {
    const task = await db.task.create({
      data: {
        title: evaluationTaskTitle(input.agentName),
        brief: evaluationTaskBrief(input),
        acceptance: clip(
          `报告写入 ${input.reportPath}，包含能力差距、P0/P1/P2 建议与验证方式。`,
          ACCEPTANCE_MAX
        ),
        agentSlug: input.agentSlug,
        priority: 'P1',
        status: 'DISPATCHED',
        readOnly: true,
        mode: 'auto',
      },
    })
    return task.id
  } catch (error) {
    logger.warn(
      { error, agentSlug: input.agentSlug },
      'failed to register task for role evaluation'
    )
    return null
  }
}

const CLOSED_STATUSES = new Set([
  'DONE',
  'FAILED',
  'CANCELLED',
  'DRAFT',
  'QUEUED',
])

/** 报告产物只登记一次（幂等） */
const ensureReportArtifact = async (taskId: string, reportPath: string) => {
  const existing = await db.taskArtifact.findFirst({
    where: { taskId, path: reportPath },
    select: { id: true },
  })
  if (existing) return

  await db.taskArtifact.create({
    data: {
      taskId,
      kind: 'report',
      source: 'evaluation',
      path: reportPath,
      label: reportPath.split('/').at(-1) || reportPath,
    },
  })
}

/** 失败原因取日志末尾的真实报错，便于在任务详情里直接看到 */
const failureReason = (logPath: string | null | undefined) =>
  failureReasonFromLog(logPath, NOTE_MAX)

/**
 * 评估结束后把结论同步回任务：成功 → 待验收并登记报告产物；
 * 失败 → 失败态并写入失败原因。人工已经处理过的任务不覆盖。
 */
export const syncTaskWithEvaluation = async (input: {
  taskId: string | null
  outcome: 'completed' | 'failed'
  reportPath: string
  logPath?: string | null
  finishedAt: Date
}) => {
  if (!input.taskId) return

  try {
    const task = await db.task.findUnique({
      where: { id: input.taskId },
      select: { id: true, status: true },
    })
    if (!task || CLOSED_STATUSES.has(task.status)) return

    // 评估结束后任务又被重新派发过：这次是新的一次尝试，不能拿旧评估的结论覆盖
    const latestRun = await db.taskRun.findFirst({
      where: { taskId: task.id },
      orderBy: { startedAt: 'desc' },
      select: { startedAt: true },
    })
    if (latestRun && latestRun.startedAt > input.finishedAt) return

    // 已经是目标终态：不再重复写任务（避免看板轮询造成的 updatedAt 抖动），
    // 只补一次报告产物。
    if (task.status === 'AWAITING_REVIEW' && input.outcome === 'completed') {
      await ensureReportArtifact(task.id, input.reportPath)
      return
    }
    if (task.status === 'FAILED' && input.outcome === 'failed') return

    if (input.outcome === 'failed') {
      const reason = failureReason(input.logPath)
      await db.task.update({
        where: { id: task.id },
        data: {
          status: 'FAILED',
          completedAt: input.finishedAt,
          ...(reason ? { reviewNote: `评估失败：${reason}` } : {}),
        },
      })
      return
    }

    await db.task.update({
      where: { id: task.id },
      data: { status: 'AWAITING_REVIEW', completedAt: input.finishedAt },
    })
    await ensureReportArtifact(task.id, input.reportPath)
  } catch (error) {
    logger.warn(
      { error, taskId: input.taskId },
      'failed to sync task with role evaluation'
    )
  }
}

/**
 * 让任务看板的评估任务始终跟随评估记录的真实状态，并修复历史遗留：
 * 1. 已结束的评估 → 把结论写回任务（幂等，不需要等状态变化）
 * 2. 任务没有 taskId（早期派发或写入中断）→ 按岗位 + 时间窗认领对应评估
 * 3. 完全找不到评估记录且已超时 → 自动收尾为失败，不再永久"执行中"
 */
export const syncEvaluationTasks = async () => {
  let healed = 0

  try {
    const finished = await db.roleEvaluation.findMany({
      where: { status: { in: ['completed', 'failed'] }, taskId: { not: null } },
      orderBy: { startedAt: 'desc' },
      take: 100,
    })
    for (const row of finished) {
      await syncTaskWithEvaluation({
        taskId: row.taskId,
        outcome: row.status === 'completed' ? 'completed' : 'failed',
        reportPath: row.reportPath,
        logPath: row.logPath,
        finishedAt: row.finishedAt ?? row.startedAt,
      })
      healed += 1
    }

    const pending = await db.task.findMany({
      where: {
        status: 'DISPATCHED',
        title: { startsWith: EVALUATION_TASK_PREFIX },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })

    for (const task of pending) {
      const linked = await db.roleEvaluation.findFirst({
        where: { taskId: task.id },
        select: { id: true },
      })
      if (linked) continue

      // 按岗位 + 时间窗认领没有写回的评估
      const candidate = await db.roleEvaluation.findFirst({
        where: {
          agentSlug: task.agentSlug,
          startedAt: {
            gte: new Date(task.createdAt.getTime() - ADOPT_WINDOW_MS),
            lte: new Date(task.createdAt.getTime() + ADOPT_WINDOW_MS),
          },
        },
        orderBy: { startedAt: 'asc' },
      })

      if (candidate) {
        await db.roleEvaluation.update({
          where: { id: candidate.id },
          data: { taskId: task.id },
        })
        if (candidate.status === 'completed' || candidate.status === 'failed') {
          await syncTaskWithEvaluation({
            taskId: task.id,
            outcome: candidate.status === 'completed' ? 'completed' : 'failed',
            reportPath: candidate.reportPath,
            logPath: candidate.logPath,
            finishedAt: candidate.finishedAt ?? candidate.startedAt,
          })
        }
        healed += 1
        continue
      }

      // 没有任何评估记录：超时后自动收尾，避免永久停在执行中
      if (Date.now() - task.createdAt.getTime() < ORPHAN_TIMEOUT_MS) continue
      await db.task.update({
        where: { id: task.id },
        data: {
          status: 'FAILED',
          completedAt: new Date(),
          reviewNote: '评估进程没有留下记录，任务已自动收尾，请重新派发。',
        },
      })
      healed += 1
    }
  } catch (error) {
    logger.warn({ error }, 'failed to sync evaluation tasks')
  }

  return healed
}
