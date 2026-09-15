import { useState, useEffect } from 'react'
import { hasCredentials, clearCredentials } from './api'
import { useT } from './LanguageContext'
import LoginForm from './components/LoginForm'
import CreateForm from './components/CreateForm'
import ImportPanel from './components/ImportPanel'
import ProductTable from './components/ProductTable'
import LangSwitcher from './components/LangSwitcher'
import LabelEditor from './components/LabelEditor'
import PrinterStatus from './components/PrinterStatus'

function MainView({ onLogout }) {
  const { t } = useT()
  const [refresh, setRefresh] = useState(0)
  const [printEnabled, setPrintEnabled] = useState(true)
  const [showImport, setShowImport] = useState(false)
  const [showLabelEditor, setShowLabelEditor] = useState(false)

  useEffect(() => {
    fetch('/api/config').then(r => r.json()).then(c => setPrintEnabled(c.print_enabled))
  }, [])

  function onCreated() { setRefresh(r => r + 1) }

  return (
    <div>
      <header>
        <h1>{t('title')}</h1>
        <div className="header-actions">
          <LangSwitcher />
          {printEnabled && <PrinterStatus />}
          {printEnabled && (
            <button className="btn-secondary" onClick={() => setShowLabelEditor(true)}>
              {t('labelSettingsBtn')}
            </button>
          )}
          <button className="btn-secondary" onClick={() => setShowImport(true)}>
            {t('importFromExcel')}
          </button>
          <button onClick={onLogout}>{t('signOut')}</button>
        </div>
      </header>
      <main>
        <CreateForm onCreated={onCreated} printEnabled={printEnabled} />
        <ProductTable refresh={refresh} printEnabled={printEnabled} />
      </main>
      {showImport && (
        <div className="modal-backdrop" onClick={() => setShowImport(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setShowImport(false)}>✕</button>
            <ImportPanel onCreated={onCreated} onClose={() => setShowImport(false)} />
          </div>
        </div>
      )}
      {showLabelEditor && (
        <div className="modal-backdrop" onClick={() => setShowLabelEditor(false)}>
          <div className="modal" style={{ maxWidth: 820 }} onClick={e => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setShowLabelEditor(false)}>✕</button>
            <LabelEditor onClose={() => setShowLabelEditor(false)} />
          </div>
        </div>
      )}
    </div>
  )
}

export default function App() {
  const [authed, setAuthed] = useState(hasCredentials())
  function logout() { clearCredentials(); setAuthed(false) }
  if (!authed) return <LoginForm onLogin={() => setAuthed(true)} />
  return <MainView onLogout={logout} />
}
