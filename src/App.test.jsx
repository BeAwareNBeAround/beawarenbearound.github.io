import { StrictMode } from 'react';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { expect, test, vi } from 'vitest';
import { I18nProvider } from '@lingui/react';
import App from './App';
import { activateLocale, i18n } from './i18n/setup';

// zh-HK guide copy from the compiled catalogs; used to address the playlist
// rows (row accessible name = label + instruction).
const INSTRUCTIONS_ZH_HK = [
  '保持鎮定，記錄抽搐開始及持續的時間。',
  '觀察並保護患者。移開附近危險物品，用軟物墊著患者頭部。',
  '將患者輕輕翻側，保持呼吸道暢通。切勿強行將任何物品塞入患者口中。',
  '尋求協助。陪伴患者直至清醒，若超過五分鐘請召喚救護車。',
];

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

function renderApp(locale = 'zh-HK', Wrapper) {
  const counter = stubCounter();
  activateLocale(locale);
  const app = <I18nProvider i18n={i18n}><App /></I18nProvider>;
  return { counter, ...render(Wrapper ? <Wrapper>{app}</Wrapper> : app) };
}

// Media lifecycle events must run inside act() so React state settles before
// assertions; the hook's Audio element is the single MockAudio instance.
const audio = () => window.MockAudioInstances.at(-1);
const emit = (instance, type) => act(() => { instance.emit(type); });
const settle = (thunk) => act(async () => { thunk(); });

const upperButton = (name) => screen.getByRole('button', { name, exact: true });
// The page-level status line; the card's own .playlist-status mirrors
// loading/error copy, so phase assertions target the page line explicitly.
const statusLine = () => document.querySelector('.status');
const playlistRow = (index) => screen.getByRole('button', { name: `${['守', '望', '相', '助'][index]} ${INSTRUCTIONS_ZH_HK[index]}` });
// Locale-independent row access for after-locale-switch checks.
const playlistRowEl = (index) => document.querySelector(`.playlist-row-${index + 1}`);
const rowBadge = (index) => playlistRowEl(index).querySelector('.playlist-playing-badge');
const clickPosts = (counter) => counter.requests.filter((request) => request.method === 'POST' && request.body && request.body.action === 'click');

test('renders the application heading', () => {
  renderApp();

  expect(screen.getByRole('heading', { name: "Be Aware n' Be Around" })).toBeInTheDocument();
});

test('places the playlist guide before the video container', () => {
  renderApp();

  const guide = document.querySelector('.instruction-box');
  const playlistCard = document.querySelector('.playlist-card');
  const youtubeContainer = document.querySelector('.youtube-container');

  expect(guide).not.toBeNull();
  expect(playlistCard).not.toBeNull();
  expect(youtubeContainer).not.toBeNull();
  expect(
    guide.compareDocumentPosition(youtubeContainer) & Node.DOCUMENT_POSITION_FOLLOWING,
  ).toBeTruthy();
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
  expect(screen.getByRole('heading', { name: 'Q1: Why is there no sound in Education Mode?' })).toBeInTheDocument();
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

test('replaces the static guide paragraphs with the four-row playlist under the retained heading', () => {
  renderApp();

  expect(screen.getByRole('heading', { name: '守望相助 急救指南' })).toBeInTheDocument();
  expect(document.querySelectorAll('.instruction-box > p')).toHaveLength(0);
  for (let index = 0; index < 4; index += 1) {
    expect(playlistRow(index)).toBeInTheDocument();
  }
});

test('an upper button click selects its recording, sends exactly one counter event, and highlights only after playback actually starts', async () => {
  const { counter } = renderApp();

  fireEvent.click(upperButton('守'));

  // The request is loading: no playing highlight or success announcement yet.
  expect(audio().src).toBe('./resources/stay-zh-HK.mp3');
  expect(upperButton('守')).not.toHaveClass('playing');
  expect(rowBadge(0)).toBeNull();
  expect(screen.queryByText('播放教育步驟 1...')).not.toBeInTheDocument();

  emit(audio(), 'playing');

  expect(upperButton('守')).toHaveClass('playing');
  expect(rowBadge(0)).not.toBeNull();
  expect(playlistRow(0)).toHaveAttribute('aria-pressed', 'true');
  expect(screen.getByText('播放教育步驟 1...')).toBeInTheDocument();
  expect(await screen.findByText('12,545')).toBeInTheDocument();
  expect(clickPosts(counter)).toHaveLength(1);
  expect(clickPosts(counter)[0].body.action_target).toBe('1');
});

test('a playlist row click selects its recording, sends exactly one counter event, and highlights the matching upper button while playing', async () => {
  const { counter } = renderApp();

  fireEvent.click(playlistRow(2));

  expect(audio().src).toBe('./resources/side-zh-HK.mp3');
  expect(upperButton('相')).not.toHaveClass('playing');

  emit(audio(), 'playing');

  expect(upperButton('相')).toHaveClass('playing');
  expect(rowBadge(2)).not.toBeNull();
  expect(screen.getByText('播放教育步驟 3...')).toBeInTheDocument();
  expect(await screen.findByText('12,545')).toBeInTheDocument();
  expect(clickPosts(counter)).toHaveLength(1);
  expect(clickPosts(counter)[0].body.action_target).toBe('3');
});

test('selecting a second track pauses the first, keeps a single player, and moves both highlights', () => {
  renderApp();

  fireEvent.click(upperButton('守'));
  emit(audio(), 'playing');
  expect(upperButton('守')).toHaveClass('playing');
  const firstAudio = audio();
  const pauseCallsBefore = firstAudio.pause.mock.calls.length;

  fireEvent.click(playlistRow(1));

  expect(firstAudio.pause).toHaveBeenCalledTimes(pauseCallsBefore + 1);
  expect(window.MockAudioInstances).toHaveLength(1);
  expect(firstAudio.src).toBe('./resources/save-zh-HK.mp3');
  expect(upperButton('守')).not.toHaveClass('playing');
  expect(rowBadge(0)).toBeNull();
  expect(upperButton('望')).not.toHaveClass('playing');

  emit(firstAudio, 'playing');

  expect(upperButton('望')).toHaveClass('playing');
  expect(rowBadge(1)).not.toBeNull();
  expect(rowBadge(0)).toBeNull();
});

test('pause and end clear both playing highlights while the playlist selection remains', () => {
  renderApp();

  fireEvent.click(upperButton('守'));
  emit(audio(), 'playing');
  expect(upperButton('守')).toHaveClass('playing');

  fireEvent.click(screen.getByRole('button', { name: '暫停' }));

  expect(upperButton('守')).not.toHaveClass('playing');
  expect(rowBadge(0)).toBeNull();
  expect(playlistRow(0)).toHaveAttribute('aria-pressed', 'true');

  // Restart, then let the track end with repeat off.
  fireEvent.click(upperButton('守'));
  emit(audio(), 'playing');
  expect(upperButton('守')).toHaveClass('playing');

  emit(audio(), 'ended');

  expect(upperButton('守')).not.toHaveClass('playing');
  expect(rowBadge(0)).toBeNull();
  expect(playlistRow(0)).toHaveAttribute('aria-pressed', 'true');
  expect(screen.getByText('教育步驟已完成。')).toBeInTheDocument();
});

test('loading and failed playback show localized status without announcing playback success', async () => {
  const { counter } = renderApp();

  fireEvent.click(playlistRow(0));

  expect(statusLine()).toHaveTextContent('載入中…');
  expect(screen.queryByText('播放教育步驟 1...')).not.toBeInTheDocument();

  await settle(() => audio().rejectPlay(new Error('blocked')));

  expect(statusLine()).toHaveTextContent('播放失敗，請按播放重試。');
  expect(screen.queryByText('播放教育步驟 1...')).not.toBeInTheDocument();
  expect(upperButton('守')).not.toHaveClass('playing');
  expect(rowBadge(0)).toBeNull();
  // A failed play still counts its initiating click exactly once.
  expect(clickPosts(counter)).toHaveLength(1);
});

test('loading and error statuses are localized in English', async () => {
  renderApp();

  fireEvent.click(screen.getByRole('button', { name: '語言' }));
  fireEvent.click(screen.getByRole('menuitem', { name: 'EN' }));

  fireEvent.click(screen.getByRole('button', { name: 'SIDE', exact: true }));

  expect(statusLine()).toHaveTextContent('Loading…');

  await settle(() => audio().rejectPlay(new Error('blocked')));

  expect(statusLine()).toHaveTextContent('Playback failed. Press play to try again.');
});

test('repeat all advances from an upper-button selection and repeat one restarts a row selection, without extra counter events', async () => {
  const { counter } = renderApp();

  fireEvent.click(screen.getByRole('button', { name: /播放設定/ }));
  fireEvent.click(screen.getByRole('button', { name: '全部重複' }));
  fireEvent.click(screen.getByRole('button', { name: /播放設定/ }));

  fireEvent.click(upperButton('助'));
  emit(audio(), 'playing');
  expect(upperButton('助')).toHaveClass('playing');

  emit(audio(), 'ended');

  expect(audio().src).toBe('./resources/stay-zh-HK.mp3');
  expect(upperButton('助')).not.toHaveClass('playing');
  emit(audio(), 'playing');
  expect(upperButton('守')).toHaveClass('playing');
  expect(playlistRow(0)).toHaveAttribute('aria-pressed', 'true');

  fireEvent.click(screen.getByRole('button', { name: /播放設定/ }));
  fireEvent.click(screen.getByRole('button', { name: '單曲重複' }));

  fireEvent.click(playlistRow(1));
  emit(audio(), 'playing');

  emit(audio(), 'ended');

  expect(audio().src).toBe('./resources/save-zh-HK.mp3');
  expect(playlistRow(1)).toHaveAttribute('aria-pressed', 'true');
  emit(audio(), 'playing');
  expect(upperButton('望')).toHaveClass('playing');

  // Only the two counted selections sent click events; advancement and repeat did not.
  expect(clickPosts(counter)).toHaveLength(2);
  expect(clickPosts(counter).map((request) => request.body.action_target)).toEqual(['4', '2']);
});

test('switching language stops playback, keeps the selection, and the next play uses the new locale recording', () => {
  renderApp();

  fireEvent.click(upperButton('望'));
  emit(audio(), 'playing');
  expect(upperButton('望')).toHaveClass('playing');

  fireEvent.click(screen.getByRole('button', { name: '語言' }));
  fireEvent.click(screen.getByRole('menuitem', { name: 'EN' }));

  expect(audio().pause).toHaveBeenCalled();
  expect(upperButton('SAFE')).not.toHaveClass('playing');
  expect(rowBadge(1)).toBeNull();
  expect(playlistRowEl(1)).toHaveAttribute('aria-pressed', 'true');
  expect(screen.getByText('Education Mode: Click buttons for instructions.')).toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: 'Play' }));

  expect(audio().src).toBe('./resources/save-en.mp3');
});

test('StrictMode does not duplicate click requests or media elements', async () => {
  const { counter } = renderApp('zh-HK', StrictMode);

  fireEvent.click(upperButton('守'));
  emit(audio(), 'playing');

  expect(window.MockAudioInstances).toHaveLength(1);
  expect(upperButton('守')).toHaveClass('playing');
  expect(await screen.findByText('12,545')).toBeInTheDocument();
  expect(clickPosts(counter)).toHaveLength(1);
});

test('transport controls, settings, seeking, and Play from initial idle send no counter click events', () => {
  const { counter } = renderApp();

  // Play with no selection starts track 1 without a click event.
  fireEvent.click(screen.getByRole('button', { name: '播放' }));
  emit(audio(), 'playing');
  expect(audio().src).toBe('./resources/stay-zh-HK.mp3');

  fireEvent.click(screen.getByRole('button', { name: '下一段' }));
  emit(audio(), 'playing');
  expect(audio().src).toBe('./resources/save-zh-HK.mp3');

  fireEvent.click(screen.getByRole('button', { name: '上一段' }));

  act(() => { audio().duration = 30; audio().emit('durationchange'); });
  fireEvent.change(screen.getByRole('slider', { name: '播放位置' }), { target: { value: '5' } });
  expect(screen.getByRole('slider', { name: '播放位置' })).toHaveValue('5');

  fireEvent.click(screen.getByRole('button', { name: /播放設定/ }));
  fireEvent.click(screen.getByRole('button', { name: '不重複' }));
  fireEvent.click(screen.getByRole('button', { name: '速度 1.25×' }));

  expect(clickPosts(counter)).toHaveLength(0);
});

test('renders the English education status with its action identifier', () => {
  renderApp();

  fireEvent.click(screen.getByRole('button', { name: '語言' }));
  fireEvent.click(screen.getByRole('menuitem', { name: 'EN' }));

  fireEvent.click(screen.getByRole('button', { name: 'STAY', exact: true }));

  emit(audio(), 'playing');

  expect(audio().src).toBe('./resources/stay-en.mp3');
  expect(screen.getByText('Playing education step 1...')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'STAY', exact: true })).toHaveClass('playing');
});
