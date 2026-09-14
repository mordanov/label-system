import { createContext, useContext, useState, useEffect } from 'react'
import { messages } from './i18n'

const Ctx = createContext()

function detectLang() {
  try {
    const saved = localStorage.getItem('lang')
    if (saved === 'en' || saved === 'ru') return saved
  } catch {}
  return navigator.language?.startsWith('ru') ? 'ru' : 'en'
}

export function LanguageProvider({ children }) {
  const [lang, setLangState] = useState(detectLang)

  function setLang(l) {
    try { localStorage.setItem('lang', l) } catch {}
    setLangState(l)
  }

  useEffect(() => {
    document.title = messages[lang]?.title ?? 'Label System'
  }, [lang])

  function t(key, vars) {
    const str = messages[lang]?.[key] ?? messages.en[key] ?? key
    if (!vars) return str
    return str.replace(/{(\w+)}/g, (_, k) => vars[k] ?? '')
  }

  return <Ctx.Provider value={{ lang, setLang, t }}>{children}</Ctx.Provider>
}

export const useT = () => useContext(Ctx)
