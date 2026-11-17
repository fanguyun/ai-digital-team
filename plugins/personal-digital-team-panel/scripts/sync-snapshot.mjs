#!/usr/bin/env node
/**
 * Regenerate the fallback snapshot served when no live team manifest can be
 * found (for example when the plugin is installed outside this repository).
 *
 * Usage: node plugins/personal-digital-team-panel/scripts/sync-snapshot.mjs
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { normalizeTeam } from '../lib/normalize.js'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const packageRoot = resolve(scriptDir, '..')
const repoRoot = resolve(packageRoot, '..', '..')
const manifestPath = join(repoRoot, 'agents', 'manifest.json')
const targetPath = join(packageRoot, 'lib', 'data', 'team.json')

const manifest = JSON.parse(await readFile(manifestPath, 'utf8'))
const team = normalizeTeam(manifest)
const snapshot = {
  ...team,
  meta: {
    source: 'snapshot',
    generatedAt: new Date().toISOString(),
  },
}

await mkdir(dirname(targetPath), { recursive: true })
await writeFile(targetPath, `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8')

console.log(
  `已写入 ${targetPath.replace(`${repoRoot}/`, '')}（${team.agents.length} 位成员 / ${team.groups.length} 个分组）`
)
