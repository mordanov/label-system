import { useEffect, useRef, useState } from 'react'

export default function AutocompleteInput({ value, onChange, placeholder, required, names = [], className, style }) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef(null)

  const suggestions = value.trim()
    ? names.filter(n => n.toLowerCase().includes(value.toLowerCase()) && n.toLowerCase() !== value.toLowerCase()).slice(0, 8)
    : []

  useEffect(() => {
    setOpen(suggestions.length > 0)
  }, [value, suggestions.length])

  useEffect(() => {
    function onClickOutside(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  return (
    <div ref={wrapRef} style={{ position: 'relative', ...style }}>
      <input
        value={value}
        onChange={e => onChange(e.target.value)}
        onFocus={() => suggestions.length > 0 && setOpen(true)}
        placeholder={placeholder}
        required={required}
        className={className}
        autoComplete="off"
        style={{ width: '100%' }}
      />
      {open && (
        <ul className="search-suggestions">
          {suggestions.map(name => (
            <li key={name} onMouseDown={() => { onChange(name); setOpen(false) }}>{name}</li>
          ))}
        </ul>
      )}
    </div>
  )
}
