import { createHash } from 'node:crypto'

export const publicationHash = (value: string) =>
  createHash('sha256').update(value).digest('hex')

export const normalizePublicationMarkdown = (value: string) =>
  value.replace(/\r\n?/g, '\n').replace(/^\n+|\n+$/g, '')

const hasControlCharacters = (value: string) =>
  [...value].some(
    (character) =>
      character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127
  )

export const publicationPath = (directory: string, title: string) => {
  const segments = directory
    .trim()
    .replace(/^\/+|\/+$/g, '')
    .split('/')
    .filter(Boolean)
  if (
    !title.trim() ||
    ['.', '..'].includes(title.trim()) ||
    title.length > 120 ||
    /[\\/]/.test(title) ||
    hasControlCharacters(title)
  )
    throw new Error('文档标题不能为空、超过120字符或包含斜杠与控制字符')
  if (
    segments.some(
      (segment) =>
        ['.', '..'].includes(segment) ||
        segment.includes('\\') ||
        hasControlCharacters(segment)
    )
  )
    throw new Error('目录不能包含相对跳转、反斜杠或控制字符')
  const result = '/' + [...segments, title.trim()].join('/')
  if (result.length > 500) throw new Error('文档路径超过500字符')
  return result
}

export const publicationPathAllowed = (
  documentPath: string,
  prefixes: string[]
) => {
  const candidate = documentPath.replace(/^\/+/, '')
  return (
    !prefixes.length ||
    prefixes.some((prefix) => {
      const normalized = prefix.replace(/^\/+|\/+$/g, '')
      return (
        Boolean(normalized) &&
        (candidate === normalized || candidate.startsWith(normalized + '/'))
      )
    })
  )
}

export const siyuanId = (value: unknown): value is string =>
  typeof value === 'string' && /^\d{14}-[a-z0-9]{7}$/.test(value)

export const siyuanPublicationClient = ({
  origin,
  token,
  fetchImpl = fetch,
}: {
  origin: string
  token: string
  fetchImpl?: typeof fetch
}) => {
  const post = async (
    endpoint: string,
    input: Record<string, unknown>
  ): Promise<unknown> => {
    try {
      const response = await fetchImpl(origin + endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Token ${token}`,
        },
        body: JSON.stringify(input),
        redirect: 'error',
        signal: AbortSignal.timeout(8000),
      })
      if (!response.ok) {
        await response.body?.cancel()
        throw new Error('request failed')
      }
      const reader = response.body?.getReader()
      if (!reader) throw new Error('empty response')
      const chunks: Uint8Array[] = []
      let size = 0
      try {
        for (;;) {
          const part = await reader.read()
          if (part.done) break
          size += part.value.byteLength
          if (size > 1024 * 1024) throw new Error('response too large')
          chunks.push(part.value)
        }
      } finally {
        await reader.cancel().catch(() => {})
      }
      const body = JSON.parse(Buffer.concat(chunks).toString('utf8'))
      if (body?.code !== 0) throw new Error('invalid API response')
      return body.data
    } catch {
      throw new Error(
        '思源请求未成功：请检查连接、令牌、笔记本写权限及服务版本。'
      )
    }
  }
  return {
    find: async (notebook: string, documentPath: string) => {
      const data = await post('/api/filetree/getIDsByHPath', {
        notebook,
        path: documentPath,
      })
      if (!Array.isArray(data) || !data.every(siyuanId))
        throw new Error('思源路径查询返回无效，已停止入库。')
      return data as string[]
    },
    create: async (
      notebook: string,
      documentPath: string,
      markdown: string
    ) => {
      const data = await post('/api/filetree/createDocWithMd', {
        notebook,
        path: documentPath,
        markdown,
      })
      if (!siyuanId(data))
        throw new Error('思源创建结果无法确认，请检查后重试验证。')
      return data
    },
    read: async (id: string) => {
      const data = (await post('/api/export/exportMdContent', {
        id,
        addTitle: false,
        yfm: false,
        headingNumber: false,
        preserveTaskMarkers: true,
      })) as {
        hPath?: unknown
        content?: unknown
      } | null
      if (
        !data ||
        typeof data.content !== 'string' ||
        typeof data.hPath !== 'string'
      )
        throw new Error('思源回读结果无效，请检查后重试验证。')
      return { markdown: data.content, documentPath: data.hPath }
    },
    render: async (markdown: string) => {
      const data = (await post('/api/lute/md2html', { markdown })) as {
        html?: unknown
      } | null
      if (!data || typeof data.html !== 'string' || !data.html.trim())
        throw new Error('思源 Markdown 格式核对不可用，已保留文档等待核对。')
      return data.html
    },
  }
}
