import { useEffect, useState } from 'react'

import { stripSceneBackground } from 'src/illustrations/rafikiScenes'
import { useTheme } from 'src/theme'

const resolvedDarkUrls = new Map()
const pendingDarkUrls = new Map()

const darkSceneUrl = (src) => {
  const resolved = resolvedDarkUrls.get(src)
  if (resolved) return Promise.resolve(resolved)

  const pending = pendingDarkUrls.get(src)
  if (pending) return pending

  const request = fetch(src)
    .then((response) => {
      if (!response.ok) throw new Error('illustration unavailable')
      return response.text()
    })
    .then((svgText) => {
      const url = URL.createObjectURL(
        new Blob([stripSceneBackground(svgText)], { type: 'image/svg+xml' })
      )
      resolvedDarkUrls.set(src, url)
      pendingDarkUrls.delete(src)
      return url
    })
    .catch((error) => {
      pendingDarkUrls.delete(src)
      throw error
    })

  pendingDarkUrls.set(src, request)
  return request
}

export const useThemedSceneSrc = (src) => {
  const { theme } = useTheme()
  const [loaded, setLoaded] = useState({ src: '', url: '' })
  const cachedUrl = theme === 'dark' ? resolvedDarkUrls.get(src) : ''
  const darkSrc = cachedUrl || (loaded.src === src ? loaded.url : '')

  useEffect(() => {
    if (theme !== 'dark') return undefined
    if (resolvedDarkUrls.has(src)) return undefined
    let cancelled = false
    darkSceneUrl(src)
      .then((url) => {
        if (!cancelled) setLoaded({ src, url })
      })
      .catch(() => {
        if (!cancelled) setLoaded({ src, url: src })
      })
    return () => {
      cancelled = true
    }
  }, [src, theme])

  if (theme !== 'dark') return { src, pending: false }
  if (!darkSrc) return { src, pending: true }
  return { src: darkSrc, pending: false }
}
