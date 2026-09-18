import { useState, useEffect } from 'react'
import { apiFetch } from '../api'
import { useT } from '../LanguageContext'
import IconPickerPanel from './IconPickerPanel'
import AutocompleteInput from './AutocompleteInput'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

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
    <Card className="mb-6 max-w-xl">
      <CardHeader>
        <CardTitle>{t('addProduct')}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <AutocompleteInput
            value={name} onChange={setName}
            placeholder={t('productName')} required
            names={names}
          />
          <IconPickerPanel value={icon} onChange={setIcon} productName={name} />

          <div className="flex items-center gap-2">
            <Label className="whitespace-nowrap">{t('unitsPerProduct')}</Label>
            <Input
              type="number" min={1} value={units}
              onChange={e => setUnits(e.target.value)}
              className="w-20 text-center"
              placeholder={t('unitsPlaceholder')}
            />
          </div>

          {warn && printEnabled && <p className="text-amber-600 text-sm">{t('savedPrintFailed')}</p>}
          {saved && <p className="text-sm text-muted-foreground">{t('saved')}</p>}
          {error && <p className="text-destructive text-sm">{error}</p>}

          <div className="flex items-center justify-end gap-2">
            <Button type="submit" disabled={busy}>{btnLabel}</Button>
            <Input
              type="number" min={1} max={99} value={qty}
              onChange={e => setQty(Math.max(1, Math.min(99, parseInt(e.target.value) || 1)))}
              className="w-14 text-center"
              title={t('qty')}
            />
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
