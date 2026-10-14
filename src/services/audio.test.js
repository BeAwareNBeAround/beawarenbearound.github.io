import { expect, test, beforeEach } from 'vitest';
import { playActionAudio, stopAudio, __resetAudioPlayer } from './audio';

beforeEach(() => {
  __resetAudioPlayer();
});

test('plays the recorded audio for each action id in each locale', () => {
  const cases = [
    [1, 'stay'],
    [2, 'save'],
    [3, 'side'],
    [4, 'help'],
  ];
  const locales = ['zh-HK', 'zh-CN', 'en'];

  for (const [id, name] of cases) {
    for (const locale of locales) {
      const played = playActionAudio(id, locale);

      expect(played).toBe(true);
      expect(window.MockAudioInstances.at(-1).src).toBe(`./resources/${name}-${locale}.mp3`);
    }
  }

  // One shared player element is created on first use and reused for every
  // playback (window.MockAudioInstances is reset between tests).
  expect(window.MockAudioInstances).toHaveLength(1);
  const player = window.MockAudioInstances[0];
  expect(player.play).toHaveBeenCalledTimes(cases.length * locales.length);
  expect(player.pause).toHaveBeenCalledTimes(cases.length * locales.length);
});

test('stops the ongoing playback before playing a new action', () => {
  playActionAudio(1, 'zh-HK');
  const player = window.MockAudioInstances.at(-1);
  const pauseCallsBefore = player.pause.mock.calls.length;

  const played = playActionAudio(3, 'zh-CN');

  expect(played).toBe(true);
  expect(player.pause).toHaveBeenCalledTimes(pauseCallsBefore + 1);
  expect(player.src).toBe('./resources/side-zh-CN.mp3');
});

test('stopAudio pauses the current playback', () => {
  playActionAudio(2, 'en');
  const player = window.MockAudioInstances.at(-1);
  const pauseCallsBefore = player.pause.mock.calls.length;

  stopAudio();

  expect(player.pause).toHaveBeenCalledTimes(pauseCallsBefore + 1);
});

test('returns false for an unknown action id', () => {
  expect(playActionAudio(5, 'en')).toBe(false);
  expect(window.MockAudioInstances).toHaveLength(0);
});
