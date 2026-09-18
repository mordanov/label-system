import { useState, useEffect, useCallback, useRef } from 'react'
import { apiFetch } from '../api'
import { useT } from '../LanguageContext'
import { Button } from '@/components/ui/button'

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
  const { t } = useT()
  const [layout, setLayout] = useState(null)
  const [saving, setSaving] = useState(false)
  const dragging = useRef(null)

  useEffect(() => {
    apiFetch('/label-settings').then(setLayout).catch(() => setLayout(DEFAULTS))
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

  if (!layout) return <div className="p-8 text-center text-muted-foreground">Loading…</div>

  return (
    <div className="p-6">
      <h2 className="font-semibold text-base mb-1">{t('labelSettingsTitle')}</h2>
      <p className="text-xs text-muted-foreground mb-4">{t('labelSettingsHint')}</p>

      <div className="overflow-x-auto mb-4">
        <div style={{
          position: 'relative',
          width: LABEL_W * SCALE,
          height: LABEL_H * SCALE,
          background: 'white',
          border: '1px solid #d1d5db',
          boxShadow: '0 1px 4px #0001',
          overflow: 'hidden',
          userSelect: 'none',
          cursor: 'default',
        }}>
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
      </div>

      <div className="grid grid-cols-2 gap-x-6 gap-y-3 mb-4">
        <Slider label={t('labelIconSize')} value={layout.icon_size} min={32} max={160} onChange={v => set('icon_size', v)} />
        <Slider label={t('labelNameFont')} value={layout.name_font_size} min={10} max={48} onChange={v => set('name_font_size', v)} />
        <Slider label={t('labelNumberFont')} value={layout.number_font_size} min={18} max={80} onChange={v => set('number_font_size', v)} />
        <Slider label={t('labelDateFont')} value={layout.date_font_size} min={8} max={32} onChange={v => set('date_font_size', v)} />
      </div>

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={() => setLayout(DEFAULTS)}>{t('labelReset')}</Button>
        <Button onClick={save} disabled={saving}>
          {saving ? t('labelSaving') : t('labelSave')}
        </Button>
      </div>
    </div>
  )
}

function Slider({ label, value, min, max, onChange }) {
  return (
    <label className="block text-sm">
      <div className="flex justify-between mb-0.5">
        <span>{label}</span>
        <span className="text-muted-foreground">{value}px</span>
      </div>
      <input
        type="range" min={min} max={max} value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="w-full accent-primary"
      />
    </label>
  )
}
