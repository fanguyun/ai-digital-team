const INTERNAL_TITLE_FRAGMENTS = [
  '同一会话里相同标题只留一条',
  '规则文档开头',
  'another language model started to solve',
  'summary produced by the other language model',
]

const stripMarkdownPrefix = (value: string) =>
  value
    .replace(/^[\s`*_>#-]+/, '')
    .replace(/[\s`*_]+$/, '')
    .trim()

export const taskTitleKey = (value: string) =>
  value
    .normalize('NFKC')
    .toLocaleLowerCase()
    .replace(/[\s`*_>#，。！？、,.!?:：；;"“”'‘’()（）\[\]{}]+/g, '')

export const usableTaskTitle = (
  value?: string,
  { truncate = true }: { truncate?: boolean } = {}
) => {
  if (!value) return undefined
  const title = stripMarkdownPrefix(value.replace(/\s+/g, ' '))
  const normalized = title.toLocaleLowerCase()
  if (!title || title.length < 2 || (!truncate && title.length > 80)) {
    return undefined
  }
  if (
    title.startsWith('本文件是') ||
    title.startsWith('PLEASE IMPLEMENT') ||
    /^任务\s*\d+/i.test(title) ||
    title.includes('工作准则') ||
    INTERNAL_TITLE_FRAGMENTS.some((fragment) => normalized.includes(fragment))
  ) {
    return undefined
  }
  return title.slice(0, 80)
}

export const extractRequestTitle = (text: string) => {
  const marker = /^\s*My request:\s*(.*)$/im
  const match = marker.exec(text)
  if (!match) return usableTaskTitle(text, { truncate: false })

  const inline = usableTaskTitle(match[1])
  if (inline) return inline

  const remainder = text.slice(match.index + match[0].length)
  const line = remainder
    .split('\n')
    .map((part) => part.trim())
    .find(
      (part) =>
        part &&
        !part.startsWith('#') &&
        !part.startsWith('<') &&
        !part.startsWith('Another language model')
    )
  return usableTaskTitle(line)
}
