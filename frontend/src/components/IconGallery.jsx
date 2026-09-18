import { useEffect, useState } from 'react'
import { apiFetch } from '../api'
import { cn } from '@/lib/utils'

export default function IconGallery({ value, onChange }) {
  const [icons, setIcons] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    apiFetch('/icons')
      .then(list => setIcons(list.map(i => i.filename)))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <p className="text-xs text-muted-foreground">⏳ …</p>

  return (
    <div className="flex flex-nowrap overflow-x-auto gap-2 my-3 pb-1">
      <button
        type="button"
        className={cn(
          "size-14 flex items-center justify-center rounded-md border-2 shrink-0 transition-colors",
          !value
            ? "border-primary bg-primary/10 text-primary"
            : "border-border bg-background text-muted-foreground hover:border-border/70"
        )}
        onClick={() => onChange('')}
        title="No icon"
      >
        <span className="text-lg">—</span>
      </button>
      {icons.map(filename => (
        <button
          key={filename}
          type="button"
          className={cn(
            "rounded-md border-2 p-1 shrink-0 transition-colors",
            value === filename
              ? "border-primary bg-primary/10"
              : "border-border bg-background hover:border-border/70"
          )}
          onClick={() => onChange(filename)}
        >
          <img src={`/api/icons/${filename}`} alt={filename} width={48} height={48} />
        </button>
      ))}
    </div>
  )
}
