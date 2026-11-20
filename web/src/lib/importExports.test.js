/**
 * 防回归：类型声明里有、运行时构建里没有的命名导出，
 * 会让 Vite 在浏览器里直接报「does not provide an export named X」，
 * 而 tsc 是拦不住的（useLazyQuery、RangePicker 都这么漏过一次）。
 * 这里静态比对源码里的命名导入和依赖包真实导出的名字。
 */
const fs = require('fs')
const path = require('path')

const SOURCE_ROOT = path.join(__dirname, '..')
const REPO_ROOT = path.join(__dirname, '..', '..', '..')

const readFile = (file) => fs.readFileSync(file, 'utf8')

/** antd 这类 `export { default as Foo } from './foo'` 的写法 */
const namedFromDefault = (file) => {
  const names = new Set()
  for (const match of readFile(file).matchAll(
    /export\s*\{\s*default\s+as\s+([A-Za-z0-9_$]+)\s*\}/g
  )) {
    names.add(match[1])
  }
  return names
}

/** `export { A, B as C }` 这种（可能跨多行） */
const braceExports = (file, names = new Set(), seen = new Set()) => {
  if (seen.has(file)) return names
  seen.add(file)

  const source = readFile(file)
  for (const block of source.matchAll(/export\s*\{([\s\S]*?)\}/g)) {
    for (const raw of block[1].split(',')) {
      const entry = raw.trim()
      if (!entry) continue
      const [original, alias] = entry.split(/\s+as\s+/)
      names.add((alias || original).trim())
    }
  }

  // export * from './x.js' 要跟进去，否则会漏掉转发出来的导出
  for (const match of source.matchAll(
    /export\s*\*\s*from\s*['"]([^'"]+)['"]/g
  )) {
    const target = path.resolve(path.dirname(file), match[1])
    if (fs.existsSync(target)) braceExports(target, names, seen)
  }

  return names
}

const modules = [
  {
    name: 'antd',
    exports: () =>
      namedFromDefault(path.join(REPO_ROOT, 'node_modules/antd/es/index.js')),
  },
  {
    name: '@cedarjs/web',
    exports: () =>
      braceExports(
        path.join(REPO_ROOT, 'node_modules/@cedarjs/web/dist/index.js')
      ),
  },
]

const listSourceFiles = (dir, files = []) => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) listSourceFiles(full, files)
    else if (/\.(jsx?|tsx?)$/.test(entry.name)) files.push(full)
  }
  return files
}

const namedImports = (file) => {
  const source = fs.readFileSync(file, 'utf8')
  const results = []
  for (const match of source.matchAll(
    /import\s+(?:type\s+)?\{([^}]*)\}\s+from\s+['"]([^'"]+)['"]/g
  )) {
    const specifiers = match[1]
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)
      .map((item) =>
        item
          .replace(/^type\s+/, '')
          .split(/\s+as\s+/)[0]
          .trim()
      )
      .filter((item) => /^[A-Za-z0-9_$]+$/.test(item))
    results.push({ specifiers, source: match[2] })
  }
  return results
}

describe('named imports match real module exports', () => {
  const files = listSourceFiles(SOURCE_ROOT)
  const exportCache = new Map()

  const exportsFor = (moduleName) => {
    if (!exportCache.has(moduleName)) {
      const entry = modules.find((item) => item.name === moduleName)
      exportCache.set(moduleName, entry ? entry.exports() : null)
    }
    return exportCache.get(moduleName)
  }

  it.each(modules.map((item) => item.name))(
    'web source only imports names %s really exports',
    (moduleName) => {
      const exported = exportsFor(moduleName)
      expect(exported && exported.size).toBeGreaterThan(0)

      const missing = []
      for (const file of files) {
        for (const item of namedImports(file)) {
          if (item.source !== moduleName) continue
          for (const specifier of item.specifiers) {
            // 类型名不在这里校验（INTERNAL 类型来自 .d.ts）
            if (/^[A-Z]/.test(specifier) && specifier.endsWith('Props'))
              continue
            if (!exported.has(specifier)) {
              missing.push(`${path.relative(REPO_ROOT, file)}: ${specifier}`)
            }
          }
        }
      }

      expect(missing).toEqual([])
    }
  )
})
