export default function SearchBar({ value, onChange }) {
  return (
    <div className="search-bar">
      <input
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder="Search by name…"
      />
    </div>
  )
}
