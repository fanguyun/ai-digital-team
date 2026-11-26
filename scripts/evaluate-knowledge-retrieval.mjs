// Node 24；只读检索评测，不启动 Agent、不写思源、不保存正文或凭证。
// node --env-file=.env scripts/evaluate-knowledge-retrieval.mjs [报告输出路径]
import { readFile, writeFile } from 'node:fs/promises'
import { stripTypeScriptTypes } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import pg from 'pg'

const root = fileURLToPath(new URL('../', import.meta.url))
const casesFile = 'docs/acceptance/2026-11-24-p1-knowledge-cases.json'
// 这两个模块仅依赖 Node 内置库；直接执行当前适配器，避免评测另写一套检索实现。
const loadSource = async (file) => {
  const code = stripTypeScriptTypes(
    await readFile(path.join(root, file), 'utf8')
  )
  return import(
    `data:text/javascript;base64,${Buffer.from(code).toString('base64')}`
  )
}

try {
  const cases = JSON.parse(await readFile(path.join(root, casesFile), 'utf8'))
  const { searchSiYuan, SIYUAN_ADAPTER_VERSION } = await loadSource(
    'api/src/lib/siyuanKnowledge.ts'
  )
  const { decryptSecret, secretKeyFromEnv } = await loadSource(
    'api/src/lib/secrets.ts'
  )
  if (!process.env.DATABASE_URL) throw new Error('数据库未配置')
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL })
  let config
  try {
    await client.connect()
    await client.query('BEGIN READ ONLY')
    config = (
      await client.query(
        'SELECT enabled, provider, "baseUrl", "tokenCipher", notebooks, "pathPrefixes", "timeoutMs" FROM "RagKnowledgeConfig" WHERE id = $1',
        ['default']
      )
    ).rows[0]
    await client.query('ROLLBACK')
  } finally {
    await client.end()
  }
  if (!config?.enabled || config.provider !== 'siyuan')
    throw new Error('未启用直连思源')
  const token = decryptSecret(config.tokenCipher, secretKeyFromEnv())
  if (!token) throw new Error('令牌不可用')
  const results = []
  for (const test of cases.cases) {
    const start = Date.now()
    const outcome = await searchSiYuan({
      origin: config.baseUrl,
      token,
      query: test.query,
      notebooks: config.notebooks,
      timeoutMs: config.timeoutMs,
    })
    const prefixes = config.pathPrefixes
      .map((prefix) => prefix.trim().replace(/^\/+|\/+$/g, ''))
      .filter((prefix) => prefix && !prefix.split('/').includes('..'))
    const items = (outcome.items || []).filter(
      (item) =>
        !prefixes.length ||
        prefixes.some((prefix) => {
          const sourcePath = item.documentPath.replace(/^\/+/, '')
          return sourcePath === prefix || sourcePath.startsWith(`${prefix}/`)
        })
    )
    const status =
      outcome.status === 'hit' && !items.length ? 'empty' : outcome.status
    results.push({
      ...test,
      actual: {
        status,
        elapsedMs: Date.now() - start,
        documents: [...new Set(items.map((item) => item.documentId))],
        targetHit: items.some(
          (item) => item.documentId === cases.targetDocumentId
        ),
        matchesExpectedStatus: status === test.expectedStatus,
      },
    })
  }
  const report = {
    evaluatedAt: new Date().toISOString(),
    adapterVersion: SIYUAN_ADAPTER_VERSION,
    casesFile,
    targetDocumentId: cases.targetDocumentId,
    description: cases.description,
    scope: '当前适配器与已配置笔记本/目录范围；不包含模型回答的语义评分。',
    results,
  }
  const output = `${JSON.stringify(report, null, 2)}\n`
  if (process.argv[2]) await writeFile(path.resolve(process.argv[2]), output)
  console.log(output)
  if (results.some((result) => !result.actual.matchesExpectedStatus))
    process.exitCode = 1
} catch {
  // 上游异常可能带连接信息，评测脚本不打印异常对象。
  console.error(
    '检索评测未完成，请检查数据库、SETTINGS_SECRET、思源配置与连接权限。'
  )
  process.exitCode = 1
}
