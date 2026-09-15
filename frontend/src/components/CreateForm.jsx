import { useState, useEffect } from 'react'
import { apiFetch } from '../api'
import { useT } from '../LanguageContext'
import IconPickerPanel from './IconPickerPanel'
import AutocompleteInput from './AutocompleteInput'

export default function CreateForm({ onCreated, printEnabled = true }) {
  const { t } = useT()
  const [name, setName] = useState('')
  const [names, setNames] = useState([])

  useEffect(() => {
    apiFetch('/products/names').then(setNames).catch(() => {})
  }, [])
  const [icon, setIcon] = useState('')
  const [qty, setQty] = useState(1)
  const [units, setUnits] = useState('')
  const [busy, setBusy] = useState(false)
  const [warn, setWarn] = useState(false)
  const [error, setError] = useState(null)
  const [saved, setSaved] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setBusy(true); setWarn(false); setError(null); setSaved(false)
    const unitsVal = units === '' ? null : parseInt(units, 10)
    try {
      if (qty > 1) {
        const items = Array.from({ length: qty }, () => ({ name, icon_filename: icon, units: unitsVal }))
        await apiFetch('/products/bulk', { method: 'POST', body: JSON.stringify({ items }) })
      } else {
        const product = await apiFetch('/products', {
          method: 'POST',
          body: JSON.stringify({ name, icon_filename: icon, units: unitsVal }),
        })
        if (product.print_warning) setWarn(true)
      }
      setSaved(true)
      setName('')
      setQty(1)
      setUnits('')
      onCreated()
    } catch (err) {
      setError(err.message || t('failedToSave'))
    } finally {
      setBusy(false)
    }
  }

  const btnLabel = busy ? t('saving')
    : qty > 1 ? t('addN', { n: qty })
    : printEnabled ? t('addAndPrint') : t('add')

  return (
    <form className="create-form" onSubmit={handleSubmit}>
      <h2>{t('addProduct')}</h2>
      <AutocompleteInput
        value={name} onChange={setName}
        placeholder={t('productName')} required
        names={names}
      />
      <IconPickerPanel value={icon} onChange={setIcon} productName={name} />

      <div className="units-row">
        <label className="units-label">{t('unitsPerProduct')}</label>
        <input
          type="number" min={1} value={units}
          onChange={e => setUnits(e.target.value)}
          className="units-input"
          placeholder={t('unitsPlaceholder')}
        />
      </div>

      {warn && printEnabled && <p className="warn">{t('savedPrintFailed')}</p>}
      {saved && <p>{t('saved')}</p>}
      {error && <p className="error">{error}</p>}

      <div className="form-actions">
        <div />
        <div className="form-submit-row">
          <button type="submit" disabled={busy}>{btnLabel}</button>
          <input
            type="number" min={1} max={99} value={qty}
            onChange={e => setQty(Math.max(1, Math.min(99, parseInt(e.target.value) || 1)))}
            className="qty-input"
            title={t('qty')}
          />
        </div>
      </div>
    </form>
  )
}
