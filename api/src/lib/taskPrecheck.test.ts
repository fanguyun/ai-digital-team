import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

import {
  extractDeliverablePaths,
  missingDeliverables,
  precheckTask,
} from './taskPrecheck'

let repoRoot: string

beforeEach(() => {
  repoRoot = mkdtempSync(path.join(tmpdir(), 'task-precheck-'))
})

afterEach(() => {
  rmSync(repoRoot, { recursive: true, force: true })
})

describe('extractDeliverablePaths', () => {
  it('picks repo paths out of acceptance text', () => {
    expect(
      extractDeliverablePaths([
        '报告写入 docs/role-evaluations/interaction-ui-designer-agent-20261118-1451.md，包含能力差距',
        '方案放在 docs/plans/20261118-plan.md。',
      ])
    ).toEqual([
      'docs/role-evaluations/interaction-ui-designer-agent-20261118-1451.md',
      'docs/plans/20261118-plan.md',
    ])
  })

  it('ignores inline code without a repo prefix and path traversal', () => {
    expect(
      extractDeliverablePaths([
        '见 src/index.ts 和 ../../etc/passwd，还有 docs/ok.md',
      ])
    ).toEqual(['docs/ok.md'])
  })
})

describe('precheckTask', () => {
  it('warns when the acceptance criteria is empty', () => {
    const result = precheckTask(
      { title: 't', brief: 'b', acceptance: '  ', agentSlug: 'main-agent' },
      repoRoot
    )
    expect(result.warnings.join()).toContain('验收标准为空')
    expect(result.expectedPaths).toEqual([])
  })

  it('reports a missing output directory', () => {
    const result = precheckTask(
      {
        title: 't',
        brief: 'b',
        acceptance: '报告写入 docs/role-evaluations/new-report.md',
        agentSlug: 'main-agent',
      },
      repoRoot
    )
    expect(result.expectedPaths).toEqual([
      'docs/role-evaluations/new-report.md',
    ])
    expect(result.warnings.join()).toContain('交付物目录不存在')
  })

  it('flags overwriting an existing non-empty deliverable', () => {
    mkdirSync(path.join(repoRoot, 'docs/role-evaluations'), { recursive: true })
    writeFileSync(
      path.join(repoRoot, 'docs/role-evaluations/existing.md'),
      '# 旧报告\n'
    )

    const result = precheckTask(
      {
        title: 't',
        brief: 'b',
        acceptance: '写入 docs/role-evaluations/existing.md',
        agentSlug: 'main-agent',
      },
      repoRoot
    )
    expect(result.warnings.join()).toContain('会被覆盖')
  })

  it('flags a read-only task that asks to change code', () => {
    mkdirSync(path.join(repoRoot, 'api/src'), { recursive: true })
    const result = precheckTask(
      {
        title: 't',
        brief: 'b',
        acceptance: '改到 api/src/tasks.ts 并在 docs/reports/x.md 写说明',
        agentSlug: 'main-agent',
        readOnly: true,
      },
      repoRoot
    )
    expect(result.warnings.join()).toContain('任务是只读的')
  })

  it('does not flag a read-only task that only writes a report', () => {
    mkdirSync(path.join(repoRoot, 'docs/role-evaluations'), { recursive: true })
    const result = precheckTask(
      {
        title: 't',
        brief: 'b',
        acceptance: '报告写入 docs/role-evaluations/x.md',
        agentSlug: 'main-agent',
        readOnly: true,
      },
      repoRoot
    )
    expect(result.warnings).toEqual([])
  })

  it('passes a well-formed task without warnings', () => {
    mkdirSync(path.join(repoRoot, 'docs/reports'), { recursive: true })
    const result = precheckTask(
      {
        title: 't',
        brief: 'b',
        acceptance: '产出 docs/reports/x.md，包含结论',
        agentSlug: 'main-agent',
      },
      repoRoot
    )
    expect(result.warnings).toEqual([])
  })
})

describe('missingDeliverables', () => {
  it('returns the accepted paths that were not produced', () => {
    mkdirSync(path.join(repoRoot, 'docs/role-evaluations'), { recursive: true })
    writeFileSync(path.join(repoRoot, 'docs/role-evaluations/ok.md'), 'x')

    expect(
      missingDeliverables(
        {
          title: 't',
          brief: 'b',
          acceptance:
            '写入 docs/role-evaluations/ok.md 与 docs/role-evaluations/missing.md',
        },
        repoRoot
      )
    ).toEqual(['docs/role-evaluations/missing.md'])
  })
})
