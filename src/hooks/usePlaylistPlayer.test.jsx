import { StrictMode } from 'react';
import { act, renderHook } from '@testing-library/react';
import { expect, test } from 'vitest';
import { usePlaylistPlayer } from './usePlaylistPlayer';

function renderPlayer(locale = 'zh-HK', options = {}) {
  return renderHook(({ locale: hookLocale }) => usePlaylistPlayer({ locale: hookLocale }), {
    initialProps: { locale },
    ...options,
  });
}

const latestAudio = () => window.MockAudioInstances.at(-1);

// Selects a track and runs the media lifecycle far enough to report playing.
function selectAndPlay(result, id) {
  act(() => result.current.selectTrack(id));
  const audio = latestAudio();
  act(() => audio.emit('playing'));
  return audio;
}

test('starts idle with no selection, no audio element, and default settings', () => {
  const { result } = renderPlayer();

  expect(result.current.selectedId).toBeNull();
  expect(result.current.phase).toBe('idle');
  expect(result.current.currentTime).toBe(0);
  expect(result.current.duration).toBeNaN();
  expect(result.current.repeatMode).toBe('off');
  expect(result.current.playbackRate).toBe(1);
  expect(result.current.volume).toBe(1);
  expect(result.current.muted).toBe(false);
  expect(window.MockAudioInstances).toHaveLength(0);
});

test('creates one audio element lazily and reuses it for every command', () => {
  const { result } = renderPlayer();

  act(() => { result.current.togglePlayback(); });
  expect(window.MockAudioInstances).toHaveLength(1);

  act(() => { result.current.selectTrack(3); });
  expect(window.MockAudioInstances).toHaveLength(1);
  expect(latestAudio()).toBe(window.MockAudioInstances[0]);
});

test('first play with no selection starts track 1', () => {
  const { result } = renderPlayer();

  act(() => { result.current.togglePlayback(); });

  expect(result.current.selectedId).toBe(1);
  expect(result.current.phase).toBe('loading');
  expect(latestAudio().src).toBe('./resources/stay-zh-HK.mp3');
});

test('selecting a track pauses the old playback and restarts from zero', () => {
  const { result } = renderPlayer();
  const audio = selectAndPlay(result, 1);
  act(() => { audio.currentTime = 4; audio.emit('timeupdate'); });
  expect(result.current.currentTime).toBe(4);
  const pauseCallsBefore = audio.pause.mock.calls.length;

  act(() => { result.current.selectTrack(2); });

  expect(audio.pause).toHaveBeenCalledTimes(pauseCallsBefore + 1);
  expect(result.current.selectedId).toBe(2);
  expect(result.current.currentTime).toBe(0);
  expect(audio.currentTime).toBe(0);
  expect(audio.src).toBe('./resources/save-zh-HK.mp3');
  expect(result.current.phase).toBe('loading');
});

test('selecting the playing track restarts it from zero', () => {
  const { result } = renderPlayer();
  const audio = selectAndPlay(result, 2);
  act(() => { audio.currentTime = 6; audio.emit('timeupdate'); });
  const playCallsBefore = audio.play.mock.calls.length;

  act(() => { result.current.selectTrack(2); });

  expect(audio.play).toHaveBeenCalledTimes(playCallsBefore + 1);
  expect(result.current.currentTime).toBe(0);
  expect(result.current.phase).toBe('loading');
});

test('selecting the paused track restarts playback from zero', () => {
  const { result } = renderPlayer();
  const audio = selectAndPlay(result, 2);
  act(() => { result.current.togglePlayback(); });
  expect(result.current.phase).toBe('paused');
  const playCallsBefore = audio.play.mock.calls.length;

  act(() => { result.current.selectTrack(2); });

  expect(audio.play).toHaveBeenCalledTimes(playCallsBefore + 1);
  expect(result.current.phase).toBe('loading');
  expect(result.current.currentTime).toBe(0);
});

test('pause and resume preserve the playback position without reloading the source', () => {
  const { result } = renderPlayer();
  const audio = selectAndPlay(result, 1);
  act(() => { audio.currentTime = 7; audio.emit('timeupdate'); });

  act(() => { result.current.togglePlayback(); });
  expect(result.current.phase).toBe('paused');

  act(() => { result.current.togglePlayback(); });
  expect(result.current.phase).toBe('loading');
  expect(result.current.currentTime).toBe(7);
  expect(audio.currentTime).toBe(7);
  expect(audio.src).toBe('./resources/stay-zh-HK.mp3');

  act(() => { audio.emit('playing'); });
  expect(result.current.phase).toBe('playing');
});

test('progress derives from media events', () => {
  const { result } = renderPlayer();
  const audio = selectAndPlay(result, 4);

  act(() => { audio.currentTime = 2.5; audio.emit('timeupdate'); });
  expect(result.current.currentTime).toBe(2.5);

  act(() => { audio.currentTime = 9; audio.emit('timeupdate'); });
  expect(result.current.currentTime).toBe(9);
});

test('repeat off keeps the selected id and stops when the track ends', () => {
  const { result } = renderPlayer();
  const audio = selectAndPlay(result, 2);

  act(() => { audio.emit('ended'); });

  expect(result.current.selectedId).toBe(2);
  expect(result.current.phase).toBe('ended');
  expect(audio.play).toHaveBeenCalledTimes(1);
});

test('repeat all advances 1→2→3→4 and wraps to 1', () => {
  const { result } = renderPlayer();
  act(() => { result.current.setRepeatMode('all'); });
  const audio = selectAndPlay(result, 1);

  for (const expectedId of [2, 3, 4, 1]) {
    act(() => { audio.emit('ended'); });
    expect(result.current.selectedId).toBe(expectedId);
    expect(result.current.phase).toBe('loading');
    act(() => { audio.emit('playing'); });
  }
});

test('repeat one restarts the same track', () => {
  const { result } = renderPlayer();
  act(() => { result.current.setRepeatMode('one'); });
  const audio = selectAndPlay(result, 3);
  const playCallsBefore = audio.play.mock.calls.length;

  act(() => { audio.emit('ended'); });

  expect(result.current.selectedId).toBe(3);
  expect(result.current.phase).toBe('loading');
  expect(result.current.currentTime).toBe(0);
  expect(audio.play).toHaveBeenCalledTimes(playCallsBefore + 1);
});

test('previous and next are no-ops without a selection', () => {
  const { result } = renderPlayer();

  act(() => { result.current.next(); });
  act(() => { result.current.previous(); });

  expect(result.current.selectedId).toBeNull();
  expect(result.current.phase).toBe('idle');
  expect(window.MockAudioInstances).toHaveLength(0);
});

test('previous never wraps past the first track, even in repeat all', () => {
  const { result } = renderPlayer();
  act(() => { result.current.setRepeatMode('all'); });
  const audio = selectAndPlay(result, 1);
  const playCallsBefore = audio.play.mock.calls.length;

  act(() => { result.current.previous(); });

  expect(result.current.selectedId).toBe(1);
  expect(audio.play).toHaveBeenCalledTimes(playCallsBefore);
});

test('next never wraps past the last track, even in repeat all', () => {
  const { result } = renderPlayer();
  act(() => { result.current.setRepeatMode('all'); });
  const audio = selectAndPlay(result, 4);
  act(() => { audio.emit('playing'); });
  const playCallsBefore = audio.play.mock.calls.length;

  act(() => { result.current.next(); });

  expect(result.current.selectedId).toBe(4);
  expect(audio.play).toHaveBeenCalledTimes(playCallsBefore);
});

test('next while playing continues playing the neighboring track from zero', () => {
  const { result } = renderPlayer();
  const audio = selectAndPlay(result, 2);
  act(() => { audio.currentTime = 5; audio.emit('timeupdate'); });

  act(() => { result.current.next(); });

  expect(result.current.selectedId).toBe(3);
  expect(result.current.phase).toBe('loading');
  expect(result.current.currentTime).toBe(0);
  expect(audio.src).toBe('./resources/side-zh-HK.mp3');
});

test('next while paused leaves the neighboring track paused', () => {
  const { result } = renderPlayer();
  const audio = selectAndPlay(result, 2);
  act(() => { result.current.togglePlayback(); });
  const playCallsBefore = audio.play.mock.calls.length;

  act(() => { result.current.next(); });

  expect(result.current.selectedId).toBe(3);
  expect(result.current.phase).toBe('paused');
  expect(result.current.currentTime).toBe(0);
  expect(audio.play).toHaveBeenCalledTimes(playCallsBefore);
  expect(audio.src).toBe('./resources/side-zh-HK.mp3');
});

test('previous while paused moves to the neighboring track paused', () => {
  const { result } = renderPlayer();
  const audio = selectAndPlay(result, 3);
  act(() => { result.current.togglePlayback(); });
  const playCallsBefore = audio.play.mock.calls.length;

  act(() => { result.current.previous(); });

  expect(result.current.selectedId).toBe(2);
  expect(result.current.phase).toBe('paused');
  expect(result.current.currentTime).toBe(0);
  expect(audio.play).toHaveBeenCalledTimes(playCallsBefore);
});

test('selecting an unknown track id does not start media', () => {
  const { result } = renderPlayer();

  act(() => { result.current.selectTrack(99); });

  expect(result.current.selectedId).toBeNull();
  expect(result.current.phase).toBe('idle');
  expect(window.MockAudioInstances).toHaveLength(0);
});

test('a rejected pending play for an old selection cannot alter the new selection', async () => {
  const { result } = renderPlayer();

  act(() => { result.current.selectTrack(1); });
  const stalePlay = window.MockAudioInstances[0].playDeferreds[0];
  act(() => { result.current.selectTrack(2); });
  expect(result.current.selectedId).toBe(2);
  expect(result.current.phase).toBe('loading');

  await act(async () => { stalePlay.reject(new Error('interrupted')); });

  expect(result.current.selectedId).toBe(2);
  expect(result.current.phase).toBe('loading');
});

test('late events cannot advance an interrupted track', () => {
  const { result } = renderPlayer();
  act(() => { result.current.setRepeatMode('all'); });
  selectAndPlay(result, 2);

  act(() => { result.current.selectTrack(1); });
  expect(result.current.phase).toBe('loading');

  act(() => { latestAudio().emit('ended'); });

  expect(result.current.selectedId).toBe(1);
  expect(result.current.phase).toBe('loading');
});

test('pausing during loading stays paused when the pending play resolves', async () => {
  const { result } = renderPlayer();
  act(() => { result.current.selectTrack(1); });
  const audio = latestAudio();

  act(() => { result.current.togglePlayback(); });
  expect(result.current.phase).toBe('paused');

  await act(async () => { audio.resolvePlay(); });

  expect(result.current.phase).toBe('paused');
});

test('buffering clears the playing state until playback resumes', () => {
  const { result } = renderPlayer();
  const audio = selectAndPlay(result, 1);

  act(() => { audio.emit('waiting'); });
  expect(result.current.phase).toBe('loading');

  act(() => { audio.emit('playing'); });
  expect(result.current.phase).toBe('playing');
});

test('a rejected play exposes retryable error state and retry replays the selection', async () => {
  const { result } = renderPlayer();
  act(() => { result.current.selectTrack(1); });
  const audio = latestAudio();

  await act(async () => { audio.rejectPlay(new Error('blocked')); });

  expect(result.current.phase).toBe('error');
  expect(result.current.selectedId).toBe(1);
  const playCallsBefore = audio.play.mock.calls.length;

  act(() => { result.current.togglePlayback(); });

  expect(result.current.phase).toBe('loading');
  expect(audio.play).toHaveBeenCalledTimes(playCallsBefore + 1);

  await act(async () => { audio.resolvePlay(); });
  act(() => { audio.emit('playing'); });
  expect(result.current.phase).toBe('playing');
});

test('a media error event halts autoplay, retains the selection, and stays retryable', () => {
  const { result } = renderPlayer();
  act(() => { result.current.selectTrack(2); });
  const audio = latestAudio();
  const playCallsBefore = audio.play.mock.calls.length;

  act(() => { audio.emit('error'); });

  expect(result.current.phase).toBe('error');
  expect(result.current.selectedId).toBe(2);
  expect(audio.play).toHaveBeenCalledTimes(playCallsBefore);

  act(() => { result.current.togglePlayback(); });
  expect(result.current.phase).toBe('loading');
  expect(audio.play).toHaveBeenCalledTimes(playCallsBefore + 1);
});

test('duration starts unknown and seeking is ignored without a finite duration', () => {
  const { result } = renderPlayer();
  act(() => { result.current.togglePlayback(); });
  const audio = latestAudio();

  act(() => { result.current.seek(5); });

  expect(result.current.currentTime).toBe(0);
  expect(audio.currentTime).toBe(0);
});

test('finite metadata enables seeking clamped to [0, duration]', () => {
  const { result } = renderPlayer();
  const audio = selectAndPlay(result, 1);
  act(() => { audio.duration = 30; audio.emit('durationchange'); });
  expect(result.current.duration).toBe(30);

  act(() => { result.current.seek(10); });
  expect(result.current.currentTime).toBe(10);
  expect(audio.currentTime).toBe(10);

  act(() => { result.current.seek(100); });
  expect(result.current.currentTime).toBe(30);

  act(() => { result.current.seek(-5); });
  expect(result.current.currentTime).toBe(0);
});

test('non-finite durations never enable seeking', () => {
  const { result } = renderPlayer();
  const audio = selectAndPlay(result, 1);
  act(() => { audio.duration = Infinity; audio.emit('durationchange'); });

  expect(result.current.duration).toBeNaN();

  act(() => { result.current.seek(12); });

  expect(result.current.currentTime).toBe(0);
  expect(audio.currentTime).toBe(0);
});

test('locale change stops playback, resets position, and keeps selection and settings', () => {
  const { result, rerender } = renderPlayer();
  act(() => { result.current.setRepeatMode('all'); });
  const audio = selectAndPlay(result, 2);
  act(() => { audio.duration = 45; audio.emit('durationchange'); });
  act(() => { audio.currentTime = 8; audio.emit('timeupdate'); });

  rerender({ locale: 'zh-CN' });

  expect(audio.pause).toHaveBeenCalled();
  expect(result.current.phase).toBe('idle');
  expect(result.current.currentTime).toBe(0);
  expect(result.current.duration).toBeNaN();
  expect(result.current.selectedId).toBe(2);
  expect(result.current.repeatMode).toBe('all');
  expect(result.current.playbackRate).toBe(1);
});

test('play after a locale change loads the new locale recording from zero', () => {
  const { result, rerender } = renderPlayer();
  selectAndPlay(result, 2);

  rerender({ locale: 'en' });
  act(() => { result.current.togglePlayback(); });

  expect(result.current.phase).toBe('loading');
  expect(result.current.currentTime).toBe(0);
  expect(latestAudio().src).toBe('./resources/save-en.mp3');
});

test('unmount pauses playback and detaches the media listeners', () => {
  const { result, unmount } = renderPlayer();
  act(() => { result.current.setRepeatMode('all'); });
  const audio = selectAndPlay(result, 1);
  const pauseCallsBefore = audio.pause.mock.calls.length;
  const playCallsBefore = audio.play.mock.calls.length;

  unmount();

  expect(audio.pause).toHaveBeenCalledTimes(pauseCallsBefore + 1);

  act(() => { audio.emit('ended'); });
  expect(audio.play).toHaveBeenCalledTimes(playCallsBefore);
});

test('StrictMode setup and cleanup do not leak playback or duplicate the element', () => {
  const { result, unmount } = renderPlayer('zh-HK', { wrapper: StrictMode });
  const audio = selectAndPlay(result, 2);
  expect(window.MockAudioInstances).toHaveLength(1);
  const pauseCallsBefore = audio.pause.mock.calls.length;

  unmount();

  expect(audio.pause).toHaveBeenCalledTimes(pauseCallsBefore + 1);
  expect(audio.play).toHaveBeenCalledTimes(1);
});

test('settings persist across track changes and locale changes', () => {
  const { result, rerender } = renderPlayer();
  act(() => { result.current.setRepeatMode('one'); });
  act(() => { result.current.setPlaybackRate(0.75); });
  act(() => { result.current.setVolume(0.4); });
  act(() => { result.current.setMuted(true); });
  const audio = selectAndPlay(result, 3);

  expect(result.current.repeatMode).toBe('one');
  expect(result.current.playbackRate).toBe(0.75);
  expect(result.current.volume).toBe(0.4);
  expect(result.current.muted).toBe(true);
  expect(audio.playbackRate).toBe(0.75);
  expect(audio.volume).toBe(0.4);
  expect(audio.muted).toBe(true);

  rerender({ locale: 'en' });
  expect(result.current.repeatMode).toBe('one');
  expect(result.current.playbackRate).toBe(0.75);
  expect(result.current.volume).toBe(0.4);
  expect(result.current.muted).toBe(true);
});

test('playback rates accept only the advertised choices', () => {
  const { result } = renderPlayer();
  act(() => { result.current.setPlaybackRate(1.25); });
  act(() => { result.current.setPlaybackRate(2); });
  expect(result.current.playbackRate).toBe(1.25);

  act(() => { result.current.setPlaybackRate(0.75); });
  expect(result.current.playbackRate).toBe(0.75);
});

test('repeat modes accept only off, all, and one', () => {
  const { result } = renderPlayer();
  act(() => { result.current.setRepeatMode('all'); });
  act(() => { result.current.setRepeatMode('shuffle'); });
  expect(result.current.repeatMode).toBe('all');
});

test('volume is bounded to 0–1 and muting preserves the volume value', () => {
  const { result } = renderPlayer();
  act(() => { result.current.setVolume(0.3); });
  act(() => { result.current.setMuted(true); });
  expect(result.current.muted).toBe(true);
  expect(result.current.volume).toBe(0.3);

  act(() => { result.current.setVolume(5); });
  expect(result.current.volume).toBe(1);

  act(() => { result.current.setVolume(-2); });
  expect(result.current.volume).toBe(0);
});

test('remounting resets page-owned state', () => {
  const first = renderPlayer();
  act(() => { first.result.current.setVolume(0.2); });
  selectAndPlay(first.result, 2);
  first.unmount();

  const second = renderPlayer();

  expect(second.result.current.selectedId).toBeNull();
  expect(second.result.current.phase).toBe('idle');
  expect(second.result.current.currentTime).toBe(0);
  expect(second.result.current.repeatMode).toBe('off');
  expect(second.result.current.volume).toBe(1);
  expect(second.result.current.muted).toBe(false);
});

test('play after the track ended restarts it from zero', () => {
  const { result } = renderPlayer();
  const audio = selectAndPlay(result, 3);
  act(() => { audio.emit('ended'); });
  expect(result.current.phase).toBe('ended');
  const playCallsBefore = audio.play.mock.calls.length;

  act(() => { result.current.togglePlayback(); });

  expect(result.current.phase).toBe('loading');
  expect(result.current.currentTime).toBe(0);
  expect(audio.play).toHaveBeenCalledTimes(playCallsBefore + 1);
});
