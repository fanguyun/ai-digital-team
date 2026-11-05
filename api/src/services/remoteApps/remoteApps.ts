import { UserInputError } from '@cedarjs/graphql-server'

import { db } from 'src/lib/db'

const NAME_MAX = 120
const URL_MAX = 500
const DATA_ICON_MAX = 300_000 // ~220KB 二进制，前端会先压到 96px
const TEXT_ICON_MAX = 16

const text = (value: unknown) => (typeof value === 'string' ? value.trim() : '')

const normalizeName = (value: unknown) => {
  const name = text(value)
  if (!name) throw new UserInputError('应用名称不能为空')
  if (name.length > NAME_MAX) {
    throw new UserInputError(`应用名称不能超过 ${NAME_MAX} 个字符`)
  }
  return name
}

/** 缺协议时按 https 补全，随后只放行 http/https */
export const normalizeUrl = (value: unknown) => {
  const raw = text(value)
  if (!raw) throw new UserInputError('应用链接不能为空')

  // javascript:/data:/file: 这类协议即使没有 // 也必须挡掉
  if (/^(javascript|data|file|vbscript|blob):/i.test(raw)) {
    throw new UserInputError('应用链接只支持 http 或 https')
  }

  const hasScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(raw)
  const candidate = hasScheme ? raw : `https://${raw}`

  let parsed: URL
  try {
    parsed = new URL(candidate)
  } catch {
    throw new UserInputError('应用链接格式不正确')
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new UserInputError('应用链接只支持 http 或 https')
  }
  if (candidate.length > URL_MAX) {
    throw new UserInputError(`应用链接不能超过 ${URL_MAX} 个字符`)
  }

  return candidate
}

const IMAGE_DATA_URL =
  /^data:image\/(png|jpeg|jpg|webp|gif);base64,[a-z0-9+/=\s]+$/i

/** 图标支持三种形态：上传后的 data URL、外链图片、emoji/短文字 */
const normalizeIcon = (value: unknown) => {
  const icon = text(value)
  if (!icon) return ''

  if (icon.startsWith('data:')) {
    if (!IMAGE_DATA_URL.test(icon)) {
      throw new UserInputError('只支持 png / jpeg / webp / gif 图片')
    }
    if (icon.length > DATA_ICON_MAX) {
      throw new UserInputError('图标图片太大，请控制在 200KB 以内')
    }
    return icon
  }

  if (/^https?:\/\//i.test(icon)) {
    if (icon.length > URL_MAX) {
      throw new UserInputError(`图标链接不能超过 ${URL_MAX} 个字符`)
    }
    return icon
  }

  if (icon.length > TEXT_ICON_MAX) {
    throw new UserInputError(
      `文字图标不能超过 ${TEXT_ICON_MAX} 个字符，图片请用上传或链接`
    )
  }
  return icon
}

export const remoteApps = () =>
  db.remoteApp.findMany({ orderBy: { createdAt: 'asc' } })

export const remoteApp = ({ id }: { id: string }) =>
  db.remoteApp.findUnique({ where: { id } })

export const createRemoteApp = async ({
  input,
}: {
  input: { name: string; url: string; icon?: string | null }
}) =>
  db.remoteApp.create({
    data: {
      name: normalizeName(input.name),
      url: normalizeUrl(input.url),
      icon: normalizeIcon(input.icon),
    },
  })

export const updateRemoteApp = async ({
  id,
  input,
}: {
  id: string
  input: { name?: string | null; url?: string | null; icon?: string | null }
}) => {
  const data: { name?: string; url?: string; icon?: string } = {}

  if (input.name !== undefined && input.name !== null) {
    data.name = normalizeName(input.name)
  }
  if (input.url !== undefined && input.url !== null) {
    data.url = normalizeUrl(input.url)
  }
  if (input.icon !== undefined && input.icon !== null) {
    data.icon = normalizeIcon(input.icon)
  }

  return db.remoteApp.update({ where: { id }, data })
}

export const deleteRemoteApp = ({ id }: { id: string }) =>
  db.remoteApp.delete({ where: { id } })
