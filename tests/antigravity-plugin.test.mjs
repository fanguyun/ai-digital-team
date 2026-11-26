import assert from 'node:assert/strict'
import { Buffer } from 'node:buffer'
import { spawnSync } from 'node:child_process'
import { join } from 'node:path'
import process from 'node:process'
import test from 'node:test'

import { loadAgentManifest, repoRoot } from '../scripts/agent-manifest.mjs'
import {
  ANTIGRAVITY_ALLOWED_MANIFEST_KEYS,
  ANTIGRAVITY_RULE_MAX_BYTES,
  buildPluginManifest,
  buildPluginReadme,
  buildPluginRules,
  transformAntigravityMarkdown,
} from '../scripts/sync-antigravity.mjs'

test('transformAntigravityMarkdown 在入口 Skill 中将共享规则和岗位路径转换为 references/', () => {
  const input = [
    '先读取 `../ROUTING_MATRIX.md` 和 `../DELIVERY_PROTOCOL.md`。',
    '涉及代码时读取 `../software-engineer-agent/AGENTS.md` 或 `../qa-security-engineer-agent/`。',
    '执行 `node ../../scripts/list-team.mjs --format json`。',
    '检查 `ls ~/.codex/skills/<skill>/SKILL.md` 与 `$research`。',
  ].join('\n')

  const output = transformAntigravityMarkdown(input, {
    scope: 'skill',
    invocableNames: ['research', 'software-engineer-agent'],
  })

  assert.match(output, /`\.\/references\/ROUTING_MATRIX\.md`/)
  assert.match(output, /`\.\/references\/DELIVERY_PROTOCOL\.md`/)
  assert.match(output, /`\.\/references\/software-engineer-agent\.md`/)
  assert.match(output, /`\.\/references\/qa-security-engineer-agent\.md`/)
  assert.match(output, /node \.\.\/\.\.\/scripts\/list-team\.mjs/)
  assert.match(output, /~\/\.gemini\/config\/skills\/<skill>\/SKILL\.md/)
  assert.doesNotMatch(output, /\$research/)
  assert.match(output, /`research`/)
})

test('transformAntigravityMarkdown 在参考文档中调整 scripts 与同级引用路径', () => {
  const input =
    '遵循 `../DELIVERY_PROTOCOL.md`，运行 `node ../../scripts/task-runtime.mjs health`。'
  const output = transformAntigravityMarkdown(input, {
    scope: 'reference',
    invocableNames: [],
  })

  assert.match(output, /`\.\/DELIVERY_PROTOCOL\.md`/)
  assert.match(output, /node \.\.\/\.\.\/\.\.\/scripts\/task-runtime\.mjs/)
})

test('buildPluginManifest 仅输出 Antigravity 允许的顶层字段', () => {
  const manifest = loadAgentManifest()
  const parsed = JSON.parse(
    buildPluginManifest(manifest, {
      version: '0.1.0',
      repository: {
        type: 'git',
        url: 'https://github.com/fanguyun/ai-digital-team.git',
      },
    })
  )

  for (const key of Object.keys(parsed)) {
    assert.ok(
      ANTIGRAVITY_ALLOWED_MANIFEST_KEYS.has(key),
      `发现不支持字段: ${key}`
    )
  }
  assert.equal(parsed.name, 'personal-digital-team')
  assert.equal(parsed.suggestedPrompts.length, 3)
  assert.match(
    parsed.description,
    new RegExp(`与 ${manifest.agents.length} 个岗位 Agent`)
  )
})

test('buildPluginRules 不含 frontmatter、动态反映岗位数且小于 24,000 字节上限', () => {
  const manifest = loadAgentManifest()
  const rules = buildPluginRules(manifest)
  assert.equal(/^---\r?\n/.test(rules), false)
  assert.ok(Buffer.byteLength(rules, 'utf8') < ANTIGRAVITY_RULE_MAX_BYTES)
  assert.match(rules, /`main-agent`/)
  assert.match(rules, /`software-engineer-agent`/)

  const sampleRules = buildPluginRules({
    agents: [
      {
        slug: 'main-agent',
        name: '数字总经理',
        en: 'Main Agent',
        scope: '默认入口',
      },
      {
        slug: 'software-engineer-agent',
        name: '软件工程师',
        en: 'Software Engineer Agent',
        scope: '代码实现',
      },
    ],
  })
  assert.match(sampleRules, /不把全部 2 个岗位同时展开/)
  assert.match(sampleRules, /岗位索引（共 2 个）/)
})

test('buildPluginReadme 不硬编码本机用户绝对路径', () => {
  const manifest = loadAgentManifest()
  const readme = buildPluginReadme(manifest)
  assert.doesNotMatch(readme, /\/Users\//)
  assert.match(readme, /<repo-root>\/antigravity\/plugins/)
})

test('inspect-role.mjs 拒绝路径穿越和共享协议文件名', () => {
  const scriptPath = join(
    repoRoot,
    'antigravity',
    'plugins',
    'personal-digital-team',
    'scripts',
    'inspect-role.mjs'
  )

  for (const badArg of ['../../../README', '../plugin', 'ROUTING_MATRIX']) {
    const result = spawnSync(process.execPath, [scriptPath, badArg], {
      cwd: repoRoot,
      encoding: 'utf8',
    })
    assert.equal(result.status, 2, `期望 ${badArg} 退出码为 2`)
    assert.match(result.stderr, /非法岗位标识/)
    assert.doesNotMatch(result.stdout, /岗位:|参考文档:/)
  }
})
