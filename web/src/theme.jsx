import { createContext, useContext, useEffect, useMemo, useState } from 'react'

import { ConfigProvider, theme as antdTheme } from 'antd'
import zhCN from 'antd/locale/zh_CN'

const STORAGE_KEY = 'pdt-theme'

const ThemeContext = createContext({
  theme: 'light',
  toggleTheme: () => {},
})

export const useTheme = () => useContext(ThemeContext)

const readTheme = () => {
  if (
    typeof document !== 'undefined' &&
    document.documentElement.dataset.theme
  ) {
    return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light'
  }
  try {
    return localStorage.getItem(STORAGE_KEY) === 'dark' ? 'dark' : 'light'
  } catch {
    return 'light'
  }
}

export const ThemeProvider = ({ children }) => {
  const [theme, setTheme] = useState(readTheme)
  const toggleTheme = () =>
    setTheme((current) => (current === 'dark' ? 'light' : 'dark'))

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    try {
      localStorage.setItem(STORAGE_KEY, theme)
    } catch {
      // Ignore storage failures in private browsing.
    }
  }, [theme])

  const antdThemeConfig = useMemo(
    () => ({
      algorithm:
        theme === 'dark' ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
      token: {
        colorPrimary: '#32d74b',
        borderRadius: 8,
        fontFamily: 'inherit',
      },
    }),
    [theme]
  )

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      <ConfigProvider locale={zhCN} theme={antdThemeConfig}>
        {children}
      </ConfigProvider>
    </ThemeContext.Provider>
  )
}
