import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { copy, type Copy, type Lang } from "./i18n";

const LangContext = createContext<{ lang: Lang; setLang: (lang: Lang) => void; t: Copy } | null>(null);

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => (localStorage.getItem("basel-lang") === "en" ? "en" : "de"));
  const setLang = (next: Lang) => {
    localStorage.setItem("basel-lang", next);
    setLangState(next);
  };
  useEffect(() => {
    document.documentElement.lang = lang === "en" ? "en" : "de";
  }, [lang]);
  return <LangContext.Provider value={{ lang, setLang, t: copy[lang] }}>{children}</LangContext.Provider>;
}

export function useI18n() {
  const value = useContext(LangContext);
  if (!value) throw new Error("lang");
  return value;
}
