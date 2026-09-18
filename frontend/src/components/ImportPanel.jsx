import { useRef, useState } from 'react'
import * as XLSX from 'xlsx'
import { apiFetch } from '../api'
import { useT } from '../LanguageContext'
import IconGallery from './IconGallery'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'

function parseXlsx(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = e => {
      try {
        const wb = XLSX.read(e.target.result, { type: 'array' })
        const ws = wb.Sheets[wb.SheetNames[0]]
        const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })
        const names = []
        for (let i = 1; i < rows.length; i++) {
          const v = String(rows[i][1] ?? '').trim()
          if (v) names.push(v)
        }
        resolve({ names, totalRows: names.length })
      } catch (err) {
        reject(err)
      }
    }
    reader.onerror = reject
    reader.readAsArrayBuffer(file)
  })
}

export default function ImportPanel({ onCreated, onClose }) {
  const { t } = useT()
  const fileRef = useRef()
  const [fileName, setFileName] = useState('')
  const [names, setNames] = useState([])
  const [checked, setChecked] = useState(new Set())
  const [icon, setIcon] = useState('')
  const [parsing, setParsing] = useState(false)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)

  async function handleFile(e) {
    const file = e.target.files[0]
    if (!file) return
    setResult(null); setError(null); setNames([]); setChecked(new Set())
    setFileName(file.name)
    setParsing(true)
    try {
      const { names: parsed } = await parseXlsx(file)
      setNames(parsed)
      setChecked(new Set(parsed.map((_, i) => i)))
    } catch (err) {
      setError(err.message || t('importFailed'))
    } finally {
      setParsing(false)
    }
    e.target.value = ''
  }

  function toggle(i) {
    setChecked(s => {
      const n = new Set(s)
      n.has(i) ? n.delete(i) : n.add(i)
      return n
    })
  }

  async function handleImport() {
    if (checked.size === 0) return
    setBusy(true); setResult(null); setError(null)
    try {
      const items = [...checked].sort((a, b) => a - b).map(i => ({ name: names[i], icon_filename: icon }))
      const created = await apiFetch('/products/bulk', {
        method: 'POST',
        body: JSON.stringify({ items }),
      })
      setResult(created.length)
      setNames([])
      setChecked(new Set())
      onCreated()
    } catch (err) {
      setError(err.message || t('importFailed'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="p-6 flex flex-col gap-4">
      <h2 className="font-semibold text-base">{t('importTitle')}</h2>

      <div className="flex items-center gap-3 flex-wrap">
        <input type="file" accept=".xlsx" ref={fileRef} className="hidden" onChange={handleFile} />
        <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current.click()}>
          {t('importPickFile')}
        </Button>
        {fileName && (
          <>
            <span className="text-sm text-muted-foreground">{fileName}</span>
            <button
              type="button"
              className="text-muted-foreground hover:text-foreground text-sm underline"
              onClick={() => { setFileName(''); setNames([]); setChecked(new Set()); setResult(null); setError(null) }}
            >✕</button>
          </>
        )}
      </div>

      <div>
        <p className="text-sm text-foreground mb-1">{t('importSelectIcon')}</p>
        <IconGallery value={icon} onChange={setIcon} />
      </div>

      {parsing && <p className="text-xs text-muted-foreground">⏳ {t('parsing')}…</p>}

      {!parsing && names.length > 0 && (
        <>
          <p className="text-xs text-muted-foreground">{t('importFound', { n: names.length })}</p>
          <div className="flex gap-4">
            <button type="button" className="text-sm text-primary underline" onClick={() => setChecked(new Set(names.map((_, i) => i)))}>
              {t('importSelectAll')}
            </button>
            <button type="button" className="text-sm text-primary underline" onClick={() => setChecked(new Set())}>
              {t('importDeselectAll')}
            </button>
          </div>

          <div className="max-h-52 overflow-y-auto rounded-md border border-border p-2 flex flex-col gap-0.5">
            {names.map((name, i) => (
              <label key={i} className="flex items-center gap-2 py-1 px-1 rounded cursor-pointer hover:bg-accent text-sm select-none">
                <Checkbox
                  checked={checked.has(i)}
                  onCheckedChange={() => toggle(i)}
                />
                <span>{name}</span>
              </label>
            ))}
          </div>

          <Button
            type="button"
            disabled={busy || checked.size === 0}
            onClick={handleImport}
          >
            {busy ? t('importing') : t('importProducts', { n: checked.size })}
          </Button>
        </>
      )}

      {!parsing && names.length === 0 && fileName && !error && result === null && (
        <p className="text-amber-600 text-sm">{t('importNoNames')}</p>
      )}
      {result !== null && <p className="text-green-700 text-sm">{t('importDone', { n: result })}</p>}
      {error && <p className="text-destructive text-sm">{error}</p>}
    </div>
  )
}
