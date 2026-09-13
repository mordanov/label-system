import { useState } from 'react'
import { setCredentials } from '../api'

export default function LoginForm({ onLogin }) {
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
      setErr('Invalid credentials')
    }
  }

  return (
    <div className="login-wrap">
      <h2>Label System</h2>
      <form onSubmit={handleSubmit}>
        <input value={user} onChange={e => setUser(e.target.value)} placeholder="Username" required />
        <input value={pass} onChange={e => setPass(e.target.value)} type="password" placeholder="Password" required />
        {err && <p className="error">{err}</p>}
        <button type="submit">Sign in</button>
      </form>
    </div>
  )
}
