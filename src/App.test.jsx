import { fireEvent, render, screen } from '@testing-library/react';
import { expect, test, vi } from 'vitest';
import { I18nProvider } from '@lingui/react';
import App from './App';
import { activateLocale, i18n } from './i18n/setup';

vi.mock('./hooks/useToyRecordings', () => ({
  useToyRecordings: () => ({
    cleanup: vi.fn(),
    enable: vi.fn().mockResolvedValue(true),
    play: vi.fn().mockReturnValue(false),
    record: vi.fn().mockReturnValue('started'),
    recordingId: null,
  }),
}));

function stubCounter(initialTotal = 12544) {
  let total = initialTotal;
  const requests = [];
  const stub = vi.fn(async (input, init = {}) => {
    const url = String(input);
    expect(url).toMatch(/^https:\/\/epilepsy\.org\.hk\/counter\//);
    const method = (init.method || 'GET').toUpperCase();
    const body = init.body ? JSON.parse(init.body) : null;
    requests.push({ url, method, body });
    if (method === 'POST' && body && body.action === 'click') {
      total += 1;
    }
    return {
      ok: true,
      status: 200,
      json: async () => ({ status: 'success', metrics: { total_views: total, unique_views: total } }),
    };
  });
  vi.stubGlobal('fetch', stub);
  return { requests };
}

function renderApp(locale = 'zh-HK') {
  const counter = stubCounter();
  activateLocale(locale);
  return { counter, ...render(<I18nProvider i18n={i18n}><App /></I18nProvider>) };
}

test('renders the application heading', () => {
  renderApp();

  expect(screen.getByRole('heading', { name: "Be Aware n' Be Around" })).toBeInTheDocument();
});

test('switches the visible action labels to English', async () => {
  const { counter } = renderApp();

  fireEvent.click(screen.getByRole('button', { name: 'EN' }));

  expect(await screen.findByText('Global Clicks:')).toBeInTheDocument();
  expect(await screen.findByText('12,544')).toBeInTheDocument();
  expect(counter.requests.some((request) => request.method === 'GET' && request.url.includes('action=click'))).toBe(true);
  expect(screen.getByRole('link', { name: '🔗 Learn more about Epilepsy Foundation HK' })).toBeInTheDocument();
});

test('switches expanded setup, guidance, FAQ, and footer content between languages', () => {
  renderApp();

  fireEvent.click(screen.getByText('📲 安裝及使用指南 ▼'));
  fireEvent.click(screen.getByText("💡 什麼是 Be Aware n' Be Around? ▼"));
  fireEvent.click(screen.getByText('❓ 常見問題 (FAQ) ▼'));

  expect(screen.getByRole('heading', { name: '如何安裝至手機' })).toBeInTheDocument();
  expect(screen.getByText('保持鎮定，記錄抽搐開始及持續的時間。')).toBeInTheDocument();
  expect(screen.getByText('留意發作時間，陪伴患者安全復原。')).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'Q1: 為什麼教育模式沒有聲音？' })).toBeInTheDocument();
  expect(screen.getByText('計數器顯示所有用戶按過應用程式動作掣的總次數。')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: '🔗 了解更多 Epilepsy Foundation HK' })).toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: 'EN' }));

  expect(screen.getByRole('heading', { name: 'How to Install' })).toBeInTheDocument();
  expect(screen.getByText('Stay calm and time the seizure.')).toBeInTheDocument();
  expect(screen.getByText('Be Aware of the time. Be Around for the safe recovery.')).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'Q1: Why is text-to-speech not working?' })).toBeInTheDocument();
  expect(screen.getByText("The counter shows the total number of times the app's action buttons have been clicked, across all users.")).toBeInTheDocument();
  expect(screen.getByRole('link', { name: '🔗 Learn more about Epilepsy Foundation HK' })).toBeInTheDocument();
});

test('renders the Traditional Chinese education status with its action identifier', async () => {
  const speak = vi.spyOn(window.speechSynthesis, 'speak').mockImplementation(() => {});
  vi.spyOn(window.speechSynthesis, 'cancel').mockImplementation(() => {});
  const { counter } = renderApp('en');

  expect(await screen.findByText('12,544')).toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: '繁體' }));

  fireEvent.click(screen.getByRole('button', { name: '守' }));

  const clickPost = counter.requests.find((request) => request.method === 'POST' && request.body && request.body.action === 'click');
  expect(clickPost).toBeDefined();
  expect(clickPost.body.action).toBe('click');
  expect(clickPost.body.action_target).toBe('1');
  expect(speak).toHaveBeenCalledOnce();
  expect(screen.getByText('播放教育步驟 1...')).toBeInTheDocument();
  expect(await screen.findByText('12,545')).toBeInTheDocument();
});

test('tracks the action click in Toy mode', async () => {
  const { counter } = renderApp('en');

  fireEvent.change(screen.getByRole('combobox'), { target: { value: 'toy' } });
  fireEvent.click(screen.getByRole('button', { name: 'STAY' }));

  const clickPost = counter.requests.find((request) => request.method === 'POST' && request.body && request.body.action === 'click');
  expect(clickPost).toBeDefined();
  expect(clickPost.body.action).toBe('click');
  expect(clickPost.body.action_target).toBe('1');
  expect(await screen.findByText('12,545')).toBeInTheDocument();
});

test('renders the English education status with its action identifier', () => {
  vi.spyOn(window.speechSynthesis, 'speak').mockImplementation(() => {});
  vi.spyOn(window.speechSynthesis, 'cancel').mockImplementation(() => {});
  renderApp();

  fireEvent.click(screen.getByRole('button', { name: 'EN' }));

  fireEvent.click(screen.getByRole('button', { name: 'STAY' }));

  expect(screen.getByText('Playing education step 1...')).toBeInTheDocument();
});

test('renders the translated recording status with its action identifier', async () => {
  renderApp('en');

  fireEvent.change(screen.getByRole('combobox'), { target: { value: 'toy' } });
  fireEvent.click(screen.getByRole('button', { name: 'Record Mode: OFF' }));
  await screen.findByRole('button', { name: 'Record Mode: ON (Click a button)' });
  fireEvent.click(screen.getByRole('button', { name: 'STAY' }));

  expect(await screen.findByText('Recording on button 1... (Max 60s)')).toBeInTheDocument();
});
