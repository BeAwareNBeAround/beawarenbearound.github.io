import { expect, test } from 'vitest';
import { APP_LOCALES, activateLocale, i18n } from './setup';

test('starts in Traditional Chinese', () => {
  expect(i18n.locale).toBe('zh-HK');
});

test('maps selector labels for every supported locale', () => {
  expect(APP_LOCALES['zh-HK'].selectorLabel).toBe('繁體');
  expect(APP_LOCALES['zh-CN'].selectorLabel).toBe('简体');
  expect(APP_LOCALES.en.selectorLabel).toBe('EN');
});

test('activates a supported local catalog', () => {
  activateLocale('en');

  expect(i18n.locale).toBe('en');
});
