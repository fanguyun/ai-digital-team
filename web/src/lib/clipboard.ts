/**
 * 复制文本：优先用 Clipboard API，8 秒内没响应或不可用时退回 textarea + execCommand。
 * 某些环境下（无焦点窗口、非安全上下文）writeText 会挂起，必须加超时兜底，
 * 否则按钮点了没有任何反馈。
 */
const CLIPBOARD_TIMEOUT_MS = 800

const fallbackCopy = (text: string) => {
  try {
    const area = document.createElement('textarea')
    area.value = text
    area.setAttribute('readonly', '')
    area.style.position = 'fixed'
    area.style.top = '-1000px'
    area.style.opacity = '0'
    document.body.appendChild(area)
    area.select()
    const copied = document.execCommand('copy')
    document.body.removeChild(area)
    return copied
  } catch {
    return false
  }
}

export const copyText = async (text: string): Promise<boolean> => {
  const clipboard = navigator.clipboard
  if (clipboard?.writeText) {
    try {
      await Promise.race([
        clipboard.writeText(text),
        new Promise((_resolve, reject) =>
          setTimeout(
            () => reject(new Error('clipboard timeout')),
            CLIPBOARD_TIMEOUT_MS
          )
        ),
      ])
      return true
    } catch {
      // 落到 textarea 兜底
    }
  }

  return fallbackCopy(text)
}
