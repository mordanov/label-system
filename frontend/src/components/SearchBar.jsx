import { useT } from '../LanguageContext'

export default function SearchBar({ value, onChange }) {
  const { t } = useT()
  return (
    <div className="search-bar">
      <input
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={t('searchPlaceholder')}
      />
    </div>
  )
}
