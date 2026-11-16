import { changedFiles } from './taskWorkspace'

describe('changedFiles', () => {
  it('returns new and modified files only', () => {
    const before = { 'a.ts': 'M', 'b.ts': '??' }
    const after = { 'a.ts': 'M', 'b.ts': 'M', 'c.ts': '??' }

    expect(changedFiles(before, after)).toEqual(['b.ts', 'c.ts'])
  })

  it('ignores system directories', () => {
    const after = {
      'docs/tasks/logs/x.log': '??',
      'docs/tasks/uploads/20261113/a.png': '??',
      'src/real.ts': 'M',
    }

    expect(changedFiles({}, after)).toEqual(['src/real.ts'])
  })

  it('treats a missing baseline as empty', () => {
    expect(changedFiles(null, { 'x.ts': '??' })).toEqual(['x.ts'])
  })
})
