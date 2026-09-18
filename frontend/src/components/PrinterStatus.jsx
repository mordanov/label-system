import { useState, useEffect } from 'react'
import { apiFetch } from '../api'

export default function PrinterStatus() {
  const [status, setStatus] = useState(null)

  useEffect(() => {
    function poll() {
      apiFetch('/printer-status')
        .then(s => setStatus(s))
        .catch(() => setStatus({ connected: false }))
    }
    poll()
    const id = setInterval(poll, 5 * 60 * 1000)
    return () => clearInterval(id)
  }, [])

  if (!status) return null

  const bat = status.battery_pct ?? null
  const temp = status.head_temp_c ?? null
  const titleParts = []
  if (status.connected) {
    titleParts.push('Printer ready')
    if (bat != null) titleParts.push(`Battery: ${bat}%`)
    if (temp != null) titleParts.push(`Head: ${temp}°C`)
  } else {
    titleParts.push(status.error || 'Printer offline')
  }

  return (
    <span
      className="flex items-center gap-1 text-xs text-muted-foreground"
      title={titleParts.join(' · ')}
    >
      <span className={`size-2 rounded-full shrink-0 ${status.connected ? 'bg-green-600' : 'bg-red-600'}`} />
      {bat != null && `${bat}%`}
    </span>
  )
}
