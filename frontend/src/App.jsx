import { useState, useEffect } from 'react'
import { hasCredentials, clearCredentials } from './api'
import { useT } from './LanguageContext'
import LoginForm from './components/LoginForm'
import CreateForm from './components/CreateForm'
import ImportPanel from './components/ImportPanel'
import ProductTable from './components/ProductTable'
import LangSwitcher from './components/LangSwitcher'

function MainView({ onLogout }) {
  const { t } = useT()
  const [refresh, setRefresh] = useState(0)
  const [printEnabled, setPrintEnabled] = useState(true)
  const [showImport, setShowImport] = useState(false)

  useEffect(() => {
    fetch('/api/config').then(r => r.json()).then(c => setPrintEnabled(c.print_enabled))
  }, [])

  function onCreated() { setRefresh(r => r + 1) }

  return (
    <div>
      <header>
        <h1>{t('title')}</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <LangSwitcher />
          <button className="btn-secondary" onClick={() => setShowImport(v => !v)}>
            {t('importFromExcel')}
          </button>
          <button onClick={onLogout}>{t('signOut')}</button>
        </div>
      </header>
      <main>
        {showImport
          ? <ImportPanel onCreated={onCreated} />
          : <CreateForm onCreated={onCreated} printEnabled={printEnabled} />
        }
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
