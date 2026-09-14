import { useEffect, useRef, useState } from 'react'
import { apiFetch } from '../api'
import { useT } from '../LanguageContext'

export default function SearchBar({ value, onChange }) {
  const { t } = useT()
  const [names, setNames] = useState([])
  const [suggestions, setSuggestions] = useState([])
  const [open, setOpen] = useState(false)
  const wrapRef = useRef(null)

  useEffect(() => {
    apiFetch('/products/names').then(setNames).catch(() => {})
  }, [])

  useEffect(() => {
    if (!value.trim()) { setSuggestions([]); setOpen(false); return }
    const q = value.toLowerCase()
    const matches = names.filter(n => n.toLowerCase().includes(q) && n.toLowerCase() !== q)
    setSuggestions(matches.slice(0, 8))
    setOpen(matches.length > 0)
  }, [value, names])

  useEffect(() => {
    function onClickOutside(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  function pick(name) {
    onChange(name)
    setOpen(false)
  }

  return (
    <div className="search-bar" ref={wrapRef} style={{ position: 'relative' }}>
      <input
        value={value}
        onChange={e => onChange(e.target.value)}
        onFocus={() => suggestions.length > 0 && setOpen(true)}
        placeholder={t('searchPlaceholder')}
        autoComplete="off"
      />
      {open && (
        <ul className="search-suggestions">
          {suggestions.map(name => (
            <li key={name} onMouseDown={() => pick(name)}>{name}</li>
          ))}
        </ul>
      )}
    </div>
  )
}
