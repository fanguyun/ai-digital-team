import {
  accessSync,
  constants,
  existsSync,
  realpathSync,
  statSync,
} from 'node:fs'
import path from 'node:path'

import { loadKnowledgeSource, probeKnowledgeBridge } from './knowledgeSource'
import { probeSiYuan } from './siyuanKnowledge'
import { extractDeliverablePaths, type TaskPrecheckInput } from './taskPrecheck'

export type EnvironmentCheck = {
  key: string
  label: string
  status: 'PASS' | 'BLOCKED' | 'WARNING'
  detail: string
  remedy: string
}

export type TaskEnvironment = {
  ready: boolean
  checks: EnvironmentCheck[]
}

const readProbeJson = async (response: Response) => {
  const reader = response.body?.getReader()
  if (!reader) throw new Error('empty response')
  const chunks: Uint8Array[] = []
  let bytes = 0
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      bytes += value.byteLength
      if (bytes > 8192) throw new Error('response too large')
      chunks.push(value)
    }
    return JSON.parse(Buffer.concat(chunks).toString('utf8'))
  } finally {
    await reader.cancel().catch(() => {})
  }
}

/** 仅探测部署配置中的服务；不访问需求正文中的 URL，也不启动模型。 */
export const checkTaskEnvironment = async (
  task: TaskPrecheckInput & { useKnowledge?: boolean; mode?: string },
  repoRoot: string,
  {
    env = process.env,
    fetchImpl = fetch,
  }: { env?: NodeJS.ProcessEnv; fetchImpl?: typeof fetch } = {}
): Promise<TaskEnvironment> => {
  const checks: EnvironmentCheck[] = []
  const add = (
    key: string,
    label: string,
    status: EnvironmentCheck['status'],
    detail: string,
    remedy = ''
  ) => checks.push({ key, label, status, detail, remedy })
  try {
    if (!env.TASK_RUNTIME_WRITE_TOKEN) throw new Error('missing token')
    const url = new URL(
      env.TASK_RUNTIME_API_URL || 'http://127.0.0.1:8901/graphql'
    )
    if (
      !['http:', 'https:'].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.search ||
      url.hash
    )
      throw new Error('invalid URL')
    const response = await fetchImpl(url.href, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${env.TASK_RUNTIME_WRITE_TOKEN}`,
      },
      body: JSON.stringify({
        query:
          'query EnvironmentProbe { taskRun(id: "00000000-0000-0000-0000-000000000000") { id } }',
      }),
      redirect: 'error',
      signal: AbortSignal.timeout(2500),
    })
    const body = await readProbeJson(response)
    if (
      !response.ok ||
      body.errors?.length ||
      !body.data ||
      !Object.hasOwn(body.data, 'taskRun')
    )
      throw new Error('API unavailable')
    add(
      'runtime',
      '团队 API',
      'PASS',
      '服务端连接和运行时鉴权通过（只读探测）。'
    )
  } catch {
    add(
      'runtime',
      '团队 API',
      'BLOCKED',
      '运行时地址、令牌缺失，或团队 API 无法连接、鉴权未通过。',
      '检查部署环境的 TASK_RUNTIME_API_URL、TASK_RUNTIME_WRITE_TOKEN，并确认 API 服务已启动。'
    )
  }

  const needsSiYuan =
    /(?:读取|写入|同步|导入|导出|连接|访问|检索|查询)[^。\n]{0,40}(?:思源|siyuan)|(?:思源|siyuan)[^。\n]{0,40}(?:读取|写入|同步|导入|导出|连接|访问|检索|查询)/i.test(
      `${task.title}\n${task.brief || ''}\n${task.acceptance || ''}`
    )
  if (needsSiYuan || task.useKnowledge !== false) {
    let required = needsSiYuan
    try {
      const source = await loadKnowledgeSource(task.agentSlug || '', env)
      required =
        needsSiYuan ||
        (source.status !== 'disabled' && source.mode === 'required')
      if (source.status !== 'ok') {
        add(
          'knowledge',
          needsSiYuan ? '思源服务' : '知识库',
          required ? 'BLOCKED' : 'WARNING',
          '未启用可用的知识库连接，或连接配置不完整。',
          '在知识库设置中检查服务地址、令牌与岗位可用范围。'
        )
      } else {
        const probe =
          source.provider === 'siyuan' ? probeSiYuan : probeKnowledgeBridge
        const result = await probe({
          origin: source.origin,
          token: source.token,
          timeoutMs: 2000,
          fetchImpl,
        })
        add(
          'knowledge',
          source.provider === 'siyuan' ? '思源服务' : '知识库桥接服务',
          result.ok ? 'PASS' : required ? 'BLOCKED' : 'WARNING',
          result.ok
            ? '服务端只读连接探测通过；不代表具备写入权限。'
            : '连接、鉴权或只读接口校验未通过。',
          result.ok
            ? ''
            : '检查知识库设置、令牌和服务网络，在设置中测试连接后重新检查。'
        )
      }
    } catch {
      add(
        'knowledge',
        '知识库连接',
        required ? 'BLOCKED' : 'WARNING',
        '无法读取或检查知识库配置。',
        '检查知识库设置与服务状态后重新检查。'
      )
    }
  }

  for (const relative of extractDeliverablePaths([
    task.brief || '',
    task.acceptance || '',
  ])) {
    if (relative.includes('*')) continue
    const reference =
      task.mode === 'plan' ||
      (task.readOnly && !relative.startsWith('docs/')) ||
      relative.startsWith('.agents/')
    try {
      const target = path.resolve(repoRoot, relative)
      let ancestor = target
      while (!existsSync(ancestor) && ancestor !== path.dirname(ancestor))
        ancestor = path.dirname(ancestor)
      const resolved = path.relative(
        realpathSync(repoRoot),
        realpathSync(ancestor)
      )
      if (resolved.startsWith('..') || path.isAbsolute(resolved)) {
        if (!reference) throw new Error('outside repo')
        add(
          `path:${relative}`,
          `参考路径 ${relative}`,
          'WARNING',
          '该参考路径通过软链接指向仓库外，是否可读由执行环境决定。',
          '确认软链接目标可读；预检不会扩大沙箱访问范围。'
        )
        continue
      }
      if (ancestor !== target && !statSync(ancestor).isDirectory())
        throw new Error('not a directory')
      accessSync(
        ancestor,
        constants.R_OK |
          (reference ? 0 : constants.W_OK) |
          (statSync(ancestor).isDirectory() ? constants.X_OK : 0)
      )
      add(
        `path:${relative}`,
        `${reference ? '参考' : '目标'}路径 ${relative}`,
        'PASS',
        ancestor === target
          ? '服务端可访问该目标。'
          : reference
            ? '参考路径尚不存在，请在执行环境中确认。'
            : '上级目录可访问，缺少的目录可在执行时创建。'
      )
    } catch {
      add(
        `path:${relative}`,
        `目标路径 ${relative}`,
        reference ? 'WARNING' : 'BLOCKED',
        reference
          ? '无法确认参考路径可读。'
          : '目标不可访问、不可写或通过软链接指向仓库外。',
        reference
          ? '检查参考路径及读取权限，执行环境仍会独立校验访问范围。'
          : '检查目标目录权限、目录结构与软链接，使用仓库内可写路径。'
      )
    }
  }
  add(
    'execution',
    '执行环境权限',
    'WARNING',
    '以上检查来自服务端；执行沙箱的网络、目录及外部写入权限仍以运行环境为准。',
    '若执行记录报告沙箱拒绝访问，请先修复对应运行环境，再点击“环境已修复，重试”。网页确认不会扩大权限。'
  )
  return { ready: !checks.some((check) => check.status === 'BLOCKED'), checks }
}
