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
    <span className={`printer-status ${status.connected ? 'printer-online' : 'printer-offline'}`} title={titleParts.join(' · ')}>
      <span className="status-dot" />
      {bat != null && `${bat}%`}
    </span>
  )
}
