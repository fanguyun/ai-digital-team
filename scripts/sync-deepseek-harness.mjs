import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadAgentManifest, repoRoot } from './agent-manifest.mjs'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const codexSkillsRoot = join(
  repoRoot,
  'plugins',
  'personal-digital-team',
  'skills'
)
const harnessSkillsRoot = join(repoRoot, 'dsh', 'skills')
const harnessScriptsRoot = join(repoRoot, 'dsh', 'scripts')
const taskRuntimeSourcePath = join(repoRoot, 'scripts', 'task-runtime.mjs')
const taskRuntimeTargetPath = join(harnessScriptsRoot, 'task-runtime.mjs')
const runtimeTelemetrySourcePath = join(
  repoRoot,
  'scripts',
  'runtime-telemetry.mjs'
)
const runtimeTelemetryTargetPath = join(
  harnessScriptsRoot,
  'runtime-telemetry.mjs'
)

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function listLinkedSkillNames(manifest) {
  const names = new Set(manifest.agents.map((agent) => agent.slug))
  for (const agent of manifest.agents) {
    for (const skill of agent.skills) names.add(skill)
  }
  return [...names]
    .filter((name) => /^[a-z0-9][a-z0-9-]*$/.test(name))
    .sort((left, right) => right.length - left.length)
}

function transformSkill(source, slug, invocableNames) {
  let result = source.replace(
    /^> 插件导出说明：.*$/m,
    `> DeepSeek Harness 导出说明：本技能由同一岗位源自动生成；可通过 \`/${slug}\` 显式调用。`
  )

  result = result
    .replace(
      /^\s+- 需要确认当前插件包含哪些岗位时，.*$/m,
      '   - 需要确认当前能力包包含哪些岗位时，以本 Skill 的岗位清单和路由矩阵为准。'
    )
    .replace(
      /^\s+- 用户报告插件安装异常、岗位缺失或元数据显示不全时，.*$/m,
      '   - 用户报告安装异常、岗位缺失或元数据显示不全时，使用 Harness 插件管理器和 `dsh --dump-config` 检查 bundle 是否启用。'
    )
    .replace(
      /^10\. 如需检查插件自身完整性，可只读执行 .*$/m,
      '10. 如需检查能力包完整性，使用 Harness 插件管理器查看已启用 bundle；在源仓库中运行 `yarn check-deepseek-harness`。'
    )
    .replaceAll('~/.codex/skills', '~/.dsh/skills')

  for (const name of invocableNames) {
    result = result.replace(
      new RegExp(`\\$${escapeRegExp(name)}\\b`, 'g'),
      `/${name}`
    )
  }
  return result
}

function writeIfChanged(path, content, log, { dryRun = false } = {}) {
  if (existsSync(path) && readFileSync(path, 'utf8') === content) return false
  if (dryRun) {
    log(`would sync ${path.replace(`${repoRoot}/`, '')}`)
    return true
  }
  writeFileSync(path, content, 'utf8')
  log(`synced ${path.replace(`${repoRoot}/`, '')}`)
  return true
}

export function syncDeepSeekHarness({
  log = console.log,
  dryRun = false,
} = {}) {
  if (!existsSync(taskRuntimeSourcePath)) {
    throw new Error(
      `缺少任务运行时 CLI: ${taskRuntimeSourcePath.replace(`${repoRoot}/`, '')}`
    )
  }
  if (!existsSync(runtimeTelemetrySourcePath)) {
    throw new Error(
      `缺少运行时遥测适配器: ${runtimeTelemetrySourcePath.replace(`${repoRoot}/`, '')}`
    )
  }
  const manifest = loadAgentManifest()
  const slugs = manifest.agents.map((agent) => agent.slug)
  const invocableNames = listLinkedSkillNames(manifest)

  if (!dryRun) {
    mkdirSync(harnessSkillsRoot, { recursive: true })
    mkdirSync(harnessScriptsRoot, { recursive: true })
  }

  let changed = writeIfChanged(
    taskRuntimeTargetPath,
    readFileSync(taskRuntimeSourcePath, 'utf8'),
    log,
    { dryRun }
  )
  changed =
    writeIfChanged(
      runtimeTelemetryTargetPath,
      readFileSync(runtimeTelemetrySourcePath, 'utf8'),
      log,
      { dryRun }
    ) || changed

  for (const slug of slugs) {
    const sourcePath = join(codexSkillsRoot, slug, 'SKILL.md')
    if (!existsSync(sourcePath)) {
      throw new Error(
        `缺少 Codex 插件导出: ${sourcePath.replace(`${repoRoot}/`, '')}`
      )
    }
    const targetDir = join(harnessSkillsRoot, slug)
    if (!dryRun) mkdirSync(targetDir, { recursive: true })
    const content = transformSkill(
      readFileSync(sourcePath, 'utf8'),
      slug,
      invocableNames
    )
    changed =
      writeIfChanged(join(targetDir, 'SKILL.md'), content, log, { dryRun }) ||
      changed
  }

  const entries = existsSync(harnessSkillsRoot)
    ? readdirSync(harnessSkillsRoot, { withFileTypes: true })
    : []
  for (const entry of entries) {
    if (
      !entry.isDirectory() ||
      entry.name.startsWith('.') ||
      slugs.includes(entry.name)
    )
      continue
    const path = join(harnessSkillsRoot, entry.name)
    if (dryRun) {
      log(`would remove stale Harness skill ${entry.name}`)
    } else {
      rmSync(path, { recursive: true, force: true })
      log(`removed stale Harness skill ${entry.name}`)
    }
    changed = true
  }

  return changed
}

const isMain =
  process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)

if (isMain) {
  const args = new Set(process.argv.slice(2))
  const supportedArgs = new Set(['--dry-run', '--check'])
  const unknownArgs = [...args].filter((arg) => !supportedArgs.has(arg))
  if (unknownArgs.length > 0) {
    console.error(`未知参数: ${unknownArgs.join(', ')}`)
    console.error(
      '用法: node scripts/sync-deepseek-harness.mjs [--dry-run|--check]'
    )
    process.exitCode = 2
  } else {
    try {
      const dryRun = args.has('--dry-run') || args.has('--check')
      const changed = syncDeepSeekHarness({ dryRun })
      if (args.has('--check') && changed) {
        console.error(
          'DeepSeek Harness 技能与源目录不同步，请先运行 pnpm sync-team。'
        )
        process.exitCode = 1
      }
    } catch (error) {
      console.error(`DeepSeek Harness 同步失败: ${error.message}`)
      process.exitCode = 1
    }
  }
}
