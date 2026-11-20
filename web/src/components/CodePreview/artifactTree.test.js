import {
  buildArtifactTree,
  isMarkdownPath,
  languageForPath,
  tokenizeLine,
} from './artifactTree'

describe('artifact tree', () => {
  const artifact = (path, extra = {}) => ({
    id: path,
    path,
    label: path.split('/').pop(),
    kind: 'file',
    source: 'git',
    ...extra,
  })

  it('groups artifacts by directory, directories first and sorted', () => {
    const tree = buildArtifactTree([
      artifact('docs/plans/task/run.md'),
      artifact('api/src/lib/knowledgeConfig.ts'),
      artifact('api/src/lib/knowledgeContext.ts'),
      artifact('README.md'),
    ])

    expect(tree.map((node) => node.title)).toEqual(['api', 'docs', 'README.md'])

    const api = tree[0]
    expect(api.isLeaf).toBe(false)
    expect(api.children.map((node) => node.title)).toEqual(['src'])

    const lib = api.children[0].children[0]
    expect(lib.title).toBe('lib')
    expect(lib.children.map((node) => node.title)).toEqual([
      'knowledgeConfig.ts',
      'knowledgeContext.ts',
    ])
    expect(lib.children[0].artifact.kind).toBe('file')
  })

  it('keeps deep paths nested and skips empty paths', () => {
    const tree = buildArtifactTree([
      artifact('a/b/c/d.ts'),
      artifact(''),
      artifact('a/b/e.ts'),
    ])

    expect(tree).toHaveLength(1)
    const d = tree[0].children[0].children[0]
    expect(d.children.map((node) => node.title)).toEqual(['d.ts'])
    expect(tree[0].children[0].children[1].title).toBe('e.ts')
  })
})

describe('language detection', () => {
  it('maps code extensions and skips markdown', () => {
    expect(languageForPath('api/src/lib/x.ts')).toBe('ts')
    expect(languageForPath('web/src/App.tsx')).toBe('tsx')
    expect(languageForPath('docs/plans/x.md')).toBeNull()
    expect(languageForPath('README.md')).toBeNull()
    expect(languageForPath('scripts/run.sh')).toBe('sh')
    expect(languageForPath('schema.prisma')).toBe('ts')
    expect(languageForPath('image.png')).toBeNull()
  })

  it('detects markdown paths separately', () => {
    expect(isMarkdownPath('docs/plans/x.md')).toBe(true)
    expect(isMarkdownPath('api/src/x.ts')).toBe(false)
    expect(isMarkdownPath('README.md')).toBe(true)
  })
})

describe('tokenizeLine', () => {
  const typesOf = (line, language = 'ts') =>
    tokenizeLine(line, language).map((token) => [token.type, token.text])

  it('marks comments, strings, numbers and keywords', () => {
    const tokens = typesOf('const id = 42 // 任务编号')

    expect(tokens).toContainEqual(['keyword', 'const'])
    expect(tokens).toContainEqual(['number', '42'])
    expect(
      tokens.some(
        ([type, text]) => type === 'comment' && text.includes('任务编号')
      )
    ).toBe(true)
  })

  it('keeps string contents together, including quotes inside', () => {
    const tokens = typesOf(`const msg = "he said \\"hi\\""`)
    expect(tokens).toContainEqual(['string', '"he said \\"hi\\""'])
  })

  it('does not treat markdown headings as comments in shell', () => {
    const tokens = typesOf('#!/bin/sh', 'sh')
    expect(tokens.every(([type]) => type !== 'comment')).toBe(true)
  })

  it('returns a single plain token for empty input', () => {
    expect(tokenizeLine('', 'ts')).toEqual([])
  })
})
