import { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { expect, test, vi } from 'vitest';
import { I18nProvider } from '@lingui/react';
import { activateLocale, i18n } from '../i18n/setup';
import { AppHeader } from './AppHeader';

function renderHeader(initialLocale = 'zh-HK', extraProps = {}) {
  activateLocale(initialLocale);
  const onLanguageChange = vi.fn((nextLocale) => {
    activateLocale(nextLocale);
  });

  function Harness() {
    const [language, setLanguage] = useState(initialLocale);
    return (
      <I18nProvider i18n={i18n}>
        <AppHeader
          language={language}
          onLanguageChange={(nextLocale) => {
            onLanguageChange(nextLocale);
            setLanguage(nextLocale);
          }}
          {...extraProps}
        />
      </I18nProvider>
    );
  }

  return { onLanguageChange, ...render(<Harness />) };
}

test('renders the sticky app-header banner with the EFHK logo and localized brand title without a mode dropdown', () => {
  renderHeader('zh-HK');

  const banner = screen.getByRole('banner');
  expect(banner).toHaveClass('app-header');
  expect(screen.getByRole('img', { name: '香港腦癇基金會' })).toHaveClass('app-header-logo');
  expect(screen.getByText('腦癎錦囊')).toHaveClass('app-header-title');
  expect(screen.queryByText('Epilepsy Foundation of Hong Kong')).not.toBeInTheDocument();
  expect(banner.querySelector('select')).toBeNull();
});

test('renders the localized brand title in Simplified Chinese and English', () => {
  const { unmount } = renderHeader('zh-CN');
  expect(screen.getByText('脑痫锦囊')).toBeInTheDocument();
  expect(screen.getByRole('img', { name: '香港脑痫基金会' })).toBeInTheDocument();
  unmount();

  renderHeader('en');
  expect(screen.getByText('EFHK Epilepsy Toolkit')).toBeInTheDocument();
  expect(screen.getByRole('img', { name: 'Epilepsy Foundation of Hong Kong' })).toBeInTheDocument();
});

test('links the brand area to the web app Home view and prevents full-page reload on plain click while allowing modified clicks', () => {
  const onNavigateHome = vi.fn();
  renderHeader('zh-HK', { onNavigateHome });

  const homeLink = screen.getByRole('link', { name: /腦癎錦囊/ });
  expect(homeLink).toHaveAttribute('href', './');
  expect(homeLink).not.toHaveAttribute('target');

  const plainClick = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 });
  homeLink.dispatchEvent(plainClick);
  expect(plainClick.defaultPrevented).toBe(true);
  expect(onNavigateHome).toHaveBeenCalledTimes(1);

  const ctrlClick = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0, ctrlKey: true });
  homeLink.dispatchEvent(ctrlClick);
  expect(ctrlClick.defaultPrevented).toBe(false);
  expect(onNavigateHome).toHaveBeenCalledTimes(1);
});

test('scrolls smoothly to the top on plain Home link click when onNavigateHome is omitted', () => {
  const scrollToSpy = vi.spyOn(window, 'scrollTo');
  renderHeader('zh-HK');

  const homeLink = screen.getByRole('link', { name: /腦癎錦囊/ });
  fireEvent.click(homeLink);

  expect(scrollToSpy).toHaveBeenCalledWith({ top: 0, behavior: 'smooth' });
});

test('keeps the language menu closed by default and opens it from the globe toggle', () => {
  renderHeader('zh-HK');

  const toggle = screen.getByRole('button', { name: '語言' });
  expect(toggle).toHaveAttribute('aria-expanded', 'false');
  expect(screen.queryByRole('menuitem')).not.toBeInTheDocument();

  fireEvent.click(toggle);

  expect(toggle).toHaveAttribute('aria-expanded', 'true');
  expect(screen.getByRole('menuitem', { name: '繁體' })).toHaveAttribute('aria-current', 'true');
  expect(screen.getByRole('menuitem', { name: '简体' })).not.toHaveAttribute('aria-current');
  expect(screen.getByRole('menuitem', { name: 'EN' })).not.toHaveAttribute('aria-current');
});

test('switches locale, updates the brand title, and closes the menu when a language item is selected', () => {
  const { onLanguageChange } = renderHeader('zh-HK');

  fireEvent.click(screen.getByRole('button', { name: '語言' }));
  fireEvent.click(screen.getByRole('menuitem', { name: 'EN' }));

  expect(onLanguageChange).toHaveBeenCalledWith('en');
  expect(screen.queryByRole('menuitem')).not.toBeInTheDocument();
  expect(screen.getByText('EFHK Epilepsy Toolkit')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Language' })).toHaveAttribute('aria-expanded', 'false');
});

test('closes the language menu on Escape and outside pointerdown, but stays open on inside pointerdown', () => {
  renderHeader('zh-HK');

  fireEvent.click(screen.getByRole('button', { name: '語言' }));
  fireEvent.pointerDown(screen.getByRole('menuitem', { name: 'EN' }));
  expect(screen.getByRole('menuitem', { name: 'EN' })).toBeInTheDocument();

  fireEvent.keyDown(document, { key: 'Escape' });
  expect(screen.queryByRole('menuitem')).not.toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: '語言' }));
  expect(screen.getByRole('menuitem', { name: 'EN' })).toBeInTheDocument();
  fireEvent.pointerDown(document.body);
  expect(screen.queryByRole('menuitem')).not.toBeInTheDocument();
});
