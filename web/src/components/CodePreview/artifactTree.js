/** 文件扩展名 → 代码语言；不属于代码的返回 null */
const LANGUAGE_BY_EXTENSION = {
  ts: 'ts',
  tsx: 'tsx',
  js: 'js',
  jsx: 'jsx',
  mjs: 'js',
  cjs: 'js',
  json: 'json',
  css: 'css',
  scss: 'css',
  less: 'css',
  html: 'html',
  vue: 'html',
  sh: 'sh',
  bash: 'sh',
  zsh: 'sh',
  yml: 'yaml',
  yaml: 'yaml',
  py: 'python',
  go: 'go',
  rs: 'rust',
  sql: 'sql',
  md: 'markdown',
  markdown: 'markdown',
  prisma: 'ts',
  toml: 'ini',
  ini: 'ini',
  env: 'ini',
}

const extensionOf = (filePath = '') => {
  const name = filePath.split('/').pop() || ''
  if (!name.includes('.')) return ''
  return name.split('.').pop()?.toLowerCase() || ''
}

/** 这个路径能不能用代码视图打开（markdown 走渲染器，不算代码视图） */
export const languageForPath = (filePath) => {
  const language = LANGUAGE_BY_EXTENSION[extensionOf(filePath)]
  if (!language || language === 'markdown') return null
  return language
}

export const isMarkdownPath = (filePath) =>
  languageForPath(filePath) === null &&
  LANGUAGE_BY_EXTENSION[extensionOf(filePath)] === 'markdown'

const KEYWORDS = {
  ts: 'const let var function return if else for while do switch case break continue class extends implements interface type enum import export from as async await try catch finally throw new this super typeof instanceof void null undefined true false public private protected readonly static get set of in delete yield default',
  tsx: 'const let var function return if else for while switch case break continue class extends implements interface type enum import export from as async await try catch finally throw new this super typeof instanceof void null undefined true false public private protected readonly static get set of in delete yield default',
  js: 'const let var function return if else for while do switch case break continue class extends import export from as async await try catch finally throw new this super typeof instanceof void null undefined true false of in delete yield default',
  jsx: 'const let var function return if else for while switch case break continue class extends import export from as async await try catch finally throw new this super typeof instanceof void null undefined true false of in delete yield default',
  json: 'true false null',
  css: 'media import supports keyframes from to important',
  html: 'html head body div span script style link meta title',
  sh: 'if then else fi for in do done while case esac function return export local echo cd npm npx pnpm yarn git docker sudo',
  yaml: 'true false null yes no',
  python: 'def class return if elif else for while import from as try except finally with lambda yield async await True False None self',
  go: 'func package import return if else for range switch case break continue type struct interface var const go defer map chan nil true false',
  rust: 'fn let mut pub use mod struct enum impl trait match if else for while loop return self Self Some None Ok Err async await move ref dyn',
  sql: 'select from where join left right inner outer on group by order having limit offset insert into values update set delete create table alter drop index as distinct union all case when then end null not and or',
  ini: 'true false null',
}

const KEYWORD_SETS = Object.fromEntries(
  Object.entries(KEYWORDS).map(([language, words]) => [
    language,
    new Set(words.split(/\s+/).filter(Boolean)),
  ])
)

/**
 * 极简语法着色：把一行拆成 {text, type} 片段。
 * 只区分注释、字符串、数字、关键字与标点，够读代码即可，不追求完整语法树。
 */
export const tokenizeLine = (line, language) => {
  const keywords = KEYWORD_SETS[language]
  const tokens = []
  const pattern =
    /(\/\/.*$|#(?![!{])(?:\s).*$)|(\/\*.*?\*\/)|('(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"|`(?:[^`\\]|\\.)*`)|(\b\d+(?:\.\d+)?\b)|([A-Za-z_$][\w$]*)|([{}()[\];,.:=+\-*/<>!&|?~^%]+)|(\s+)/g

  let lastIndex = 0
  let match
  while ((match = pattern.exec(line)) !== null) {
    if (match.index > lastIndex) {
      tokens.push({ text: line.slice(lastIndex, match.index), type: 'plain' })
    }
    const [text, lineComment, blockComment, string, number, word, punct, space] =
      match
    if (lineComment || blockComment) tokens.push({ text, type: 'comment' })
    else if (string) tokens.push({ text, type: 'string' })
    else if (number) tokens.push({ text, type: 'number' })
    else if (word) {
      tokens.push({
        text,
        type: keywords?.has(word) ? 'keyword' : 'plain',
      })
    } else if (punct) tokens.push({ text, type: 'punct' })
    else if (space) tokens.push({ text, type: 'plain' })
    lastIndex = match.index + text.length
  }

  if (lastIndex < line.length) {
    tokens.push({ text: line.slice(lastIndex), type: 'plain' })
  }
  return tokens
}

/** 把产物路径列表聚成目录树（目录在前，同一层按名称排序） */
export const buildArtifactTree = (artifacts = []) => {
  const root = { directories: new Map(), files: [] }

  for (const artifact of artifacts) {
    const segments = String(artifact.path || '')
      .split('/')
      .filter(Boolean)
    if (!segments.length) continue
    const fileName = segments.pop()
    let node = root
    for (const segment of segments) {
      if (!node.directories.has(segment)) {
        node.directories.set(segment, { directories: new Map(), files: [] })
      }
      node = node.directories.get(segment)
    }
    node.files.push({ ...artifact, name: fileName })
  }

  const buildNodes = (node, prefix) => {
    const directoryNodes = [...node.directories.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([name, child]) => {
        const dirPath = prefix ? `${prefix}/${name}` : name
        return {
          key: `dir:${dirPath}`,
          title: name,
          isLeaf: false,
          children: buildNodes(child, dirPath),
        }
      })

    const fileNodes = [...node.files]
      .sort((left, right) => left.name.localeCompare(right.name))
      .map((file) => ({
        key: `file:${file.path}`,
        title: file.name,
        isLeaf: true,
        artifact: file,
      }))

    return [...directoryNodes, ...fileNodes]
  }

  return buildNodes(root, '')
}
