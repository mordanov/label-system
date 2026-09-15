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

  const title = status.connected
    ? `Printer ready${status.battery_pct != null ? ` · Battery: ${status.battery_pct}%` : ''}${status.a1_payload_hex ? ` · A1: ${status.a1_payload_hex}` : ''}`
    : (status.error || 'Printer offline')

  return (
    <span className={`printer-status ${status.connected ? 'printer-online' : 'printer-offline'}`} title={title}>
      <span className="status-dot" />
      {status.battery_pct != null && `${status.battery_pct}%`}
    </span>
  )
}
