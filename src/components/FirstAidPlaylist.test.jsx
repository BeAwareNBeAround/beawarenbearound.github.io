import { fireEvent, render, screen, within } from '@testing-library/react';
import { expect, test, vi } from 'vitest';
import { I18nProvider } from '@lingui/react';
import { FirstAidPlaylist } from './FirstAidPlaylist';
import { activateLocale, i18n } from '../i18n/setup';

const TRACKS = [
  { id: 1, label: 'STAY', instruction: 'Stay calm and time the seizure.' },
  { id: 2, label: 'SAFE', instruction: 'Observe and keep the person safe. Clear hard objects and cushion their head.' },
  { id: 3, label: 'SIDE', instruction: 'Gently roll the person onto their side. Never put anything in their mouth.' },
  { id: 4, label: 'HELP', instruction: 'Seek help. Stay with them until fully conscious, and call an ambulance if over 5 minutes.' },
];

// Plain stub of the usePlaylistPlayer contract. Tests mutate fields through
// rerenderWith and assert exact command calls; the real hook is never used.
function createStubPlayer(overrides = {}) {
  return {
    selectedId: null,
    phase: 'idle',
    currentTime: 0,
    duration: NaN,
    repeatMode: 'off',
    playbackRate: 1,
    volume: 1,
    muted: false,
    selectTrack: vi.fn(),
    togglePlayback: vi.fn(),
    previous: vi.fn(),
    next: vi.fn(),
    seek: vi.fn(),
    setRepeatMode: vi.fn(),
    setPlaybackRate: vi.fn(),
    setVolume: vi.fn(),
    setMuted: vi.fn(),
    ...overrides,
  };
}

function renderPlaylist({ locale = 'en', tracks = TRACKS, player = createStubPlayer(), onSelectTrack = vi.fn(), volumeSupported } = {}) {
  activateLocale(locale);
  const view = render(
    <I18nProvider i18n={i18n}>
      <FirstAidPlaylist tracks={tracks} player={player} onSelectTrack={onSelectTrack} volumeSupported={volumeSupported} />
    </I18nProvider>,
  );
  const rerenderWith = (overrides = {}) => {
    view.rerender(
      <I18nProvider i18n={i18n}>
        <FirstAidPlaylist tracks={tracks} player={{ ...player, ...overrides }} onSelectTrack={onSelectTrack} volumeSupported={volumeSupported} />
      </I18nProvider>,
    );
  };
  return { ...view, player, onSelectTrack, rerenderWith };
}

const getRow = (label) => {
  const track = TRACKS.find((candidate) => candidate.label === label);
  return screen.getByRole('button', { name: `${track.label} ${track.instruction}` });
};

// jsdom does not synthesize clicks from Enter/Space, so keyboard activation is
// locked in by requiring native <button> rows (Enter/Space activate natively).
test('renders four rows with full instructions as native, keyboard-activatable buttons without nested controls', () => {
  renderPlaylist();

  for (const track of TRACKS) {
    const row = getRow(track.label);
    expect(row).toBeInTheDocument();
    expect(row.tagName).toBe('BUTTON');
    expect(within(row).queryAllByRole('button')).toHaveLength(0);
    expect(within(row).queryAllByRole('slider')).toHaveLength(0);
    expect(within(row).getByText(track.instruction)).toBeInTheDocument();
  }
});

test('activating each row calls onSelectTrack exactly once with that id and never a player command', () => {
  const { onSelectTrack, player } = renderPlaylist();

  TRACKS.forEach((track, index) => {
    fireEvent.click(getRow(track.label));
    expect(onSelectTrack).toHaveBeenCalledTimes(index + 1);
    expect(onSelectTrack).toHaveBeenLastCalledWith(track.id);
  });

  expect(player.selectTrack).not.toHaveBeenCalled();
  expect(player.togglePlayback).not.toHaveBeenCalled();
  expect(player.previous).not.toHaveBeenCalled();
  expect(player.next).not.toHaveBeenCalled();
});

test('marks only the selected row with a distinct selected marker', () => {
  renderPlaylist({ player: createStubPlayer({ selectedId: 2 }) });

  expect(getRow('SAFE')).toHaveAttribute('aria-pressed', 'true');
  for (const label of ['STAY', 'SIDE', 'HELP']) {
    expect(getRow(label)).toHaveAttribute('aria-pressed', 'false');
  }
});

test('selection uses background and semantics without adding checkmarks or playing badges in any phase', () => {
  const { rerenderWith } = renderPlaylist({ player: createStubPlayer({ selectedId: 2, phase: 'playing' }) });

  for (const phase of ['playing', 'loading', 'paused', 'ended', 'error', 'idle']) {
    rerenderWith({ phase });
    for (const track of TRACKS) {
      expect(getRow(track.label).querySelector('.playlist-playing-badge')).toBeNull();
      expect(getRow(track.label).querySelector('.playlist-selected-mark')).toBeNull();
    }
    expect(getRow('SAFE')).toHaveAttribute('aria-pressed', 'true');
    expect(getRow('SAFE')).toHaveClass('selected');
  }
});

test('the play button reflects the phase and calls togglePlayback', () => {
  const { player, rerenderWith } = renderPlaylist();

  expect(screen.getByRole('button', { name: 'Play' }).textContent).toBe('');
  expect(screen.getByRole('button', { name: 'Play' }).querySelector('svg[aria-hidden="true"]')).not.toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Play' }));
  expect(player.togglePlayback).toHaveBeenCalledTimes(1);

  rerenderWith({ phase: 'playing' });
  expect(screen.getByRole('button', { name: 'Pause' }).textContent).toBe('');
  fireEvent.click(screen.getByRole('button', { name: 'Pause' }));
  expect(player.togglePlayback).toHaveBeenCalledTimes(2);
});

test('compact controls omit previous and next regardless of selection', () => {
  const { rerenderWith } = renderPlaylist();
  for (const selectedId of [null, 1, 2, 4]) {
    rerenderWith({ selectedId });
    expect(screen.queryByRole('button', { name: 'Previous' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Next' })).not.toBeInTheDocument();
  }
});

test.each([
  ['en', 'Settings', 'Play all once'],
  ['zh-HK', '播放設定', '全部播放一次'],
  ['zh-CN', '播放设置', '全部播放一次'],
])('play all once is localized and selectable in %s', (locale, settings, label) => {
  const { player, rerenderWith } = renderPlaylist({ locale });
  fireEvent.click(screen.getByRole('button', { name: settings }));
  const choice = screen.getByRole('button', { name: label });
  expect(choice).toHaveAttribute('aria-pressed', 'false');
  fireEvent.click(choice);
  expect(player.setRepeatMode).toHaveBeenCalledWith('once');
  rerenderWith({ repeatMode: 'once' });
  expect(choice).toHaveAttribute('aria-pressed', 'true');
});

test('seeking is disabled while the duration is unknown and never renders NaN or Infinity', () => {
  const { container, player } = renderPlaylist({ player: createStubPlayer({ duration: NaN }) });

  const seekSlider = screen.getByRole('slider', { name: 'Playback position' });
  expect(seekSlider).toBeDisabled();
  expect(container.textContent).not.toContain('NaN');
  expect(container.textContent).not.toContain('Infinity');

  fireEvent.change(seekSlider, { target: { value: '5' } });
  expect(player.seek).not.toHaveBeenCalled();
});

test('seeking with a known duration calls seek with the slider value and shows both times', () => {
  const { player } = renderPlaylist({ player: createStubPlayer({ duration: 30, currentTime: 7 }) });

  const seekSlider = screen.getByRole('slider', { name: 'Playback position' });
  expect(seekSlider).toBeEnabled();
  expect(seekSlider).toHaveAttribute('max', '30');
  expect(seekSlider).toHaveValue('7');
  expect(screen.getByText('0:07')).toBeInTheDocument();
  expect(screen.getByText('0:30')).toBeInTheDocument();

  fireEvent.change(seekSlider, { target: { value: '12' } });
  expect(player.seek).toHaveBeenCalledTimes(1);
  expect(player.seek).toHaveBeenCalledWith(12);
});

test('the volume slider and mute button call setVolume/setMuted with exact values', () => {
  const { player } = renderPlaylist({ player: createStubPlayer({ volume: 0.4 }) });

  const volumeSlider = screen.getByRole('slider', { name: 'Volume' });
  expect(volumeSlider).toHaveValue('0.4');
  fireEvent.change(volumeSlider, { target: { value: '0.5' } });
  expect(player.setVolume).toHaveBeenCalledTimes(1);
  expect(player.setVolume).toHaveBeenCalledWith(0.5);

  fireEvent.click(screen.getByRole('button', { name: 'Mute' }));
  expect(player.setMuted).toHaveBeenCalledTimes(1);
  expect(player.setMuted).toHaveBeenCalledWith(true);
});

test('the mute button offers unmute while muted', () => {
  const { player } = renderPlaylist({ player: createStubPlayer({ muted: true }) });

  fireEvent.click(screen.getByRole('button', { name: 'Unmute' }));
  expect(player.setMuted).toHaveBeenCalledTimes(1);
  expect(player.setMuted).toHaveBeenCalledWith(false);
});

test('settings exposes speed and repeat choices, defaulting to 1x and repeat off', () => {
  renderPlaylist();

  fireEvent.click(screen.getByRole('button', { name: 'Settings' }));

  const speedGroup = screen.getByRole('group', { name: 'Speed' });
  for (const label of ['Speed 0.75×', 'Speed 1×', 'Speed 1.25×', 'Speed 1.5×']) {
    expect(within(speedGroup).getByRole('button', { name: label })).toBeInTheDocument();
  }
  expect(within(speedGroup).getByRole('button', { name: 'Speed 1×' })).toHaveAttribute('aria-pressed', 'true');
  expect(within(speedGroup).getByRole('button', { name: 'Speed 0.75×' })).toHaveAttribute('aria-pressed', 'false');

  const repeatGroup = screen.getByRole('group', { name: 'Repeat' });
  for (const label of ['Repeat off', 'Repeat all', 'Repeat one']) {
    expect(within(repeatGroup).getByRole('button', { name: label })).toBeInTheDocument();
  }
  expect(within(repeatGroup).getByRole('button', { name: 'Repeat off' })).toHaveAttribute('aria-pressed', 'true');
});

test('choosing a speed or repeat mode calls the exact command and updates the pressed state', () => {
  const { player, rerenderWith } = renderPlaylist();

  fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
  fireEvent.click(within(screen.getByRole('group', { name: 'Speed' })).getByRole('button', { name: 'Speed 1.25×' }));
  expect(player.setPlaybackRate).toHaveBeenCalledTimes(1);
  expect(player.setPlaybackRate).toHaveBeenCalledWith(1.25);

  const repeatGroup = screen.getByRole('group', { name: 'Repeat' });
  fireEvent.click(within(repeatGroup).getByRole('button', { name: 'Repeat one' }));
  expect(player.setRepeatMode).toHaveBeenCalledTimes(1);
  expect(player.setRepeatMode).toHaveBeenCalledWith('one');

  // The panel stays open so several settings can be adjusted together.
  rerenderWith({ playbackRate: 1.25, repeatMode: 'one' });
  const speedGroup = screen.getByRole('group', { name: 'Speed' });
  expect(within(speedGroup).getByRole('button', { name: 'Speed 1×' })).toHaveAttribute('aria-pressed', 'false');
  expect(within(speedGroup).getByRole('button', { name: 'Speed 1.25×' })).toHaveAttribute('aria-pressed', 'true');
  expect(within(repeatGroup).getByRole('button', { name: 'Repeat off' })).toHaveAttribute('aria-pressed', 'false');
  expect(within(repeatGroup).getByRole('button', { name: 'Repeat one' })).toHaveAttribute('aria-pressed', 'true');
});

test('Escape closes the settings panel and returns focus to the settings toggle', () => {
  renderPlaylist();

  const toggle = screen.getByRole('button', { name: 'Settings' });
  fireEvent.click(toggle);
  expect(screen.getByRole('group', { name: 'Settings' })).toBeInTheDocument();

  fireEvent.keyDown(document, { key: 'Escape' });

  expect(screen.queryByRole('group', { name: 'Settings' })).not.toBeInTheDocument();
  expect(toggle).toHaveFocus();
});

test('a pointer down outside the settings panel closes it', () => {
  renderPlaylist();

  fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
  expect(screen.getByRole('group', { name: 'Settings' })).toBeInTheDocument();

  fireEvent.pointerDown(document.body);

  expect(screen.queryByRole('group', { name: 'Settings' })).not.toBeInTheDocument();
});

test('loading and error states surface an inline status and never a modal', () => {
  const { container, rerenderWith } = renderPlaylist();

  rerenderWith({ phase: 'loading' });
  const cardStatus = container.querySelector('.playlist-status');
  expect(screen.getByText('Loading…')).toBeInTheDocument();
  // The embedding page's .status live region is the single announcement
  // path; the card line stays visually present but must not announce again.
  expect(cardStatus).not.toHaveAttribute('role', 'status');
  expect(cardStatus).not.toHaveAttribute('aria-live');

  rerenderWith({ phase: 'error' });
  expect(screen.getByText('Playback failed. Press play to try again.')).toBeInTheDocument();
  expect(container.querySelector('dialog')).toBeNull();

  rerenderWith({ phase: 'idle' });
  expect(screen.queryByText('Loading…')).not.toBeInTheDocument();
  expect(screen.queryByText('Playback failed. Press play to try again.')).not.toBeInTheDocument();
});

test('unsupported device volume falls back to guidance instead of pretending to adjust', () => {
  const originalUserAgent = window.navigator.userAgent;
  Object.defineProperty(window.navigator, 'userAgent', {
    value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    configurable: true,
  });
  try {
    const { player } = renderPlaylist();

    expect(screen.queryByRole('slider', { name: 'Volume' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Mute' })).not.toBeInTheDocument();
    expect(screen.getByText("Use your device's volume buttons to adjust the volume.")).toBeInTheDocument();
    expect(player.setVolume).not.toHaveBeenCalled();
    expect(player.setMuted).not.toHaveBeenCalled();
  } finally {
    Object.defineProperty(window.navigator, 'userAgent', { value: originalUserAgent, configurable: true });
  }
});

test('an explicit volumeSupported=false forces the fallback without any platform sniffing', () => {
  const { player } = renderPlaylist({ volumeSupported: false });

  expect(screen.queryByRole('slider', { name: 'Volume' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Mute' })).not.toBeInTheDocument();
  expect(screen.getByText("Use your device's volume buttons to adjust the volume.")).toBeInTheDocument();
  expect(player.setVolume).not.toHaveBeenCalled();
  expect(player.setMuted).not.toHaveBeenCalled();
});

test('an explicit volumeSupported=true overrides the restricted-platform heuristic', () => {
  const originalUserAgent = window.navigator.userAgent;
  Object.defineProperty(window.navigator, 'userAgent', {
    value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    configurable: true,
  });
  try {
    const { player } = renderPlaylist({ volumeSupported: true });

    expect(screen.getByRole('slider', { name: 'Volume' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Mute' })).toBeInTheDocument();
    expect(screen.queryByText("Use your device's volume buttons to adjust the volume.")).not.toBeInTheDocument();
    expect(player.setVolume).not.toHaveBeenCalled();
    expect(player.setMuted).not.toHaveBeenCalled();
  } finally {
    Object.defineProperty(window.navigator, 'userAgent', { value: originalUserAgent, configurable: true });
  }
});

test('control labels, loading, and repeat choices are translated in zh-HK', () => {
  renderPlaylist({ locale: 'zh-HK', player: createStubPlayer({ phase: 'loading' }) });

  // While loading, the play button offers pause.
  expect(screen.getByRole('button', { name: '暫停' })).toBeInTheDocument();
  expect(screen.getByRole('slider', { name: '播放位置' })).toBeInTheDocument();
  expect(screen.getByRole('slider', { name: '音量' })).toBeInTheDocument();
  expect(screen.getByText('載入中…')).toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: '播放設定' }));
  const speedGroup = screen.getByRole('group', { name: '速度' });
  expect(within(speedGroup).getByRole('button', { name: '速度 0.75×' })).toBeInTheDocument();
  const repeatGroup = screen.getByRole('group', { name: '重複播放' });
  expect(within(repeatGroup).getByRole('button', { name: '不重複' })).toBeInTheDocument();
  expect(within(repeatGroup).getByRole('button', { name: '全部重複' })).toBeInTheDocument();
  expect(within(repeatGroup).getByRole('button', { name: '單曲重複' })).toBeInTheDocument();
});

test('control labels, pause, and error are translated in zh-CN', () => {
  const { rerenderWith } = renderPlaylist({ locale: 'zh-CN' });

  expect(screen.getByRole('button', { name: '播放' })).toBeInTheDocument();

  rerenderWith({ phase: 'playing' });
  expect(screen.getByRole('button', { name: '暂停' })).toBeInTheDocument();

  rerenderWith({ phase: 'error' });
  expect(screen.getByText('播放失败，请按播放重试。')).toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: '播放设置' }));
  expect(within(screen.getByRole('group', { name: '速度' })).getByRole('button', { name: '速度 1×' })).toBeInTheDocument();
});
