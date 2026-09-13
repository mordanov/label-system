import { useState } from 'react'
import { apiFetch } from '../api'
import IconGallery from './IconGallery'

export default function CreateForm({ onCreated }) {
  const [name, setName] = useState('')
  const [icon, setIcon] = useState('')
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
      const product = await apiFetch('/products', {
        method: 'POST',
        body: JSON.stringify({ name, icon_filename: icon }),
      })
      if (product.print_warning) setWarn(true)
      setSaved(true)
      setName('')
      onCreated(product)
    } catch(err) {
      setError(err.message || 'Failed to save')
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
    } catch(err) {
      setGenError(err.message || 'Generation failed')
    } finally {
      setGenBusy(false)
    }
  }

  function handleUseGenerated() {
    setIcon(genResult.filename)
    setShowGen(false)
    setGenResult(null)
  }

  return (
    <form className="create-form" onSubmit={handleSubmit}>
      <h2>Add product</h2>
      <input
        value={name} onChange={e => setName(e.target.value)}
        placeholder="Product name" required
      />
      <IconGallery value={icon} onChange={setIcon} />

      <div className="gen-section">
        <button type="button" className="gen-toggle" onClick={toggleGen}>
          {showGen ? '▲ Hide generator' : '✦ Generate icon'}
        </button>
        {showGen && (
          <div className="gen-panel">
            <input
              value={genName || name}
              onChange={e => setGenName(e.target.value)}
              placeholder="Describe the icon…"
            />
            <button type="button" onClick={handleGenerate} disabled={genBusy}>
              {genBusy ? 'Generating…' : 'Generate'}
            </button>
            {genError && <p className="error">{genError}</p>}
            {genResult && (
              <div className="gen-preview">
                {genResult.exists && <p className="hint">Existing icon found</p>}
                <img
                  src={`data:image/png;base64,${genResult.image_b64}`}
                  alt="generated icon"
                  width={80} height={80}
                />
                <div className="gen-actions">
                  <button type="button" onClick={handleUseGenerated}>Use this</button>
                  <button type="button" onClick={handleGenerate} disabled={genBusy}>
                    Try again
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {warn && <p className="warn">Saved, but printing failed — use Reprint.</p>}
      {saved && <p>Saved!</p>}
      {error && <p className="error">{error}</p>}
      <button type="submit" disabled={busy || !icon}>
        {busy ? 'Saving…' : 'Add & Print'}
      </button>
    </form>
  )
}
