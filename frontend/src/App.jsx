import { useState } from 'react'
import { hasCredentials, clearCredentials } from './api'
import LoginForm from './components/LoginForm'
import CreateForm from './components/CreateForm'

function MainView({ onLogout }) {
  const [refresh, setRefresh] = useState(0)

  return (
    <div>
      <header>
        <h1>Label System</h1>
        <button onClick={onLogout}>Sign out</button>
      </header>
      <main>
        <CreateForm onCreated={() => setRefresh(r => r + 1)} />
        {/* ProductTable added in Task 9 */}
        <p style={{color:'#888'}}>Product table coming soon…</p>
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
