import { createContext, useContext, useEffect, useState } from 'react'

import { Command, Eye, EyeOff } from 'lucide-react'

import { RAFIKI_CREDIT } from 'src/illustrations/rafikiScenes'
import { useThemedSceneSrc } from 'src/illustrations/useThemedSceneSrc'

const AUTH_URL = '/.api/functions/auth'

const AuthContext = createContext({
  user: null,
  logout: async () => {},
})

export const useAuth = () => useContext(AuthContext)

const LoginIdentity = () => (
  <section className="login-identity">
    <div className="login-brand">
      <span className="brand-mark" aria-hidden="true">
        <Command size={17} strokeWidth={2.1} />
      </span>
      <div>
        <strong>个人数字团队</strong>
        <span>数字办公室入口</span>
      </div>
    </div>
    <div className="login-identity-body">
      <p className="login-identity-note">
        让岗位、Skill 与任务在同一个数字办公室持续流动。
      </p>
    </div>
  </section>
)

const LoginScreen = ({ onSuccess }) => {
  const loginIllustration = useThemedSceneSrc(
    '/illustrations/rafiki/team-work.svg'
  )
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const submit = async (event) => {
    event.preventDefault()
    setSubmitting(true)
    setError('')
    try {
      const response = await fetch(AUTH_URL, {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ username, password }),
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) {
        setError(body.message || '账号或密码不正确')
        setPassword('')
        return
      }
      const confirmed = await fetch(AUTH_URL, { credentials: 'include' })
      if (!confirmed.ok) {
        setError('登录状态没有保存，请重试')
        return
      }
      setPassword('')
      onSuccess(body.user)
    } catch {
      setError('无法连接登录服务')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="login-screen">
      <LoginIdentity />
      <section className="login-panel">
        <form className="login-form" onSubmit={submit}>
          <h2>登录</h2>
          <p>使用你的团队账号进入办公室。</p>
          <label htmlFor="login-username">
            账号
            <input
              id="login-username"
              name="username"
              autoComplete="username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              required
            />
          </label>
          <label htmlFor="login-password">
            密码
            <span className="login-password">
              <input
                id="login-password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
              <button
                type="button"
                className="login-reveal"
                aria-label={showPassword ? '隐藏密码' : '显示密码'}
                aria-pressed={showPassword}
                onClick={() => setShowPassword((current) => !current)}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </span>
          </label>
          {error && (
            <div className="login-error" role="alert">
              {error}
            </div>
          )}
          <button className="login-submit" type="submit" disabled={submitting}>
            {submitting ? '正在登录…' : '进入团队'}
          </button>
        </form>
        <figure className="login-panel-art">
          <img
            className={loginIllustration.pending ? 'is-pending' : undefined}
            src={loginIllustration.src}
            alt="数字团队协作"
          />
          <figcaption>
            <a href={RAFIKI_CREDIT.href} target="_blank" rel="noreferrer">
              {RAFIKI_CREDIT.label}
            </a>
          </figcaption>
        </figure>
      </section>
    </main>
  )
}

export const AuthProvider = ({ children }) => {
  const [status, setStatus] = useState('checking')
  const [user, setUser] = useState(null)

  useEffect(() => {
    let cancelled = false
    fetch(AUTH_URL, { credentials: 'include' })
      .then(async (response) => {
        if (!response.ok) return null
        const body = await response.json()
        return body.user || null
      })
      .then((nextUser) => {
        if (cancelled) return
        setUser(nextUser)
        setStatus(nextUser ? 'authenticated' : 'anonymous')
      })
      .catch(() => {
        if (!cancelled) setStatus('anonymous')
      })
    return () => {
      cancelled = true
    }
  }, [])

  const logout = async () => {
    await fetch(AUTH_URL, { method: 'DELETE', credentials: 'include' })
    setUser(null)
    setStatus('anonymous')
  }

  useEffect(() => {
    if (status === 'checking') return
    document.getElementById('app-boot')?.remove()
  }, [status])

  if (status === 'checking') return null

  if (status !== 'authenticated') {
    return <LoginScreen onSuccess={(nextUser) => {
      setUser(nextUser)
      setStatus('authenticated')
    }} />
  }

  return (
    <AuthContext.Provider value={{ user, logout }}>
      {children}
    </AuthContext.Provider>
  )
}
