import { useState } from 'react'
import { apiFetch } from '../api'
import { useT } from '../LanguageContext'
import IconGallery from './IconGallery'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export default function IconPickerPanel({ value, onChange, productName = '' }) {
  const { t } = useT()
  const [showGen, setShowGen] = useState(false)
  const [genName, setGenName] = useState(productName)
  const [genBusy, setGenBusy] = useState(false)
  const [genResult, setGenResult] = useState(null)
  const [genError, setGenError] = useState(null)

  async function handleGenerate(force = false) {
    setGenBusy(true); setGenError(null); setGenResult(null)
    try {
      const result = await apiFetch('/icons/generate', {
        method: 'POST',
        body: JSON.stringify({ dish_name: genName || productName, force }),
      })
      setGenResult(result)
    } catch (err) {
      setGenError(err.message || t('generationFailed'))
    } finally {
      setGenBusy(false)
    }
  }

  function handleUseGenerated() {
    onChange(genResult.filename)
    setShowGen(false)
    setGenResult(null)
  }

  return (
    <>
      <IconGallery value={value} onChange={onChange} />
      <Button type="button" variant="outline" size="sm" onClick={() => setShowGen(v => !v)}>
        {showGen ? t('hideGenerator') : t('generateIcon')}
      </Button>
      {showGen && (
        <div className="mt-3 flex flex-col gap-3">
          <div className="flex gap-2">
            <Input
              value={genName}
              onChange={e => setGenName(e.target.value)}
              placeholder={t('describeIcon')}
            />
            <Button type="button" onClick={() => handleGenerate()} disabled={genBusy} size="sm">
              {genBusy ? t('generating') : t('generate')}
            </Button>
          </div>
          {genError && <p className="text-destructive text-sm">{genError}</p>}
          {genResult && (
            <div className="flex items-center gap-4">
              <img
                src={`data:image/png;base64,${genResult.image_b64}`}
                alt="generated icon"
                width={80} height={80}
                className="rounded-md border border-border"
              />
              <div className="flex flex-col gap-2">
                {genResult.exists && <p className="text-xs text-muted-foreground">{t('existingIconFound')}</p>}
                <div className="flex gap-2">
                  <Button type="button" size="sm" onClick={handleUseGenerated}>{t('useThis')}</Button>
                  <Button type="button" size="sm" variant="outline" onClick={() => handleGenerate(true)} disabled={genBusy}>
                    {t('tryAgain')}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </>
  )
}
