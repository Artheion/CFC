import { useTranslation } from 'react-i18next';

const LanguageSwitcher = () => {
  const { i18n } = useTranslation();

  const languages = [
    { code: 'en', name: 'EN' },
    { code: 'zh', name: '中文' },
  ];

  const changeLanguage = (langCode: string) => {
    i18n.changeLanguage(langCode);
    localStorage.setItem('language', langCode);
  };

  return (
    <div className="flex gap-2 bg-white/5 p-1">
      {languages.map((lang) => (
        <button
          key={lang.code}
          onClick={() => changeLanguage(lang.code)}
          className={`px-3 py-1.5 text-sm tracking-wide transition-all duration-300 ${
            i18n.language === lang.code
              ? 'border border-[#d03333] bg-[#d03333]/10 text-[#d03333]'
              : 'border border-transparent text-white/60 hover:bg-white/5 hover:text-white'
          }`}
        >
          {lang.name}
        </button>
      ))}
    </div>
  );
};

export default LanguageSwitcher;
