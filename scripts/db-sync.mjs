#!/usr/bin/env node

/**
 * 本地数据库 ⇄ NAS 数据库 同步脚本
 *
 * 用法：
 *   node scripts/db-sync.mjs status [--local]   # 对比两边表数 / 行数
 *   node scripts/db-sync.mjs push [--yes]       # 本地 → NAS（先在 staging 校验，再原子切换）
 *   node scripts/db-sync.mjs pull [--yes]       # NAS → 本地（同样走 staging）
 *
 * 设计要点：
 *   - 全程走容器内 local socket（trust 认证），脚本不需要任何数据库密码
 *   - 还原先落到 <db>__staging，校验行数一致后才 RENAME 切换，失败不动现有库
 *   - 用 plain SQL 格式（--format=plain），保证 18 → 17 跨版本可还原（custom 格式会因版本号拒绝）
 *   - 每次 push 前会在 backups/database/ 留一份 dump
 */

import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, openSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
process.chdir(ROOT)

// ---------------------------------------------------------------- 配置

loadEnvFile(resolve(ROOT, 'scripts/db-sync.env'))

const config = {
  nasSsh: process.env.NAS_SSH || '',
  nasContainer: process.env.NAS_CONTAINER || 'postgres',
  nasSuperuser: process.env.NAS_SUPERUSER || '',
  localService: process.env.LOCAL_SERVICE || 'postgres',
  localSuperuser: process.env.LOCAL_SUPERUSER || 'personal_digital_team',
  dbName: process.env.SYNC_DB_NAME || 'personal_digital_team',
  dbOwner: process.env.SYNC_DB_OWNER || process.env.SYNC_DB_NAME || 'personal_digital_team',
  keepBackups: Number(process.env.SYNC_KEEP_BACKUPS || 5)
}

const stagingDb = `${config.dbName}__staging`
const backupDir = resolve(ROOT, 'backups/database')

// ---------------------------------------------------------------- 工具

function log(message = '') {
  console.log(message)
}

function step(message) {
  console.log(`\n▸ ${message}`)
}

function die(message) {
  console.error(`\n✖ ${message}\n`)
  process.exit(1)
}

function shq(value) {
  return `'${String(value).replaceAll("'", `'\\''`)}'`
}

function assertIdent(name, label) {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) {
    die(`${label} 只能包含字母数字下划线：${name}`)
  }
}

function loadEnvFile(path) {
  if (!existsSync(path)) return
  for (const rawLine of readFileSync(path, 'utf8').split('\n')) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue
    const eq = line.indexOf('=')
    if (eq < 0) continue
    const key = line.slice(0, eq).trim()
    let value = line.slice(eq + 1).trim()
    if (
      (value.startsWith("'") && value.endsWith("'")) ||
      (value.startsWith('"') && value.endsWith('"'))
    ) {
      value = value.slice(1, -1)
    }
    if (!(key in process.env)) process.env[key] = value
  }
}

function run(cmd, args, options = {}) {
  const result = spawnSync(cmd, args, { encoding: 'utf8', ...options })
  if (result.error) throw new Error(`${cmd} 无法执行：${result.error.message}`)
  return result
}

/** 本地 psql：docker compose exec，走容器内 trust 认证 */
function localPsql(sql, { user = config.localSuperuser, db = 'postgres' } = {}) {
  const result = run('docker', [
    'compose', 'exec', '-T', config.localService,
    'psql', '-v', 'ON_ERROR_STOP=1', '-q', '-t', '-A',
    '-U', user, '-d', db, '-f', '-'
  ], { input: sql })
  if (result.status !== 0) {
    throw new Error(`本地 psql 失败：${(result.stderr || '').trim()}`)
  }
  return result.stdout
}

/** 远端 psql：ssh + docker exec，同样走容器内 trust 认证 */
function remotePsql(sql, { user = config.nasSuperuser, db = 'postgres' } = {}) {
  const remoteCmd =
    `sudo docker exec -i ${shq(config.nasContainer)} ` +
    `psql -v ON_ERROR_STOP=1 -q -t -A -U ${shq(user)} -d ${shq(db)} -f -`
  const result = run('ssh', [config.nasSsh, remoteCmd], { input: sql })
  if (result.status !== 0) {
    throw new Error(`远端 psql 失败：${(result.stderr || '').trim()}`)
  }
  return result.stdout
}

/** 在 NAS 上执行普通 shell 命令 */
function remoteShell(command) {
  return run('ssh', [config.nasSsh, command])
}

// ---------------------------------------------------------------- 前置检查

function checkLocal() {
  const result = run('docker', ['compose', 'ps', '-q', config.localService])
  if (result.status !== 0) die('docker compose 不可用，请在项目根目录执行')
  if (!result.stdout.trim()) {
    die(`本地容器 ${config.localService} 没有运行，先执行 yarn db:up`)
  }
}

function checkRemote() {
  if (!config.nasSsh) {
    die(
      '缺少 NAS_SSH 配置。\n' +
      '  复制 scripts/db-sync.env.example 为 scripts/db-sync.env，填入 NAS_SSH=用户@主机'
    )
  }

  const ping = run('ssh', ['-o', 'BatchMode=yes', '-o', 'ConnectTimeout=8', config.nasSsh, 'true'])
  if (ping.status !== 0) {
    die(
      `SSH 无法免密连接 ${config.nasSsh}\n` +
      '  1) 确认已配置公钥：ssh-copy-id ' + config.nasSsh + '\n' +
      '  2) 确认 NAS 已开启 SSH 服务'
    )
  }

  const sudo = run('ssh', ['-o', 'BatchMode=yes', config.nasSsh, 'sudo -n true'])
  if (sudo.status !== 0) {
    die(
      'NAS 上的 sudo 需要密码，脚本无法在管道中交互。\n' +
      '  在 NAS 上执行一次（只放行 docker）：\n' +
      `    echo '${config.nasSsh.split('@')[0]} ALL=(ALL) NOPASSWD: /usr/bin/docker' | sudo tee /etc/sudoers.d/docker-nopasswd\n` +
      '    sudo chmod 440 /etc/sudoers.d/docker-nopasswd'
    )
  }

  const running = run('ssh', [
    '-o', 'BatchMode=yes', config.nasSsh,
    `sudo -n docker inspect -f '{{.State.Running}}' ${shq(config.nasContainer)}`
  ])
  if (running.status !== 0 || running.stdout.trim() !== 'true') {
    die(`NAS 上容器 ${config.nasContainer} 不存在或未运行`)
  }

  if (!config.nasSuperuser) {
    const detected = run('ssh', [
      '-o', 'BatchMode=yes', config.nasSsh,
      `sudo -n docker exec ${shq(config.nasContainer)} sh -c 'printf %s "$POSTGRES_USER"'`
    ])
    const user = detected.stdout.trim()
    if (!user) die('无法自动识别 NAS 上的超级用户，请在 scripts/db-sync.env 设置 NAS_SUPERUSER')
    config.nasSuperuser = user
  }
}

// ---------------------------------------------------------------- 表行数统计

/** 一次往返拿到所有表的精确行数 */
function tableCounts(psql, options) {
  const listSql =
    "SELECT string_agg(format('SELECT %L::text AS t, count(*)::text AS c FROM public.%I', " +
    "tablename, tablename), ' UNION ALL ') FROM pg_tables WHERE schemaname='public';"
  const unionSql = psql(listSql, options).trim()
  if (!unionSql) return {}

  const rows = psql(`${unionSql} ORDER BY 1;`, options)
  const counts = {}
  for (const line of rows.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed) continue
    const [table, count] = trimmed.split('|')
    counts[table] = Number(count)
  }
  return counts
}

function printCounts(local, remote) {
  const tables = [...new Set([...Object.keys(local), ...Object.keys(remote)])].sort()
  const width = Math.max(8, ...tables.map((t) => t.length))
  log(`\n  ${'表'.padEnd(width)}  ${'本地'.padStart(8)}  ${'NAS'.padStart(8)}   状态`)
  log(`  ${'-'.repeat(width)}  ${'-'.repeat(8)}  ${'-'.repeat(8)}   ----`)
  for (const table of tables) {
    const l = local[table]
    const r = remote[table]
    const status = l === r ? '一致' : l === undefined ? '仅 NAS 有' : r === undefined ? '仅本地有' : '不一致'
    log(
      `  ${table.padEnd(width)}  ${String(l ?? '-').padStart(8)}  ${String(r ?? '-').padStart(8)}   ${status}`
    )
  }
  const diff = tables.some((t) => local[t] !== remote[t])
  log(diff ? '\n  → 两边数据不一致，需要 push 或 pull' : '\n  → 两边行数一致')
  return !diff
}

// ---------------------------------------------------------------- dump / restore

function localDump(targetPath) {
  const fd = openSync(targetPath, 'w')
  const result = spawnSync('docker', [
    'compose', 'exec', '-T', config.localService,
    'pg_dump',
    '--username', config.localSuperuser,
    '--dbname', config.dbName,
    '--format=plain',
    '--clean',
    '--if-exists',
    '--no-owner',
    '--no-privileges'
  ], { stdio: ['ignore', fd, 'inherit'] })
  if (result.status !== 0) {
    rmSync(targetPath, { force: true })
    die('本地 pg_dump 失败')
  }
}

function remoteDump(targetPath) {
  const fd = openSync(targetPath, 'w')
  const remoteCmd =
    `sudo docker exec ${shq(config.nasContainer)} pg_dump ` +
    `--username ${shq(config.dbOwner)} --dbname ${shq(config.dbName)} ` +
    '--format=plain --clean --if-exists --no-owner --no-privileges'
  const result = spawnSync('ssh', [config.nasSsh, remoteCmd], { stdio: ['ignore', fd, 'inherit'] })
  if (result.status !== 0) {
    rmSync(targetPath, { force: true })
    die('远端 pg_dump 失败')
  }
}

function gzipFile(path) {
  const result = run('gzip', ['-f', path])
  if (result.status !== 0) die(`gzip 压缩失败：${path}`)
  return `${path}.gz`
}

function restoreLocal(gzPathFromLocal) {
  // 本地还原：读本地文件
  const result = spawnSync(
    'sh',
    ['-c', `gunzip -c ${shq(gzPathFromLocal)} | docker compose exec -T ${shq(config.localService)} psql -v ON_ERROR_STOP=1 -q -o /dev/null -U ${shq(config.dbOwner)} -d ${shq(stagingDb)}`],
    { stdio: ['ignore', 'inherit', 'inherit'], cwd: ROOT }
  )
  if (result.status !== 0) die('本地还原失败（现有库未受影响）')
}

function restoreRemote(gzPathOnNas) {
  const remoteCmd =
    `gunzip -c ${shq(gzPathOnNas)} | sudo docker exec -i ${shq(config.nasContainer)} ` +
    `psql -v ON_ERROR_STOP=1 -q -o /dev/null -U ${shq(config.dbOwner)} -d ${shq(stagingDb)}`
  const result = run('ssh', [config.nasSsh, remoteCmd])
  if (result.status !== 0) die('远端还原失败（现有库未受影响）')
}

// ---------------------------------------------------------------- 切换

/**
 * 把 staging 库原子切换成正式库名。
 * 失败时回滚，保证正式库始终可用。
 */
function switchDatabase(psql, { label }) {
  const exists = (name) =>
    psql(`SELECT 1 FROM pg_database WHERE datname = '${name}';`).trim() === '1'

  step(`${label}：切换 ${stagingDb} → ${config.dbName}`)

  // 断开两边连接，否则 RENAME 会被占用阻塞
  psql(
    `SELECT pg_terminate_backend(pid) FROM pg_stat_activity ` +
    `WHERE datname IN ('${config.dbName}', '${stagingDb}') AND pid <> pg_backend_pid();`
  )

  const legacyName = `${config.dbName}__old_${Date.now()}`
  const hadTarget = exists(config.dbName)

  if (hadTarget) {
    psql(`ALTER DATABASE "${config.dbName}" RENAME TO "${legacyName}";`)
  }

  try {
    psql(`ALTER DATABASE "${stagingDb}" RENAME TO "${config.dbName}";`)
  } catch (error) {
    if (hadTarget) {
      psql(`ALTER DATABASE "${legacyName}" RENAME TO "${config.dbName}";`)
      die(`${label}：切换失败，已回滚到原库。原因：${error.message}`)
    }
    die(`${label}：切换失败，staging 库 ${stagingDb} 保留。原因：${error.message}`)
  }

  if (hadTarget) {
    try {
      psql(`DROP DATABASE IF EXISTS "${legacyName}" WITH (FORCE);`)
      log(`  旧库已删除（临时名 ${legacyName}）`)
    } catch {
      log(`  ⚠ 旧库 ${legacyName} 删除失败，可稍后手动清理`)
    }
  }
}

function recreateStaging(psql) {
  step(`重建 staging 库 ${stagingDb}`)
  psql(
    `DROP DATABASE IF EXISTS "${stagingDb}" WITH (FORCE);\n` +
    `CREATE DATABASE "${stagingDb}" OWNER "${config.dbOwner}";`
  )
}

// ---------------------------------------------------------------- 命令

function commandStatus(args) {
  const localOnly = args.includes('--local')
  checkLocal()

  step('读取本地行数')
  const local = tableCounts(localPsql, { user: config.localSuperuser, db: config.dbName })
  log(`  本地 ${config.dbName}：${Object.keys(local).length} 张表，共 ${sum(local)} 行`)

  if (localOnly) return

  checkRemote()
  step('读取 NAS 行数')
  const remote = tableCounts(remotePsql, { user: config.dbOwner, db: config.dbName })
  log(`  NAS ${config.dbName}：${Object.keys(remote).length} 张表，共 ${sum(remote)} 行`)

  printCounts(local, remote)
}

function commandPush(args) {
  checkLocal()
  checkRemote()

  step('本地行数快照')
  const local = tableCounts(localPsql, { user: config.localSuperuser, db: config.dbName })
  log(`  本地 ${config.dbName}：${Object.keys(local).length} 张表，共 ${sum(local)} 行`)

  step('导出本地数据（plain SQL，兼容 PG17）')
  mkdirSync(backupDir, { recursive: true })
  const stamp = new Date().toISOString().replaceAll(':', '-').replace(/\..+$/, '')
  const dumpPath = resolve(backupDir, `${config.dbName}-${stamp}.sql`)
  localDump(dumpPath)
  const gzPath = gzipFile(dumpPath)
  ensureConfirmed(args, `即将用本地数据覆盖 NAS 上的 ${config.dbName}`)
  log(`  ${gzPath}（${formatSize(gzPath)}）`)

  const nasPath = `/tmp/db-sync-${stamp}.sql.gz`
  step(`上传到 NAS：${nasPath}`)
  const scp = run('scp', ['-q', gzPath, `${config.nasSsh}:${nasPath}`])
  if (scp.status !== 0) die('scp 上传失败')

  recreateStaging(remotePsql)
  step('还原到 staging 库')
  restoreRemote(nasPath)

  step('校验 staging 库行数')
  const staged = tableCounts(remotePsql, { user: config.dbOwner, db: stagingDb })
  const ok = printCounts(local, staged)
  if (!ok) {
    die(`staging 与本地不一致，已保留 ${stagingDb} 供排查；正式库 ${config.dbName} 未被改动`)
  }

  switchDatabase(remotePsql, { label: 'NAS' })

  step('清理 NAS 临时文件')
  remoteShell(`rm -f ${shq(nasPath)}`)

  pruneBackups()
  log(`\n✔ 同步完成：本地 → NAS（${Object.keys(local).length} 张表，${sum(local)} 行）`)
}

function commandPull(args) {
  checkLocal()
  checkRemote()

  step('NAS 行数快照')
  const remote = tableCounts(remotePsql, { user: config.dbOwner, db: config.dbName })
  log(`  NAS ${config.dbName}：${Object.keys(remote).length} 张表，共 ${sum(remote)} 行`)

  step('从 NAS 导出数据')
  mkdirSync(backupDir, { recursive: true })
  const stamp = new Date().toISOString().replaceAll(':', '-').replace(/\..+$/, '')
  const dumpPath = resolve(backupDir, `${config.dbName}-from-nas-${stamp}.sql`)
  remoteDump(dumpPath)
  const gzPath = gzipFile(dumpPath)
  ensureConfirmed(args, `即将用 NAS 数据覆盖本地 ${config.dbName}`)
  log(`  ${gzPath}（${formatSize(gzPath)}）`)

  recreateStaging(localPsql)
  step('还原到本地 staging 库')
  restoreLocal(gzPath)

  step('校验 staging 库行数')
  const staged = tableCounts(localPsql, { user: config.dbOwner, db: stagingDb })
  const ok = printCounts(remote, staged)
  if (!ok) {
    die(`staging 与 NAS 不一致，已保留 ${stagingDb} 供排查；本地正式库未被改动`)
  }

  switchDatabase(localPsql, { label: '本地' })

  pruneBackups()
  log(`\n✔ 同步完成：NAS → 本地（${Object.keys(remote).length} 张表，${sum(remote)} 行）`)
}

// ---------------------------------------------------------------- 杂项

function sum(counts) {
  return Object.values(counts).reduce((a, b) => a + b, 0)
}

function formatSize(path) {
  const bytes = statSync(path).size
  if (bytes > 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  return `${Math.max(1, Math.round(bytes / 1024))} KB`
}

function ensureConfirmed(args, message) {
  if (args.includes('--yes') || args.includes('-y')) return
  if (!process.stdin.isTTY) return
  process.stdout.write(`\n  ⚠ ${message}，继续？[y/N] `)
  // stdin 继承终端，stdout 走管道，这样 read 能拿到真实输入
  const result = spawnSync('sh', ['-c', 'read -r a && printf %s "$a"'], {
    encoding: 'utf8',
    stdio: ['inherit', 'pipe', 'inherit']
  })
  if (!/^y(es)?$/i.test((result.stdout || '').trim())) die('已取消')
}

function pruneBackups() {
  if (!existsSync(backupDir)) return
  const files = readdirSync(backupDir)
    .filter((f) => f.startsWith(config.dbName) && f.endsWith('.sql.gz'))
    .map((f) => ({ f, t: statSync(resolve(backupDir, f)).mtimeMs }))
    .sort((a, b) => b.t - a.t)
  for (const { f } of files.slice(config.keepBackups)) {
    rmSync(resolve(backupDir, f), { force: true })
  }
}

function usage() {
  log(`
本地 ⇄ NAS 数据库同步

  node scripts/db-sync.mjs status [--local]   对比表数与行数（--local 只看本地）
  node scripts/db-sync.mjs push  [--yes]      本地 → NAS
  node scripts/db-sync.mjs pull  [--yes]      NAS → 本地

首次使用：
  cp scripts/db-sync.env.example scripts/db-sync.env
  # 填写 NAS_SSH=用户@NAS地址，其余默认即可

说明：
  - 还原先落 staging 库并校验行数，一致后才切换，失败不动现有库
  - 每次 push/pull 在 backups/database/ 留一份 dump，默认保留最近 ${config.keepBackups} 份
`)
}

// ---------------------------------------------------------------- 入口

const [command, ...rest] = process.argv.slice(2)

try {
  switch (command) {
    case 'status':
      commandStatus(rest)
      break
    case 'push':
      commandPush(rest)
      break
    case 'pull':
      commandPull(rest)
      break
    case undefined:
    case '-h':
    case '--help':
      usage()
      break
    default:
      die(`未知命令：${command}\n可用命令：status | push | pull`)
  }
} catch (error) {
  die(error.message)
}
