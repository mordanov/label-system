import { useState, useEffect, useCallback, useRef } from 'react'
import { apiFetch } from '../api'

const SCALE = 2
const LABEL_W = 384
const LABEL_H = 200

const DEFAULTS = {
  icon_x: 8, icon_y: 8, icon_size: 80,
  name_x: 96, name_y: 8, name_font_size: 24,
  number_x: 192, number_y: 90, number_font_size: 48,
  date_x: 8, date_y: 170, date_font_size: 18,
}

export default function LabelEditor({ onClose }) {
  const [layout, setLayout] = useState(DEFAULTS)
  const [saving, setSaving] = useState(false)
  const dragging = useRef(null)

  useEffect(() => {
    apiFetch('/label-settings').then(setLayout).catch(() => {})
  }, [])

  const startDrag = useCallback((e, xKey, yKey) => {
    e.preventDefault()
    dragging.current = {
      xKey, yKey,
      startX: e.clientX, startY: e.clientY,
      origX: layout[xKey], origY: layout[yKey],
    }
  }, [layout])

  useEffect(() => {
    const onMove = (e) => {
      if (!dragging.current) return
      const { xKey, yKey, startX, startY, origX, origY } = dragging.current
      const dx = Math.round((e.clientX - startX) / SCALE)
      const dy = Math.round((e.clientY - startY) / SCALE)
      setLayout(l => ({
        ...l,
        [xKey]: Math.max(0, Math.min(LABEL_W - 4, origX + dx)),
        [yKey]: Math.max(0, Math.min(LABEL_H - 4, origY + dy)),
      }))
    }
    const onUp = () => { dragging.current = null }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [])

  const set = (key, val) => setLayout(l => ({ ...l, [key]: val }))

  async function save() {
    setSaving(true)
    try {
      await apiFetch('/label-settings', { method: 'PUT', body: JSON.stringify(layout) })
      onClose()
    } catch (err) {
      alert(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <h2 style={{ marginBottom: 12 }}>Label Layout</h2>
      <p style={{ fontSize: 12, color: '#6b7280', marginBottom: 12 }}>
        Drag elements to reposition. Use sliders to adjust sizes.
      </p>

      {/* Preview */}
      <div style={{
        position: 'relative',
        width: LABEL_W * SCALE,
        height: LABEL_H * SCALE,
        background: 'white',
        border: '1px solid #d1d5db',
        boxShadow: '0 1px 4px #0001',
        marginBottom: 16,
        overflow: 'hidden',
        userSelect: 'none',
        cursor: 'default',
      }}>
        {/* Icon */}
        <div
          onMouseDown={e => startDrag(e, 'icon_x', 'icon_y')}
          title="Drag to move icon"
          style={{
            position: 'absolute',
            left: layout.icon_x * SCALE,
            top: layout.icon_y * SCALE,
            width: layout.icon_size * SCALE,
            height: layout.icon_size * SCALE,
            background: '#f0f9ff',
            border: '2px dashed #7dd3fc',
            borderRadius: 4,
            cursor: 'grab',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 11,
            color: '#6b7280',
          }}
        >icon</div>

        {/* Name */}
        <div
          onMouseDown={e => startDrag(e, 'name_x', 'name_y')}
          title="Drag to move name"
          style={{
            position: 'absolute',
            left: layout.name_x * SCALE,
            top: layout.name_y * SCALE,
            fontSize: layout.name_font_size * SCALE,
            lineHeight: 1,
            cursor: 'grab',
            whiteSpace: 'nowrap',
            background: '#fff7ed',
            border: '1px dashed #fed7aa',
            padding: '1px 3px',
            borderRadius: 2,
            color: '#111',
          }}
        >Product Name</div>

        {/* Number */}
        <div
          onMouseDown={e => startDrag(e, 'number_x', 'number_y')}
          title="Drag to move inventory number"
          style={{
            position: 'absolute',
            left: layout.number_x * SCALE,
            top: layout.number_y * SCALE,
            fontSize: layout.number_font_size * SCALE,
            lineHeight: 1,
            cursor: 'grab',
            whiteSpace: 'nowrap',
            background: '#f0fdf4',
            border: '1px dashed #86efac',
            padding: '1px 3px',
            borderRadius: 2,
            fontWeight: 'bold',
            color: '#111',
          }}
        >#000001</div>

        {/* Date */}
        <div
          onMouseDown={e => startDrag(e, 'date_x', 'date_y')}
          title="Drag to move date"
          style={{
            position: 'absolute',
            left: layout.date_x * SCALE,
            top: layout.date_y * SCALE,
            fontSize: layout.date_font_size * SCALE,
            lineHeight: 1,
            cursor: 'grab',
            whiteSpace: 'nowrap',
            background: '#fdf4ff',
            border: '1px dashed #e9d5ff',
            padding: '1px 3px',
            borderRadius: 2,
            color: '#111',
          }}
        >2024-01-15</div>
      </div>

      {/* Sliders */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 24px' }}>
        <Slider label="Icon size" value={layout.icon_size} min={32} max={160} onChange={v => set('icon_size', v)} />
        <Slider label="Name font" value={layout.name_font_size} min={10} max={48} onChange={v => set('name_font_size', v)} />
        <Slider label="Number font" value={layout.number_font_size} min={18} max={80} onChange={v => set('number_font_size', v)} />
        <Slider label="Date font" value={layout.date_font_size} min={8} max={32} onChange={v => set('date_font_size', v)} />
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
        <button className="btn-secondary" onClick={() => setLayout(DEFAULTS)}>Reset</button>
        <button className="btn-primary" onClick={save} disabled={saving}>
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </div>
  )
}

function Slider({ label, value, min, max, onChange }) {
  return (
    <label style={{ fontSize: 13, display: 'block' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
        <span>{label}</span>
        <span style={{ color: '#6b7280' }}>{value}px</span>
      </div>
      <input
        type="range" min={min} max={max} value={value}
        onChange={e => onChange(Number(e.target.value))}
        style={{ width: '100%' }}
      />
    </label>
  )
}
