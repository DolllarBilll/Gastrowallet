import { useLanguage } from '../context/LanguageContext';

// Toggle button switching UI copy between English (default) and German
export default function LanguageToggleButton() {
  const { lang, toggleLanguage, t } = useLanguage();

  return (
    <button
      type="button"
      onClick={toggleLanguage}
      className="gw-btn gw-btn-sm"
    >
      {lang === 'en' ? t('switchToGerman') : t('switchToEnglish')}
    </button>
  );
}