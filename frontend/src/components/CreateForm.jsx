import { useState } from 'react'
import { apiFetch } from '../api'
import IconGallery from './IconGallery'

export default function CreateForm({ onCreated }) {
  const [name, setName] = useState('')
  const [icon, setIcon] = useState('')
  const [busy, setBusy] = useState(false)
  const [warn, setWarn] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setBusy(true); setWarn(false)
    try {
      const product = await apiFetch('/products', {
        method: 'POST',
        body: JSON.stringify({ name, icon_filename: icon }),
      })
      if (product.print_warning) setWarn(true)
      setName('')
      onCreated(product)
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="create-form" onSubmit={handleSubmit}>
      <h2>Add product</h2>
      <input
        value={name} onChange={e => setName(e.target.value)}
        placeholder="Product name" required
      />
      <IconGallery value={icon} onChange={setIcon} />
      {warn && <p className="warn">Saved, but printing failed — use Reprint.</p>}
      <button type="submit" disabled={busy || !icon}>
        {busy ? 'Saving…' : 'Add & Print'}
      </button>
    </form>
  )
}
