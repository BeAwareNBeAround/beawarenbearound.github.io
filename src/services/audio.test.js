import { expect, test } from 'vitest';
import { getActionAudioSource } from './audio';

test('getActionAudioSource resolves the exact recording path for every action and locale', () => {
  const expectedNames = { 1: 'track1', 2: 'track2', 3: 'track3', 4: 'track4' };

  for (const [id, name] of Object.entries(expectedNames)) {
    for (const locale of ['zh-HK', 'zh-CN', 'en']) {
      expect(getActionAudioSource(Number(id), locale)).toBe(`./resources/${name}-${locale}.mp3`);
    }
  }

  // Asset names are generic track ids, independent of any slogan wording.
  expect(getActionAudioSource(2, 'en')).toBe('./resources/track2-en.mp3');
});

test('getActionAudioSource returns null for unknown ids without creating media', () => {
  for (const invalidId of [0, 5, -1]) {
    expect(getActionAudioSource(invalidId, 'en')).toBeNull();
  }

  expect(window.MockAudioInstances).toHaveLength(0);
});
