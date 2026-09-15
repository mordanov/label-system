import { useState } from 'react'
import { apiFetch } from '../api'
import { useT } from '../LanguageContext'
import IconGallery from './IconGallery'

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
      <button type="button" className="btn-secondary gen-toggle" onClick={() => setShowGen(v => !v)}>
        {showGen ? t('hideGenerator') : t('generateIcon')}
      </button>
      {showGen && (
        <div className="gen-panel">
          <input
            value={genName}
            onChange={e => setGenName(e.target.value)}
            placeholder={t('describeIcon')}
          />
          <button type="button" onClick={() => handleGenerate()} disabled={genBusy}>
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
                <button type="button" onClick={() => handleGenerate(true)} disabled={genBusy}>
                  {t('tryAgain')}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </>
  )
}
