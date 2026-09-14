import { useRef, useState } from 'react'
import * as XLSX from 'xlsx'
import { apiFetch } from '../api'
import { useT } from '../LanguageContext'
import IconGallery from './IconGallery'

function parseXlsx(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = e => {
      try {
        const wb = XLSX.read(e.target.result, { type: 'array' })
        const ws = wb.Sheets[wb.SheetNames[0]]
        const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })
        const seen = new Set()
        const names = []
        for (let i = 1; i < rows.length; i++) {
          const v = String(rows[i][1] ?? '').trim()
          if (v && !seen.has(v)) { seen.add(v); names.push(v) }
        }
        resolve(names)
      } catch (err) {
        reject(err)
      }
    }
    reader.onerror = reject
    reader.readAsArrayBuffer(file)
  })
}

export default function ImportPanel({ onCreated }) {
  const { t } = useT()
  const fileRef = useRef()
  const [fileName, setFileName] = useState('')
  const [names, setNames] = useState([])
  const [checked, setChecked] = useState(new Set())
  const [icon, setIcon] = useState('')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)

  async function handleFile(e) {
    const file = e.target.files[0]
    if (!file) return
    setResult(null); setError(null); setNames([]); setChecked(new Set())
    setFileName(file.name)
    try {
      const parsed = await parseXlsx(file)
      setNames(parsed)
      setChecked(new Set(parsed))
    } catch (err) {
      setError(err.message || t('importFailed'))
    }
    e.target.value = ''
  }

  function toggle(name) {
    setChecked(s => {
      const n = new Set(s)
      n.has(name) ? n.delete(name) : n.add(name)
      return n
    })
  }

  async function handleImport() {
    if (!icon || checked.size === 0) return
    setBusy(true); setResult(null); setError(null)
    try {
      const items = [...checked].map(name => ({ name, icon_filename: icon }))
      const created = await apiFetch('/products/bulk', {
        method: 'POST',
        body: JSON.stringify({ items }),
      })
      setResult(created.length)
      setChecked(new Set())
      onCreated()
    } catch (err) {
      setError(err.message || t('importFailed'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="import-panel">
      <h2>{t('importTitle')}</h2>

      <div className="import-file-row">
        <input type="file" accept=".xlsx" ref={fileRef} style={{ display: 'none' }} onChange={handleFile} />
        <button type="button" className="btn-secondary" onClick={() => fileRef.current.click()}>
          {t('importPickFile')}
        </button>
        {fileName && <span className="import-filename">{fileName}</span>}
      </div>

      {names.length > 0 && (
        <>
          <div className="import-icon-section">
            <p className="import-label">{t('importSelectIcon')}</p>
            <IconGallery value={icon} onChange={setIcon} />
          </div>

          <div className="import-toolbar">
            <button type="button" className="btn-link" onClick={() => setChecked(new Set(names))}>
              {t('importSelectAll')}
            </button>
            <button type="button" className="btn-link" onClick={() => setChecked(new Set())}>
              {t('importDeselectAll')}
            </button>
          </div>

          <div className="import-name-list">
            {names.map(name => (
              <label key={name} className="import-name-item">
                <input type="checkbox" checked={checked.has(name)} onChange={() => toggle(name)} />
                <span>{name}</span>
              </label>
            ))}
          </div>

          <button
            type="button"
            disabled={busy || !icon || checked.size === 0}
            onClick={handleImport}
          >
            {busy ? t('importing') : t('importProducts', { n: checked.size })}
          </button>
        </>
      )}

      {names.length === 0 && fileName && !error && (
        <p className="warn">{t('importNoNames')}</p>
      )}
      {result !== null && <p className="import-success">{t('importDone', { n: result })}</p>}
      {error && <p className="error">{error}</p>}
    </div>
  )
}
