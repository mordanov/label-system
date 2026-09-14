import { useState } from 'react'
import { apiFetch } from '../api'
import { useT } from '../LanguageContext'
import IconGallery from './IconGallery'

export default function CreateForm({ onCreated, printEnabled = true }) {
  const { t } = useT()
  const [name, setName] = useState('')
  const [icon, setIcon] = useState('')
  const [qty, setQty] = useState(1)
  const [busy, setBusy] = useState(false)
  const [warn, setWarn] = useState(false)
  const [error, setError] = useState(null)
  const [saved, setSaved] = useState(false)

  const [showGen, setShowGen] = useState(false)
  const [genName, setGenName] = useState('')
  const [genBusy, setGenBusy] = useState(false)
  const [genResult, setGenResult] = useState(null)
  const [genError, setGenError] = useState(null)

  async function handleSubmit(e) {
    e.preventDefault()
    setBusy(true); setWarn(false); setError(null); setSaved(false)
    try {
      if (qty > 1) {
        const items = Array.from({ length: qty }, () => ({ name, icon_filename: icon }))
        await apiFetch('/products/bulk', { method: 'POST', body: JSON.stringify({ items }) })
      } else {
        const product = await apiFetch('/products', {
          method: 'POST',
          body: JSON.stringify({ name, icon_filename: icon }),
        })
        if (product.print_warning) setWarn(true)
      }
      setSaved(true)
      setName('')
      setQty(1)
      onCreated()
    } catch (err) {
      setError(err.message || t('failedToSave'))
    } finally {
      setBusy(false)
    }
  }

  function toggleGen() {
    setShowGen(v => !v)
    setGenName(name)
    setGenResult(null)
    setGenError(null)
  }

  async function handleGenerate() {
    setGenBusy(true); setGenError(null); setGenResult(null)
    try {
      const result = await apiFetch('/icons/generate', {
        method: 'POST',
        body: JSON.stringify({ dish_name: genName || name }),
      })
      setGenResult(result)
    } catch (err) {
      setGenError(err.message || t('generationFailed'))
    } finally {
      setGenBusy(false)
    }
  }

  function handleUseGenerated() {
    setIcon(genResult.filename)
    setShowGen(false)
    setGenResult(null)
  }

  const btnLabel = busy ? t('saving')
    : qty > 1 ? t('addN', { n: qty })
    : printEnabled ? t('addAndPrint') : t('add')

  return (
    <form className="create-form" onSubmit={handleSubmit}>
      <h2>{t('addProduct')}</h2>
      <input
        value={name} onChange={e => setName(e.target.value)}
        placeholder={t('productName')} required
      />
      <IconGallery value={icon} onChange={setIcon} />

      {warn && printEnabled && <p className="warn">{t('savedPrintFailed')}</p>}
      {saved && <p>{t('saved')}</p>}
      {error && <p className="error">{error}</p>}

      <div className="form-actions">
        <button type="button" className="btn-secondary gen-toggle" onClick={toggleGen}>
          {showGen ? t('hideGenerator') : t('generateIcon')}
        </button>
        <div className="form-submit-row">
          <button type="submit" disabled={busy || !icon}>{btnLabel}</button>
          <input
            type="number" min={1} max={99} value={qty}
            onChange={e => setQty(Math.max(1, Math.min(99, parseInt(e.target.value) || 1)))}
            className="qty-input"
            title={t('qty')}
          />
        </div>
      </div>

      {showGen && (
        <div className="gen-panel">
          <input
            value={genName || name}
            onChange={e => setGenName(e.target.value)}
            placeholder={t('describeIcon')}
          />
          <button type="button" onClick={handleGenerate} disabled={genBusy}>
            {genBusy ? t('generating') : t('generate')}
          </button>
          {genError && <p className="error">{genError}</p>}
          {genResult && (
            <div className="gen-preview">
              {genResult.exists && <p className="hint">{t('existingIconFound')}</p>}
              <img
                src={`data:image/png;base64,${genResult.image_b64}`}
                alt="generated icon"
                width={80} height={80}
              />
              <div className="gen-actions">
                <button type="button" onClick={handleUseGenerated}>{t('useThis')}</button>
                <button type="button" onClick={handleGenerate} disabled={genBusy}>
                  {t('tryAgain')}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </form>
  )
}
