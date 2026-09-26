import { useState } from 'react'
import { setToken } from '../api'
import { useT } from '../LanguageContext'
import LangSwitcher from './LangSwitcher'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'

export default function LoginForm({ onLogin }) {
  const { t } = useT()
  const [user, setUser] = useState('')
  const [pass, setPass] = useState('')
  const [err, setErr] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setErr('')
    try {
      const res = await fetch('/api/auth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: user, password: pass }),
      })
      if (!res.ok) throw new Error('bad')
      const { token } = await res.json()
      setToken(token)
      onLogin()
    } catch {
      setErr(t('invalidCredentials'))
    }
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-secondary/40 px-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">{t('title')}</CardTitle>
            <LangSwitcher />
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="username">{t('username')}</Label>
              <Input id="username" value={user} onChange={e => setUser(e.target.value)} placeholder={t('username')} required />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="password">{t('password')}</Label>
              <Input id="password" type="password" value={pass} onChange={e => setPass(e.target.value)} placeholder={t('password')} required />
            </div>
            {err && <p className="text-destructive text-sm">{err}</p>}
            <Button type="submit" className="w-full">{t('signIn')}</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
