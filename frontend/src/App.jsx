import { useState, useEffect } from 'react'
import { hasCredentials, clearCredentials, apiFetch, apiDownload } from './api'
import { useT } from './LanguageContext'
import LoginForm from './components/LoginForm'
import CreateForm from './components/CreateForm'
import ImportPanel from './components/ImportPanel'
import ProductTable from './components/ProductTable'
import LangSwitcher from './components/LangSwitcher'
import LabelEditor from './components/LabelEditor'
import PrinterStatus from './components/PrinterStatus'
import { Button } from '@/components/ui/button'

function MainView({ onLogout }) {
  const { t } = useT()
  const [refresh, setRefresh] = useState(0)
  const [printEnabled, setPrintEnabled] = useState(true)
  const [showImport, setShowImport] = useState(false)
  const [showLabelEditor, setShowLabelEditor] = useState(false)
  const [apkAvailable, setApkAvailable] = useState(false)

  useEffect(() => {
    fetch('/api/config').then(r => r.json()).then(c => setPrintEnabled(c.print_enabled))
    apiFetch('/download/apk/info').then(info => setApkAvailable(info.available)).catch(() => {})
  }, [])

  function onCreated() { setRefresh(r => r + 1) }

  return (
    <div className="min-h-screen bg-secondary/30">
      <header className="flex items-center justify-between flex-wrap gap-2 px-4 py-3 bg-background border-b border-border">
        <h1 className="text-base font-semibold">{t('title')}</h1>
        <div className="flex items-center gap-2 flex-wrap">
          <LangSwitcher />
          {printEnabled && <PrinterStatus />}
          {printEnabled && (
            <Button variant="outline" size="sm" onClick={() => setShowLabelEditor(true)}>
              {t('labelSettingsBtn')}
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => setShowImport(true)}>
            {t('importFromExcel')}
          </Button>
          {apkAvailable && (
            <Button variant="outline" size="sm" onClick={() => apiDownload('/download/apk', 'label-app.apk')}>
              {t('downloadApk')}
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={onLogout}>{t('signOut')}</Button>
        </div>
      </header>
      <main className="p-4 sm:p-6">
        <CreateForm onCreated={onCreated} printEnabled={printEnabled} />
        <ProductTable refresh={refresh} printEnabled={printEnabled} />
      </main>

      {showImport && (
        <div
          className="fixed inset-0 bg-black/45 flex items-start sm:items-center justify-center z-50 p-4 overflow-y-auto"
          onClick={() => setShowImport(false)}
        >
          <div
            className="bg-background rounded-xl w-full max-w-lg max-h-[calc(100vh-2rem)] overflow-y-auto relative shrink-0"
            onClick={e => e.stopPropagation()}
          >
            <button
              className="absolute top-3 right-3 text-muted-foreground hover:text-foreground leading-none p-1"
              onClick={() => setShowImport(false)}
            >✕</button>
            <ImportPanel onCreated={onCreated} onClose={() => setShowImport(false)} />
          </div>
        </div>
      )}

      {showLabelEditor && (
        <div
          className="fixed inset-0 bg-black/45 flex items-start sm:items-center justify-center z-50 p-4 overflow-y-auto"
          onClick={() => setShowLabelEditor(false)}
        >
          <div
            className="bg-background rounded-xl w-full max-w-[820px] max-h-[calc(100vh-2rem)] overflow-y-auto relative shrink-0"
            onClick={e => e.stopPropagation()}
          >
            <button
              className="absolute top-3 right-3 text-muted-foreground hover:text-foreground leading-none p-1"
              onClick={() => setShowLabelEditor(false)}
            >✕</button>
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
