import { useState, useEffect } from 'react'
import { hasCredentials, clearCredentials } from './api'
import LoginForm from './components/LoginForm'
import CreateForm from './components/CreateForm'
import ProductTable from './components/ProductTable'

function MainView({ onLogout }) {
  const [refresh, setRefresh] = useState(0)
  const [printEnabled, setPrintEnabled] = useState(true)

  useEffect(() => {
    fetch('/api/config').then(r => r.json()).then(c => setPrintEnabled(c.print_enabled))
  }, [])

  return (
    <div>
      <header>
        <h1>Label System</h1>
        <button onClick={onLogout}>Sign out</button>
      </header>
      <main>
        <CreateForm onCreated={() => setRefresh(r => r + 1)} printEnabled={printEnabled} />
        <ProductTable refresh={refresh} printEnabled={printEnabled} />
      </main>
    </div>
  )
}

export default function App() {
  const [authed, setAuthed] = useState(hasCredentials())
  function logout() { clearCredentials(); setAuthed(false) }
  if (!authed) return <LoginForm onLogin={() => setAuthed(true)} />
  return <MainView onLogout={logout} />
}
