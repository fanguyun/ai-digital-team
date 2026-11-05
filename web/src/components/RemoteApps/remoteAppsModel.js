/** 应用中心里与 UI 无关的纯逻辑，便于单测 */

const DANGEROUS_PROTOCOL = /^(javascript|data|file|vbscript|blob):/i
const HAS_PROTOCOL = /^[a-z][a-z0-9+.-]*:\/\//i

/** 缺协议时补 https://；危险协议直接返回空串 */
export const normalizeUrlInput = (input) => {
  const raw = String(input || '').trim()
  if (!raw) return ''
  if (DANGEROUS_PROTOCOL.test(raw)) return ''
  return HAS_PROTOCOL.test(raw) ? raw : `https://${raw}`
}

export const isValidUrl = (input) => {
  const normalized = normalizeUrlInput(input)
  if (!normalized) return false
  try {
    const parsed = new URL(normalized)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}

/** 上传后的 data URL 图标 */
export const isDataUrlIcon = (icon) =>
  /^data:image\/(png|jpeg|jpg|webp|gif);base64,/i.test(
    String(icon || '').trim()
  )

/** 图标是图片（外链或上传）还是文字/emoji */
export const isImageIcon = (icon) => {
  const value = String(icon || '').trim()
  return /^https?:\/\//i.test(value) || isDataUrlIcon(value)
}

/** 没有图标时用名称首字兜底（支持 emoji 与代理对） */
export const initialFor = (name) => {
  const trimmed = String(name || '').trim()
  if (!trimmed) return '?'
  return Array.from(trimmed)[0].toUpperCase()
}

const PALETTE = [
  '#6857e8',
  '#2e938a',
  '#b88a45',
  '#4c78c8',
  '#b66555',
  '#66727f',
  '#7a5aaa',
]

/** 同一个名称永远拿到同一个底色 */
export const hashColor = (value) => {
  const text = String(value || '')
  let hash = 0
  for (const char of text) {
    hash = (hash * 31 + (char.codePointAt(0) || 0)) % 100000
  }
  return PALETTE[hash % PALETTE.length]
}

/** 卡片上只显示域名+端口，不铺整条 URL */
export const displayHost = (url) => {
  try {
    return new URL(url).host
  } catch {
    return String(url || '')
  }
}
