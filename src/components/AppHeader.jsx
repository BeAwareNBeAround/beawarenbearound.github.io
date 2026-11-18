import { useEffect, useRef, useState } from 'react';
import { t } from '@lingui/core/macro';
import { APP_LOCALES } from '../i18n/setup';
import './AppHeader.css';

const logoUrl = 'https://epilepsy.org.hk/wp-content/uploads/elementor/thumbs/EFHK-abb-Logo-Ver-%E5%9C%93%E5%BA%95-rsi4tzw9b949vi84j6y5gkdzbj2s5xn3mit7czgz2g.png';

export function AppHeader({ language, onLanguageChange, onNavigateHome }) {
  const [langMenuOpen, setLangMenuOpen] = useState(false);
  const langMenuRef = useRef(null);

  useEffect(() => {
    if (!langMenuOpen) {
      return;
    }
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setLangMenuOpen(false);
      }
    };
    const handlePointerDown = (event) => {
      if (langMenuRef.current && !langMenuRef.current.contains(event.target)) {
        setLangMenuOpen(false);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('pointerdown', handlePointerDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('pointerdown', handlePointerDown);
    };
  }, [langMenuOpen]);

  function handleHomeClick(event) {
    if (
      event.button !== 0
      || event.metaKey
      || event.ctrlKey
      || event.shiftKey
      || event.altKey
    ) {
      return;
    }
    event.preventDefault();
    if (onNavigateHome) {
      onNavigateHome();
      return;
    }
    if (typeof window !== 'undefined' && typeof window.scrollTo === 'function') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  return (
    <header className="app-header">
      <a href="./" className="app-header-home-link" onClick={handleHomeClick}>
        <img
          src={logoUrl}
          alt={t({ id: 'organization.logoAlt', message: 'Epilepsy Foundation of Hong Kong' })}
          className="app-header-logo"
        />
        <span className="app-header-title">
          {t({ id: 'header.brandTitle', message: 'EFHK Epilepsy Toolkit' })}
        </span>
      </a>

      <div className="lang-menu" ref={langMenuRef}>
        <button
          type="button"
          className="lang-menu-toggle"
          aria-label={t({ id: 'language.selectorLabel', message: 'Language' })}
          aria-haspopup="menu"
          aria-expanded={langMenuOpen}
          onClick={() => setLangMenuOpen(!langMenuOpen)}
        >
          <svg
            aria-hidden="true"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="10" />
            <path d="M2 12h20" />
            <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
          </svg>
        </button>
        {langMenuOpen && (
          <div
            className="lang-menu-dropdown"
            role="menu"
            aria-label={t({ id: 'language.selectorLabel', message: 'Language' })}
          >
            {Object.entries(APP_LOCALES).map(([code, { selectorLabel }]) => (
              <button
                key={code}
                type="button"
                role="menuitem"
                className={`lang-menu-item ${language === code ? 'active' : ''}`}
                aria-current={language === code ? 'true' : undefined}
                onClick={() => {
                  onLanguageChange(code);
                  setLangMenuOpen(false);
                }}
              >
                {selectorLabel}
                {language === code && <span aria-hidden="true">✓</span>}
              </button>
            ))}
          </div>
        )}
      </div>
    </header>
  );
}
