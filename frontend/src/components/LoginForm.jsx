import { useState } from 'react'
import { setCredentials } from '../api'
import { useT } from '../LanguageContext'
import LangSwitcher from './LangSwitcher'

export default function LoginForm({ onLogin }) {
  const { t } = useT()
  const [user, setUser] = useState('')
  const [pass, setPass] = useState('')
  const [err, setErr] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setCredentials(user, pass)
    try {
      const r = await fetch('/api/products', {
        headers: { Authorization: `Basic ${btoa(`${user}:${pass}`)}` },
      })
      if (r.status === 401) throw new Error('bad')
      onLogin()
    } catch {
      setErr(t('invalidCredentials'))
    }
  }

  return (
    <div className="login-wrap">
      <div className="login-header">
        <h2>{t('title')}</h2>
        <LangSwitcher />
      </div>
      <form onSubmit={handleSubmit}>
        <input value={user} onChange={e => setUser(e.target.value)} placeholder={t('username')} required />
        <input value={pass} onChange={e => setPass(e.target.value)} type="password" placeholder={t('password')} required />
        {err && <p className="error">{err}</p>}
        <button type="submit">{t('signIn')}</button>
      </form>
    </div>
  )
}
