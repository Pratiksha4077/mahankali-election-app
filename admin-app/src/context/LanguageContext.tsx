import React, { createContext, useContext, useState } from "react";
import { translations, Language } from "../localization/translations";

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  toggleLanguage: () => void;
  t: (key: keyof typeof translations["mr"]) => string;
}

const LanguageContext = createContext<LanguageContextType>({} as LanguageContextType);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguage] = useState<Language>("mr"); // default Marathi

  const toggleLanguage = () => {
    setLanguage(prev => (prev === "mr" ? "en" : "mr"));
  };

  const t = (key: keyof typeof translations["mr"]): string => {
    const langDict = translations[language];
    return (langDict && langDict[key]) || translations["en"][key] || (key as string);
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, toggleLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => useContext(LanguageContext);
