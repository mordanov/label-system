import { useT } from '../LanguageContext'

export default function LangSwitcher() {
  const { lang, setLang } = useT()
  return (
    <div className="lang-switcher">
      <button className={lang === 'en' ? 'active' : ''} onClick={() => setLang('en')}>EN</button>
      <span>/</span>
      <button className={lang === 'ru' ? 'active' : ''} onClick={() => setLang('ru')}>RU</button>
    </div>
  )
}
