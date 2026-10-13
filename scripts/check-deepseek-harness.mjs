import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { loadAgentManifest, repoRoot } from './agent-manifest.mjs'
import { syncDeepSeekHarness } from './sync-deepseek-harness.mjs'

const packagePath = join(repoRoot, 'package.json')
const patchPath = join(repoRoot, 'dsh', 'cordis.patch.yml')
let issueCount = 0

function issue(message) {
  console.error(`问题: ${message}`)
  issueCount += 1
}

const packageJson = JSON.parse(readFileSync(packagePath, 'utf8'))
if (packageJson.dsh?.bundle?.patch !== './dsh/cordis.patch.yml') {
  issue('package.json 缺少 dsh.bundle.patch，或路径不是 ./dsh/cordis.patch.yml')
}
if (!Array.isArray(packageJson.files) || !packageJson.files.includes('dsh')) {
  issue('package.json 的 files 必须包含 dsh')
}
if (!existsSync(patchPath)) {
  issue('缺少 dsh/cordis.patch.yml')
} else {
  const patch = readFileSync(patchPath, 'utf8')
  for (const expected of [
    'id: personal-digital-team-skills',
    "name: '@deepseek-ai/dsh-skill-filesystem'",
    'providerName: personal-digital-team',
    'includeDefaultRoots: false',
    'watch: false',
    "'dsh',",
    "'skills'",
  ]) {
    if (!patch.includes(expected)) issue(`Harness bundle patch 缺少配置: ${expected}`)
  }
}

try {
  const changed = syncDeepSeekHarness({ dryRun: true, log: () => {} })
  if (changed) issue('DeepSeek Harness 技能导出与源目录不同步')
} catch (error) {
  issue(error.message)
}

const manifest = loadAgentManifest()
for (const agent of manifest.agents) {
  const skillPath = join(repoRoot, 'dsh', 'skills', agent.slug, 'SKILL.md')
  if (!existsSync(skillPath)) {
    issue(`缺少 Harness Skill: dsh/skills/${agent.slug}/SKILL.md`)
    continue
  }
  const content = readFileSync(skillPath, 'utf8')
  if (!content.includes(`name: ${agent.slug}`)) {
    issue(`Harness Skill 名称不匹配: ${agent.slug}`)
  }
  if (!content.includes(`/${agent.slug}`)) {
    issue(`Harness Skill 缺少显式调用提示: /${agent.slug}`)
  }
}

const dshHome = mkdtempSync(join(tmpdir(), 'personal-digital-team-dsh-check-'))
try {
  const result = spawnSync(
    'dsh',
    ['--profile', 'headless', '--patch', patchPath, '--dump-config'],
    {
      cwd: repoRoot,
      env: { ...process.env, DSH_HOME: dshHome },
      encoding: 'utf8',
    },
  )
  if (result.error?.code === 'ENOENT') {
    console.log('skip Harness CLI validation: dsh not found')
  } else if (result.status !== 0) {
    issue([result.stdout, result.stderr].filter(Boolean).join('\n').trim())
  } else if (!result.stdout.includes('personal-digital-team-skills')) {
    issue('dsh --dump-config 未包含 personal-digital-team-skills')
  }
} finally {
  rmSync(dshHome, { recursive: true, force: true })
}

if (issueCount === 0) {
  console.log(`DeepSeek Harness 检查通过：${manifest.agents.length} 个岗位 Skill。`)
} else {
  console.error(`DeepSeek Harness 检查失败：发现 ${issueCount} 个问题。`)
  process.exitCode = 1
}
