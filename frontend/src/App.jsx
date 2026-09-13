import { useState } from 'react'
import { hasCredentials, clearCredentials } from './api'
import LoginForm from './components/LoginForm'

// Placeholder — ProductTable and CreateForm added in Tasks 8-9
function MainView({ onLogout }) {
  return (
    <div>
      <header>
        <h1>Label System</h1>
        <button onClick={onLogout}>Sign out</button>
      </header>
      <main>
        <p>Loading…</p>
      </main>
    </div>
  )
}

export default function App() {
  const [authed, setAuthed] = useState(hasCredentials())

  function logout() {
    clearCredentials()
    setAuthed(false)
  }

  if (!authed) return <LoginForm onLogin={() => setAuthed(true)} />
  return <MainView onLogout={logout} />
}
