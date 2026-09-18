import { useT } from '../LanguageContext'

export default function LangSwitcher() {
  const { lang, setLang } = useT()
  return (
    <div className="flex items-center gap-1 text-xs">
      <button
        className={`px-1.5 py-0.5 rounded transition-colors ${lang === 'en' ? 'text-primary font-semibold' : 'text-muted-foreground hover:text-foreground'}`}
        onClick={() => setLang('en')}
      >EN</button>
      <span className="text-border">/</span>
      <button
        className={`px-1.5 py-0.5 rounded transition-colors ${lang === 'ru' ? 'text-primary font-semibold' : 'text-muted-foreground hover:text-foreground'}`}
        onClick={() => setLang('ru')}
      >RU</button>
    </div>
  )
}
