#!/usr/bin/env node

import { mkdirSync, createWriteStream, rmSync } from 'node:fs'
import { resolve } from 'node:path'
import { spawn } from 'node:child_process'

const timestamp = new Date()
  .toISOString()
  .replaceAll(':', '-')
  .replace('.', '-')
const backupDirectory = resolve('backups/database')
const backupPath = resolve(
  backupDirectory,
  `personal-digital-team-${timestamp}.dump`
)

mkdirSync(backupDirectory, { recursive: true })

const output = createWriteStream(backupPath, { flags: 'wx' })
const dump = spawn(
  'docker',
  [
    'compose',
    'exec',
    '-T',
    'postgres',
    'pg_dump',
    '--username',
    'personal_digital_team',
    '--dbname',
    'personal_digital_team',
    '--format=custom',
    '--no-owner',
    '--no-privileges',
  ],
  { stdio: ['ignore', 'pipe', 'inherit'] }
)

dump.stdout.pipe(output)

dump.on('error', (error) => {
  output.destroy()
  rmSync(backupPath, { force: true })
  console.error(`Database backup failed: ${error.message}`)
  process.exitCode = 1
})

dump.on('close', (code) => {
  output.end()
  if (code !== 0) {
    rmSync(backupPath, { force: true })
    console.error(`Database backup failed with exit code ${code}`)
    process.exitCode = code || 1
    return
  }
  console.log(backupPath)
})
