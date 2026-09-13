import { useEffect, useState } from 'react'
import { apiFetch } from '../api'

export default function IconGallery({ value, onChange }) {
  const [icons, setIcons] = useState([])

  useEffect(() => {
    apiFetch('/icons').then(list => {
      setIcons(list.map(i => i.filename))
      if (!value && list.length) onChange(list[0].filename)
    })
  }, [])

  return (
    <div className="icon-gallery">
      {icons.map(filename => (
        <button
          key={filename}
          type="button"
          className={`icon-btn${value === filename ? ' selected' : ''}`}
          onClick={() => onChange(filename)}
        >
          <img src={`/api/icons/${filename}`} alt={filename} width={48} height={48} />
        </button>
      ))}
    </div>
  )
}
