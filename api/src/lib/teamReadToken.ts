import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const parseEnv = (text: string) => {
  for (const line of text.split(/\r?\n/)) {
    const match = /^\s*TEAM_READ_TOKEN\s*=\s*(.*?)\s*$/.exec(line)
    if (!match) continue
    let value = match[1]
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    if (value.trim() !== '') return value.trim()
  }
  return ''
}

/**
 * Read the read-only team token.
 *
 * `TEAM_READ_TOKEN` from the process environment wins. In development the
 * Cedar API process may have started before the token was added to `.env`, so
 * fall back to reading the nearest `.env`; production deployments should set
 * the environment variable explicitly.
 */
export const readTeamReadToken = () => {
  const fromEnvironment = process.env.TEAM_READ_TOKEN?.trim()
  if (fromEnvironment) return fromEnvironment

  const candidates = [
    join(process.cwd(), '.env'),
    join(process.cwd(), '..', '.env'),
    join(process.cwd(), '..', '..', '.env'),
  ]
  for (const file of candidates) {
    try {
      if (!existsSync(file)) continue
      const token = parseEnv(readFileSync(file, 'utf8'))
      if (token !== '') return token
    } catch {
      // An unreadable .env is the same as no token here.
    }
  }
  return ''
}
