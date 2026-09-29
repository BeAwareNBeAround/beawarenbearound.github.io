import { fireEvent, render, screen, within } from '@testing-library/react';
import { expect, test, vi } from 'vitest';
import { I18nProvider } from '@lingui/react';
import App from './App';
import { activateLocale, i18n } from './i18n/setup';

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

test('renders the secondary subtitle line in each locale', () => {
  renderApp();

  expect(screen.getByText('處理急性腦癇發作的口訣')).toBeInTheDocument();
  expect(screen.getByText('點按下面 4 個按鍵了解口訣')).toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: '語言' }));
  fireEvent.click(screen.getByRole('menuitem', { name: '简体' }));
  expect(screen.getByText('点按下面 4 个按键了解口诀')).toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: '语言' }));
  fireEvent.click(screen.getByRole('menuitem', { name: 'EN' }));
  expect(screen.getByText('Tap the 4 buttons below to learn the steps')).toBeInTheDocument();
});

test('keeps the language menu closed by default', () => {
  renderApp();

  expect(screen.queryByRole('menuitem')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: '語言' })).toHaveAttribute('aria-expanded', 'false');
});

test('opens the language menu from the globe toggle', () => {
  renderApp();

  fireEvent.click(screen.getByRole('button', { name: '語言' }));

  expect(screen.getByRole('menuitem', { name: '繁體' })).toBeInTheDocument();
  expect(screen.getByRole('menuitem', { name: '简体' })).toBeInTheDocument();
  expect(screen.getByRole('menuitem', { name: 'EN' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: '語言' })).toHaveAttribute('aria-expanded', 'true');
});

test('switches the language and closes the menu when a menu item is selected', async () => {
  renderApp();

  fireEvent.click(screen.getByRole('button', { name: '語言' }));
  fireEvent.click(screen.getByRole('menuitem', { name: 'EN' }));

  expect(screen.queryByRole('menuitem')).not.toBeInTheDocument();
  expect(await screen.findByText('Global Clicks:')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Language' })).toHaveAttribute('aria-expanded', 'false');
});

test('closes the language menu on Escape', () => {
  renderApp();

  fireEvent.click(screen.getByRole('button', { name: '語言' }));
  fireEvent.keyDown(document, { key: 'Escape' });

  expect(screen.queryByRole('menuitem')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: '語言' })).toHaveAttribute('aria-expanded', 'false');
});

test('closes the language menu on a pointerdown outside the menu', () => {
  renderApp();

  fireEvent.click(screen.getByRole('button', { name: '語言' }));
  fireEvent.pointerDown(document.body);

  expect(screen.queryByRole('menuitem')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: '語言' })).toHaveAttribute('aria-expanded', 'false');
});

test('closes the language menu when the globe toggle is clicked again', () => {
  renderApp();

  fireEvent.click(screen.getByRole('button', { name: '語言' }));
  expect(screen.getByRole('menuitem', { name: 'EN' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '語言' }));

  expect(screen.queryByRole('menuitem')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: '語言' })).toHaveAttribute('aria-expanded', 'false');
});

test('keeps the language menu open on a pointerdown inside the menu', () => {
  renderApp();

  fireEvent.click(screen.getByRole('button', { name: '語言' }));
  fireEvent.pointerDown(screen.getByRole('menuitem', { name: 'EN' }));

  expect(screen.getByRole('menuitem', { name: 'EN' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: '語言' })).toHaveAttribute('aria-expanded', 'true');
});

test('marks the active locale in the language menu', () => {
  renderApp();

  fireEvent.click(screen.getByRole('button', { name: '語言' }));

  expect(screen.getByRole('menuitem', { name: '繁體' })).toHaveAttribute('aria-current', 'true');
  expect(screen.getByRole('menuitem', { name: '简体' })).not.toHaveAttribute('aria-current');
  expect(screen.getByRole('menuitem', { name: 'EN' })).not.toHaveAttribute('aria-current');
});

test('switches the visible action labels to English', async () => {
  const { counter } = renderApp();

  fireEvent.click(screen.getByRole('button', { name: '語言' }));
  fireEvent.click(screen.getByRole('menuitem', { name: 'EN' }));

  expect(await screen.findByText('Global Clicks:')).toBeInTheDocument();
  expect(await screen.findByText('12,544')).toBeInTheDocument();
  expect(counter.requests.some((request) => request.method === 'GET' && request.url.includes('action=click'))).toBe(true);
  expect(screen.getByRole('link', { name: '🔗 Learn more about Epilepsy Foundation HK' })).toBeInTheDocument();
});

test('switches the setup, guidance, FAQ, and footer content between languages', () => {
  renderApp();

  function openInfoPanel(summary) {
    fireEvent.click(screen.getByRole('button', { name: summary }));
    const dialog = screen.getByRole('dialog', { name: summary });
    expect(dialog).toHaveAttribute('open');
    return dialog;
  }

  function closeInfoPanel(dialog, closeLabel) {
    fireEvent.click(within(dialog).getByRole('button', { name: closeLabel }));
    expect(dialog).not.toHaveAttribute('open');
  }

  const setupPanel = openInfoPanel('📲 安裝及使用指南');
  expect(screen.getByRole('heading', { name: '如何安裝至手機' })).toBeInTheDocument();
  expect(screen.getByText('保持鎮定，記錄抽搐開始及持續的時間。')).toBeInTheDocument();
  closeInfoPanel(setupPanel, '關閉');
  const whatIsPanel = openInfoPanel("💡 什麼是 Be Aware n' Be Around?");
  expect(screen.getByText('留意發作時間，陪伴患者安全復原。')).toBeInTheDocument();
  closeInfoPanel(whatIsPanel, '關閉');
  const faqPanel = openInfoPanel('❓ 常見問題 (FAQ)');
  expect(screen.getByRole('heading', { name: 'Q1: 為什麼教育模式沒有聲音？' })).toBeInTheDocument();
  expect(screen.getByText('計數器顯示所有用戶按過應用程式動作按鍵的總次數。')).toBeInTheDocument();
  closeInfoPanel(faqPanel, '關閉');
  expect(screen.getByRole('link', { name: '🔗 了解更多 Epilepsy Foundation HK' })).toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: '語言' }));
  fireEvent.click(screen.getByRole('menuitem', { name: 'EN' }));

  const englishSetupPanel = openInfoPanel('📲 Setup & Guide');
  expect(screen.getByRole('heading', { name: 'How to Install' })).toBeInTheDocument();
  expect(screen.getByText('Stay calm and time the seizure.')).toBeInTheDocument();
  closeInfoPanel(englishSetupPanel, 'Close');
  const englishWhatIsPanel = openInfoPanel("💡 What is Be Aware n' Be Around?");
  expect(screen.getByText('Be Aware of the time. Be Around for the safe recovery.')).toBeInTheDocument();
  closeInfoPanel(englishWhatIsPanel, 'Close');
  const englishFaqPanel = openInfoPanel('❓ Frequently Asked Questions (FAQ)');
  expect(screen.getByRole('heading', { name: 'Q1: Why is text-to-speech not working?' })).toBeInTheDocument();
  expect(screen.getByText("The counter shows the total number of times the app's action buttons have been clicked, across all users.")).toBeInTheDocument();
  closeInfoPanel(englishFaqPanel, 'Close');
  expect(screen.getByRole('link', { name: '🔗 Learn more about Epilepsy Foundation HK' })).toBeInTheDocument();
});

test('does not describe the unreachable toy mode in the setup or FAQ panels', () => {
  renderApp();

  function openInfoPanel(summary) {
    fireEvent.click(screen.getByRole('button', { name: summary }));
    const dialog = screen.getByRole('dialog', { name: summary });
    expect(dialog).toHaveAttribute('open');
    return dialog;
  }

  function closeInfoPanel(dialog) {
    fireEvent.click(within(dialog).getByRole('button', { name: '關閉' }));
    expect(dialog).not.toHaveAttribute('open');
  }

  const setupPanel = openInfoPanel('📲 安裝及使用指南');
  expect(within(setupPanel).queryByText('玩具模式 (錄音/播放):')).not.toBeInTheDocument();
  expect(within(setupPanel).queryByText('開啟錄音模式後，點擊任何顏色按鍵錄製聲音（最長60秒），關閉後點擊按鍵即可播放。')).not.toBeInTheDocument();
  expect(within(setupPanel).getByText('點擊顏色按鍵，手機會播放該步驟的急救指示。')).toBeInTheDocument();
  closeInfoPanel(setupPanel);

  const faqPanel = openInfoPanel('❓ 常見問題 (FAQ)');
  expect(within(faqPanel).queryByRole('heading', { name: 'Q2: 玩具模式錄音失敗怎麼辦？' })).not.toBeInTheDocument();
  expect(within(faqPanel).queryByText('錄音功能需要麥克風權限。請允許瀏覽器存取麥克風，並確保裝置未處於靜音模式。')).not.toBeInTheDocument();
  expect(within(faqPanel).getByRole('heading', { name: 'Q1: 為什麼教育模式沒有聲音？' })).toBeInTheDocument();
  closeInfoPanel(faqPanel);
});

test('renders the Traditional Chinese education status with its action identifier', async () => {
  const speak = vi.spyOn(window.speechSynthesis, 'speak').mockImplementation(() => {});
  vi.spyOn(window.speechSynthesis, 'cancel').mockImplementation(() => {});
  const { counter } = renderApp('en');

  expect(await screen.findByText('12,544')).toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: 'Language' }));
  fireEvent.click(screen.getByRole('menuitem', { name: '繁體' }));

  fireEvent.click(screen.getByRole('button', { name: '守' }));

  const clickPost = counter.requests.find((request) => request.method === 'POST' && request.body && request.body.action === 'click');
  expect(clickPost).toBeDefined();
  expect(clickPost.body.action).toBe('click');
  expect(clickPost.body.action_target).toBe('1');
  expect(speak).toHaveBeenCalledOnce();
  expect(screen.getByText('播放教育步驟 1...')).toBeInTheDocument();
  expect(await screen.findByText('12,545')).toBeInTheDocument();
});

test('renders the English education status with its action identifier', () => {
  vi.spyOn(window.speechSynthesis, 'speak').mockImplementation(() => {});
  vi.spyOn(window.speechSynthesis, 'cancel').mockImplementation(() => {});
  renderApp();

  fireEvent.click(screen.getByRole('button', { name: '語言' }));
  fireEvent.click(screen.getByRole('menuitem', { name: 'EN' }));

  fireEvent.click(screen.getByRole('button', { name: 'STAY' }));

  expect(screen.getByText('Playing education step 1...')).toBeInTheDocument();
});
