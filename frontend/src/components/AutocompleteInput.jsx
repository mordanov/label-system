import { useEffect, useRef, useState } from 'react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

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
    <div ref={wrapRef} className="relative" style={style}>
      <Input
        value={value}
        onChange={e => onChange(e.target.value)}
        onFocus={() => suggestions.length > 0 && setOpen(true)}
        placeholder={placeholder}
        required={required}
        className={className}
        autoComplete="off"
      />
      {open && (
        <ul className="absolute top-full left-0 z-50 mt-1 min-w-[260px] max-w-[400px] rounded-md border border-border bg-background shadow-md list-none overflow-hidden">
          {suggestions.map(name => (
            <li
              key={name}
              className="px-3 py-2 text-sm cursor-pointer hover:bg-accent hover:text-accent-foreground"
              onMouseDown={() => { onChange(name); setOpen(false) }}
            >{name}</li>
          ))}
        </ul>
      )}
    </div>
  )
}
